package com.anook.backend.frontdesk.request.application.dto.response;

import java.util.Map;

/**
 * 대시보드 통계 응답 DTO
 */
public record FrontdeskRequestStatsResult(
        long total,
        Map<String, Long> byStatus,
        Map<String, Long> byDepartment,
        Map<String, Long> byPriority,
        Map<String, Long> frequentRequests,
        long overdueCount,
        double avgResolutionTimeMins,
        double resolutionRatePct,
        double customerSatisfaction,
        String totalChange,
        String avgResolutionTimeChange,
        String resolutionRateChange,
        String customerSatisfactionChange
) {}
