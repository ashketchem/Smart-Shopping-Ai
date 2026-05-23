package com.smartai;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import com.smartai.entity.Product;
import com.smartai.service.ProductService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class ScrapeController {

    private final ProductService productService;
    private final RestTemplate restTemplate;

    private final Set<String> activeScrapes = ConcurrentHashMap.newKeySet();

    @Value("${scraper.python.url}")
    private String pythonBaseUrl;

    @GetMapping("/search")
    public ResponseEntity<?> search(@RequestParam String query) {
        String clean = query.toLowerCase().trim();
        log.info("Search request: '{}'", clean);

        if (productService.isCached(clean)) {
            List<Product> products = productService.getByQuery(clean);
            log.info("cache hit for query: '{}', returning {} products", clean, products.size());
            return ResponseEntity.ok(products);
        }

        log.info("cache miss for query: '{}', calling scraper", clean);
        activeScrapes.add(clean); 
        triggerScrape(clean);

        return ResponseEntity
                .status(HttpStatus.ACCEPTED)
                .body(Map.of("message", "Scraping initiated. Please check back in a few seconds.", "status", "searching", "query", clean));
    }

    @GetMapping("/results")
    public ResponseEntity<?> getResults(@RequestParam String query) {
        String clean = query.toLowerCase().trim();
        log.info("Results request: '{}'", clean);
        
        List<Product> products = productService.getByQuery(clean);


        if (!products.isEmpty()) {
            log.info("Returning {} products for query: '{}'", products.size(), clean);
            return ResponseEntity.ok(products);
        }

        if (activeScrapes.contains(clean)) {
            return ResponseEntity
                    .status(HttpStatus.ACCEPTED)
                    .body(Map.of("status", "pending", "query", clean));
        }

        log.info("No results found for query: '{}'", clean);
        return ResponseEntity.ok(Map.of(
                "message", "No relevant results found on retail platforms.",
                "status", "not_found",
                "query", clean,
                "products", List.of()
        ));
    }

    @PostMapping("/webhook/scrape-done")
    public ResponseEntity<Void> scrapeDone(@RequestBody Map<String, Object> payload) {
        log.info("python scraper completed webhook received: {}", payload);
        
        if (payload.containsKey("searchQuery")) {
            String finishedQuery = ((String) payload.get("searchQuery")).toLowerCase().trim();
            activeScrapes.remove(finishedQuery);
        }
        
        return ResponseEntity.ok().build();
    }

    @GetMapping("/products")
    public List<Product> allProducts() {
        return productService.getAll();
    }

    @GetMapping("/products/{id}")
    public ResponseEntity<Product> getProduct(@PathVariable Long id) {
        return productService.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/products/{id}")
    public ResponseEntity<Void> deleteProduct(@PathVariable Long id) {
        productService.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private void triggerScrape(String query) {
        try {
            String url = pythonBaseUrl + "/start_scrape?query=" + query;
            restTemplate.postForEntity(url, null, String.class);
            log.info("Scrape triggered for query: '{}'", query);
        } catch (Exception e) {
            log.error("Failed to trigger scrape for query: '{}', '{}'", query, e.getMessage());
            activeScrapes.remove(query); // Remove if connection completely fails
        }
    }
}