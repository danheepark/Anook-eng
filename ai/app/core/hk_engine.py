from app.infrastructure.gemini.client import call_gemini_async
from app.prompts.hk_prompt import HK_SYSTEM_PROMPT
from app.schemas.common import HotelRequestSchema
from app.domains.rag import service as rag_service

async def run_hk_agent(user_message: str, room_no: str, chat_history: list = None, images: list = None, system_language: str = "ko", active_requests: list = None, room_inventory: dict = None, **kwargs) -> dict:
    """
    HK 에이전트: One-pass로 다국어 감지 + Entity 추출 + 되묻기 판단
    
    Returns:
        analyze.py가 기대하는 dict 형태
        (내부적으로 HotelRequestSchema로 Pydantic 검증 후 변환)
    """
    # 1. RAG 검색 → HK 도메인 지식 (비품 목록, 수량 제한 등)
    rag_context = ""
    try:
        rag_results = rag_service.search_hybrid(
            query=user_message, domain_code="HK", top_k=3, threshold=0.5
        )
        if rag_results:
            rag_context = "\n".join([f"- {r['question']}: {r['answer']}" for r in rag_results])
    except Exception as e:
        print(f"[HK Agent] RAG 검색 실패: {e}")

    # 2. 대화 맥락 조립
    if chat_history:
        context = "\n".join([
            f"{'Guest' if m.get('role')=='user' else 'AI'}: {m.get('content')}"
            for m in chat_history[-5:]
        ])
        prompt = f"[Chat History]\n{context}\n\n"
    else:
        prompt = ""
    
    # 3. RAG 지식 삽입 + 현재 메시지
    if rag_context:
        prompt += f"[Room Amenity Info]\n{rag_context}\n\n"
    if room_inventory:
        import json
        prompt += f"[Stateful Room Inventory (Daily Allowed Limits)]\n"
        prompt += f"This is the actual, current usage data for the room from the backend database. You MUST strictly adhere to this:\n"
        prompt += f"{json.dumps(room_inventory, ensure_ascii=False)}\n\n"
    prompt += f"[Current Request]\nGuest: {user_message}"

    # 4. Gemini One-pass 호출
    system_instruction_with_lang = HK_SYSTEM_PROMPT.replace("{system_language}", system_language)
    raw = await call_gemini_async(prompt=prompt, system_instruction=system_instruction_with_lang, images=images)

    if isinstance(raw, list):
        if not raw:
            raise ValueError("AI returned an empty list")
        raw = raw[0]

    # 5. reasoning 필드가 리스트로 올 경우 문자열로 변환 (Pydantic 검증 에러 방지)
    if isinstance(raw.get("reasoning"), list):
        raw["reasoning"] = "\n".join(raw["reasoning"])

    # 6. Pydantic 검증 (HotelRequestSchema)
    if "request_id" not in raw or raw["request_id"] == "auto":
        raw["request_id"] = "auto"
    if "room_no" not in raw or raw["room_no"] == "unknown":
        raw["room_no"] = room_no
    if "domain" not in raw:
        raw["domain"] = "HK"

    result = HotelRequestSchema(**raw)

    # 7. analyze.py 응답 형태로 변환
    # 되묻기(needs_clarification)일 때나 에스컬레이션(관할 밖)일 때는 domain_code=None → 백엔드가 불필요한 티켓을 생성하지 않음
    action_type = raw.get("action_type")
    if action_type is None:
        action_type = result.entities.get("action_type")
    if action_type is None:
        action_type = "ADD"

    is_escalation = result.entities.get("intent") == "ESCALATION"
    if is_escalation or result.needs_clarification:
        domain_code = None
    else:
        domain_code = result.domain if result.domain else "HK"

    return {
        "guest_reply": result.clarification_question if result.needs_clarification else result.final_reply,
        "summary": result.summary,
        "domain_code": domain_code,
        "priority": result.priority,
        "entities": result.entities,
        "confidence": result.confidence,
        "missing_fields": result.missing_fields,
        "clarification_options": getattr(result, "clarification_options", []),

        "reasoning": result.reasoning,
        "action_type": action_type,
        "target_keyword": result.entities.get("target_keyword") if result.entities.get("target_keyword") else raw.get("target_keyword"),
        "target_request_id": result.target_request_id if result.target_request_id else (result.entities.get("target_request_id") if result.entities else raw.get("target_request_id")),
    }

