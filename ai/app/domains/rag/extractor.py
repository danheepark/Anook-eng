from typing import List, Dict, Any
from app.infrastructure.gemini.client import call_gemini_async

SYSTEM_INSTRUCTION = """You are a specialized AI assistant that automatically extracts and categorizes useful knowledge (Q&A pairs) from chat histories to be registered in a hotel RAG (Retrieval-Augmented Generation) system.

[Analysis & Extraction Rules]
1. You MUST extract Q&A candidates ONLY from the direct answers provided by STAFF to GUEST. The useful information and explanations provided by the staff are the core sources for RAG.
2. Exclude AI automated responses (sender_type: AI) as they are already known to the system. Extract ONLY from the information manually inputted by STAFF.
3. Exclude simple greetings (e.g., "Hello", "Thank you"), unrelated small talk, simple complaints, and personal information (specific personal details like names, phone numbers, card numbers, reservation numbers, etc.).
4. The extracted question (`question`) MUST be rewritten into a polite, standard question format that a typical guest might ask.
   - Example: "When does the pool open?" -> "What are the operating hours for the swimming pool?"
   - Example: "Give me some towels" -> "Can I request additional towels for my room?"
5. The extracted answer (`answer`) MUST be organized into clear, kind, and standardized sentences based on the actual information provided by the staff in the chat. Remove situational phrases from the chat (e.g., "I will be there now", "You are in room 301, right?") and refine it to focus purely on the information.
6. Categorize the domain (`domain_code`) accurately based on the subject of the question into one of the following:
   - HK: Room cleaning, extra towels, amenities provision, housekeeping related.
   - FB: Food and beverage, breakfast, room service, restaurant related.
   - FACILITY: Swimming pool, fitness center, spa, parking lot, and other facilities related.
   - CONCIERGE: Nearby attractions, shuttle bus, external reservations, activities related.
   - FRONT: Check-in, check-out, late check-out, payment, room change, and front desk related.
   - EMERGENCY: Emergency situations, lost items, medical requests, and urgent matters related.
   - COMMON: General inquiries that apply to multiple departments or do not fit the above categories.
7. Assign a confidence score (`confidence`) to each extracted Q&A pair as a float between 0.0 and 1.0. (Higher score for more useful, certain, and reliable knowledge).
8. (IMPORTANT) Do not miss any **distinct topics or questions** covered in the chat history. Extract EACH of them as a separate Q&A pair. For example, if a guest asked about both 'umbrella rental' and 'bicycle rental' in one conversation, you MUST include 2 Q&A candidates (umbrella, bicycle) in the list.

[Response Format]
You MUST respond in JSON format that satisfies the following JSON schema.
{
  "candidates": [
    {
      "question": "Extracted standard question (English)",
      "answer": "Extracted and refined answer (English)",
      "domain_code": "One of HK | FB | FACILITY | CONCIERGE | FRONT | EMERGENCY | COMMON",
      "confidence": 0.95
    }
  ]
}
If there is absolutely no useful knowledge information to extract from the chat history, return an empty list for "candidates":
{
  "candidates": []
}
"""

async def extract_rag_candidates(messages: List[Dict[str, str]]) -> Dict[str, Any]:
    """
    대화 내용에서 RAG 지식(Q&A) 후보들을 추출하고 도메인을 분류합니다.
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
    
    prompt = f"""Analyze the chat history between the hotel guest and staff below, and extract and categorize useful Q&A (knowledge) candidates that can be utilized when answering future guests' questions.

[Chat History]
{chat_log_text}

[Result]
"""
    
    try:
        # call_gemini_async는 JSON 응답을 딕셔너리로 자동 파싱하여 반환합니다.
        result = await call_gemini_async(
            prompt=prompt,
            system_instruction=SYSTEM_INSTRUCTION,
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
