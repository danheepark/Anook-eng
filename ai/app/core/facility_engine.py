from app.infrastructure.gemini.client import call_gemini_async
from app.prompts.facility_prompt import FACILITY_SYSTEM_PROMPT
from app.schemas.common import HotelRequestSchema
from app.domains.rag import service as rag_service

# ── 대상물(equipment) 정규화 매핑 ──
# 고객이 같은 설비를 다양하게 부르는 경우를 통일
EQUIPMENT_ALIASES = {
    # 냉난방
    "냉방기": "에어컨", "에어콘": "에어컨", "AC": "에어컨", "aircon": "에어컨",
    "히터": "난방기", "온풍기": "난방기", "라디에이터": "난방기",
    # 수도/배관
    "양변기": "변기", "화장실 변기": "변기",
    "수도꼭지": "수전", "세면대 수도": "수전",
    # 네트워크
    "wifi": "와이파이", "WiFi": "와이파이", "인터넷": "와이파이", "무선랜": "와이파이",
    # 가전
    "텔레비전": "TV", "티비": "TV",
    "드라이기": "헤어드라이어", "드라이어": "헤어드라이어",
    "커피포트": "전기포트", "포트": "전기포트",
    "미니바": "냉장고",
    "블라인드": "커튼",
}


def _normalize_equipment(equipment: str) -> str:
    """대상물 이름을 정규화된 표준명으로 변환"""
    return EQUIPMENT_ALIASES.get(equipment, equipment)


def _build_guest_reply(result: HotelRequestSchema) -> str:
    """다국어 지원을 위해 프롬프트에서 생성된 final_reply를 직접 매핑"""
    return result.clarification_question if result.needs_clarification else getattr(result, "final_reply", "접수되었습니다.")


async def run_facility_agent(user_message: str, room_no: str, chat_history: list = None, images: list = None, system_language: str = "ko", active_requests: list = None, **kwargs) -> dict:
    """시설관리 에이전트: 고객 메시지에서 시설/수리 관련 정보를 추출"""
    
    # 1. RAG 검색 → FACILITY 도메인 지식 (수리비, 담당자 등)
    rag_context = ""
    try:
        rag_results = rag_service.search_hybrid(
            query=user_message, domain_code="FACILITY", top_k=3, threshold=0.5
        )
        if rag_results:
            rag_context = "\n".join([f"- {r['question']}: {r['answer']}" for r in rag_results])
    except Exception as e:
        print(f"[FACILITY Agent] RAG 검색 실패: {e}")

    # 2. 대화 맥락 조립
    if chat_history:
        context = "\n".join([
            f"{'고객' if m.get('role')=='user' else 'AI'}: {m.get('content')}"
            for m in chat_history[-5:]
        ])
        prompt = f"[대화 맥락]\n{context}\n\n"
    else:
        prompt = f"고객 객실: {room_no}\n"
    
    # 3. RAG 지식 삽입 + 현재 메시지
    if rag_context:
        prompt += f"[관련 지식 (RAG)]\n{rag_context}\n\n"
    prompt += f"[현재 요청]\n고객 메시지: {user_message}"
    
    system_instruction_with_lang = FACILITY_SYSTEM_PROMPT.replace("{system_language}", system_language)
    raw = await call_gemini_async(prompt=prompt, system_instruction=system_instruction_with_lang, images=images)
    
    if isinstance(raw, list):
        if not raw:
            raise ValueError("AI returned an empty list")
        raw = raw[0]
        
    # AI가 룸넘버를 누락할 경우를 대비한 안전 장치 (백엔드에서 받은 room_no 강제 주입)
    if "room_no" not in raw or raw["room_no"] in ["unknown", "", "from input"]:
        raw["room_no"] = room_no

    # Pydantic 검증
    result = HotelRequestSchema(**raw)
    
    # 대상물(equipment) 정규화
    if 'equipment' in result.entities:
        result.entities['equipment'] = _normalize_equipment(result.entities['equipment'])
    
    action_type = raw.get("action_type")
    if action_type is None:
        action_type = result.entities.get("action_type")
    if action_type is None:
        action_type = "ADD"

    # /analyze 응답 형태로 변환
    return {
        "guest_reply": _build_guest_reply(result),
        "summary": result.summary,
        "domain_code": None if result.needs_clarification else "FACILITY",
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

