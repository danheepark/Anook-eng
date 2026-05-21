package com.anook.backend.frontdesk.request.application.dto.response;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 관리자 요청 상세 조회 응답 DTO
 */
public record FrontdeskRequestDetailResult(
        Long id,
        String status,
        String priority,
        String departmentId,
        String departmentName,
        Map<String, Object> entities,
        String rawText,
        String summary,
        double confidence,
        String roomNo,
        Long assignedStaffId,
        String assignedStaffName,
        int version,
        boolean cancelRequested,
        LocalDateTime cancelRequestedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        String imageUrl,
        String reasoning
) {}
