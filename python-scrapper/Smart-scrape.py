from tkinter import INSERT
import requests
import os
from dotenv import load_dotenv
from fastapi import FastAPI, BackgroundTasks
import requests
import re
import json
import asyncio
import logging
import requests
import psycopg2
import psycopg2.extras
from datetime import datetime
from bs4 import BeautifulSoup
from urllib.parse import quote_plus


load_dotenv()
S_API = os.getenv('Scrape_API')
payload = { 'api_key': {S_API} }


app = FastAPI(title="Smart Scraper API", description="An API for scraping product data and saving it to a database.", version="1.0.0")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
log = logging.getLogger(__name__)
SCRAPER_API_KEY = S_API

SPRING_WEBHOOK = os.getenv("SPRING_WEBHOOK", "http://localhost:8080/api/webhook/scrape-done")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:54943/ScrapeDb")
SCRAPERAPI_BASE = "https://api.scraperapi.com"

def get_conn():
    return psycopg2.connect(DATABASE_URL)

def save_products(products: list[dict]) -> int:
    if not products:
        return 0
    sql = """
        INSERT INTO product (search_query, name, price, product_url, image_url, reviews, platform, description, created_at)
        VALUES (%(search_query)s, %(name)s, %(price)s, %(product_url)s, %(image_url)s, %(reviews)s, %(platform)s, %(description)s, NOW())
        ON CONFLICT (product_url) DO UPDATE SET
            price = EXCLUDED.price,
            reviews = EXCLUDED.reviews,
            created_at = NOW()
        RETURNING id
    """
    count = 0
    try:
        with get_conn() as conn, conn.cursor() as cur:
            for p in products:
                try:
                    cur.execute(sql, p)
                    if cur.fetchone():
                        count += 1
                except Exception as e:
                    log.warning(f"DB insert error for {p.get('name','?')}: {e}")
                    conn.rollback()
            conn.commit()
    except Exception as e:
        log.exception(f"DB connection error: {e}")
    return count
 

def scraper_get(url: str, render: bool = False) -> requests.Response:
    params = {
        "api_key": SCRAPER_API_KEY,
        "url": url,
        "render": "true" if render else "false",
        "country_code": "in",
        "device_type": "desktop",
    }
    resp = requests.get(SCRAPERAPI_BASE, params=params, timeout=60)
    resp.raise_for_status()
    return resp

def is_relevant(name: str, query: str, threshold: float = 0.3) -> bool:
    """Check if scraped product name matches the search query."""
    if not name or name == "N/A":
        return False
    query_words = set(query.lower().split())
    name_words  = set(name.lower().split())
    # Remove common stop words
    stops = {"the", "a", "an", "for", "with", "and", "in", "of", "to", "best", "new"}
    query_words -= stops
    if not query_words:
        return True
    overlap = query_words & name_words
    score = len(overlap) / len(query_words)
    return score >= threshold


def scrape_amazon( query: str ) -> list[dict]:
    log.info(f"Scraping Amazon for: {query}")
    url = f"https://www.amazon.in/s?k={quote_plus(query)}&ref=nb_sb_noss"
    try:
       response = scraper_get(url)
       soup = BeautifulSoup(response.text, 'html.parser')
    except Exception as e:
        log.exception(f"Error scraping Amazon: {e}")
        return []


    results = []
    cards = soup.select("[data-component-type='s-search-result']")
    log.info(f"Amazon: found {len(cards)} cards")
 
    for card in cards[:8]:  
        try:
            name = "N/A"
            for sel in ["h2 a span", "span.a-size-medium", "span.a-text-normal[data-a-color]", "span.a-size-base-plus", "h2 span"]:
                el = card.select_one(sel)
                if el and el.text.strip() and len(el.text.strip()) > 3:
                    name = el.text.strip()
                    break
 
            price = "N/A"
            for sel in [".a-price .a-offscreen", ".a-price-whole", "span.a-price"]:
                el = card.select_one(sel)
                if el:
                    price = el.text.strip().split("\n")[0]
                    break
 
            link_el = card.select_one("h2 a, a.a-link-normal")
            href = link_el.get("href", "") if link_el else ""
            link = ("https://www.amazon.in" + href) if href and href.startswith("/") else href or "N/A"
 
            img_el = card.select_one("img.s-image, img[data-image-latency]")
            img = img_el.get("src", "") if img_el else ""
 

            star_el  = card.select_one(".a-icon-star-small span, .a-icon-star span")
            count_el = card.select_one("span[aria-label*='ratings'], span[aria-label*='stars']")
            stars = star_el.text.strip() if star_el else ""
            count = count_el.get("aria-label", "") if count_el else ""
            reviews = f"{stars} ({count})" if stars and count else stars or count or "N/A"
 
            desc_el = card.select_one(".a-size-base-plus, .a-size-medium, .a-color-secondary")
            desc = desc_el.text.strip() if desc_el else name
 
            if not is_relevant(name, query):
                log.info(f"Amazon: skipping irrelevant result: {name[:50]}")
                continue
 
            results.append({
                "search_query": query.lower().strip(),
                "name":         name,
                "price":        price,
                "product_url":  link,
                "image_url":    img,
                "reviews":      reviews,
                "platform":     "Amazon",
                "description":  desc,
            })
 
            if len(results) >= 5:
                break
 
        except Exception as e:
            log.warning(f"Amazon card parse error: {e}")
 
    log.info(f"Amazon: {len(results)} relevant products for '{query}'")
    return results


