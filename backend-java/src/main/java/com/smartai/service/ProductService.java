package com.smartai.service;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.smartai.entity.Product;
import com.smartai.repository.ProductRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;

    public Product save(Product product) {
        return productRepository.save(product);
    }

    public List<Product> getByQuery(String query) {
        return productRepository.findBySearchQueryIgnoreCase(query.trim());
    }

    public List<Product> searchByName(String name) {
        return productRepository.findByNameContainingIgnoreCase(name.trim());
    }

    public boolean isCached(String query) {
        return productRepository.existsBySearchQueryIgnoreCase(query.trim());
    }

    public List<Product> getAll() {
        return productRepository.findAll();
    }

    public Optional<Product> getById(long id) {
        return productRepository.findById(id);
    }

    public void deleteById(Long id) {
        productRepository.deleteById(id);
    }
}