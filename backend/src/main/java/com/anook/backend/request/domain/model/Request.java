package com.anook.backend.request.domain.model;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Request 도메인 모델 — 순수 POJO Aggregate Root
 *
 * JPA, Spring 등 프레임워크 의존 없음.
 * 행위 메서드를 통해 상태 변경 (빈혈 도메인 방지).
 */
public class Request {

    private Long id;
    private RequestStatus status;
    private Priority priority;
    private DomainCode domainCode;
    private Map<String, Object> entities;
    private double confidence;
    private String rawText;
    private String summary;
    private String reasoning;
    private String roomNo;
    private Long guestId;
    private Long assignedStaffId;
    private int version;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private boolean cancelRequested;
    private LocalDateTime cancelRequestedAt;
    private Integer rating;

    // === 생성자 (팩토리 메서드 + 재구성용) ===

    private Request() {}

    /**
     * 신규 Request 생성 (이벤트 수신 시)
     */
    public static Request create(String roomNo,
                                  Long guestId,
                                  DomainCode domainCode,
                                  String priority,
                                  Map<String, Object> entities,
                                  double confidence,
                                  String rawText,
                                  String summary,
                                  String reasoning) {
        Request request = new Request();
        request.roomNo = roomNo;
        request.guestId = guestId;
        request.domainCode = domainCode;
        request.status = RequestStatus.PENDING;
        request.priority = Priority.from(priority);
        request.entities = entities;
        request.confidence = confidence;
        request.rawText = rawText;
        request.summary = summary;
        request.reasoning = reasoning;
        request.version = 0;
        request.cancelRequested = false;
        request.createdAt = LocalDateTime.now();
        request.updatedAt = LocalDateTime.now();
        return request;
    }

    /**
     * DB에서 재구성할 때 사용 (PersistenceAdapter → Domain 변환)
     */
    public static Request reconstitute(Long id,
                                        RequestStatus status,
                                        Priority priority,
                                        DomainCode domainCode,
                                        Map<String, Object> entities,
                                        double confidence,
                                        String rawText,
                                        String summary,
                                        String reasoning,
                                        String roomNo,
                                        Long guestId,
                                        Long assignedStaffId,
                                        int version,
                                        boolean cancelRequested,
                                        LocalDateTime cancelRequestedAt,
                                        Integer rating,
                                        LocalDateTime createdAt,
                                        LocalDateTime updatedAt) {
        Request request = new Request();
        request.id = id;
        request.status = status;
        request.priority = priority;
        request.domainCode = domainCode;
        request.entities = entities;
        request.confidence = confidence;
        request.rawText = rawText;
        request.summary = summary;
        request.reasoning = reasoning;
        request.roomNo = roomNo;
        request.guestId = guestId;
        request.assignedStaffId = assignedStaffId;
        request.version = version;
        request.cancelRequested = cancelRequested;
        request.cancelRequestedAt = cancelRequestedAt;
        request.rating = rating;
        request.createdAt = createdAt;
        request.updatedAt = updatedAt;
        return request;
    }

    // === 행위 메서드 ===

