package com.anook.backend.message.application.port.out;

import com.anook.backend.message.domain.model.Message;

import java.util.List;

/**
 * 메시지 영속성 포트 (Out)
 *
 * Service → 이 인터페이스 → PersistenceAdapter(구현체)
 *
 * ❌ JPA Entity를 반환하지 않는다
 * ✅ 도메인 모델(Message)만 반환한다
 */
public interface MessageRepositoryPort {

    /**
     * 메시지 저장
     */
    Message save(Message message);

    /**
     * 특정 객실 및 투숙객의 대화 내역 조회 (시간순 정렬)
     */
    List<Message> findByRoomNoAndGuestId(String roomNo, Long guestId);

    /**
     * 특정 객실과 투숙객의 최근 대화 내역 조회 (시간순 정렬, limit)
     */
    List<Message> findRecentByRoomNoAndGuestId(String roomNo, Long guestId, int limit);

    /**
     * ID로 메시지 단건 조회
     */
    java.util.Optional<Message> findById(Long id);

    /**
     * VOC 태그가 있는 메시지 조회
     */
    List<Message> findVocs();

    /**
     * 특정 시점 이전의 메시지 조회 (VOC 원문 불만 역추적용)
     */
    List<Message> findMessagesBeforeTimestamp(String roomNo, Long guestId, java.time.LocalDateTime before, int limit);
}

