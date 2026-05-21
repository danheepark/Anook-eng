package com.anook.backend.message.application.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

/**
 * 고객이 AI 챗봇을 통해 가장 최근 요청을 취소했을 때 발생하는 이벤트.
 * Message 모듈에서 발행(Publish)하고, Request 모듈에서 구독(Subscribe)한다.
 */
@Getter
public class RequestCancelledByGuestEvent extends ApplicationEvent {

    private final String roomNo;
    private final Long guestId;
    private final String domainCode;
    /** [Keyword Targeting] 취소 대상 아이템 키워드 (예: "콜라"). 미지정 시 null → 최신 건 취소 (Legacy fallback) */
    private final String targetKeyword;
    /** [ID Targeting] 취소 대상 주문 ID (활성 목록 주입 기반). 미지정 시 null */
    private final Long targetRequestId;

    public RequestCancelledByGuestEvent(Object source, String roomNo, Long guestId, String domainCode, String targetKeyword, Long targetRequestId) {
        super(source);
        this.roomNo = roomNo;
        this.guestId = guestId;
        this.domainCode = domainCode;
        this.targetKeyword = targetKeyword;
        this.targetRequestId = targetRequestId;
    }
}
