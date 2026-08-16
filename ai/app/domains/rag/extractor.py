from typing import List, Dict, Any, Optional
from app.infrastructure.gemini.client import call_gemini_async

LANG_MAP = {
    "ko": "Korean (한국어)",
    "en": "English",
    "ja": "Japanese (日本語)",
    "zh": "Simplified Chinese (简体中文)"
}

def get_system_instruction(target_lang: str) -> str:
    lang_name = LANG_MAP.get(target_lang.lower(), "English")
    return f"""You are a specialized hotel knowledge engineer that extracts NEW hotel knowledge (Q&A pairs) from conversations where human hotel staff (STAFF) assisted guests.

[Core Mission]
Extract knowledge ONLY from the direct answers, explanations, and service information provided by human STAFF to GUEST.
Do NOT extract anything answered by AI, because whatever AI already answered is already part of the existing knowledge base.

[Analysis & Extraction Rules]
1. [HUMAN STAFF ONLY]: You MUST extract Q&A candidates ONLY from the inquiries that required human STAFF intervention and where human STAFF provided the specific resolution or answer.
2. [IGNORE AI ANSWERS]: STRICTLY IGNORE any questions/answers that were handled by automated AI (`[AI]`). The AI bot's answers already exist in the database and must NEVER be re-extracted.
3. [IGNORE SYSTEM GREETINGS & NOTICES]: Ignore generic greetings, acknowledgement notices (e.g., "A front desk staff has seen your message", "We will assist you shortly", "프론트 데스크 직원이 메시지를 확인했습니다"), simple complaints without resolution, and closing system notices.
4. [REWRITE QUESTION]: The extracted question (`question`) MUST be rewritten into a polite, standard hotel inquiry that a future guest would ask.
   - Example: "Could I stay until 2 PM tomorrow? is there an extra charge?" -> "Can I request a late checkout until 2 PM, and is there an additional fee?"
5. [STANDARDIZE ANSWER]: The extracted answer (`answer`) MUST capture the actual policy, fee, rule, or resolution provided by the STAFF in clear, polite, and standardized language. Strip out conversational filler (e.g., "Hi there", "I updated your checkout time").
   - Example: STAFF says "We can offer late checkout until 2 PM for an additional $30." -> "Late checkout until 2:00 PM is available for an additional fee of $30."
6. [DOMAIN CATEGORIZATION]: Categorize each extracted item into:
   - HK: Housekeeping, extra amenities, cleaning, linen
   - FB: Food & Beverage, breakfast, room service, dining
   - FACILITY: Swimming pool, gym, spa, parking, facilities
   - CONCIERGE: Local attractions, transport, tours, shuttle
   - FRONT: Check-in, check-out, late check-out, billing, room moves
   - EMERGENCY: Medical, lost & found, urgent safety
   - COMMON: General inquiries that span multiple departments
7. [MANDATORY SYSTEM LANGUAGE RULE]: The extracted Q&A candidates (both `question` and `answer`) MUST ALWAYS be written in {lang_name}. Regardless of what language was used in the original conversation between the guest and staff (e.g., Korean, Japanese, Chinese, or English), you MUST translate, standardize, and output both the question and answer in {lang_name}.

[Response Format]
You MUST respond in JSON format that satisfies the following JSON schema:
{{
  "candidates": [
    {{
      "question": "Polite standard question in {lang_name}",
      "answer": "Clear, informative standard answer in {lang_name} based on human staff information",
      "domain_code": "One of HK | FB | FACILITY | CONCIERGE | FRONT | EMERGENCY | COMMON",
      "confidence": 1.0
    }}
  ]
}}
If no new human staff knowledge is found, return an empty list:
{{
  "candidates": []
}}
"""

async def extract_rag_candidates(messages: List[Dict[str, str]], language: str = "en") -> Dict[str, Any]:
    """
    대화 내용에서 RAG 지식(Q&A) 후보들을 추출하고 도메인을 분류합니다.
    추출된 지식은 반드시 시스템 언어(language)로 표준화/번역되어 출력됩니다.
    """
    if not messages:
        return {"candidates": []}
        
    # 대화 로그를 프롬프트용 텍스트로 변환
    chat_log_lines = []
    for msg in messages:
        sender = msg.get("sender_type", "GUEST")
        content = msg.get("content", "")
        chat_log_lines.append(f"[{sender}]: {content}")
        
    chat_log_text = "\n".join(chat_log_lines)
    lang_name = LANG_MAP.get(language.lower(), "English")
    
    prompt = f"""Analyze the chat history between the hotel guest and staff below, and extract and categorize useful Q&A (knowledge) candidates that can be utilized when answering future guests' questions.

[Target System Language]
{lang_name} (All extracted questions and answers MUST be written in {lang_name})

[Chat History]
{chat_log_text}

[Result]
"""
    
    try:
        # call_gemini_async는 JSON 응답을 딕셔너리로 자동 파싱하여 반환합니다.
        result = await call_gemini_async(
            prompt=prompt,
            system_instruction=get_system_instruction(language),
            model_name="gemini-3.1-flash-lite",
            temperature=0.1
        )
        
        # __ai_log_meta 등 부가 필드가 있을 수 있으므로 정제
        if isinstance(result, dict) and "candidates" in result:
            return {
                "candidates": result["candidates"]
            }
        return {"candidates": []}
    except Exception as e:
        print(f"Error in extract_rag_candidates: {e}")
        return {"candidates": []}
