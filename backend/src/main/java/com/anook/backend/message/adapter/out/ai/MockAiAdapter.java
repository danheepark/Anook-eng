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
    public java.util.List<MessageAiResult> analyze(String text, String roomNo, String language, java.util.List<java.util.Map<String, String>> chatHistory, java.util.List<String> images, java.util.List<java.util.Map<String, Object>> activeRequests, java.util.Map<String, Integer> roomInventory) {
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
                    "요청하신 물품을 객실로 곧 가져다 드리겠습니다!",
                    "물품 요청 (" + item + ")",
                    "HK", "NORMAL",
                    Map.of("item", item, "qty", 1),
                    0.92,
                    null,
                    "ADD",
                    null,
                    null,
                    null,
                    null,
                    "키워드 기반 매칭 (HK)"
            ));
        }

        // 시설 수리 요청
        if (containsAny(text, "에어컨", "고장", "수리", "안 돼", "작동")) {
            return java.util.List.of(new MessageAiResult(
                    "시설 점검 요청을 접수했습니다. 엔지니어가 곧 방문드릴 예정입니다.",
                    "에어컨 점검 요청",
                    "FACILITY", "HIGH",
                    Map.of("target", "air_conditioner"),
                    0.88,
                    null,
                    "ADD",
                    null,
                    null,
                    null,
                    null,
                    "키워드 기반 매칭 (FACILITY)"
            ));
        }

        // 룸서비스 요청
        if (containsAny(text, "룸서비스", "음식", "주문", "먹")) {
            return java.util.List.of(new MessageAiResult(
                    "룸서비스 주문을 접수하겠습니다. 메뉴를 확인 중입니다.",
                    "룸서비스 주문",
                    "FB", "NORMAL",
                    Map.of(),
                    0.85,
                    null,
                    "ADD",
                    null,
                    null,
                    null,
                    null,
                    "키워드 기반 매칭 (FB)"
            ));
        }

        // 단순 대화 (domainCode = null → 이벤트 발행 안 함)
        return java.util.List.of(new MessageAiResult(
                "안녕하세요! 아눅 호텔 컨시어지입니다. 무엇이든 편하게 말씀해 주세요.",
                null,
                null, null, Map.of(), 0.0, null, "ADD", null, null, null, null, null
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