def scrape_flipkart(query: str) -> list[dict]:
    log.info(f"scrapping Flipkart for: {query}")
    url = f"https://www.flipkart.com/search?q={quote_plus(query)}"
    try:
        resp = scraper_get(url)
        soup = BeautifulSoup(resp.text, "html.parser")
    except Exception as e:
        log.error(f"Flipkart fetch failed: {e}")
        return []
 
    results = []
    cards = soup.select("div._1AtVbE, div.tUxRFH, div._2kHMtA")
    log.info(f"Flipkart: found {len(cards)} cards")
 
    for card in cards[:8]:
        try:
            name = "N/A"
            for sel in ["div.KzDlHZ", "a.wjcEIp", "div._4rR01T", "div.s1Q9rs", "a.s1Q9rs", "div.IRpwTa", "p.u-jN_N, span.BUOuZu"]:
                el = card.select_one(sel)
                if el and el.text.strip():
                    name = el.text.strip()
                    break
 
            price = "N/A"
            for sel in ["div.Nx9bqj", "div._30jeq3", "div.fcsOS0", "div._25b18c div._30jeq3"]:
                el = card.select_one(sel)
                if el and el.text.strip():
                    price = el.text.strip()
                    break
 
            link = "N/A"
            for sel in ["a.CGtC98", "a._1fQZEK", "a.IRpwTa", "a.s1Q9rs", "a"]:
                el = card.select_one(sel)
                if el and el.get("href"):
                    href = el["href"]
                    link = ("https://www.flipkart.com" + href) if href.startswith("/") else href
                    break
 
            img = ""
            for sel in ["img.DByuf4", "img._396cs4", "img.q6DClP"]:
                el = card.select_one(sel)
                if el:
                    img = el.get("src", "")
                    break
 
            rev_el = card.select_one("div.XQDdHH, span._2_R_DZ, div._3LWZlK")
            reviews = rev_el.text.strip() if rev_el else "N/A"

            desc_el = card.select_one("ul.G4BRas li, div._1xgFaf, div.fMghEO")
            desc = desc_el.text.strip() if desc_el else name
 
            if not is_relevant(name, query):
                log.info(f"Flipkart: skipping irrelevant: {name[:50]}")
                continue
 
            results.append({
                "search_query": query.lower().strip(),
                "name":         name,
                "price":        price,
                "product_url":  link,
                "image_url":    img,
                "reviews":      reviews,
                "platform":     "Flipkart",
                "description":  desc,
            })
 
            if len(results) >= 5:
                break
 
        except Exception as e:
            log.warning(f"Flipkart card parse error: {e}")
 
    log.info(f"Flipkart: {len(results)} relevant products for '{query}'")
    return results
 
def scrape_reliance(query: str) -> list[dict]:
    log.info(f"Scraping Reliance Digital for: {query}")
    url = f"https://www.reliancedigital.in/search?q={quote_plus(query)}"
    try:
        resp = scraper_get(url, render=True)
        soup = BeautifulSoup(resp.text, "html.parser")
    except Exception as e:
        log.exception(f"Reliance fetch failed: {e}")
        return []
 
    results = []
    cards = soup.select("div.product-grid__item, li.pl__item, div[class*='productCard']")
    log.info(f"Reliance: found {len(cards)} cards")
 
    for card in cards[:6]:
        try:
            name_el  = card.select_one("p.sp__name, span.product__title, h4, h3")
            price_el = card.select_one("span.price, span[class*='price'], strong")
            link_el  = card.select_one("a[href]")
            img_el   = card.select_one("img")
 
            name  = name_el.text.strip() if name_el else "N/A"
            price = price_el.text.strip() if price_el else "N/A"
            href  = link_el.get("href", "") if link_el else ""
            link  = ("https://www.reliancedigital.in" + href) if href.startswith("/") else href or "N/A"
            img   = img_el.get("src", img_el.get("data-src", "")) if img_el else ""
 
            if not is_relevant(name, query):
                continue
 
            results.append({
                "search_query": query.lower().strip(),
                "name":         name,
                "price":        price,
                "product_url":  link,
                "image_url":    img,
                "reviews":      "N/A",
                "platform":     "Reliance Digital",
                "description":  name,
            })
            if len(results) >= 6:
                break
        except Exception as e:
            log.warning(f"Reliance card error: {e}")
 
    log.info(f"Reliance: {len(results)} products for '{query}'")
    return results
 
def do_scrape(query: str):
    q = query.lower().strip()
    log.info(f"Starting scrape for: '{q}'")
 
    all_products = []
 
    all_products += scrape_amazon(q)
    all_products += scrape_flipkart(q)
    all_products += scrape_reliance(q)
 
    if not all_products:
        log.warning(f"No relevant products found for '{q}'")
        return
 
    log.info(f"Total relevant products before save: {len(all_products)}")
    saved = save_products(all_products)
    log.info(f"Saved {saved} products for query='{q}'")
 
    try:
        requests.post(SPRING_WEBHOOK, json={"searchQuery": q, "count": saved}, timeout=5)
    except Exception as e:
        log.warning(f"Webhook failed (non-fatal): {e}")

@app.post("/start_scrape")
async def start_scrape(query:str, bg: BackgroundTasks):
    """Called by Spring Boot to kick offasync scraping."""
    bg.add_task(do_scrape, query)
    return {"status": "processing in background", "query": query}

@app.get("/health")
def health():
    return {"status": "ok", "time": datetime.now().isoformat()}
