package com.anook.backend.message.adapter.in.web.dto.request;

/**
 * 고객 메시지 전송 요청 DTO (Controller 전용)
 *
 * ❌ @RequestBody Map<String, Object> 사용 금지 → 이 전용 DTO 사용
 */
public record SendMessageRequest(
        String content,
        java.util.List<String> images,
        String language
) {
}
