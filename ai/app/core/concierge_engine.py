from app.infrastructure.gemini.client import call_gemini_async
from app.prompts.concierge_prompt import CONCIERGE_SYSTEM_PROMPT
from app.schemas.common import HotelRequestSchema
from app.domains.rag import service as rag_service

# Step 1 전용: 대화에서 확인된 엔티티를 추출하는 경량 프롬프트
ENTITY_EXTRACT_PROMPT = """You are an entity extraction assistant for a hotel concierge conversation.

TASK: Read the conversation and extract ALL entities that the guest has confirmed or provided.

RULES:
1. Only include entities the guest explicitly stated (e.g., "개화꽃" → item: "개화꽃").
2. If the AI mentioned an entity in its message (e.g., "개화꽃을 몇 송이?") and the guest did NOT deny it in their reply, treat it as confirmed.
3. If the guest said "아무데서나" or "상관없어" for any field, set it to "호텔 지정".
4. Convert time references to absolute format if possible.
5. Output ONLY a flat JSON object. No explanation, no markdown.

EXAMPLE:
[대화]
AI: 어떤 꽃을 배달해 드릴까요?
고객: 개화꽃
AI: 개화꽃을 몇 송이 배달해 드릴까요?
고객: 10송이

OUTPUT:
{"intent": "DELIVERY", "item": "개화꽃", "quantity": 10}
"""

