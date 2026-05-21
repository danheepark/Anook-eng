package com.anook.backend.staff.application.port.out;

import java.util.List;
import java.util.Map;

/**
 * 직원이 특정 객실의 대화 내역을 읽기 전용으로 조회하기 위한 포트.
 * (frontdesk 모듈의 Port를 import하지 않고 staff 자체 포트로 정의)
 */
public interface StaffMessageQueryPort {

    /**
     * 특정 객실 번호의 메시지 목록을 시간순 조회
     */
    List<Map<String, Object>> findMessagesByRoomNo(String roomNo);
}
