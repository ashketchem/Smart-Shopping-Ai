import asyncio
import sys
import httpx
from playwright_stealth import Stealth
from fastapi import FastAPI, BackgroundTasks
from amazoncaptcha import AmazonCaptcha
from playwright.async_api import async_playwright
import tempfile
import os
import random
import json
from urllib.parse import urljoin


if sys.platform == "win32":
    try:
       asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except AttributeError:
        pass

app = FastAPI()

HEADLESS_MODE = False
SPRING_BOOT_URL = "http://localhost:8080/api/test-scrape"

async def human_click(page, selector):
    """Bypasses bot detection by clicking like a human (random offset)."""
    try:
        element = await page.wait_for_selector(selector, timeout=10000)
        box = await element.bounding_box()
        # Click at a random point within the button
        x = box['x'] + box['width'] * random.uniform(0.2, 0.8)
        y = box['y'] + box['height'] * random.uniform(0.2, 0.8)
        # Move mouse smoothly
        await page.mouse.move(x, y, steps=10)
        await page.mouse.click(x, y)
    except Exception as e:
        print(f"Human click failed: {e}")

PLATFORMS = [
   {
      "platform": "Amazon",
      "search_url": "https://www.amazon.in/s?k={}",
      "item_container": "div[data-component-type='s-search-result']",
      "link_css": "h2 a.a-link-normal",
      "name_css": "h2 a span span, #productTitle, h1 span, .a-size-large", 
      "price_css": "span.a-price .a-offscreen, span.a-price-whole",
      "reviews_css": "span[data-hook='review-body'], #customer_review-list",
    },
    {
      "platform": "Flipkart",
      "search_url": "https://www.flipkart.com/search?q={}",
      "item_container": "div[data-id]",
      "link_css": "a[href*='/p/']",
      "name_css": "span.B_NuCI, .VU-Z7G, h1.yhB1nd",
      "price_css": "div._30jeq3, ._25b18c, div.Nx9bqj",
      "reviews_css": "div.t-ZTKy"
    },
    {
      "platform": "Walmart",
      "search_url": "https://www.walmart.com/search?q={}",
      "item_container": "div[data-item-id]",
      "link_css": "a[link-identifier]",
      "name_css": "span[data-automation-id='product-title'], .e-LUYh",
      "price_css": "span[data-automation-id='product-price']",
      "reviews_css": "div.review-text"
    },
    {
      "platform": "eBay",
      "search_url": "https://www.ebay.com/sch/i.html?_nkw={}",
      "item_container": "li.s-item, li[data-item-id], .s-item, .s-item:not(.s-item__pl-on-bottom)",
      "link_css": "a.s-item__link, a.s-item__link",
      "name_css": "div.s-item__title, .x-item-title__mainTitle, .s-item__title, h1.x-item-title__mainTitle, h1.x-item-title",
      "price_css": "span.s-item__price, .x-price-primary, .s-item__price",
      "reviews_css": "p.ebay-review-section"
    },
    {
      "platform": "BestBuy",
      "search_url": "https://www.bestbuy.com/site/searchpage.jsp?st={}",
      "item_container": "li.sku-item, li.sku-item[data-sku-id]",
      "link_css": "h4.sku-header a, .sku-header a",
      "name_css": "h4.sku-header a, .sku-title h1, h1, .sku-header a",
      "price_css": "div.priceView-customer-pricing span[aria-hidden='true'], [data-testid='customer-price'] span, .priceView-customer-pricing span",
      "reviews_css": "p.review-content, .ugc-review-body"
    }
]

async def solve_amazon_captcha(page):
    #captcha solving as it is not adv fallbakc to manual if it fails
    if "captcha || verify you're human" in page.url.lower() or await page.query_selector("#captcha-img, div.a-row img, #captchacharacters"):
        print(" Amazon CAPTCHA found!")
        try:
            img_element = await page.query_selector("#captcha-img, div.a-row img")
            if img_element:
                img_url = await img_element.get_attribute("src")
                captcha = AmazonCaptcha.from_url(img_url)
                solution = captcha.solve()

                print("captcha is being solved. Please wait...")
                await page.fill('#captchacharacters', solution)
                await page.click('button[type="submit"]')
                await page.wait_load_state("domcontentloaded")

            if "captcha || verify you're human" in page.url.lower() or await page.query_selector("#captchacharacters"):
                    raise Exception("Auto-solve failed. need manual verification")
        except Exception as e:
            print(f"auto verify failed {e}, procedeing manual verification.")
            if not HEADLESS_MODE:
                print(" manual verification... ")
                await page.bring_to_front()
                try:
                    await page.wait_for_function(
                        "() => !document.querySelector('#captchacharacters')",
                        timeout=30000
                    )
                    print(" manual solve dected1")
                except: 
                    print("manual solving time limit reached.")
