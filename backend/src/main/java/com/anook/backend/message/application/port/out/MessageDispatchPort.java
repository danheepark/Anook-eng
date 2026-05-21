package com.anook.backend.message.application.port.out;

/**
 * Message 도메인 전용 실시간 이벤트 디스패치 포트 (Out)
 *
 * Service 계층에서 WebSocket 메시지를 발송할 때 사용하는 추상화 인터페이스.
 * 구현체: message/adapter/out/websocket/MessageWebSocketDispatchAdapter
 *
 * ❌ Service에서 SimpMessagingTemplate을 직접 주입하지 않는다.
 * ✅ 반드시 이 MessageDispatchPort를 통해 메시지를 발송한다.
 */
public interface MessageDispatchPort {

    /**
     * 특정 객실 채널로 메시지 전송
     * → /topic/room/{roomNo}
     *
     * @param roomNo  객실 번호 (예: "302")
     * @param payload 전송할 이벤트 데이터
     */
    void sendToRoom(String roomNo, Object payload);

    /**
     * 특정 부서 채널로 메시지 전송
     * → /topic/dept/{deptCode}
     *
     * @param deptCode 부서 코드 (예: "HK", "FB")
     * @param payload  전송할 이벤트 데이터
     */
    void sendToDept(String deptCode, Object payload);

    /**
     * 관리자 채널로 메시지 전송
     * → /topic/frontdesk
     *
     * @param payload 전송할 이벤트 데이터
     */
    void sendToFrontdesk(Object payload);
}
