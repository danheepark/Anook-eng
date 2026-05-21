package com.anook.backend.frontdesk.request.application.port.out;

/**
 * 관리자 요청 모듈에서 메시지를 전송할 때 사용하는 Port (Out)
 *
 * admin/message 모듈의 Port를 직접 import하지 않고,
 * 자체 인터페이스를 정의하여 모듈 독립성을 유지합니다.
 */
public interface FrontdeskRequestMessagePort {

    /**
     * 특정 객실에 STAFF 메시지를 저장합니다.
     *
     * @param roomNo  객실 번호
     * @param content 메시지 내용 (예: 반려 사유)
     */
    void sendStaffMessage(String roomNo, String content);
}
