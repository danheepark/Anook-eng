from app.infrastructure.gemini.client import call_gemini_async
from app.prompts.concierge_prompt import CONCIERGE_SYSTEM_PROMPT
from app.schemas.common import HotelRequestSchema
from app.domains.rag import service as rag_service

# Step 1: Lightweight prompt to extract confirmed entities from conversation
ENTITY_EXTRACT_PROMPT = """You are an entity extraction assistant for a hotel concierge conversation.

TASK: Read the conversation and extract ALL entities that the guest has confirmed or provided.

RULES:
1. ONLY include entities that the guest EXPLICITLY stated in their own messages (e.g., "Flowers" → item: "Flowers", "Seoul Station" → destination: "Seoul Station").
2. NEVER include, assume, or extract entities that were only mentioned by the AI in questions or examples unless the guest explicitly confirmed or stated that value in their own reply.
3. If the guest said "anywhere" or "doesn't matter" for any field, set it to "Hotel Default".
4. If a guest provides a vague time (e.g., "morning", "tomorrow"), DO NOT hallucinate or guess a specific hour (e.g., "09:00 AM"). Do not extract `time` unless a specific hour is provided.
5. DO NOT hallucinate quantities (e.g., `passenger_count`: 3) unless the guest explicitly provided a number.
6. Output ONLY a flat JSON object. No explanation, no markdown.

EXAMPLE:
[Conversation]
AI: What kind of flowers would you like delivered?
Guest: Blooming flowers
AI: How many blooming flowers would you like?
Guest: 10 stems

OUTPUT:
{"intent": "DELIVERY", "item": "Blooming flowers", "quantity": 10}
"""

import re

def _is_meta_instruction_pill(opt_str: str) -> bool:
    if not isinstance(opt_str, str):
        return True
    s = opt_str.lower().strip()
    meta_verbs = ["confirm", "provide", "enter", "fill", "specify", "select", "choose", "check", "submit", "indicate"]
    if any(s.startswith(v) for v in meta_verbs):
        return True
    meta_phrases = ["passenger count", "destination", "time", "details", "info", "information", "number of passengers"]
    if any(p in s for p in meta_phrases) and any(v in s for v in ["confirm", "provide", "enter", "fill", "specify", "select", "choose"]):
        return True
    return False


def _is_vague_time_str(val) -> bool:
    if not val or not isinstance(val, str):
        return False
    v = val.lower().strip()
    if re.search(r'\b\d{1,2}(:\d{2})?\s*(am|pm)?\b', v) or re.search(r'\b\d{1,2}\s*시', v):
        return False
    vague_words = ["morning", "afternoon", "evening", "night", "tonight", "tomorrow", "today", "아침", "오전", "오후", "저녁", "밤", "내일"]
    return any(w in v for w in vague_words)


