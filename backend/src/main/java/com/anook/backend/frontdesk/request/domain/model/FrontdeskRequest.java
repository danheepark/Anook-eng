package com.anook.backend.frontdesk.request.domain.model;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * FrontdeskRequest 도메인 모델 — 관리자 관점의 요청
 *
 * request 테이블과 같은 데이터를 바라보지만,
 * 관리자 모듈의 독립적인 순수 POJO 도메인 모델입니다.
 * (request 모듈의 Request.java를 직접 import하지 않음)
 *
 * 부서명, 직원명 등 다른 모듈의 데이터는 포함하지 않습니다.
 * 조합이 필요한 경우 Service에서 별도 Port를 통해 조회 후 DTO에 매핑합니다.
 */
public class FrontdeskRequest {

    private final Long id;
    private final String status;
    private final String priority;
    private final String departmentId;
    private final Map<String, Object> entities;
    private final String rawText;
    private final String summary;
    private final double confidence;
    private final String reasoning;
    private final String roomNo;
    private final Long assignedStaffId;
    private final int version;
    private final boolean cancelRequested;
    private final LocalDateTime cancelRequestedAt;
    private final LocalDateTime createdAt;
    private final LocalDateTime updatedAt;

    public FrontdeskRequest(Long id, String status, String priority,
                        String departmentId,
                        Map<String, Object> entities, String rawText,
                        String summary, double confidence, String reasoning, String roomNo,
                        Long assignedStaffId,
                        int version, boolean cancelRequested, LocalDateTime cancelRequestedAt,
                        LocalDateTime createdAt, LocalDateTime updatedAt) {
        this.id = id;
        this.status = status;
        this.priority = priority;
        this.departmentId = departmentId;
        this.entities = entities;
        this.rawText = rawText;
        this.summary = summary;
        this.confidence = confidence;
        this.reasoning = reasoning;
        this.roomNo = roomNo;
        this.assignedStaffId = assignedStaffId;
        this.version = version;
        this.cancelRequested = cancelRequested;
        this.cancelRequestedAt = cancelRequestedAt;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    // === 행위 메서드 ===

    /**
     * 초과 시간 여부 (30분 기준)
     */
    public boolean isOverdue() {
        if ("COMPLETED".equals(status) || "SETTLED".equals(status) || "CANCELLED".equals(status)) {
            return false;
        }
        return createdAt != null && createdAt.plusMinutes(30).isBefore(LocalDateTime.now());
    }

    /**
     * 취소 가능 여부
     */
    public boolean isCancellable() {
        return !"SETTLED".equals(status) && !"CANCELLED".equals(status);
    }

    /**
     * 배정 가능 여부
     */
    public boolean isAssignable() {
        return "PENDING".equals(status);
    }

    /**
     * 에스컬레이션 가능 여부 — 직원이 처리 불가 판단 시
     */
    public boolean isEscalatable() {
        return "IN_PROGRESS".equals(status);
    }

    // === Getter ===

    public Long getId() { return id; }
    public String getStatus() { return status; }
    public String getPriority() { return priority; }
    public String getDepartmentId() { return departmentId; }
    public Map<String, Object> getEntities() { return entities; }
    public String getRawText() { return rawText; }
    public String getSummary() { return summary; }
    public double getConfidence() { return confidence; }
    public String getReasoning() { return reasoning; }
    public String getRoomNo() { return roomNo; }
    public Long getAssignedStaffId() { return assignedStaffId; }
    public int getVersion() { return version; }
    public boolean isCancelRequested() { return cancelRequested; }
    public LocalDateTime getCancelRequestedAt() { return cancelRequestedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
