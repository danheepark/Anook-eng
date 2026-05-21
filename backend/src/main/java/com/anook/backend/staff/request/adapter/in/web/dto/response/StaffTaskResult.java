package com.anook.backend.staff.request.adapter.in.web.dto.response;

import java.time.LocalDateTime;

public record StaffTaskResult(
        Long id,
        String status,
        String priority,
        String departmentId,
        String summary,
        String rawText,
        String roomNumber,
        Long assignedStaffId,
        Float confidence,
        LocalDateTime createdAt,
        Integer version,
        boolean cancelRequested,
        LocalDateTime cancelRequestedAt,
        java.util.Map<String, Object> entities,
        String imageUrl,
        String reasoning
) {}
