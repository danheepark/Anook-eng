package com.anook.backend.fb.application.dto.response;

public record MenuInfo(
    Long id,
    String name,
    int price,
    Double priceUsd,
    String category,
    String allergens,
    String options
) {}
