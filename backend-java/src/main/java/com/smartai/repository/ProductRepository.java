package com.smartai.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.smartai.entity.Product;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {

    List<Product> findBySearchQueryIgnoreCase(String searchQuery);

    List<Product> findByNameContainingIgnoreCase(String name);

    boolean existsBySearchQueryIgnoreCase(String searchQuery);

    Optional<Product> findFirstBySearchQueryIgnoreCase(String searchQuery);
}