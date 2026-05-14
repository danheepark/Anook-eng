package com.anook.backend.message.application.port.out;

/**
 * 객실의 현재 상담 상태를 조회하는 Port(Out)
 *
 * message 모듈에서 request 테이블의 상태를 확인하기 위한 읽기 전용 포트.
 * 다른 모듈(request)의 JPA Repository를 직접 import하지 않고,
 * Adapter에서 JdbcTemplate 네이티브 쿼리로 구현합니다.
 */
public interface MessageRoomStatusPort {

    /**
     * 해당 객실에 직원이 실시간 상담 중인(IN_PROGRESS 상태의 FRONT 요청이 있는) 상태인지 확인
     *
     * @param roomNo 객실 번호
     * @return 직원 상담 중이면 true (→ AI 개입 스킵)
     */
    boolean isStaffHandlingRoom(String roomNo);
}
