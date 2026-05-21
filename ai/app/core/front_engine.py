"""
프론트데스크 AI 엔진
"""
from app.infrastructure.gemini.client import call_gemini_async
from app.prompts.front_prompt import FRONT_SYSTEM_PROMPT
from app.schemas.common import HotelRequestSchema
from app.domains.rag import service as rag_service

async def run_front_agent(user_message: str, room_no: str, chat_history: list = None, images: list = None, system_language: str = "ko", active_requests: list = None, **kwargs) -> dict:
    """프론트데스크 에이전트: 고객 메시지에서 프론트 관련 정보를 추출"""
    
    # 1. RAG 검색 → FRONT 도메인 지식
    rag_context = ""
    try:
        rag_results = rag_service.search_hybrid(
            query=user_message, domain_code="FRONT", top_k=3, threshold=0.5
        )
        if rag_results:
            rag_context = "\n".join([f"- {r['question']}: {r['answer']}" for r in rag_results])
    except Exception as e:
        print(f"[FRONT Agent] RAG 검색 실패: {e}")

    # 2. 대화 맥락 및 지식 조립
    if chat_history:
        context = "\n".join([
            f"{'고객' if m.get('role')=='user' else 'AI'}: {m.get('content')}"
            for m in chat_history[-5:]
        ])
        prompt = f"[대화 맥락]\n{context}\n\n"
    else:
        prompt = f"고객 객실: {room_no}\n"
        
    if rag_context:
        prompt += f"[관련 지식 (RAG)]\n{rag_context}\n\n"
        
    prompt += f"[현재 요청]\n고객: {user_message}"
    
    system_instruction_with_lang = FRONT_SYSTEM_PROMPT.replace("{system_language}", system_language)
    raw = await call_gemini_async(prompt=prompt, system_instruction=system_instruction_with_lang, images=images)
    
    # 방어 로직: 배열로 오면 첫 번째 요소 추출
    if isinstance(raw, list):
        raw = raw[0] if raw else {}

    # 필수 필드 주입 방어 로직 (Pydantic 에러 방지)
    if "request_id" not in raw or raw["request_id"] == "auto":
        raw["request_id"] = "auto"
    if "room_no" not in raw or raw["room_no"] == "unknown" or raw["room_no"] is None:
        raw["room_no"] = room_no
    if "domain" not in raw or raw["domain"] is None:
        raw["domain"] = "FRONT"

    # Pydantic 검증
    result = HotelRequestSchema(**raw)
    
    # 챗봇 응답(guest_reply) 분기 처리
    final_response = getattr(result, "final_reply", "")
    if not final_response:
        final_response = "프론트데스크에서 확인 후 처리해 드리겠습니다."
        
    guest_reply = final_response
    domain_code = "FRONT"
    
    intent = result.entities.get("intent")
    has_options = bool(getattr(result, "clarification_options", []))

    if intent == "INFO":
        guest_reply = result.entities.get("fallback_message", result.clarification_question)
        domain_code = None  # 정보 조회는 티켓 생성 X
    elif result.needs_clarification or has_options or intent == "AMBIGUOUS":
        guest_reply = result.clarification_question if result.clarification_question else result.entities.get("fallback_message", "어떻게 도와드릴까요?")
        domain_code = None  # 질문/버튼 선택 단계이거나 의도 불분명일 때는 카드 노출 방지 (UX 최적화)
    elif intent == "ESCALATION":
        guest_reply = result.entities.get("fallback_message", "프론트데스크 직원에게 즉시 연결해 드리겠습니다. 잠시만 기다려주세요.")

    # /analyze 응답 형태로 변환
    return {
        "guest_reply": guest_reply,
        "clarification_options": result.clarification_options,
        "summary": result.summary,
        "domain_code": domain_code,
        "priority": getattr(result, "priority", "NORMAL"),
        "entities": result.entities,
        "confidence": result.confidence,
        "missing_fields": result.missing_fields,
        "reasoning": result.reasoning,
    }
