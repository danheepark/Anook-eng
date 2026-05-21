package com.anook.backend.pms.domain.model;

import java.time.LocalDateTime;

/**
 * PMS 영수증 도메인 모델 (순수 POJO)
 */
public record PmsReceipt(
        Long id,
        String roomNo,
        Long menuId,
        String menuName,
        int quantity,
        int totalPrice,
        Double totalPriceUsd,
        String status,
        LocalDateTime createdAt
) {}
