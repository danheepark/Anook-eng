package com.anook.backend.frontdesk.request.adapter.out.persistence.entity;

import com.anook.backend.frontdesk.request.domain.model.FrontdeskRequest;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 관리자용 요청 JPA 엔티티
 * — 같은 request 테이블을 바라보되, 엔티티 이름으로 분리
 */
@Entity(name = "FrontdeskRequest")
@Table(name = "request")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class FrontdeskRequestJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String status;

    @Column(nullable = false)
    private String priority;

    @Column(name = "department_id", nullable = false)
    private String departmentId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> entities;

    @Column(name = "raw_text")
    private String rawText;

    private String summary;

    private Float confidence;

    @Column(columnDefinition = "TEXT")
    private String reasoning;

    @Column(name = "room_no", nullable = false)
    private String roomNo;

    @Column(name = "assigned_staff_id")
    private Long assignedStaffId;

    @Column(name = "guest_id")
    private Long guestId;

    @Column(nullable = false)
    private Integer version;

    @Column(name = "cancel_requested", nullable = false)
    private Boolean cancelRequested = false;

    @Column(name = "cancel_requested_at")
    private LocalDateTime cancelRequestedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    // === Domain 변환 ===

    public FrontdeskRequest toDomain() {
        return new FrontdeskRequest(
                this.id,
                this.status,
                this.priority,
                this.departmentId,
                this.entities,
                this.rawText,
                this.summary,
                this.confidence != null ? this.confidence : 0.0,
                this.reasoning,
                this.roomNo,
                this.assignedStaffId,
                this.version != null ? this.version : 0,
                this.cancelRequested != null ? this.cancelRequested : false,
                this.cancelRequestedAt,
                this.createdAt,
                this.updatedAt
        );
    }

    // === 쓰기 메서드 ===

    public void updateAssignedStaff(Long staffId, String staffDepartmentId) {
        this.assignedStaffId = staffId;
        if (staffDepartmentId != null && !staffDepartmentId.isBlank()) {
            this.departmentId = staffDepartmentId;
        }
        if ("PENDING".equals(this.status)) {
            this.status = "IN_PROGRESS";
        }
        this.updatedAt = LocalDateTime.now();
    }

    public void updatePriority(String priority) {
        this.priority = priority;
        this.updatedAt = LocalDateTime.now();
    }

    public void updateSummary(String summary, String rawText) {
        this.summary = summary;
        if (rawText != null && !rawText.isBlank()) {
            this.rawText = (this.rawText != null ? this.rawText + "\n" : "") + rawText;
        }
        this.updatedAt = LocalDateTime.now();
    }

    public void changeDepartment(String departmentId) {
        this.departmentId = departmentId;
        this.assignedStaffId = null;
        if ("ASSIGNED".equals(this.status) || "IN_PROGRESS".equals(this.status)) {
            this.status = "PENDING";
        }
        this.updatedAt = LocalDateTime.now();
    }

    public void cancel() {
        this.status = "CANCELLED";
        this.updatedAt = LocalDateTime.now();
    }

    public void approveCancellation() {
        if (this.cancelRequested == null || !this.cancelRequested) {
            throw new IllegalStateException("취소 요청이 없는 상태에서 취소 승인할 수 없습니다.");
        }
        this.status = "CANCELLED";
        this.cancelRequested = false;
        this.updatedAt = LocalDateTime.now();
    }

    public void rejectCancellation() {
        if (this.cancelRequested == null || !this.cancelRequested) {
            throw new IllegalStateException("취소 요청이 없는 상태에서 취소 반려할 수 없습니다.");
        }
        this.cancelRequested = false;
        this.cancelRequestedAt = null;
        this.updatedAt = LocalDateTime.now();
    }

    public void updateStatus(String status) {
        this.status = status;
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * 에스컬레이션 요청 — 직원이 처리 불가로 판단하여 관리자 승인 대기 상태로 변경
     */
    public void requestEscalation() {
        this.status = "ESCALATED";
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * 에스컬레이션 승인 — 관리자가 부서·우선순위를 지정하여 승인
     */
    public void approveEscalation(String departmentId, String priority) {
        if (departmentId != null && !departmentId.isBlank()) {
            this.departmentId = departmentId;
        }
        this.priority = (priority != null && !priority.isBlank()) ? priority.toUpperCase() : "URGENT";
        this.status = "PENDING";
        this.assignedStaffId = null;
        this.updatedAt = LocalDateTime.now();
    }

    // === 팩토리: 관리자 수동 생성 ===

    public static FrontdeskRequestJpaEntity createManual(
            String departmentId, String roomNo, String summary,
            String rawText, String priority, Long assignedStaffId, Long guestId) {
        FrontdeskRequestJpaEntity entity = new FrontdeskRequestJpaEntity();
        entity.departmentId = departmentId;
        entity.roomNo = roomNo;
        entity.summary = summary;
        entity.rawText = rawText;
        entity.priority = (priority != null && !priority.isBlank()) ? priority.toUpperCase() : "NORMAL";
        entity.assignedStaffId = assignedStaffId;
        entity.guestId = guestId;
        entity.status = (assignedStaffId != null) ? "IN_PROGRESS" : "PENDING";
        entity.confidence = 1.0f;
        entity.version = 0;
        entity.cancelRequested = false;
        entity.createdAt = LocalDateTime.now();
        entity.updatedAt = LocalDateTime.now();
        return entity;
    }
}
