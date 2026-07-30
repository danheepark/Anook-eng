package com.anook.backend.message.adapter.out.ai;

import com.anook.backend.message.application.port.out.MessageAiPort;
import com.anook.backend.message.application.port.out.MessageAiResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Collections;

/**
 * Mock AI 어댑터 — 개발/테스트용 고정 응답
 *
 * AI 서버 미완성 시 기본 어댑터로 사용됨.
 * ai.service.enabled=true 설정 시 PythonAiHttpAdapter(@Primary)가 활성화되어 자동 대체됨.
 *
 * 키워드 기반으로 간단한 분기 처리:
 *   - "수건", "물", "베개" 등 → HK 부서 요청
 *   - "에어컨", "고장", "수리" 등 → FACILITY 부서 요청
 *   - "룸서비스", "음식" 등 → FB 부서 요청
 *   - 그 외 → 단순 대화 (domainCode = null, 이벤트 발행 안 함)
 */
@Slf4j
@Component
public class MockAiAdapter implements MessageAiPort {

    @Override
    public java.util.List<MessageAiResult> analyze(String text, String roomNo, String language, java.util.List<java.util.Map<String, String>> chatHistory, java.util.List<String> images, java.util.List<java.util.Map<String, Object>> activeRequests, java.util.Map<String, Object> roomInventory, String specialNotes) {
        log.info("[MockAI] 분석 요청(Mock) — room: {}, lang: {}, text: {}", roomNo, language, text);

        // 1초 딜레이 (AI 처리 시간 시뮬레이션)
        try {
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        // 하우스키핑 요청
        if (containsAny(text, "수건", "물", "베개", "이불", "가운", "슬리퍼", "어메니티")) {
            String item = extractItem(text);
            return java.util.List.of(new MessageAiResult(
                    "We will bring the requested items to your room shortly!",
                    "Item Request (" + item + ")",
                    "HK", "NORMAL",
                    Map.of("item", item, "qty", 1),
                    0.92,
                    null,
                    "ADD",
                    false,
                    null,
                    null,
                    null,
                    null,
                    "Keyword Matching (HK)"
            ));
        }

        // 시설 수리 요청
        if (containsAny(text, "에어컨", "고장", "수리", "안 돼", "작동")) {
            return java.util.List.of(new MessageAiResult(
                    "We have received your facility inspection request. An engineer will visit shortly.",
                    "Air Conditioner Inspection Request",
                    "FACILITY", "HIGH",
                    Map.of("target", "air_conditioner"),
                    0.88,
                    null,
                    "ADD",
                    false,
                    null,
                    null,
                    null,
                    null,
                    "Keyword Matching (FACILITY)"
            ));
        }

        // 룸서비스 요청
        if (containsAny(text, "룸서비스", "음식", "주문", "먹")) {
            return java.util.List.of(new MessageAiResult(
                    "We have received your room service order. We are checking the menu.",
                    "Room Service Order",
                    "FB", "NORMAL",
                    Map.of(),
                    0.85,
                    null,
                    "ADD",
                    false,
                    null,
                    null,
                    null,
                    null,
                    "Keyword Matching (FB)"
            ));
        }

        // 단순 대화 (domainCode = null → 이벤트 발행 안 함)
        return java.util.List.of(new MessageAiResult(
                "Hello! I am the Aneuk Hotel Concierge. Please let me know if you need anything.",
                null,
                null, null, Map.of(), 0.0, null, "ADD", false, null, null, null, null, null
        ));
    }

    @Override
    public String translate(String text, String targetLanguage) {
        log.info("[MockAI] 번역 요청 — text: {}, targetLang: {}", text, targetLanguage);
        
        // 1초 딜레이 (AI 처리 시간 시뮬레이션)
        try {
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        // 목업: 단순히 (Translated) 접두사만 붙여서 반환
        return "(Translated to " + targetLanguage + ") " + text;
    }

    private boolean containsAny(String text, String... keywords) {
        for (String keyword : keywords) {
            if (text.contains(keyword)) return true;
        }
        return false;
    }

    private String extractItem(String text) {
        if (text.contains("수건")) return "towel";
        if (text.contains("물")) return "water";
        if (text.contains("베개")) return "pillow";
        if (text.contains("이불")) return "blanket";
        if (text.contains("가운")) return "bathrobe";
        if (text.contains("슬리퍼")) return "slippers";
        return "amenity";
    }
}