async def run_concierge_agent(user_message: str, room_no: str, chat_history: list = None, images: list = None, active_requests: list = None, system_language: str = "en", **kwargs) -> dict:
    """
    Concierge Agent Engine (Step 0-2)
    ───────────────────────────
    Calls Gemini with guest message and extracts concierge-specific information.
    """
    
    from datetime import datetime, timedelta, timezone
    
    # Get current Korea time (UTC+9)
    kst = timezone(timedelta(hours=9))
    now_str = datetime.now(kst).strftime('%Y-%m-%d %H:%M')
    
    # 1. RAG Search → CONCIERGE domain knowledge
    rag_context = ""
    try:
        rag_results = rag_service.search_hybrid(
            query=user_message, domain_code="CONCIERGE", top_k=3, threshold=0.5
        )
        if rag_results:
            rag_context = "\n".join([f"- {r['question']}: {r['answer']}" for r in rag_results])
    except Exception as e:
        print(f"[CONCIERGE Agent] RAG search failed: {e}")

    # 2. Assemble conversation context
    prompt = ""
    if special_notes := kwargs.get("special_notes"):
        prompt += f"[Guest PMS Special Notes]\n{special_notes}\n\n"

    if chat_history:
        context = "\n".join([
            f"{'Guest' if m.get('role')=='user' else 'AI'}: {m.get('content')}"
            for m in chat_history[-15:]
        ])
        prompt += f"[Current Date and Time]\n{now_str}\n\n[Chat Context]\n{context}\n\n"
        
        # ── Step 1: Lightweight Gemini call to extract existing entities ──
        # Only run when turn count >= 2 (4 messages), no entities to extract on first turn
        accumulated_entities = {}
        if len(chat_history) >= 4:
            try:
                extract_result = await call_gemini_async(
                    prompt=f"[Conversation]\n{context}",
                    system_instruction=ENTITY_EXTRACT_PROMPT
                )
                if isinstance(extract_result, dict):
                    # __ai_log_meta 등 내부 메타데이터 필터링
                    accumulated_entities = {k: v for k, v in extract_result.items() if not k.startswith('__')}
                    print(f"[CONCIERGE] 📋 Step 1 Extracted Entities: {accumulated_entities}")
            except Exception as e:
                print(f"[CONCIERGE] ⚠️ Entity extraction failed (ignoring, proceeding with default): {e}")
        
        # Inject Step 1 results into [Confirmed Information] block
        if accumulated_entities:
            entities_str = "\n".join([
                f"- {k}: {v} ✅" for k, v in accumulated_entities.items() if v
            ])
            prompt += f"[Confirmed Information - Keep these previously confirmed values]\n{entities_str}\n\n"
    else:
        prompt = f"[Current Date and Time]\n{now_str}\n\nGuest Room: {room_no}\n"
        
    if rag_context:
        prompt += f"[Related Knowledge (RAG)]\n{rag_context}\n\n"
        
    if active_requests:
        prompt += "[Currently Active Reservations]\n"
        for req in active_requests:
            prompt += f"- {req}\n"
        prompt += "\n"
        
    prompt += f"[Current Request]\nGuest message: {user_message}"
    
    try:
        # Gemini 호출
        system_instruction_with_lang = CONCIERGE_SYSTEM_PROMPT.replace("{system_language}", system_language)
        raw = await call_gemini_async(prompt=prompt, system_instruction=system_instruction_with_lang, images=images)
        
        if isinstance(raw, list):
            if not raw:
                raise ValueError("AI returned an empty list")
            raw = raw[0]
            
        # AI가 null을 반환할 경우를 대비해 데이터 세척 (Pydantic 검증 오류 방지)
        # 문자열 필드에 null이 들어오면 빈 문자열("")로 대체
        clean_fields = ["clarification_question", "summary", "request_id", "room_no"]
        cleaned_raw = {k: (v if v is not None else ("" if k in clean_fields else ([] if k in ["clarification_options", "missing_fields"] else v))) for k, v in raw.items()}
        
        # room_no is more accurate from our input than AI response
        cleaned_raw["room_no"] = room_no if room_no else cleaned_raw.get("room_no", "")
        
        # Pydantic schema validation
        result = HotelRequestSchema(**cleaned_raw)
    except Exception as e:
        print(f"[Concierge] ⚠️ Error occurred: {e}")
        # Safe fallback response on error
        fallback_err = {
            "ko": "Sorry, there was a problem processing your request. Please try again later or contact the front desk.",
            "en": "Sorry, there was a problem processing your request. Please try again later or contact the front desk.",
            "ja": "申し訳ありません。リクエストの処理中に問題が発生しました。しばらくしてから再度お試しいただくか、フロントデスクまでご連絡ください。",
            "zh": "抱歉，处理您的请求时出现问题。请稍后再试或联系前台。"
        }
        return {
            "request_id": "REQ_ERR",
            "room_no": room_no,
            "domain": "FRONT", # Escalate to front desk on error
            "summary": "AI Processing Error (Fallback)",
            "priority": "NORMAL",
            "entities": {"intent": "OTHER", "error": str(e)},
            "confidence": 0.0,
            "guest_reply": fallback_err.get(system_language, fallback_err["en"]),
            "needs_clarification": False,
            "clarification_question": "",
            "clarification_options": [],
            "missing_fields": []
        }
    
    # Generate default reply message
    intent = result.entities.get('intent')
    entities = result.entities
    
    if intent == 'TAXI':
        dest = entities.get('destination', 'destination')
        time = entities.get('time', 'now')
        count = entities.get('passenger_count', '1')
        default_reply = f"I will check availability and confirm. Would you like to book a taxi for {count} passenger(s) to {dest} at {time}?"
    elif intent == 'LUGGAGE_STORAGE':
        count = entities.get('count', 'luggage')
        action = "store" if entities.get('action') == 'store' else "pick up"
        default_reply = f"Our staff will assist you shortly. Would you like to {action} {count} piece(s) of luggage?"
    elif intent == 'RESTAURANT':
        res_name = entities.get('restaurant_name', 'restaurant')
        cuisine = entities.get('cuisine_type')
        cuisine_str = f"({cuisine})" if cuisine else ""
        default_reply = f"Would you like me to proceed with the reservation for {res_name}{cuisine_str}?"
    elif intent == 'TOUR_INFO':
        category = entities.get('category', 'attraction')
        default_reply = f"Looking for great {category} spots? I'll guide you to recommended places!"
    elif intent == 'RESERVATION':
        target = entities.get('target', 'requested item')
        time = entities.get('time', 'scheduled time')
        default_reply = f"I will check and get back to you. Shall I proceed with the reservation for {target} at {time}?"
    elif intent == 'DELIVERY':
        item = entities.get('item', 'item')
        default_reply = f"We will bring it up to your room upon arrival. Shall I accept the delivery request for {item}?"
    elif intent == 'WAKE_UP_CALL':
        time = entities.get('time', 'scheduled time')
        default_reply = f"Sleep well! Shall I schedule a wake-up call for {time}?"
    elif intent == 'MEDICAL_INFO':
        m_type = "hospital" if entities.get('type') == 'Hospital' else "pharmacy"
        default_reply = f"I'll guide you to the nearest {m_type}. Please press staff call if you feel unwell."
    elif intent == 'POSTAL_SERVICE':
        item = entities.get('item', 'mail')
        default_reply = f"Would you like assistance with sending {item}? (Requires visiting 1st floor concierge desk)"
    if intent == 'INFO':
        default_reply = entities.get('fallback_message', "I will assist you with that.")
    else:
        default_reply = "I will assist you with that."
    
    # [AN-344] 더블체크 UX 및 정보 제공 인텐트 처리 고도화:
    # 1. 정보 안내 목적의 인텐트 (INFO, TOUR_INFO, MEDICAL_INFO)는 티켓을 생성하지 않도록 domain_code = None 처리합니다.
    # 2. 예약/요청 의도(is_request_intent)일 때만 티켓 생성을 진행합니다.
    #    - 필요한 필수 정보가 누락되어 되묻는 질문 단계(needs_clarification)일 때는 일단 카드를 띄우지 않도록 domain_code = None 처리합니다.
    #    - 단, 모든 정보가 수집되어 확인 질문을 하거나 최종 접수 승인을 할 때는 domain_code = "CONCIERGE"로 설정하여 카드를 노출합니다.
    missing = getattr(result, "missing_fields", [])
    is_request_intent = intent not in ['INFO', 'TOUR_INFO', 'MEDICAL_INFO']
    
    if not is_request_intent:
        domain_code = None
    elif intent == "ESCALATION":
        domain_code = "FRONT"
    else:
        if result.needs_clarification:
            domain_code = None
        else:
            domain_code = "CONCIERGE"
    
    # ── CODE-LEVEL GUARDRAIL: Prevent Add/Replace infinite loop ──
    if result.needs_clarification:
        _cl_opts = getattr(result, 'clarification_options', None) or []
        _opts_lower = [o.lower() for o in _cl_opts]
        _is_add_replace_q = any(o in _opts_lower for o in ('add', 'replace'))

        _q_text = (getattr(result, 'clarification_question', '') or '').lower()
        if not _is_add_replace_q and 'add' in _q_text and 'replace' in _q_text:
            _is_add_replace_q = True

        if _is_add_replace_q:
            _user_lower = user_message.strip().lower()

            _previously_asked = False
            if chat_history:
                for _msg in chat_history:
                    _content = (_msg.get('content') or '').lower()
                    _role = _msg.get('role', '')
                    if _role != 'user' and 'add' in _content and 'replace' in _content:
                        _previously_asked = True
                        break

            if _user_lower in ('add', 'replace') or _previously_asked:
                print(f"[CONCIERGE Guard] ✅ Suppressing Add/Replace loop (prev_asked={_previously_asked}, user='{_user_lower}')")
                result.clarification_options = []
                result.needs_clarification = False
                # domain_code가 위에서 None으로 설정되었으므로 재지정
                if is_request_intent:
                    domain_code = "CONCIERGE"

                if _user_lower == 'replace':
                    cleaned_raw["action_type"] = "REPLACE"
                else:
                    result.target_request_id = None
                    cleaned_raw.pop("target_request_id", None)
                    cleaned_raw["action_type"] = "ADD_DUPLICATE"

    # ── CODE-LEVEL GUARDRAIL: Filter meta-instruction pills and inject Contextual Time Pills ──
    raw_time = entities.get("time")
    is_time_vague = _is_vague_time_str(raw_time)

    if is_time_vague:
        entities.pop("time", None)
        if "time" not in missing:
            missing.append("time")
        result.needs_clarification = True

    vague_source = f"{user_message} {raw_time or ''}".lower()

    if result.needs_clarification:
        _cl_opts = getattr(result, 'clarification_options', None) or []
        _valid_opts = [o for o in _cl_opts if not _is_meta_instruction_pill(o)]
        result.clarification_options = _valid_opts

        if ("time" in missing or is_time_vague or not entities.get("time")) and not _valid_opts:
            if any(w in vague_source for w in ["morning", "아침", "오전"]):
                result.clarification_options = ["08:00 AM", "09:00 AM", "10:00 AM"]
            elif any(w in vague_source for w in ["afternoon", "낮", "오후"]):
                result.clarification_options = ["01:00 PM", "02:00 PM", "03:00 PM"]
            elif any(w in vague_source for w in ["evening", "night", "tonight", "저녁", "밤"]):
                result.clarification_options = ["06:00 PM", "07:00 PM", "08:00 PM"]

    # Convert to /analyze response format (adhere to HotelRequestSchema)
    
    final_response = getattr(result, "final_reply", "")
    if not final_response:
        final_response = default_reply
        
    action_type = cleaned_raw.get("action_type")
    if action_type is None:
        action_type = result.entities.get("action_type")
    if action_type is None:
        action_type = "ADD"

    return {
        "request_id": result.request_id if result.request_id else "REQ_TEMP",
        "room_no": room_no,
        "domain_code": domain_code,
        "summary": result.summary,
        "priority": result.priority,
        "entities": result.entities,
        "confidence": result.confidence,
        "guest_reply": result.clarification_question if result.needs_clarification else final_response,
        "needs_clarification": result.needs_clarification,
        "clarification_question": result.clarification_question,
        "clarification_options": getattr(result, "clarification_options", []),
        "missing_fields": getattr(result, "missing_fields", []),
        "reasoning": result.reasoning,
        "action_type": action_type,
        "target_keyword": result.entities.get("target_keyword") if result.entities.get("target_keyword") else raw.get("target_keyword"),
        "target_request_id": result.target_request_id if result.target_request_id else (result.entities.get("target_request_id") if result.entities else raw.get("target_request_id")),
    }

