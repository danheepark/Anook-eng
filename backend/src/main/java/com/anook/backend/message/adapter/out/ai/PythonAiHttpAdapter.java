package com.anook.backend.message.adapter.out.ai;

import com.anook.backend.message.application.port.out.MessageAiPort;
import com.anook.backend.message.application.port.out.MessageAiResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Duration;
import java.util.Collections;
import java.util.Map;

/**
 * Python AI 서버 연동 어댑터
 *
 * AI 서버(FastAPI)에 HTTP POST 요청을 보내 고객 메시지를 분석한다.
 * 엔드포인트: POST {ai-service-url}/analyze
 *
 * @Primary → MockAiAdapter보다 우선 주입됨.
 * @ConditionalOnProperty → ai.service.enabled=true 일 때만 활성화.
 *                          AI 서버 미완성 시 이 빈은 생성되지 않으므로 MockAiAdapter가 사용됨.
 *
 * ❌ Spring Boot에서 Gemini API 직접 호출 금지 — 반드시 Python AI 서비스 경유
 */
@Slf4j
@Primary
@Component
@ConditionalOnProperty(name = "ai.service.enabled", havingValue = "true", matchIfMissing = false)
public class PythonAiHttpAdapter implements MessageAiPort {

    private final WebClient webClient;

    public PythonAiHttpAdapter(
            @Value("${ai.service.url:http://localhost:8000}") String aiServiceUrl
    ) {
        this.webClient = WebClient.builder()
                .baseUrl(aiServiceUrl)
                .build();
    }

    @Override
    public java.util.List<MessageAiResult> analyze(String text, String roomNo, String language, java.util.List<java.util.Map<String, String>> chatHistory, java.util.List<String> images, java.util.List<java.util.Map<String, Object>> activeRequests, java.util.Map<String, Integer> roomInventory) {
        log.info("[PythonAI] 분석 요청 — room: {}, lang: {}, text: {}", roomNo, language, text);

        try {
            java.util.Map<String, Object> body = new java.util.HashMap<>();
            body.put("text", text);
            body.put("room_no", roomNo);
            body.put("language", language);
            body.put("system_language", language);
            body.put("chat_history", chatHistory);
            if (images != null && !images.isEmpty()) {
                body.put("images", images);
            }
            if (activeRequests != null) {
                body.put("active_requests", activeRequests);
            }
            if (roomInventory != null) {
                body.put("room_inventory", roomInventory);
            }

            java.util.List<Map<String, Object>> responses = webClient.post()
                    .uri("/analyze")
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(new ParameterizedTypeReference<java.util.List<Map<String, Object>>>() {})
                    .timeout(Duration.ofSeconds(60))
                    .block();

            if (responses == null || responses.isEmpty()) {
                log.warn("[PythonAI] 응답이 null 또는 비어있음 — 폴백 응답 반환");
                return fallbackResult();
            }

            java.util.List<MessageAiResult> results = new java.util.ArrayList<>();
            for (Map<String, Object> response : responses) {
                String guestReply = (String) response.getOrDefault("guest_reply", "죄송합니다. 잠시 후 다시 시도해 주세요.");
                String summary = (String) response.get("summary");
                String domainCode = (String) response.get("domain_code");
                String priority = (String) response.getOrDefault("priority", "NORMAL");

                @SuppressWarnings("unchecked")
                Map<String, Object> entities = response.containsKey("entities")
                        ? (Map<String, Object>) response.get("entities")
                        : Collections.emptyMap();

                double confidence = response.containsKey("confidence")
                        ? ((Number) response.get("confidence")).doubleValue()
                        : 0.0;

                String action = (String) response.get("action");

                String actionType = (String) response.getOrDefault("action_type", "ADD");

                @SuppressWarnings("unchecked")
                Map<String, Object> aiLogMeta = response.containsKey("ai_log_meta")
                        ? (Map<String, Object>) response.get("ai_log_meta")
                        : null;

                String targetKeyword = (String) response.get("target_keyword");
                
                Long targetRequestId = response.containsKey("target_request_id") && response.get("target_request_id") != null
                        ? ((Number) response.get("target_request_id")).longValue()
                        : null;

                @SuppressWarnings("unchecked")
                java.util.List<String> clarificationOptions = response.containsKey("clarification_options")
                        ? (java.util.List<String>) response.get("clarification_options")
                        : null;

                String reasoning = (String) response.getOrDefault("reasoning", "알 수 없음");

                log.info("[PythonAI] 개별 분석 완료 — domain: {}, confidence: {}, action: {}, actionType: {}, targetKeyword: {}, options: {}, reasoning: {}",
                        domainCode, confidence, action, actionType, targetKeyword, clarificationOptions, reasoning);

                results.add(new MessageAiResult(guestReply, summary, domainCode, priority, entities, confidence, action, actionType, aiLogMeta, targetKeyword, targetRequestId, clarificationOptions, reasoning));
            }

            return results;

        } catch (WebClientResponseException e) {
            log.error("[PythonAI] HTTP 에러 — status: {}, body: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return fallbackResult();
        } catch (Exception e) {
            log.error("[PythonAI] 연결 실패 — {}", e.getMessage());
            return fallbackResult();
        }
    }

    /**
     * AI 서버 장애 시 폴백 응답
     * 고객에게 직원 연결 안내 메시지를 보내고, FRONT 부서로 티켓을 생성한다.
     */
    private java.util.List<MessageAiResult> fallbackResult() {
        return java.util.List.of(new MessageAiResult(
                "안내에 어려움이 있어 프론트 데스크 직원을 연결해 드리겠습니다. 잠시만 기다려 주세요.",
                "AI 분석 실패 (직원 연결)", 
                "FRONT", 
                "URGENT", 
                Collections.emptyMap(), 
                0.0, 
                "ADD", 
                "ADD", 
                null,
                null,
                null,
                null,
                "AI 서버 연결 실패 또는 에러 발생으로 인한 폴백(Fallback)"
        ));
    }

    @Override
    public String translate(String text, String targetLanguage) {
        log.info("[PythonAI] 번역 요청 — text: {}, targetLang: {}", text, targetLanguage);

        try {
            Map<String, Object> response = webClient.post()
                    .uri("/translate")
                    .bodyValue(Map.of(
                            "text", text,
                            "target_language", targetLanguage
                    ))
                    .retrieve()
                    .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                    .timeout(Duration.ofSeconds(15))
                    .block();

            if (response != null && response.containsKey("translated_text")) {
                return (String) response.get("translated_text");
            }
            
            log.warn("[PythonAI] 번역 응답이 유효하지 않음 — 원문 반환");
            return text;

        } catch (WebClientResponseException e) {
            log.error("[PythonAI] HTTP 에러 (번역) — status: {}, body: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return text;
        } catch (Exception e) {
            log.error("[PythonAI] 연결 실패 (번역) — {}", e.getMessage());
            return text;
        }
    }
}