async def collect_reviews(page, config):
    reviews = {"bestReviews": [], "avgReviews": [], "badReviews": []}
    base_url = page.url
    filters = [
        ("bestReviews", config["filter_5star_url"]),
        ("avgReviews", config["filter_3star_url"]),
        ("badReviews", config["filter_1star_url"])
    ]

    for key, filter_suffix in filters:
        try:
            sep = "&" if "?" in base_url else "?"
            await page.goto(f"{base_url}{sep}{filter_suffix}", wait_until="domcontentloaded", timeout=45000)
            await page.wait_for_timeout(1500) #loading js content (rendering).
            elements = await page.locator(config["review_text_css"]).all()
            reviews[key] = [await element.inner_text() for element in elements[:5]]
        except:
            continue
    return reviews


async def scrape_single_site(browser_context, product_name, config):
    page = await browser_context.new_page()
    intercepted_json = []

    result_data = {
        "platformName": config['platform'],
        "error": "Initial failure"
    }

    async def handle_respone(response):
        if response.status == 200 and "json" in response.headers.get("content-type", ""):
            try:
                if any(k in response.url.lower() for k in ["search", "api", "discover", "v1/catalog"]):
                    body = await response.body()
                    if body:
                        data = await response.json()
                        intercepted_json.append(data)
            except Exception as e:
                print(f"error: {e}")

    page.on("response", handle_respone)
    try:
        url = config['search_url'].format(product_name.replace(' ', '+'))

        await page.set_extra_http_headers({"Referer": "https://www.google.com/"})
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)

        await page.mouse.wheel(0,random.randint(600,1200))
        await asyncio.sleep(2)
        await page.mouse.wheel(0,-300)

        try:
            await page.wait_for_selector(config['link_css'], state="attached", timeout=15000)
        except Exception:
            print(f"[{config['platform']}] Search results timeout. Might be blocked.")
            return {"platformName": config['platform'], "error": "Search timeout/Blocked"}
        
        links = await page.locator(config['link_css']).evaluate_all("elements => elements.map(e => e.href)")

        product_link = ""
        for link in links:
            if not any(x in link for x in ["slredirect", "adurl", "clickserve", "googleadservices"]):
                product_link = link
                break

        if not product_link and links:
            print(f"[{config['platform']}] No organic link found, trying first link available.")
            product_link = links[0]

        if not product_link:
            return {"platformName": config['platform'], "error": "No product link found"}

        print(f"[{config['platform']}] Navigating to: {product_link}")
        await page.goto(product_link, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(2)


        name = "unknow"
        price = "Check site, unable to retrive price."
        reviews = []
       
        try:
            name_node = page.locator(config['name_css']).first
            price_node = page.locator(config['price_css']).first
            if await name_node.count() > 0:
              name = await name_node.inner_text(timeout=5000)
            if await price_node.count() > 0:
              price = await price_node.inner_text(timeout=5000)


            review_locs = await page.locator(config['reviews_css']).all()
            for loc in review_locs[:15]:
                txt = await loc.inner_text()
                if len(txt) > 20: reviews.append(txt.strip().replace('\n',' '))
        except Exception as e:
            print(f"[{config['platform']}] details extraction partial fail: {e}")

        return {
            "platformName": config['platform'],
            "productName": name.strip(),
            "productPrice": price.strip(),
            "productLink": product_link,
            "reviews": reviews,
            "interceptedDataCount": len(intercepted_json)
        }
 
    except Exception as e:
            print(f"Error scraping {config['platform']}: {e}")
            print("smth wrong with json parsing... trying fallback")

            async def scrape_single_site_backup(browser_context, product_name, config):
               page = await browser_context.new_page()
               await page.set_viewport_size({"width": 1200, "height": 800})
               await page.set_extra_http_headers({
                   "Accept-Language": "en-US,en;q=0.9",
                   "Referer": "https://www.google.com/"
               })
           
               try: 
                   url = config['search_url'].format(product_name.replace(' ', '+'))
           
                   try:
                      await page.goto(url, wait_until="domcontentloaded", timeout=60000)
                   except Exception as e:
                       print(f"Navigation error/timeout for {config['platform']}: {e}")
                       return {"platformName": config['platform'], "error": str(e)}
                   
                   content = await page.content()
                   if "Access Denied" in content or "Just a moment" in content or "try proving you're not a robot" in content or "px-captcha" in content:
                       print(f"!! Blocked by {config['platform']} !!")
                       await page.screenshot(path=f"blocked_{config['platform']}.png")
                       return {"platformName": config['platform'], "error": "blocked by antibot"}
                    
           
                   if 'bestbuy' in config['platform'].lower() and "select a country" in page.content():
                       print("BestBuy dected: selectiong a contury")
                       try:
                           await page.click("a.us-link", timeout=5000)
                       except:
                           pass
                   
                   if 'walmart' in config['platform'].lower() and "human or robot" in page.content():
                       if await page.query_selector("button#px-captcha"):
                         print("Walmart Captcha Detected. Trying human click...")
                         await human_click(page, "button#px-captcha")
           
                   if config['platform'] == 'Amazon' and ("captcha" or "verify you're human" or "solve the puzzle") in content:
                       await solve_amazon_captcha(page)
                       pass
           
                   await page.mouse.wheel(0,500)
                   await asyncio.sleep(1)
                   await page.mouse.wheel(0,-300)
           
                   try:
                       await page.evaluate("window.scrollBy(0, 500)")
                       await asyncio.sleep(1)
                       await page.wait_for_selector(config['item_container'], timeout=15000)
                   except Exception:
                       print(f"{config['platform']}: no items found. check selectors. ")
                       # If we fail here, take a screenshot for debugging (check your folder!)
                       await page.screenshot(path=f"debug_{config['platform']}.png")
                       return {"platformName": config['platform'], "error": "Search results invisible/blocked"}
                   
                   container = await page.query_selector(config['item_container'])
                   if not container:
                    return {"platformName": config['platform'], "error": "container selector failed, trying genericfallback..."}
                   
                   link_element = await container.query_selector(config['link_css'])
                   if not link_element:
                       link_element = await container.query_selector("a")
                       if not link_element:
                           return {"platformName": config['platform'], "error": "link selector failed, trying genericfallback..."}
                       
           
                   if link_element:
                       raw_link = await link_element.get_attribute('href')
                       product_link = urljoin(page.url, raw_link)
                   else:
                       return {"platformName": config['platform'], "error": "no link found"}
                   
                   print(f"[{config['platform']}] Navigating to: {product_link}")
           
                   await page.goto(product_link, wait_until="domcontentloaded", timeout=60000)
                   await asyncio.sleep(2)
           
                   name = "N/A"
                   price = "N/A"
                   review_data = {"bestReviews": [], "avgReviews": [], "badReviews": []}\
                   
                   if await page.locator("button#px-captcha, iframe[src*='captcha']"):
                    print(f"[{config['platform']}] Captcha triggered on product page. Attempting bypass...")
                    await human_click(page, "button#px-captcha")
                    await page.wait_for_load_state("domcontentloaded", timeout=10000)
           
                   try:
                       name_el = await page.wait_for_selector(config['name_css'], timeout=10000)
                       name = await name_el.inner_text()
                   except:
                       print(f"{config['platform']}: Cloud not find product name.")
                       
                   try:
                       price_el = await page.wait_for_selector(config['price_css'], timeout=10000)
                       price = await price_el.inner_text()
                   except:
                       print(f"{config['platform']}: Cloud not find product price.")
           
                   try:
                       if config['reviews_css']:
                           await page.wait_for_selector(config['reviews_css'], timeout=30000)
                           review_data = await collect_reviews(page, config)
                   except:
                       print(f"{config['platform']}: Cloud not find reviews.")
           
                   return {
                       "platformName": config['platform'],
                       "productName": name.strip(),
                       "productPrice": price.strip(),
                       "productLink": product_link,
                       "reviews": review_data
                   }
               except Exception as e:
                   print(f"Error scraping {config['platform']}: {e}")
                   return {"platformName": config['platform'], "error": str(e)}
               finally:
                   await page.close()

    except Exception as e:
        print(f"Error scraping {config['platform']}: {e}")
    finally:
        await page.close()
    return result_data
   


async def run_scraper__task(product_name: str):

    stealth = Stealth()
    user_data_dir = os.path.join(tempfile.gettempdir(), 'playwright_profile')

    async with stealth.use_async(async_playwright()) as p:
        browser_content = await p.chromium.launch_persistent_context(
            user_data_dir,
            headless=HEADLESS_MODE,
            slow_mo=150,
            args=[
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-http2"
        ], ignore_default_args=["--enable-automation"], user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
     )
    
        # tasks = [scrape_single_site(browser, product_name, config) for config in PLATFORMS]
        
        results = []
        for config in PLATFORMS:
            if not browser_content.browser or not browser_content.browser.is_connected():
                print(f"Browser disconnected. Skipping {config['platform']}")
                break

            print(f"Starting scrape for {config['platform']}...")
            try:
                # IMPORTANT: await the function directly, don't pre-create tasks
                result = await scrape_single_site(browser_content, product_name, config)
                results.append(result)
            except Exception as e:
                print(f"Critical failure on {config['platform']}: {e}")
            
            await asyncio.sleep(random.uniform(2, 5)) # Randomize delay to look human


        await browser_content.close()
        
        valid_results = [ r for r in  results if 'error' not in r]
        payload = {"searchQuery": product_name, "results": valid_results}

        async with httpx.AsyncClient(verify=False) as client:
            try: 
                headers = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
                response = await client.post(SPRING_BOOT_URL, json={"results": payload}, headers=headers,timeout=40.0)
                print(f"sent {len(valid_results)} results for spring boot, status = {response.status_code} ")
            except Exception as e:
                print(f"spring boot sync failed {e}")

@app.post("/scrape/{product_name}")
async def trigger_scrape(product_name: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_scraper__task, product_name)
    return {"status": "processing in background"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

