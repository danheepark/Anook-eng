package com.anook.backend.knowledge.adapter.out.persistence;

import com.anook.backend.knowledge.domain.model.DomainCode;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * knowledge_entry 테이블 JPA 엔티티
 *
 * created_at / updated_at은 schema.sql의 DEFAULT NOW()에 의해 DB가 자동 설정.
 * 업데이트 시에는 PersistenceAdapter에서 명시적으로 updatedAt을 세팅한다.
 */
@Entity
@Table(name = "knowledge_entry")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class KnowledgeJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String question;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String answer;

    @Enumerated(EnumType.STRING)
    @Column(name = "domain_code", length = 20)
    private DomainCode domainCode;

    @Column(length = 20, nullable = false)
    private String status;

    @Column(name = "approved_by")
    private Long approvedBy;

    @Column(name = "room_no", length = 10)
    private String roomNo;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false)
    private LocalDateTime updatedAt;

    public KnowledgeJpaEntity(Long id, String question, String answer, DomainCode domainCode, String status, Long approvedBy, String roomNo) {
        this.id = id;
        this.question = question;
        this.answer = answer;
        this.domainCode = domainCode;
        this.status = status;
        this.approvedBy = approvedBy;
        this.roomNo = roomNo;
    }

    public void updateFields(String question, String answer, DomainCode domainCode, String status) {
        this.question = question;
        this.answer = answer;
        this.domainCode = domainCode;
        if (status != null) {
            this.status = status;
        }
        this.updatedAt = java.time.LocalDateTime.now();
    }
}
