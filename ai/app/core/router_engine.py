"""
메인 라우터 엔진 (AN-194)
────────────────────────
고객 메시지를 받아 Gemini로 도메인을 분류하고,
RouterOutputSchema로 검증된 결과를 반환한다.

흐름:
  1. 고객 텍스트 → Gemini (시스템 프롬프트: 프론트 데스크)
  2. Gemini JSON 응답 → RouterOutputSchema로 Pydantic 검증
  3. 검증 완료된 RouterOutputSchema 반환
"""

import logging
from app.infrastructure.gemini.client import call_gemini
from app.prompts.router_prompt import ROUTER_SYSTEM_PROMPT
from app.schemas.router import RouterOutputSchema
from typing import List

logger = logging.getLogger(__name__)

# ── 상수 ──
VALID_DOMAINS = {"HK", "FB", "FACILITY", "CONCIERGE", "FRONT", "COMMON", "EMERGENCY"}
VALID_ROUTE_TYPES = {"DEPARTMENT", "CLARIFICATION", "FRONT_ESCALATION", "SOFT_FALLBACK", "NON_ACTIONABLE", "INFO", "CANCEL", "STATUS_CHECK", "VOC"}

def route(user_message: str, chat_history: List[dict] = None, images: List[str] = None) -> List[RouterOutputSchema]:
    """
    고객 메시지를 분류하여 RouterOutputSchema의 리스트를 반환한다.
    다중 요청(Multi-intent)일 경우 여러 개의 스키마 객체가 반환된다.
    """
    if chat_history is None:
        chat_history = []
    
    # 만약 백엔드에서 실수로 전체 대화를 다 보내더라도, AI 서버에서 안전하게 최근 5개만 자름 (비용 폭발 방지)
    chat_history = chat_history[-5:]

    # ── 1) 과거 대화 맥락 조립 ──
    if chat_history:
        context_lines = []
        for msg in chat_history:
            role = "고객" if msg.get("role") == "user" else "AI"
            context_lines.append(f"{role}: {msg.get('content')}")
        
        context_str = "\n".join(context_lines)
        final_prompt = f"[과거 대화 맥락]\n{context_str}\n\n[현재 요청]\n고객: {user_message}"
    else:
        final_prompt = user_message

    # ── 2) Gemini 호출 ──
    raw_result = call_gemini(
        prompt=final_prompt,
        system_instruction=ROUTER_SYSTEM_PROMPT,
        temperature=0.1,  # 분류 작업이므로 최대한 결정적으로
        images=images
    )

    logger.info(f"[Router] Gemini 최종 프롬프트: {final_prompt}")
    logger.info(f"[Router] Gemini 원본 응답: {raw_result}")

    # 리스트 형태가 아니면 강제로 리스트로 감싸기
    if isinstance(raw_result, dict):
        raw_result = [raw_result]
    elif not isinstance(raw_result, list):
        raise ValueError(f"Gemini 응답이 객체 또는 배열이 아닙니다: {raw_result}")

    final_results = []

    for item in raw_result:
        # 호환성/방어 로직 (이전 버전의 키가 들어올 경우 변환)
        if "mode" in item and "route_type" not in item:
            item["route_type"] = item.pop("mode")
            if item["route_type"] == "TASK": item["route_type"] = "DEPARTMENT"
            elif item["route_type"] == "CHITCHAT": item["route_type"] = "SOFT_FALLBACK"

        # ── 2) Pydantic 스키마 검증 ──
        result = RouterOutputSchema(**item)

        # ── 2.5) 긴급 상황 예외 처리 ──
        if result.route_type == "EMERGENCY" or result.domain == "EMERGENCY":
            result.route_type = "FRONT_ESCALATION"
            result.domain = "EMERGENCY"
            result.priority = "URGENT"

        # ── 3) route_type 유효성 검증 ──
        if result.route_type not in VALID_ROUTE_TYPES:
            logger.warning(f"[Router] 알 수 없는 route_type '{result.route_type}' → CLARIFICATION으로 Fallback")
            result.route_type = "CLARIFICATION"
            result.domain = None

        # ── 4) 도메인 검증 ──
        if result.route_type in ("DEPARTMENT", "INFO", "CANCEL", "FRONT_ESCALATION"):
            if result.domain is not None and result.domain not in VALID_DOMAINS:
                logger.warning(
                    f"[Router] 유효하지 않은 도메인: {result.domain} → None 처리"
                )
                result.domain = None

        # ── 5) 티켓 미생성 유형의 domain 무효화 (보호 처리) ──
        if result.route_type in ("SOFT_FALLBACK", "NON_ACTIONABLE", "CLARIFICATION", "STATUS_CHECK", "VOC"):
            result.domain = None
            result.create_ticket = False

        logger.info(
            f"[Router] 개별 결과: route_type={result.route_type}, "
            f"domain={result.domain}, confidence={result.confidence:.2f}"
        )
        final_results.append(result)

    return final_results
