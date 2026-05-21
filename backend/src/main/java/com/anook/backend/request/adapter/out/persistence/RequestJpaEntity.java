package com.anook.backend.request.adapter.out.persistence;

import com.anook.backend.request.domain.model.*;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Request JPA Entity — request 모듈 전용
 */
@Entity
@Table(name = "request")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RequestJpaEntity {

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

    @Version
    @Column(nullable = false)
    private Integer version;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "cancel_requested", nullable = false)
    private Boolean cancelRequested = false;

    @Column(name = "cancel_requested_at")
    private LocalDateTime cancelRequestedAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private Integer rating;

    // === 팩토리 메서드: Domain → Entity ===

    public static RequestJpaEntity fromDomain(Request request) {
        RequestJpaEntity entity = new RequestJpaEntity();
        entity.id = request.getId();
        entity.status = request.getStatus().name();
        entity.priority = request.getPriority().name();
        entity.departmentId = request.getDepartmentId();
        entity.entities = request.getEntities();
        entity.rawText = request.getRawText();
        entity.summary = request.getSummary();
        entity.confidence = (float) request.getConfidence();
        entity.reasoning = request.getReasoning();
        entity.roomNo = request.getRoomNo();
        entity.guestId = request.getGuestId();
        entity.assignedStaffId = request.getAssignedStaffId();
        entity.version = request.getVersion();
        entity.cancelRequested = request.isCancelRequested();
        entity.cancelRequestedAt = request.getCancelRequestedAt();
        entity.rating = request.getRating();
        entity.createdAt = request.getCreatedAt();
        entity.updatedAt = request.getUpdatedAt();
        return entity;
    }

    // === Entity → Domain 변환 ===

    public Request toDomain() {
        return Request.reconstitute(
                this.id,
                RequestStatus.from(this.status),
                Priority.from(this.priority),
                DomainCode.from(this.departmentId),
                this.entities,
                this.confidence != null ? this.confidence : 0.0,
                this.rawText,
                this.summary,
                this.reasoning,
                this.roomNo,
                this.guestId,
                this.assignedStaffId,
                this.version,
                this.cancelRequested != null ? this.cancelRequested : false,
                this.cancelRequestedAt,
                this.rating,
                this.createdAt,
                this.updatedAt);
    }

    // === 상태 변경 ===

    public void updateStatus(String newStatus) {
        this.status = newStatus;
        this.updatedAt = LocalDateTime.now();
    }

    public void updateRating(Integer rating) {
        this.rating = rating;
        this.updatedAt = LocalDateTime.now();
    }
}
