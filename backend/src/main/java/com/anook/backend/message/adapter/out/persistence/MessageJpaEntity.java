package com.anook.backend.message.adapter.out.persistence;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 메시지 JPA Entity
 *
 * DB 테이블: message (schema.sql L85~93)
 *
 * ⚠️ 이 클래스는 adapter/out/persistence/ 밖으로 절대 노출하지 않는다.
 * ⚠️ Port(Out)에서 JPA Entity 반환 금지 → 반드시 Domain 모델로 변환 후 반환
 */
@Entity
@Table(name = "message")
@Getter
@NoArgsConstructor
public class MessageJpaEntity {

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

    @Column(name = "guest_id")
    private Long guestId;

    @Column(name = "sentiment", length = 10)
    private String sentiment;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    // ── 정적 팩토리: Domain → Entity ──

    public static MessageJpaEntity fromDomain(com.anook.backend.message.domain.model.Message domain) {
        MessageJpaEntity entity = new MessageJpaEntity();
        entity.id = domain.getId();
        entity.senderType = domain.getSenderType().name();
        entity.content = domain.getContent();
        entity.translatedContent = domain.getTranslatedContent();
        entity.roomNo = domain.getRoomNo();
        entity.guestId = domain.getGuestId();
        entity.requestId = domain.getRequestId();
        entity.sentiment = domain.getSentiment();
        entity.createdAt = domain.getCreatedAt();
        return entity;
    }

    // ── Domain 변환: Entity → Domain ──

    public com.anook.backend.message.domain.model.Message toDomain() {
        com.anook.backend.message.domain.model.Message msg =
                com.anook.backend.message.domain.model.Message.reconstruct(
                        this.id,
                        com.anook.backend.message.domain.model.SenderType.valueOf(this.senderType),
                        this.content,
                        this.translatedContent,
                        this.roomNo,
                        this.guestId,
                        this.requestId,
                        this.sentiment,
                        this.createdAt
                );
        return msg;
    }
}
