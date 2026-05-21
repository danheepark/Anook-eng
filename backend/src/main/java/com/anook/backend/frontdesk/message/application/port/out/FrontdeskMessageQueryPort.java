package com.anook.backend.frontdesk.message.application.port.out;

import java.util.List;
import java.util.Map;

/**
 * 관리자 메시지 조회 Port (Out)
 *
 * admin/message 모듈 전용 포트.
 * message 모듈의 Port/UseCase를 import하지 않고 독립적으로 정의.
 */
public interface FrontdeskMessageQueryPort {

    /**
     * 메시지가 존재하는 객실 목록 조회
     *
     * @return [ { roomId, roomNo } ] 형태의 맵 리스트
     */
    List<Map<String, Object>> findRoomsWithMessages();
    
    /**
     * 특정 날짜에 메시지가 존재하는 객실 목록 조회
     *
     * @param date 조회할 날짜
     * @return [ { roomId, roomNo } ] 형태의 맵 리스트
     */
    List<Map<String, Object>> findRoomsWithMessages(java.time.LocalDate date);

    /**
     * 특정 객실의 메시지 목록 조회 (시간순)
     *
     * @param roomNo 객실 번호
     * @return 메시지 맵 리스트 [ { id, senderType, content, translatedContent, createdAt }
     *         ]
     */
    List<Map<String, Object>> findMessagesByRoomNo(String roomNo);

    /**
     * 특정 roomNo의 최근 메시지 기준 guestId 조회
     */
    Long getLatestGuestId(String roomNo);
}
