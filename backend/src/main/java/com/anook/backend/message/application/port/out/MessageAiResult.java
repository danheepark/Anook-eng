package com.anook.backend.message.application.port.out;

import java.util.Map;

/**
 * AI 분석 결과 DTO — message 모듈 소유
 *
 * AI가 고객 메시지를 분석한 결과를 담는 레코드.
 * 채팅 응답(guestReply)과 요청 감지 정보(domainCode 등)를 모두 포함.
 *
 * domainCode가 null이면 단순 대화로 판정 → 이벤트 발행 안 함
 * domainCode가 non-null이면 태스크형 요청 → RequestDetectedEvent 발행
 */
public record MessageAiResult(
        /** AI가 고객에게 보여줄 응답 텍스트 */
        String guestReply,

        /** 직원 대시보드 카드용 짧은 요약 (예: "수건 2장 요청") */
        String summary,

        /** 부서 코드 (예: "HK", "FB") — 단순 대화면 null */
        String domainCode,

        /** 우선순위 (예: "NORMAL", "HIGH", "URGENT") */
        String priority,

        /** 부서별 가변 데이터 (예: {"item": "towel", "qty": 2}) */
        Map<String, Object> entities,

        /** AI 확신도 (0.0 ~ 1.0) */
        double confidence,

        /** AI가 지시하는 특수 액션 (예: "CANCEL_REQUEST"). 일반 흐름이면 null */
        String action,

        /** 요청 유형: "ADD"(새 요청 추가) 또는 "REPLACE"(기존 요청 수정). 기본값 "ADD" */
        String actionType,
        
        /** AI 로그 저장을 위한 메타데이터 (토큰, 소요시간 등) */
        Map<String, Object> aiLogMeta,

        /** [Keyword Targeting] 취소/변경 대상 아이템 키워드 (예: "콜라", "수건"). 미지정 시 null */
        String targetKeyword,

        /** [ID Targeting] 취소 대상 주문 ID (활성 목록 주입 기반). 미지정 시 null */
        Long targetRequestId,

        /** UI에 표시할 선택지 (Pill Tab) 목록 */
        java.util.List<String> clarificationOptions,

        /** AI가 이 결정을 내린 판단 근거 (디버깅/업무 상세용) */
        String reasoning
) {
}
