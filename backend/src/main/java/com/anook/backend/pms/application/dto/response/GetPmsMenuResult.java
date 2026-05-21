package com.anook.backend.pms.application.dto.response;

import com.anook.backend.pms.domain.model.MenuOptionGroup;
import java.util.List;

/**
 * PMS 메뉴 조회 응답 DTO
 */
public record GetPmsMenuResult(
        Long id,
        String name,
        int price,
        Double priceUsd,
        String category,
        String allergens,
        List<MenuOptionGroup> options,
        boolean available
) {}