async def run_concierge_agent(user_message: str, room_no: str, chat_history: list = None, images: list = None, active_requests: list = None, system_language: str = "ko", **kwargs) -> dict:
    """
    컨시어지 에이전트 엔진 (Step 0-2)
    ───────────────────────────
    고객 메시지를 받아 Gemini를 호출하고, 컨시어지 도메인에 특화된 정보를 추출한다.
    """
    
    from datetime import datetime, timedelta, timezone
    
    # 현재 한국 시간 구하기 (UTC+9)
    kst = timezone(timedelta(hours=9))
    now_str = datetime.now(kst).strftime('%Y-%m-%d %H:%M')
    
    # 1. RAG 검색 → CONCIERGE 도메인 지식
    rag_context = ""
    try:
        rag_results = rag_service.search_hybrid(
            query=user_message, domain_code="CONCIERGE", top_k=3, threshold=0.5
        )
        if rag_results:
            rag_context = "\n".join([f"- {r['question']}: {r['answer']}" for r in rag_results])
    except Exception as e:
        print(f"[CONCIERGE Agent] RAG 검색 실패: {e}")

    # 2. 대화 맥락 조립
    if chat_history:
        context = "\n".join([
            f"{'고객' if m.get('role')=='user' else 'AI'}: {m.get('content')}"
            for m in chat_history[-15:]
        ])
        prompt = f"[현재 날짜 및 시각]\n{now_str}\n\n[대화 맥락]\n{context}\n\n"
        
        # ── Step 1: 경량 Gemini 호출로 기존 엔티티 추출 ──
        # 2턴(메시지 4개) 이상일 때만 실행 (첫 턴에는 추출할 엔티티 없음)
        accumulated_entities = {}
        if len(chat_history) >= 4:
            try:
                extract_result = await call_gemini_async(
                    prompt=f"[대화]\n{context}",
                    system_instruction=ENTITY_EXTRACT_PROMPT
                )
                if isinstance(extract_result, dict):
                    # __ai_log_meta 등 내부 메타데이터 필터링
                    accumulated_entities = {k: v for k, v in extract_result.items() if not k.startswith('__')}
                    print(f"[CONCIERGE] 📋 Step 1 추출 엔티티: {accumulated_entities}")
            except Exception as e:
                print(f"[CONCIERGE] ⚠️ 엔티티 추출 실패 (무시, 기존 방식 진행): {e}")
        
        # Step 1 결과를 [확인된 정보] 블록으로 주입
        if accumulated_entities:
            entities_str = "\n".join([
                f"- {k}: {v} ✅" for k, v in accumulated_entities.items() if v
            ])
            prompt += f"[확인된 정보 - 아래 값들은 이미 고객이 확인한 것이므로 반드시 유지하세요]\n{entities_str}\n\n"
    else:
        prompt = f"[현재 날짜 및 시각]\n{now_str}\n\n고객 객실: {room_no}\n"
        
    if rag_context:
        prompt += f"[관련 지식 (RAG)]\n{rag_context}\n\n"
        
    if active_requests:
        prompt += "[현재 활성화된 예약 내역]\n"
        for req in active_requests:
            prompt += f"- {req}\n"
        prompt += "\n"
        
    prompt += f"[현재 요청]\n고객 메시지: {user_message}"
    
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
        
        # room_no는 AI의 응답보다 우리가 인자로 받은 값이 더 정확하므로 강제 주입
        cleaned_raw["room_no"] = room_no if room_no else cleaned_raw.get("room_no", "")
        
        # Pydantic 스키마 검증
        result = HotelRequestSchema(**cleaned_raw)
    except Exception as e:
        print(f"[Concierge] ⚠️ 에러 발생: {e}")
        # 에러 발생 시 안전한 Fallback 응답 반환
        return {
            "request_id": "REQ_ERR",
            "room_no": room_no,
            "domain": "FRONT", # 에러 시 프론트로 이관
            "summary": "AI 처리 오류 (Fallback)",
            "priority": "NORMAL",
            "entities": {"intent": "OTHER", "error": str(e)},
            "confidence": 0.0,
            "guest_reply": "죄송합니다. 요청을 처리하는 중에 잠시 문제가 발생했습니다. 잠시 후 다시 말씀해 주시거나 프론트 데스크(내선 0번)로 연락 부탁드립니다.",
            "needs_clarification": False,
            "clarification_question": "",
            "clarification_options": [],
            "missing_fields": []
        }
    
    # 기본 응답 메시지 생성 (intent별 상세화는 단계 1에서 수행)
    intent = result.entities.get('intent')
    entities = result.entities
    
    if intent == 'TAXI':
        dest = entities.get('destination', '목적지')
        time = entities.get('time', '지금 바로')
        count = entities.get('passenger_count', '1')
        default_reply = f"배차 확인 후 안내해 드리겠습니다. {time}에 {dest}(으)로 가시는 택시({count}명)를 예약해 드릴까요?"
    elif intent == 'LUGGAGE_STORAGE':
        count = entities.get('count', '짐')
        action = "보관" if entities.get('action') == 'store' else "찾기"
        default_reply = f"담당 직원이 곧 도움을 드리러 가겠습니다. 짐 {count}개를 {action}하시겠습니까?"
    elif intent == 'RESTAURANT':
        res_name = entities.get('restaurant_name', '식당')
        cuisine = entities.get('cuisine_type')
        cuisine_str = f"({cuisine})" if cuisine else ""
        default_reply = f"요청하신 {res_name}{cuisine_str} 예약을 진행해 드릴까요?"
    elif intent == 'TOUR_INFO':
        category = entities.get('category', '관광지')
        default_reply = f"멋진 {category} 장소들을 찾고 계시군요! 아늑이 엄선한 추천 명소를 안내해 드리겠습니다."
    elif intent == 'RESERVATION':
        target = entities.get('target', '요청하신 항목')
        time = entities.get('time', '정해진 시간')
        default_reply = f"확인 후 다시 연락드리겠습니다. {time}에 {target} 예약을 진행해 드릴까요?"
    elif intent == 'DELIVERY':
        item = entities.get('item', '물품')
        default_reply = f"도착 시 객실로 안내해 드리겠습니다. 요청하신 {item} 배달/전달 건을 접수해 드릴까요?"
    elif intent == 'WAKE_UP_CALL':
        time = entities.get('time', '정해진 시간')
        default_reply = f"편안한 밤 되세요! {time}에 모닝콜을 예약해 드릴까요?"
    elif intent == 'MEDICAL_INFO':
        m_type = "병원" if entities.get('type') == 'Hospital' else "약국"
        default_reply = f"근처에서 가장 가까운 {m_type}을(를) 안내해 드리겠습니다. 몸 상태가 많이 안 좋으시면 직원 호출을 눌러주세요."
    elif intent == 'POSTAL_SERVICE':
        item = entities.get('item', '우편물')
        default_reply = f"요청하신 {item} 발송 대행 업무를 도와드릴까요? (1층 컨시어지 데스크 방문 필요)"
    elif intent == 'INFO':
        default_reply = entities.get('fallback_message', "안내해 드리겠습니다.")
    else:
        default_reply = f"요청하신 컨시어지 서비스({intent or '문의사항'})를 확인하였습니다. 담당 직원이 곧 안내해 드릴까요?"
    
    # [AN-344] 더블체크 UX 및 정보 제공 인텐트 처리 고도화:
    # 1. 정보 안내 목적의 인텐트 (INFO, TOUR_INFO, MEDICAL_INFO)는 티켓을 생성하지 않도록 domain_code = None 처리합니다.
    # 2. 예약/요청 의도(is_request_intent)일 때만 티켓 생성을 진행합니다.
    #    - 필요한 필수 정보가 누락되어 되묻는 질문 단계(needs_clarification)일 때는 일단 카드를 띄우지 않도록 domain_code = None 처리합니다.
    #    - 단, 모든 정보가 수집되어 확인 질문을 하거나 최종 접수 승인을 할 때는 domain_code = "CONCIERGE"로 설정하여 카드를 노출합니다.
    missing = getattr(result, "missing_fields", [])
    is_request_intent = intent not in ['INFO', 'TOUR_INFO', 'MEDICAL_INFO']
    
    if not is_request_intent:
        domain_code = None
    else:
        if result.needs_clarification:
            domain_code = None
        else:
            domain_code = "CONCIERGE"
    
    # /analyze 응답 규격에 맞게 변환 (HotelRequestSchema 준수)
    
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

