package com.anook.backend.knowledge.adapter.out.ai;

import com.anook.backend.knowledge.application.dto.request.ChatMessageDto;
import com.anook.backend.knowledge.application.dto.response.KnowledgeCandidateResult;
import com.anook.backend.knowledge.application.port.out.KnowledgeExtractPort;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * RAG 지식 추출 AI 서비스 어댑터
 *
 * Python AI 서비스(FastAPI)에 HTTP POST 요청을 보내 대화 내용 기반으로 Q&A 후보를 추출한다.
 * 엔드포인트: POST {ai-service-url}/api/v1/rag/extract-from-chat
 *
 * ❌ Spring Boot에서 Gemini API 직접 호출 금지 — 반드시 Python AI 서비스 경유
 */
@Slf4j
@Component
public class KnowledgeExtractAiAdapter implements KnowledgeExtractPort {

    private final WebClient webClient;

    public KnowledgeExtractAiAdapter(
            @Value("${ai.service.url:http://localhost:8000}") String aiServiceUrl
    ) {
        this.webClient = WebClient.builder()
                .baseUrl(aiServiceUrl)
                .build();
    }

    @Override
    @SuppressWarnings("unchecked")
    public List<KnowledgeCandidateResult> extractFromChat(List<ChatMessageDto> messages) {
        try {
            List<Map<String, String>> messagesList = new ArrayList<>();
            for (ChatMessageDto msg : messages) {
                // null 방지
                String senderType = msg.senderType() != null ? msg.senderType() : "GUEST";
                String content = msg.content() != null ? msg.content() : "";
                
                messagesList.add(Map.of(
                        "sender_type", senderType,
                        "content", content
                ));
            }

            Map<String, Object> requestBody = Map.of("messages", messagesList);

            Map<String, Object> response = webClient.post()
                    .uri("/api/v1/rag/extract-from-chat")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                    .timeout(Duration.ofSeconds(60))
                    .block();

            List<KnowledgeCandidateResult> candidates = new ArrayList<>();
            if (response != null && response.containsKey("candidates")) {
                List<Map<String, Object>> candidatesList = (List<Map<String, Object>>) response.get("candidates");
                for (Map<String, Object> item : candidatesList) {
                    candidates.add(new KnowledgeCandidateResult(
                            (String) item.get("question"),
                            (String) item.get("answer"),
                            (String) item.get("domain_code"),
                            item.get("confidence") instanceof Number ? ((Number) item.get("confidence")).doubleValue() : 0.0
                    ));
                }
            }
            return candidates;
        } catch (Exception e) {
            log.error("Failed to extract knowledge candidates from AI service", e);
            throw new RuntimeException("Failed to extract knowledge: " + e.getMessage());
        }
    }
}
