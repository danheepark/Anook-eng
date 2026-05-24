package com.anook.backend.message.application.dto.response;

/**
 * 메시지 전송 결과 DTO (Service → Controller)
 *
 * AI 응답은 비동기 처리 후 WebSocket으로 전달되므로,
 * HTTP 응답에는 고객 메시지 ID만 즉시 반환한다.
 */
public record SendMessageResult(
        /** 저장된 고객 메시지 ID */
        Long guestMessageId,
        /** PII 마스킹 처리된 메시지 내용 (프론트엔드 즉시 반영용) */
        String maskedContent
) {
}
