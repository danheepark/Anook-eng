package com.anook.backend.admin.request.application.dto.response;

import java.time.LocalDateTime;

/**
 * 관리자 요청 목록 조회 응답 DTO
 */
public record AdminRequestListResult(
        Long id,
        String status,
        String priority,
        String departmentId,
        String departmentName,
        String summary,
        String rawText,
        String roomNo,
        Long assignedStaffId,
        String assignedStaffName,
        boolean cancelRequested,
        LocalDateTime cancelRequestedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        Integer version
) {}
