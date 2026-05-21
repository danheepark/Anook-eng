package com.anook.backend.frontdesk.message.adapter.out.persistence;

import com.anook.backend.frontdesk.message.adapter.out.persistence.entity.FrontdeskMessageJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

/**
 * 관리자용 메시지 JPA Repository (읽기 전용)
 *
 * admin/message 모듈 내부에서만 사용
 */
public interface FrontdeskMessageJpaRepository extends JpaRepository<FrontdeskMessageJpaEntity, Long> {

    /**
     * 메시지가 존재하는 고유 roomNo 목록
     */
    @Query("SELECT DISTINCT m.roomNo FROM FrontdeskMessage m ORDER BY m.roomNo")
    List<String> findDistinctRoomNos();

    @Query("SELECT DISTINCT m.roomNo FROM FrontdeskMessage m WHERE m.createdAt >= :start AND m.createdAt <= :end ORDER BY m.roomNo")
    List<String> findDistinctRoomNosByDate(java.time.LocalDateTime start, java.time.LocalDateTime end);

    /**
     * 특정 roomNo의 메시지를 시간순으로 조회
     */
    List<FrontdeskMessageJpaEntity> findByRoomNoOrderByCreatedAtAsc(String roomNo);

    /**
     * 특정 roomNo의 최신 메시지 조회 (guestId 추출용)
     */
    java.util.Optional<FrontdeskMessageJpaEntity> findFirstByRoomNoOrderByCreatedAtDesc(String roomNo);

    /**
     * 특정 roomNo의 모든 메시지 삭제
     */
    @org.springframework.data.jpa.repository.Modifying
    @Query("DELETE FROM FrontdeskMessage m WHERE m.roomNo = :roomNo")
    void deleteByRoomNo(String roomNo);
}
