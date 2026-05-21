package com.anook.backend.pms.application.dto.response;

import java.time.LocalDateTime;

/**
 * PMS 영수증 조회 응답 DTO
 */
public record GetPmsReceiptResult(
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
