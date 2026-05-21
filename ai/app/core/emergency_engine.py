from app.infrastructure.gemini.client import call_gemini_async
from app.schemas.common import HotelRequestSchema

EMERGENCY_SYSTEM_PROMPT = """
You are the Emergency Response Agent for "Anook" Hotel.
Your job is to analyze the emergency reported by the guest and extract key information.

Determine the exact emergency category from the following:
- MEDICAL_ASSIST : Medical emergencies, injuries, illnesses.
- SECURITY : Fights, threats, suspicious persons, crime.
- WATER_LEAK : Water leaks, bursting pipes, flooding.
- URGENT_CLEANUP : Vomit, biohazard, urgent messes.
- FIRE : Fire, smoke, burning smell.
- OTHER : Other emergencies not listed.

Create a JSON output strictly conforming to the requested schema below.
Output ONLY a valid JSON object matching the HotelRequestSchema. Do not include markdown formatting or backticks like ```json.

[JSON Output Requirements]
- request_id: "auto"
- room_no: "unknown"
- domain: "EMERGENCY"
- summary: A short 3-line summary of the emergency in `{system_language}`.
- priority: "EMERGENCY" (MUST be EMERGENCY)
- status: "PENDING"
- confidence: A float between 0.0 and 1.0 representing your confidence.
- entities: A JSON object containing {"intent": "<category>", "details": "<extracted details>"}.
- needs_clarification: false (Do NOT ask clarifying questions. Assume the worst-case scenario and send staff immediately).
- clarification_question: ""
- missing_fields: []
- final_reply: A reassuring message in the exact language the guest used.

[Examples]
Guest: "피가 많이 나요. 구급상자 좀 빨리요!"
JSON Output:
{
    "request_id": "auto",
    "room_no": "unknown",
    "domain": "EMERGENCY",
    "summary": "의료 지원 및 구급상자 요청",
    "priority": "EMERGENCY",
    "status": "PENDING",
    "confidence": 0.99,
    "entities": {"intent": "MEDICAL_ASSIST", "details": "피가 많이 남, 구급상자 필요"},
    "needs_clarification": false,
    "clarification_question": "",
    "final_reply": "구급약품/의료 지원이 필요하시군요. 직원이 구급상자를 지참하여 즉시 출동하겠습니다. 안정을 취하고 기다려주세요.",
    "missing_fields": []
}

Guest: "There is water leaking from the ceiling!"
JSON Output:
{
    "request_id": "auto",
    "room_no": "unknown",
    "domain": "EMERGENCY",
    "summary": "천장 누수 발생",
    "priority": "EMERGENCY",
    "status": "PENDING",
    "confidence": 0.98,
    "entities": {"intent": "WATER_LEAK", "details": "water leaking from the ceiling"},
    "needs_clarification": false,
    "clarification_question": "",
    "final_reply": "A water leak has been detected! Please stay away from electrical outlets to prevent electric shock. The facility team is on their way immediately.",
    "missing_fields": []
}
"""

async def run_emergency_agent(user_message: str, room_no: str, chat_history: list = None, images: list = None, system_language: str = "ko", active_requests: list = None, **kwargs) -> dict:
    if chat_history:
        context = "\n".join([
            f"{'Guest' if m.get('role')=='user' else 'AI'}: {m.get('content')}"
            for m in chat_history[-5:]
        ])
        prompt = f"[Chat History]\n{context}\n\n"
    else:
        prompt = ""
        
    prompt += f"[Current Request]\nGuest: {user_message}"
    
    system_instruction_with_lang = EMERGENCY_SYSTEM_PROMPT.replace("{system_language}", system_language)
    raw = await call_gemini_async(prompt=prompt, system_instruction=system_instruction_with_lang, images=images)

    if isinstance(raw, list):
        if not raw:
            raise ValueError("AI returned an empty list")
        raw = raw[0]

    if "request_id" not in raw or raw.get("request_id") == "auto":
        raw["request_id"] = "auto"
    if "room_no" not in raw or raw.get("room_no") == "unknown":
        raw["room_no"] = room_no
    if "domain" not in raw:
        raw["domain"] = "EMERGENCY"
    if "priority" not in raw or raw.get("priority") != "EMERGENCY":
        raw["priority"] = "EMERGENCY"
        
    try:
        result = HotelRequestSchema(**raw)
    except Exception as e:
        print(f"[Emergency Engine] Schema Validation Error: {e}, Raw: {raw}")
        # Fallback to a valid dictionary
        return {
            "guest_reply": "긴급 상황이 접수되었습니다. 즉시 직원이 출동하겠습니다.",
            "summary": "긴급 상황 접수",
            "domain_code": "EMERGENCY",
            "priority": "EMERGENCY",
            "entities": {"intent": "OTHER"},
            "confidence": 0.9,
            "missing_fields": [],
            "clarification_options": [],
        }

    return {
        "guest_reply": result.clarification_question if result.needs_clarification else result.final_reply,
        "summary": result.summary,
        "domain_code": "EMERGENCY",
        "priority": "EMERGENCY",
        "entities": result.entities,
        "confidence": result.confidence,
        "missing_fields": getattr(result, "missing_fields", []),
        "clarification_options": getattr(result, "clarification_options", []),
    }
