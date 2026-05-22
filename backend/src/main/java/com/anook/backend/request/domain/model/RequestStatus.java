package com.anook.backend.request.domain.model;

/**
 * 요청 상태 Enum
 *
 * CREATED → PENDING → IN_PROGRESS → COMPLETED → SETTLED / CANCELLED
 *
 * CREATED: 요청 생성됨 (Grace Period / 고객 확인 대기 중). 아직 직원에게 알림 전.
 * PENDING: 고객 확인 완료, 직원 배정 대기 중.
 */
public enum RequestStatus {

    CREATED,
    PENDING,
    IN_PROGRESS,
    COMPLETED,
    SETTLED,
    CANCELLED,
    ESCALATED;

    /**
     * 문자열 → RequestStatus 변환 (대소문자 무시)
     */
    public static RequestStatus from(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("RequestStatus 값이 null이거나 비어있습니다.");
        }
        return valueOf(value.trim().toUpperCase());
    }
}
