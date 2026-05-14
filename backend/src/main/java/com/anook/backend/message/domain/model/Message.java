package com.anook.backend.message.domain.model;

import java.time.LocalDateTime;

/**
 * 메시지 도메인 모델 (순수 POJO)
 *
 * ❌ JPA, Spring 어노테이션 금지
 * ✅ 팩토리 메서드로 생성, 행위 메서드 포함
 *
 * DB 매핑: message 테이블 (schema.sql L85~93)
 */
public class Message {

    private Long id;
    private SenderType senderType;
    private String content;
    private String translatedContent;
    private String roomNo;
    private Long guestId;
    private Long requestId;
    private String sentiment;
    private LocalDateTime createdAt;

    // ── 팩토리 메서드 ──

    /**
     * 고객 메시지 생성
     */
    public static Message createGuestMessage(String roomNo, Long guestId, String content) {
        Message msg = new Message();
        msg.senderType = SenderType.GUEST;
        msg.content = content;
        msg.roomNo = roomNo;
        msg.guestId = guestId;
        msg.createdAt = LocalDateTime.now();
        return msg;
    }

    /**
     * AI 응답 메시지 생성
     */
    public static Message createAiReply(String roomNo, Long guestId, String content) {
        Message msg = new Message();
        msg.senderType = SenderType.AI;
        msg.content = content;
        msg.roomNo = roomNo;
        msg.guestId = guestId;
        msg.createdAt = LocalDateTime.now();
        return msg;
    }

    /**
     * 직원 메시지 생성 (에스컬레이션 시)
     */
    public static Message createStaffMessage(String roomNo, Long guestId, String content) {
        Message msg = new Message();
        msg.senderType = SenderType.STAFF;
        msg.content = content;
        msg.roomNo = roomNo;
        msg.guestId = guestId;
        msg.createdAt = LocalDateTime.now();
        return msg;
    }

    // ── 행위 메서드 ──

    /**
     * 요청(Request)과 연결
     */
    public void linkToRequest(Long requestId) {
        this.requestId = requestId;
    }

    /**
     * 번역된 내용 설정
     */
    public void setTranslation(String translatedContent) {
        this.translatedContent = translatedContent;
    }

    /**
     * 감정 분석 결과(VOC) 설정
     */
    public void setSentiment(String sentiment) {
        this.sentiment = sentiment;
    }

    /**
     * 고객이 보낸 메시지인지 확인
     */
    public boolean isFromGuest() {
        return this.senderType == SenderType.GUEST;
    }

    /**
     * AI가 보낸 메시지인지 확인
     */
    public boolean isFromAi() {
        return this.senderType == SenderType.AI;
    }

    // ── Getters ──

    public Long getId() { return id; }
    public SenderType getSenderType() { return senderType; }
    public String getContent() { return content; }
    public String getTranslatedContent() { return translatedContent; }
    public String getRoomNo() { return roomNo; }
    public Long getGuestId() { return guestId; }
    public Long getRequestId() { return requestId; }
    public String getSentiment() { return sentiment; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    // ── 영속성 어댑터 전용: DB에서 읽어온 데이터를 도메인 모델로 복원 ──

    /**
     * DB에서 조회한 데이터를 도메인 모델로 복원하는 팩토리 메서드
     * ⚠️ PersistenceAdapter 내부에서만 사용할 것
     */
    public static Message reconstruct(Long id, SenderType senderType, String content,
                                       String translatedContent, String roomNo, Long guestId,
                                       Long requestId, String sentiment, LocalDateTime createdAt) {
        Message msg = new Message();
        msg.id = id;
        msg.senderType = senderType;
        msg.content = content;
        msg.translatedContent = translatedContent;
        msg.roomNo = roomNo;
        msg.guestId = guestId;
        msg.requestId = requestId;
        msg.sentiment = sentiment;
        msg.createdAt = createdAt;
        return msg;
    }
}
