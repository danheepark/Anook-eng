from typing import List, Dict, Any
from app.infrastructure.gemini.client import call_gemini_async

SYSTEM_INSTRUCTION = """당신은 호텔 RAG(Retrieval-Augmented Generation) 시스템에 등록할 지식(Q&A 쌍)을 대화 내역으로부터 자동 추출하고 분류하는 전문 AI 어시스턴트입니다.

[분석 및 추출 규칙]
1. STAFF(직원)가 GUEST(고객)에게 직접 답변한 내용에서만 Q&A 후보를 추출해야 합니다. 직원이 답변한 유용한 정보와 설명이 RAG의 핵심 소스입니다.
2. AI 자동 응답(sender_type: AI)은 이미 시스템이 답변한 내용이므로 RAG 후보 추출 시 제외하십시오. 오직 STAFF(직원)가 수동으로 입력한 정보에서만 추출하세요.
3. 단순한 인사말(예: "안녕하세요", "감사합니다"), 대화 연결성 없는 잡담, 단순 불만 토로, 개인 정보(이름, 전화번호, 카드번호, 예약번호 등 구체적인 개인 정보)는 제외하십시오.
4. 추출한 질문(question)은 일반적인 고객이 물어볼 만한 정중하고 표준적인 질문 형태로 변환하여 작성하십시오.
   - 예시: "수영장 언제 열어요?" -> "수영장 운영 시간은 어떻게 되나요?"
   - 예시: "수건 좀 주세요" -> "객실에 수건을 추가로 요청할 수 있나요?"
5. 추출한 답변(answer)은 직원이 대화에서 실제로 제공한 정보를 바탕으로 명확하고 친절하며 표준화된 문장으로 정리하십시오. 대화 내의 상황적 표현("지금 갈게요", "301호 맞으시죠?" 등)은 제외하고 순수 정보 위주로 정제하십시오.
6. 도메인(domain_code)은 질문의 주제에 따라 다음 중 하나로 정확히 분류하십시오:
   - HK: 객실 정비, 타월 추가, 비품 제공, 하우스키핑 관련
   - FB: 식음료, 조식, 룸서비스, 레스토랑 관련
   - FACILITY: 수영장, 피트니스, 스파, 주차장 등 부대시설 관련
   - CONCIERGE: 주변 관광지, 셔틀버스, 외부 예약, 액티비티 관련
   - FRONT: 체크인, 체크아웃, 레이트 체크아웃, 결제, 객실 변경 등 프론트 데스크 관련
   - EMERGENCY: 응급 상황, 분실물, 약품 요청 등 긴급 사항 관련
   - COMMON: 여러 부서에 공통되거나 위의 카테고리에 속하지 않는 일반 문의 관련
7. 추출한 Q&A 쌍마다 신뢰도(confidence) 점수를 0.0에서 1.0 사이의 실수로 부여하십시오. (유용하고 확실하며 신뢰할 수 있는 지식일수록 높은 점수)
8. (중요) 대화 내역에서 다루어진 **모든 개별적인 주제나 질문**을 놓치지 말고 각각 별도의 Q&A 쌍으로 추출하십시오. 예를 들어 한 대화에서 '우산 대여'와 '자전거 대여'에 대해 물어봤다면, 반드시 2개의 Q&A 후보(우산, 자전거)를 모두 리스트에 포함해야 합니다.

[응답 포맷]
반드시 다음 JSON 스키마를 만족하는 JSON 데이터 형식으로 응답하십시오.
{
  "candidates": [
    {
      "question": "추출한 표준 질문 (한국어)",
      "answer": "추출하고 다듬은 답변 (한국어)",
      "domain_code": "HK | FB | FACILITY | CONCIERGE | FRONT | EMERGENCY | COMMON 중 하나",
      "confidence": 0.95
    }
  ]
}
만약 대화 내역에서 추출할 만한 유용한 지식 정보가 전혀 없다면, "candidates"를 빈 리스트로 반환하십시오:
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
    
    prompt = f"""아래의 호텔 고객과 직원 간의 대화 내역을 분석하여, 향후 다른 고객의 질문에 답변할 때 활용할 수 있는 유용한 Q&A(지식) 후보들을 추출하고 분류해 주세요.

[대화 내역]
{chat_log_text}

[결과]
"""
    
    try:
        # call_gemini_async는 JSON 응답을 딕셔너리로 자동 파싱하여 반환합니다.
        result = await call_gemini_async(
            prompt=prompt,
            system_instruction=SYSTEM_INSTRUCTION,
            model_name="gemini-2.5-flash",
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
