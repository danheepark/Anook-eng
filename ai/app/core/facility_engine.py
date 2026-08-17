from app.infrastructure.gemini.client import call_gemini_async
from app.prompts.facility_prompt import FACILITY_SYSTEM_PROMPT
from app.schemas.common import HotelRequestSchema
from app.domains.rag import service as rag_service

# ── Equipment name normalization mapping (to English standard names) ──
EQUIPMENT_ALIASES = {
    # Cooling / Heating
    "냉방기": "Air conditioner", "에어콘": "Air conditioner", "에어컨": "Air conditioner", "AC": "Air conditioner", "aircon": "Air conditioner",
    "히터": "Heater", "온풍기": "Heater", "라디에이터": "Heater", "난방기": "Heater",
    # Plumbing
    "양변기": "Toilet", "화장실 변기": "Toilet", "변기": "Toilet",
    "수도꼭지": "Faucet", "세면대 수도": "Faucet", "수전": "Faucet",
    # Network
    "wifi": "Wi-Fi", "WiFi": "Wi-Fi", "인터넷": "Wi-Fi", "무선랜": "Wi-Fi", "와이파이": "Wi-Fi",
    # Appliances
    "텔레비전": "TV", "티비": "TV",
    "드라이기": "Hair dryer", "드라이어": "Hair dryer", "헤어드라이어": "Hair dryer",
    "커피포트": "Electric kettle", "포트": "Electric kettle", "전기포트": "Electric kettle",
    "미니바": "Refrigerator", "냉장고": "Refrigerator",
    "블라인드": "Curtains", "커튼": "Curtains",
}


def _normalize_equipment(equipment: str) -> str:
    """Normalize equipment name to standardized English name"""
    if not equipment:
        return equipment
    if equipment in EQUIPMENT_ALIASES:
        return EQUIPMENT_ALIASES[equipment]
    eq_lower = equipment.lower()
    for key, val in EQUIPMENT_ALIASES.items():
        if key.lower() == eq_lower:
            return val
    return equipment


def _build_guest_reply(result: HotelRequestSchema, system_language: str) -> str:
    """Map final_reply from prompt output for multilingual support"""
    fallback_msg = {
        "ko": "Your request has been received.",
        "en": "Your request has been received.",
        "ja": "受付されました。",
        "zh": "已收到您的请求。"
    }
    return result.clarification_question if result.needs_clarification else getattr(result, "final_reply", fallback_msg.get(system_language, fallback_msg["en"]))


async def run_facility_agent(user_message: str, room_no: str, chat_history: list = None, images: list = None, system_language: str = "en", active_requests: list = None, **kwargs) -> dict:
    """Facility agent: extract facility/repair information from guest message"""
    
    # 1. RAG search → FACILITY domain knowledge (repair costs, contacts, etc.)
    rag_context = ""
    try:
        rag_results = rag_service.search_hybrid(
            query=user_message, domain_code="FACILITY", top_k=3, threshold=0.5
        )
        if rag_results:
            rag_context = "\n".join([f"- {r['question']}: {r['answer']}" for r in rag_results])
    except Exception as e:
        print(f"[FACILITY Agent] RAG search failed: {e}")

    # 2. Build conversation context
    prompt = ""
    if special_notes := kwargs.get("special_notes"):
        prompt += f"[Guest PMS Special Notes]\n{special_notes}\n\n"

    if chat_history:
        context = "\n".join([
            f"{'Guest' if m.get('role')=='user' else 'AI'}: {m.get('content')}"
            for m in chat_history[-5:]
        ])
        prompt += f"[Chat History]\n{context}\n\n"
    else:
        prompt += f"Guest room: {room_no}\n"
    
    # 3. Inject RAG knowledge + current message
    if rag_context:
        prompt += f"[Related Knowledge (RAG)]\n{rag_context}\n\n"
    prompt += f"[Current Request]\nGuest: {user_message}"
    
    system_instruction_with_lang = FACILITY_SYSTEM_PROMPT.replace("{system_language}", system_language)
    raw = await call_gemini_async(prompt=prompt, system_instruction=system_instruction_with_lang, images=images)
    
    if isinstance(raw, list):
        if not raw:
            raise ValueError("AI returned an empty list")
        raw = raw[0]
        
    # Safety fallback: force-inject room_no from backend if AI omits it
    if "room_no" not in raw or raw["room_no"] in ["unknown", "", "from input"]:
        raw["room_no"] = room_no

    # Pydantic validation
    result = HotelRequestSchema(**raw)
    
    # Normalize equipment name
    if 'equipment' in result.entities:
        result.entities['equipment'] = _normalize_equipment(result.entities['equipment'])
    
    action_type = raw.get("action_type")
    if action_type is None:
        action_type = result.entities.get("action_type")
    if action_type is None:
        action_type = "ADD"

    # Convert to /analyze response format
    return {
        "guest_reply": _build_guest_reply(result, system_language),
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

