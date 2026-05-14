package com.anook.backend.message.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 메시지 JPA Repository
 *
 * ⚠️ Service에서 직접 import 금지
 * ⚠️ MessagePersistenceAdapter 내부에서만 사용
 */
public interface MessageJpaRepository extends JpaRepository<MessageJpaEntity, Long> {

    /**
     * 특정 객실 및 투숙객의 메시지를 시간순으로 조회 (격리 조회)
     */
    List<MessageJpaEntity> findByRoomNoAndGuestIdOrderByCreatedAtAsc(String roomNo, Long guestId);

    /**
     * 특정 객실과 투숙객의 최근 메시지 조회 (Pageable 이용)
     */
    List<MessageJpaEntity> findByRoomNoAndGuestIdOrderByCreatedAtDesc(String roomNo, Long guestId, org.springframework.data.domain.Pageable pageable);

    /**
     * VOC 태그가 있는 메시지 조회
     */
    List<MessageJpaEntity> findBySentimentIsNotNullOrderByCreatedAtDesc();

    /**
     * 특정 시점 이전의 메시지 조회 (VOC 원문 불만 역추적용)
     */
    List<MessageJpaEntity> findByRoomNoAndGuestIdAndCreatedAtBeforeOrderByCreatedAtDesc(
            String roomNo, Long guestId, java.time.LocalDateTime before, org.springframework.data.domain.Pageable pageable);
}