    /**
     * 상태 변경 — 유효한 전이만 허용
     */
    public void changeStatus(RequestStatus newStatus) {
        validateTransition(this.status, newStatus);
        this.status = newStatus;
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * 에스컬레이션 (AI 확신도 부족 시)
     */
    public void escalate(String reason) {
        this.priority = Priority.URGENT;
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * 긴급 상황 마킹 — priority URGENT + 즉시 ESCALATED 상태로 전환
     * (화재·의료·위협 키워드 감지 시 Pre-Filter에서 호출)
     */
    public void markEmergency(String category) {
        this.priority = Priority.URGENT;
        this.status = RequestStatus.ESCALATED;
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * 직원 배정
     */
    public void assignStaff(Long staffId) {
        this.assignedStaffId = staffId;
        if (this.status == RequestStatus.PENDING || this.status == RequestStatus.ESCALATED) {
            this.status = RequestStatus.IN_PROGRESS;
        }
        this.updatedAt = LocalDateTime.now();
    }

    public void transferDepartment(DomainCode newDomainCode, String reason) {
        this.domainCode = newDomainCode;
        this.assignedStaffId = null;
        this.status = RequestStatus.ESCALATED;
        if (reason != null && !reason.isBlank()) {
            this.rawText = this.rawText + "\n|||TRANSFER_REASON|||" + reason;
        }
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * 고객의 취소 요청 — IN_PROGRESS 상태에서만 가능
     */
    public void requestCancellation() {
        if (this.status != RequestStatus.IN_PROGRESS) {
            throw new IllegalStateException("IN_PROGRESS 상태에서만 취소 요청이 가능합니다: " + this.status);
        }
        this.cancelRequested = true;
        this.cancelRequestedAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * 스태프/어드민의 취소 승인 — cancelRequested가 true일 때만 가능
     */
    public void approveCancellation() {
        if (!this.cancelRequested) {
            throw new IllegalStateException("취소 요청이 없는 상태에서 취소 승인할 수 없습니다.");
        }
        this.status = RequestStatus.CANCELLED;
        this.cancelRequested = false;
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * 스태프/어드민의 취소 반려 — cancelRequested가 true일 때만 가능
     */
    public void rejectCancellation() {
        if (!this.cancelRequested) {
            throw new IllegalStateException("취소 요청이 없는 상태에서 취소 반려할 수 없습니다.");
        }
        this.cancelRequested = false;
        this.cancelRequestedAt = null;
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * 고객 피드백 별점 등록 (1~5)
     */
    public void rate(int rating) {
        if (rating < 1 || rating > 5) {
            throw new IllegalArgumentException("별점은 1~5 사이여야 합니다: " + rating);
        }
        this.rating = rating;
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * 초과 시간 여부 (30분 기준)
     */
    public boolean isOverdue() {
        if (status == RequestStatus.COMPLETED || status == RequestStatus.SETTLED || status == RequestStatus.CANCELLED) {
            return false;
        }
        return createdAt != null && createdAt.plusMinutes(30).isBefore(LocalDateTime.now());
    }

    // === 상태 전이 검증 ===

    private void validateTransition(RequestStatus from, RequestStatus to) {
        boolean valid = switch (to) {
            case IN_PROGRESS -> from == RequestStatus.PENDING || from == RequestStatus.ESCALATED;
            case COMPLETED -> from == RequestStatus.IN_PROGRESS;
            case SETTLED -> from == RequestStatus.COMPLETED;
            case CANCELLED -> from != RequestStatus.SETTLED && from != RequestStatus.CANCELLED;
            case ESCALATED -> from == RequestStatus.PENDING || from == RequestStatus.IN_PROGRESS;
            default -> false;
        };
        if (!valid) {
            throw new IllegalStateException(
                    String.format("상태 전환 불가: %s → %s", from, to));
        }
    }

    // === Getter ===

    public Long getId() { return id; }
    public RequestStatus getStatus() { return status; }
    public Priority getPriority() { return priority; }
    public DomainCode getDomainCode() { return domainCode; }
    public Map<String, Object> getEntities() { return entities; }
    public double getConfidence() { return confidence; }
    public String getRawText() { return rawText; }
    public String getSummary() { return summary; }
    public String getReasoning() { return reasoning; }
    public String getRoomNo() { return roomNo; }
    public Long getGuestId() { return guestId; }
    public Long getAssignedStaffId() { return assignedStaffId; }
    public int getVersion() { return version; }
    public boolean isCancelRequested() { return cancelRequested; }
    public LocalDateTime getCancelRequestedAt() { return cancelRequestedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public Integer getRating() { return rating; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    /**
     * department 테이블의 ID로 변환 (domainCode → deptId)
     */
    public String getDepartmentId() {
        return domainCode != null ? domainCode.getDeptId() : null;
    }
}
