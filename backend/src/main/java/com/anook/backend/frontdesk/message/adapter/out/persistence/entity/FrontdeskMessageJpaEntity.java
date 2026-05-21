package com.anook.backend.frontdesk.message.adapter.out.persistence.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 관리자용 메시지 JPA Entity (읽기 전용)
 *
 * message 테이블에 매핑하되, admin/message 모듈에서 독립적으로 관리.
 * 다른 모듈(message)의 JPA Entity를 import하지 않음.
 */
@Entity(name = "FrontdeskMessage")
@Table(name = "message")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class FrontdeskMessageJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sender_type", nullable = false, length = 10)
    private String senderType;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "translated_content", columnDefinition = "TEXT")
    private String translatedContent;

    @Column(name = "room_no", nullable = false, length = 10)
    private String roomNo;

    @Column(name = "request_id")
    private Long requestId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "guest_id")
    private Long guestId;

    // === 팩토리 메서드: 관리자/직원 메시지 생성 ===

    public static FrontdeskMessageJpaEntity createStaffMessage(String roomNo, String content) {
        FrontdeskMessageJpaEntity entity = new FrontdeskMessageJpaEntity();
        entity.senderType = "STAFF";
        entity.content = content;
        entity.roomNo = roomNo;
        entity.createdAt = LocalDateTime.now();
        return entity;
    }
}
