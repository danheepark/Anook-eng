package com.anook.backend.pms.domain.model;

import java.util.List;

/**
 * PMS 메뉴 도메인 모델 (순수 POJO)
 */
public record PmsMenu(
        Long id,
        String name,
        int price,
        Double priceUsd,
        String category,
        String allergens,
        List<MenuOptionGroup> options,
        boolean available
) {}
