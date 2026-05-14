"""
/analyze 엔드포인트 (인프라 브릿지)
─────────────────────────────────
백엔드(PythonAiHttpAdapter)가 호출하는 단일 진입점.

처리 흐름:
  1. RAG 지식 검색 (COMMON 도메인) → 매칭되면 즉시 응답
  2. 라우터 엔진으로 도메인 분류 (HK, FB, FACILITY 등)
  3-a. TASK → domain_code 찍어서 백엔드에 전달 (→ request 테이블 생성)
  3-b. CHITCHAT → 친절한 AI 응답만 반환 (→ request 생성 안 함)
  3-c. CLARIFICATION → 되묻기 응답 반환

※ 부서별 에이전트(intent/entities 파싱)는 팀원이 플러그인으로 추가 예정.
  지금은 라우터가 분류한 domain_code만 전달하고,
  entities는 빈 객체({})로 내려보냅니다.
"""

import random
import re
# pyrefly: ignore [missing-import]
from fastapi import APIRouter
# pyrefly: ignore [missing-import]
from pydantic import BaseModel
from typing import Dict, Any, Optional, List, Callable, Awaitable
import httpx
import os

from app.domains.rag import service as rag_service
from app.core.router_engine import route
from app.infrastructure.gemini.client import call_gemini, call_gemini_async, ai_log_meta_ctx
from app.utils.pii_masking import mask_pii, has_pii

router = APIRouter()


class AnalyzeRequest(BaseModel):
    text: str
    room_no: str
    language: Optional[str] = "ko"
    chat_history: List[dict] = []
    images: Optional[List[str]] = []


# ── 부서별 에이전트 레지스트리 ──
# 팀원이 에이전트를 완성하면 여기에 등록합니다.
from app.core.facility_engine import run_facility_agent
from app.core.hk_engine import run_hk_agent
from app.core.concierge_engine import run_concierge_agent
from app.core.fb_engine import run_fb_agent
from app.core.emergency_engine import run_emergency_agent
from app.core.front_engine import run_front_agent

DOMAIN_AGENTS: Dict[str, Callable[..., Awaitable[Dict[str, Any]]]] = {
    "FACILITY": run_facility_agent,
    "HK": run_hk_agent,
    "CONCIERGE": run_concierge_agent,
    "FB": run_fb_agent,
    "EMERGENCY": run_emergency_agent,
    "FRONT": run_front_agent,
}


# ── 다국어 정적 멘트 딕셔너리 ──
_background_tasks = set()

STATIC_REPLIES = {
    "ESCALATION": {
        "ko": "제가 바로 답변드리기 어려운 부분이라, 프런트 데스크 직원에게 바로 연결해 드릴게요. 잠시만 기다려 주세요!",
        "en": "I'll connect you to the front desk right away to assist you further. Please hold on a moment!"
    },
    "ESCALATION_INFO": {
        "ko": "더 자세한 정보를 위해 프런트 데스크 직원에게 연결해 드릴게요! 잠시만 기다려 주세요.",
        "en": "I'll connect you to the front desk for more detailed information! Please hold on a moment."
    },
    "CLARIFICATION": {
        "ko": "어떤 말씀이신지 조금만 더 자세히 알려주시겠어요? 말씀해주시면 바로 도와드릴게요!",
        "en": "Could you tell me a bit more about what you need? I'd be happy to help you right away!"
    },
    "CANCEL": {
        "ko": "대기 중인 요청은 즉시 취소 처리됩니다. 단, 이미 직원이 처리를 시작한 경우 담당 부서 확인 후 취소됩니다.",
        "en": "Pending requests will be canceled immediately. If staff have already begun processing, it will be canceled after department confirmation."
    },
    "STATUS_CHECK": {
        "ko": "현재 고객님의 최근 요청 진행 상태를 확인해 드리겠습니다.",
        "en": "I will check the status of your most recent request right now."
    },
    "TARGETED_CANCEL": {
        "ko": "지목하신 요청의 취소를 진행합니다. 대기 중인 건은 즉시 취소되며, 처리 중인 건은 부서 확인 후 취소됩니다.",
        "en": "We will process the cancellation for the specific request. Pending ones are canceled immediately, while in-progress ones require department confirmation."
    },
    "TASK_WAIT": {
        "ko": "네, 알겠습니다! 담당 부서로 빠르게 전달해 드릴게요. 조금만 기다려 주세요.",
        "en": "Got it! I'll pass this on to the right department right away. Please give us just a moment."
    },
    "INFO_NOT_FOUND": {
        "ko": "앗, 그 부분은 제가 바로 답변드리기 어려워 프런트 데스크 직원에게 즉시 전달해 두었습니다! 직원이 확인 후 바로 채팅으로 답변 드릴 예정이니 잠시만 기다려 주세요.",
        "en": "Oh, I'm not quite sure about that one! I have forwarded your question to the front desk staff. They will check and reply to you here shortly."
    },
    "ERROR": {
        "ko": "잠시 시스템에 통신 지연이 생겼나 봐요. 조금만 이따가 다시 말씀해 주시겠어요?",
        "en": "It looks like we're having a tiny system hiccup. Could you try asking again in just a moment?"
    },
    "COMPLAINT": {
        "ko": "불편을 드려 대단히 죄송합니다. 지금 바로 프런트와 직접 연결해 드리겠습니다.",
        "en": "We sincerely apologize for the inconvenience. We will connect you directly to the front desk right now."
    },
    "FALLBACK_FAILURE": {
        "ko": "말씀하신 내용을 파악하기 어렵습니다. 프론트 연결이 필요하시면 '프론트 연결'이라고 말씀해 주세요.",
        "en": "I'm having trouble understanding your request. If you need assistance from the front desk, please type 'connect to front desk'."
    },
    "NEED_MORE_INFO": {
        "ko": "자세한 정보가 필요하시면 프런트로 연결해 드릴까요?",
        "en": "Would you like me to connect you to the front desk for more detailed information?"
    },
    "EMERGENCY_REPLY": {
        "ko": "응급 상황을 인지하였습니다. 즉시 119 및 호텔 보안팀을 호출하고 가장 가까운 직원을 파견하겠습니다. 안전한 곳에 머물러 주십시오.",
        "en": "We have recognized an emergency. We are immediately dispatching hotel security and calling 911. Please stay safe."
    }
}

def _get_static_reply(key: str, lang: str) -> str:
    lang = lang.lower()
    if lang not in ["ko", "en"]:
        lang = "en"
    return STATIC_REPLIES.get(key, {}).get(lang, STATIC_REPLIES.get(key, {}).get("en", "We are processing your request."))

def _summarize_from_context(current_text: str, chat_history: list, fallback: str) -> str:
    try:
        recent = chat_history[-6:] if len(chat_history) > 6 else chat_history
        context_lines = []
        for msg in recent:
            role = "고객" if msg.get("role") == "user" else "AI"
            context_lines.append(f"{role}: {msg.get('content', '')}")
        context_lines.append(f"고객: {current_text}")
        context_str = "\n".join(context_lines)

        raw = call_gemini(
            prompt=(
                f"아래 호텔 고객과 AI 컨시어지의 대화를 읽고, "
                f"고객이 원하는 것을 15자 이내의 한국어 명사형으로 한줄 요약해 주세요.\n\n"
                f"[대화]\n{context_str}"
            ),
            system_instruction='반드시 {"summary": "요약내용"} 형식의 JSON으로만 출력하세요. 예: {"summary": "아기 침대 객실 배치 요청"}'
        )
        summary = raw.get("summary", "").strip()
        if summary:
            print(f"[Analyze] 📝 맥락 기반 요약 생성: '{summary}'")
            return summary
    except Exception as e:
        print(f"[Analyze] ⚠️ 맥락 요약 생성 실패 (폴백 사용): {e}")
    return fallback

def _fallback_response(guest_reply: str) -> dict:
    return {
        "guest_reply": guest_reply,
        "summary": "시스템 오류",
        "domain_code": None,
        "priority": "NORMAL",
        "entities": {},
        "confidence": 0.0,
    }

@router.post("/analyze")
async def analyze_message(request: AnalyzeRequest) -> List[Dict[str, Any]]:
    """
    백엔드 PythonAiHttpAdapter가 호출하는 단일 분석 엔드포인트.
    멀티 인텐트를 처리하기 위해 배열(List)을 반환합니다.
    """
    # 사용자가 실제로 입력한 텍스트를 기반으로 언어 덮어쓰기 (크롬 설정 무시)
    def _detect_language(text: str, default: str) -> str:
        if any('\uac00' <= char <= '\ud7a3' for char in text): return "ko"
        if any('a' <= char.lower() <= 'z' for char in text): return "en"
        return default
        
    request.language = _detect_language(request.text, request.language)

    # [수정] AI 모델은 이미지를 직접 판독하지 않도록 이미지 데이터를 비웁니다.
    # 사진은 단순 첨부파일(백엔드가 Redis에 저장) 용도로만 사용하며, AI는 오직 '텍스트'에 집중해 라우팅합니다.
    request.images = []

    # 요청마다 컨텍스트 초기화
    ai_log_meta_ctx.set({})
    
    responses = await _analyze_message_core(request)
    
    final_responses = []
    
    for response in responses:
        guest_reply = response.get("guest_reply", "").strip()
        is_clarification = (response.get("domain_code") is None) and ("?" in guest_reply)
        
        if is_clarification:
            # ── [Option A + 폴백 라운드 카운팅 혼합 이관 카운터] ──
            # 우선순위:
            #   1. 에이전트가 missing_fields를 내려보낸 경우 → 해당 key가 3라운드 미해소면 이관
            #   2. missing_fields가 없는 경우 (라우터-CLARIFICATION) → 라운드 카운팅으로 이관
            current_missing = response.get("missing_fields", [])

            # 현재 턴도 하나의 clarification 라운드로 간주하므로 1부터 시작 (고객의 현재 메시지가 history에서 빠져있기 때문)
            clarification_rounds = 1
            last_was_ai_question = False
            
            # missing_fields별 관련 키워드 (다국어 지원을 위해 영어 키워드 추가)
            keyword_map = {
                "quantity": ["몇", "수량", "개수", "얼마나", "how many", "quantity", "amount", "number"],
                "passenger_count": ["몇", "인원", "탑승", "사람", "몇분", "몇명"],
                "count": ["몇", "수량", "개수", "몇개"],
                "party_size": ["몇", "인원", "몇분", "몇명"],
                "menu_items": ["어떤", "메뉴", "무엇을", "음식", "음료", "what", "menu", "food", "drink", "beverage", "which"],
                "item": ["어떤", "무엇을", "용품", "물품", "필요하신", "what", "item", "need", "amenity", "supply"],
                "temperature": ["따뜻", "차갑", "아이스", "핫", "온도", "hot", "cold", "ice", "iced", "warm", "temperature"],
                "destination": ["어디", "목적지", "장소", "어느", "where", "destination", "place"],
                "time": ["시간", "언제", "몇 시", "time", "when"],
                "symptom": ["증상", "어떻게", "어떤 문제", "고장", "symptom", "problem", "issue", "wrong", "what"],
                "location": ["어디", "위치", "어느 곳", "where", "location"],
                "category": ["어떤", "종류", "테마"],
                "action": ["보관", "찾기", "맡길", "찾을"],
                "restaurant_name": ["식당", "레스토랑", "이름", "어디"],
                "target": ["무엇을", "어떤 대상", "어떤 것"],
                "store_name": ["가게", "상점", "플랫폼", "어디", "이름"],
                "type": ["병원", "약국", "어떤 곳"]
            }
            
            current_keywords = []
            if current_missing:
                for field in current_missing:
                    current_keywords.extend(keyword_map.get(field, []))
            else:
                # 라우터 CLARIFICATION인 경우, 이전 AI 응답도 일반 되묻기 멘트였는지 확인
                current_keywords = ["어떤 말씀이신지", "자세히", "알려주시겠어요", "도와드릴까요", "tell me a bit more", "clarify"]
            
            asked_fields_history = []
            
            for msg in reversed(request.chat_history):
                role = msg.get("role")
                if role == "ai":
                    msg_content = msg.get("content", "").strip()
                    if "?" in msg_content:
                        msg_content_lower = msg_content.lower()
                        
                        # 2번 방법: 이 AI 질문이 포함하고 있는 필수값 키워드 종류 개수를 파악 (진행도 검사)
                        asked_fields = [f for f, kws in keyword_map.items() if any(kw in msg_content_lower for kw in kws)]
                        
                        if asked_fields_history:
                            # 역순으로 순회하므로, 현재 보고 있는 과거 질문(asked_fields)의 필수값 개수가 
                            # 시간상 더 최근 질문(asked_fields_history[-1])보다 많다면
                            # -> 과거에는 여러 개를 물어봤는데 최근에는 적게 물어봄 -> 고객이 정보를 제공해서 필수값이 줄어들었음! (정상 진행)
                            if len(asked_fields) > len(asked_fields_history[-1]):
                                break # 정상적인 진행 과정이므로 루프 단절
                                
                        asked_fields_history.append(asked_fields)

                        # 에이전트가 특정 필수값을 찾고 있다면, 이전 질문들도 그 필수값 관련 키워드를 포함해야만 같은 루프로 인정
                        if current_missing and not current_keywords:
                            # current_missing이 있지만 keyword가 정의되지 않은 경우 루프 단절
                            break
                        if current_keywords and not any(kw in msg_content_lower for kw in current_keywords):
                            break # 이전 질문은 다른 것을 물어봤으므로 연속 루프가 아님!
                        last_was_ai_question = True
                    else:
                        break # AI가 질문을 안 했으면 되묻기 사이클 단절
                elif role == "user":
                    if last_was_ai_question:
                        # 이전 사이클(AI질문->고객답변) 1라운드 추가
                        clarification_rounds += 1
                        last_was_ai_question = False

            # 1번 방법: 컨시어지는 입력받을 값이 많으므로 임계치를 5회로 증가
            agent_domain = response.get("agent_domain")
            threshold = 5 if agent_domain == "CONCIERGE" else 3
            
            should_escalate = False
            if current_missing and clarification_rounds > threshold:
                print(f"\n[Analyze] 🚨 missing_fields {current_missing} 미해소 {clarification_rounds}라운드 → SOFT_FALLBACK 강제 전환")
                should_escalate = True
            elif not current_missing and clarification_rounds > threshold:
                print(f"\n[Analyze] 🚨 라우터-CLARIFICATION {clarification_rounds}라운드 반복 → SOFT_FALLBACK 강제 전환")
                should_escalate = True

            if should_escalate:
                # 하드코딩된 대화 종료 멘트 대신, Gemini를 호출하여 정중하고 유연한 SOFT_FALLBACK 안내 멘트를 생성합니다.
                try:
                    import asyncio
                    recent_chat = "\n".join([f"{m.get('role', 'user')}: {m.get('content', '')}" for m in request.chat_history[-4:]])
                    escalation_prompt = (
                        f"고객과의 대화에서 AI가 여러 번 질문을 던졌지만, 고객이 명확한 답을 주지 않고 계속 겉도는 상황입니다.\n"
                        f"정중하게 '요청하신 내용을 정확히 파악하기 어렵습니다. 원하시는 서비스를 다시 말씀해 주시거나, 프론트 연결을 원하시면 말씀해 주세요.' 라는 뉘앙스로 자연스럽게 안내하고 대화를 종료하세요.\n"
                        f"반드시 고객의 언어(주 언어: {request.language})로 작성하세요.\n\n"
                        f"[최근 대화]\n{recent_chat}"
                    )
                    raw_fallback = call_gemini(
                        prompt=escalation_prompt,
                        system_instruction='반드시 {"reply": "..."} 형태의 JSON으로만 응답하세요.'
                    )
                    generated_reply = raw_fallback.get("reply", _get_static_reply("FALLBACK_FAILURE", request.language))
                except Exception as e:
                    print(f"[Analyze] ⚠️ Fallback 멘트 생성 실패: {e}")
                    generated_reply = _get_static_reply("FALLBACK_FAILURE", request.language)

                response["guest_reply"] = generated_reply
                response["summary"] = "안내 및 거절 (입력 오류 누적)"
                response["domain_code"] = None
                response["priority"] = "NORMAL"
                response["entities"] = {}
                response["confidence"] = 0.0
                response["missing_fields"] = []
                response["clarification_options"] = []
        
        # ── [비동기 로깅 메타데이터 주입] ──
        # STEP 4에서 이미 에이전트별 메타가 세팅되었으면 스킵 (이중 주입 방지)
        if "ai_log_meta" not in response:
            meta = ai_log_meta_ctx.get()
            if meta:
                meta_copy = meta.copy()
                meta_copy["is_fallback"] = (response.get("domain_code") == "FRONT" or response.get("confidence", 1.0) < 0.4)
                response["ai_log_meta"] = meta_copy
            
        final_responses.append(response)
        
    return final_responses


async def _analyze_message_core(request: AnalyzeRequest) -> List[Dict[str, Any]]:
    # ── [비동기 로깅 메타데이터 처리 보류] ──
    # agent_result 안에서 __ai_log_meta를 반환하도록 처리

    # ── [실무 최적화: 역질문 단답형(네/아니요) 강제 라우팅 인터셉트] ──
    if request.chat_history:
        last_ai = None
        for msg in reversed(request.chat_history):
            if msg.get("role") == "ai":
                last_ai = msg.get("content", "")
                break
        
        if last_ai and "프런트 데스크의 직접적인 조치나 확인이 필요하신 상황일까요" in last_ai:
            text_lower = request.text.lower().replace(" ", "")
            if any(w in text_lower for w in ["네", "응", "조치해", "필요해", "부탁해", "해주", "yes", "요청"]):
                print(f"[Analyze] ⚡ 역질문 단답형 '네' 감지 → FRONT_ESCALATION 강제 라우팅")
                return [{
                    "guest_reply": "제가 바로 답변드리기 어려운 부분이라, 프런트 데스크 직원에게 바로 연결해 드릴게요. 잠시만 기다려 주세요!",
                    "summary": "프론트 연결 요청 (고객 확인)",
                    "domain_code": "FRONT",
                    "priority": "URGENT",
                    "entities": {"intent": "ESCALATION"},
                    "confidence": 1.0
                }]
            elif any(w in text_lower for w in ["아니", "괜찮", "됐어", "피드백", "no", "의견", "아닙"]):
                print(f"[Analyze] ⚡ 역질문 단답형 '아니요' 감지 → VOC 강제 라우팅")
                return [{
                    "guest_reply": "소중한 의견 감사드립니다. 서비스 개선에 꼭 참고하겠습니다.",
                    "summary": "고객 피드백 (VOC)",
                    "domain_code": None,
                    "priority": "NORMAL",
                    "entities": {"intent": "VOC", "sentiment": "NEGATIVE"},
                    "confidence": 1.0,
                    "action": "VOC_FEEDBACK"
                }]

    # ──────────────────────────────────────────────
    # STEP 0: 지식 베이스 정확 일치 검색 (Exact Match)
    # ──────────────────────────────────────────────
    # "내 이름", "test" 같은 짧은 단어들이 임베딩 유사도에서 밀리는 현상을 방지하기 위해
    # 사용자의 입력이 지식 베이스의 Question과 100% 일치하면 즉시 답변을 반환합니다.
    try:
        exact_results = rag_service.search_exact(request.text.strip())
        if exact_results:
            best = exact_results[0]
            response = {
                "guest_reply": best["answer"],
                "summary": "AI 자동 답변 (정확 일치)",
                "domain_code": None,
                "priority": "NORMAL",
                "entities": {},
                "confidence": 1.0,
                "reasoning": f"• “{request.text}” → 지식 베이스(RAG) 100% 일치 정보 감지\n• 자동 답변 처리\n• Confidence: 1.0"
            }
            print(f"\n[Analyze] ✅ Exact Match (100% 일치)")
            print(f"[Analyze] 응답: {response}\n")
            return [response]
    except Exception as e:
        print(f"[Analyze] ⚠️ Exact Match 검색 실패 (무시하고 RAG로 진행): {e}")

    # ──────────────────────────────────────────────
    # STEP 1: 지식 베이스 검색 (RAG - 임베딩 기반)
    # ──────────────────────────────────────────────
    try:
        # threshold를 0.85로 상향하여 너무 느슨한 일치 방지
        rag_results = rag_service.search_similar(request.text, domain_code=None, top_k=1, threshold=0.85)
        if rag_results:
            best = rag_results[0]
            rag_domain = best.get("domain_code")
            
            # 단순 정보 제공(FAQ)이므로 부서 상관없이 티켓 생성 방지
            final_domain = None
            
            response = {
                "guest_reply": best["answer"],
                "summary": best.get("summary") or _summarize_from_context(request.text, request.chat_history, best["question"]),
                "domain_code": final_domain,
                "priority": "URGENT" if rag_domain == "EMERGENCY" else "NORMAL",
                "entities": {},
                "confidence": best["similarity"],
                "reasoning": f"• “{request.text}” → 지식 베이스(RAG) 유사 정보 감지 ({rag_domain})\n• 자동 답변 처리 및 부서 전달\n• Confidence: {best['similarity']:.2f}"
            }
            print(f"\n[Analyze] ✅ RAG 매칭 (유사도: {best['similarity']:.2f})")
            print(f"[Analyze] 응답: {response}\n")
            return [response]
    except Exception as e:
        print(f"[Analyze] ⚠️ RAG 검색 실패 (무시하고 라우터로 진행): {e}")

    # ──────────────────────────────────────────────
    # STEP 1-5: [초기 Progress Indicator] 라우터 분석 시작 알림
    # ──────────────────────────────────────────────
    try:
        base_url = os.getenv("BACKEND_URL", "http://localhost:8080")
        async with httpx.AsyncClient(timeout=2.0) as http_client:
            # 빈 배열([])을 보내면 프론트엔드에서 "요청하신 내용을 확인하고 있습니다..." 출력
            await http_client.post(f"{base_url}/chat/{request.room_no}/progress", json={
                "domains": [],
                "status": "ANALYZING"
            })
    except Exception as e:
        print(f"[Analyze] ⚠️ 초기 Progress 이벤트 전송 실패 (무시): {e}")

    # ──────────────────────────────────────────────
    # STEP 2: 라우터 엔진으로 도메인 분류
    # ──────────────────────────────────────────────
    try:
        router_results = route(request.text, request.chat_history, request.images)
        print(f"\n[Analyze] 🔀 라우터 결과: {[{'route_type': r.route_type, 'domain': r.domain, 'confidence': r.confidence} for r in router_results]}")
    except Exception as e:
        print(f"[Analyze] ❌ 라우터 실패: {e}")
        return [_fallback_response(_get_static_reply("ERROR", request.language))]

    final_responses = []
    processed_domains = set()
    agent_tasks = []  # (domain, primary, coroutine)

    # ──────────────────────────────────────────────
    # STEP 2-1: [FALSE ALARM 감지] LLM 기반 다국어 및 의미 검증
    # ──────────────────────────────────────────────
    # 단순 키워드("아니") 매칭의 치명적 오류("아니 진짜 불이 났다고!!")를 방지하고,
    # 영어(No, false alarm), 중국어, 일본어 등 모든 언어의 취소 의도를 정확히 파악합니다.
    _EMERGENCY_CONTEXT_KEYWORDS = ["119", "응급", "보안팀", "긴급", "EMERGENCY", "emergency", "security", "911"]
    
    has_emergency_context = False
    if request.chat_history:
        recent_ai_msgs = [m for m in request.chat_history[-4:] if m.get("role") == "ai"]
        if recent_ai_msgs:
            last_ai_content = recent_ai_msgs[-1].get("content", "").lower()
            has_emergency_context = any(kw in last_ai_content for kw in _EMERGENCY_CONTEXT_KEYWORDS)
    
    if has_emergency_context:
        is_false_alarm = False
        try:
            validation_prompt = (
                f"호텔 직원이 고객에게 긴급 상황(화재, 응급 환자 등)을 인지하고 즉시 조치/출동하겠다고 안내한 직후입니다.\n"
                f"고객이 보낸 다음 메시지를 읽고, 고객의 의도를 정확히 분류하세요.\n"
                f"- CANCEL: 오인 신고, 단순 실수, 장난, 상황 종료 등 출동을 취소하려는 의도 (예: '아니야 잘못 눌렀어', '불 안났어', '취소', 'No, false alarm', '不是')\n"
                f"- CONFIRM: 상황이 실제임을 확인하거나, 강조하거나, 더 빨리 와달라고 재촉하는 의도 (예: '아니 진짜 불났다고!', '빨리 와요', 'Yes, hurry')\n\n"
                f"[고객 메시지]: {request.text}"
            )
            val_raw = await call_gemini_async(
                prompt=validation_prompt,
                system_instruction='반드시 {"intent": "CANCEL"} 또는 {"intent": "CONFIRM"} 형태의 JSON으로만 응답하세요.'
            )
            is_false_alarm = (val_raw.get("intent") == "CANCEL") if isinstance(val_raw, dict) else False
            print(f"[Analyze] 🧠 긴급 상황 의미 검증 결과: {val_raw} (원문: '{request.text}')")
        except Exception as e:
            print(f"[Analyze] ⚠️ 긴급 상황 의미 검증 실패, 폴백 사용: {e}")
            is_false_alarm = any(pat in request.text.lower() for pat in ["취소", "장난", "잘못", "아니", "괜찮", "no", "false", "cancel", "mistake"])

        if is_false_alarm:
            # 라우터가 EMERGENCY를 반환했더라도 강제 CANCEL로 오버라이드
            any_emergency = any(r.route_type == "FRONT_ESCALATION" and r.domain == "EMERGENCY" for r in router_results)
            if any_emergency:
                print(f"[Analyze] 🛡️ FALSE ALARM (LLM 판별 완료) — EMERGENCY → CANCEL 오버라이드")
                for r in router_results:
                    if r.route_type == "FRONT_ESCALATION":
                        r.route_type = "CANCEL"
                        r.domain = "EMERGENCY"
                        r.confidence = 1.0

    # ──────────────────────────────────────────────
    # STEP 2-5: [Progress Indicator] 라우터 결과 기반 진행 상태 전송
    # ──────────────────────────────────────────────
    # ⚠️ 에이전트 실행 전에 반드시 전송 완료되어야 하므로 await로 직접 호출합니다.
    #    (create_task 사용 시, 응답이 먼저 도착하여 Progress UI가 표시되지 않는 레이스 컨디션 발생)
    task_domains = [r.domain for r in router_results if r.route_type in ("DEPARTMENT", "FRONT_ESCALATION", "INFO", "CANCEL") and r.domain]
    
    try:
        base_url = os.getenv("BACKEND_URL", "http://localhost:8080")
        async with httpx.AsyncClient(timeout=2.0) as http_client:
            resp = await http_client.post(f"{base_url}/chat/{request.room_no}/progress", json={
                "domains": task_domains,
                "status": "ANALYZING"
            })
            print(f"[Analyze] ✅ Progress 이벤트 전송 성공 (status: {resp.status_code})")
    except Exception as e:
        print(f"[Analyze] ⚠️ Progress 이벤트 전송 실패 (무시): {e}")

    # [추가] reasoning 필드가 리스트로 올 경우 문자열로 변환 (Pydantic 검증 유연성 확보)
    for res in router_results:
        if isinstance(getattr(res, 'reasoning', None), list):
            res.reasoning = "\n".join(res.reasoning)

    # ──────────────────────────────────────────────
    # STEP 3: 모든 분류 결과 순회하며 에이전트 실행 (멀티 인텐트 처리)
    # ──────────────────────────────────────────────
    for primary in router_results:
        # STEP 3-a: TASK → 부서로 라우팅
        if primary.route_type in ("DEPARTMENT", "FRONT_ESCALATION") and primary.domain:
            domain = primary.domain
            
            # 🚨 중복된 부서(Domain)는 한 번만 호출하도록 처리
            if domain in processed_domains:
                continue
            processed_domains.add(domain)

            # 부서별 에이전트가 등록되어 있으면 호출
            if domain in DOMAIN_AGENTS:
                coro = DOMAIN_AGENTS[domain](
                    user_message=request.text,
                    room_no=request.room_no,
                    chat_history=request.chat_history,
                    images=request.images
                )
                agent_tasks.append((domain, primary, coro))
                continue

            # 에이전트 미등록 시 → domain_code만 찍어서 전달 (인프라 기본 동작)
            context_summary = _summarize_from_context(request.text, request.chat_history, f"{domain} 부서 요청 접수")
            response = {
                "guest_reply": _get_static_reply("TASK_WAIT", request.language),
                "summary": context_summary,
                "domain_code": domain,
                "priority": "NORMAL",
                "entities": {},
                "confidence": primary.confidence,
                "reasoning": getattr(primary, 'reasoning', '알 수 없음'),
            }
            if hasattr(primary, 'action_type'):
                response["action_type"] = primary.action_type

            print(f"[Analyze] 📌 DEPARTMENT → domain: {domain} (에이전트 미등록, 기본 응답)")
            print(f"[Analyze] 응답: {response}\n")
            final_responses.append(response)
            continue

        # STEP 3-b: SOFT_FALLBACK / NON_ACTIONABLE → 티켓 생성 없이 답변만
        if primary.route_type in ("SOFT_FALLBACK", "NON_ACTIONABLE"):
            guest_reply = primary.reply or _get_static_reply("FALLBACK_FAILURE", request.language)
            response = {
                "guest_reply": guest_reply,
                "summary": "안내 및 거절",
                "domain_code": None,
                "priority": "NORMAL",
                "entities": {},
                "confidence": primary.confidence,
                "reasoning": getattr(primary, 'reasoning', '알 수 없음')
            }
            print(f"[Analyze] 💬 {primary.route_type} 응답")
            print(f"[Analyze] 응답: {response}\n")
            final_responses.append(response)
            continue

        # STEP 3-c: CLARIFICATION → 되묻기
        if primary.route_type == "CLARIFICATION":
            # ── [에이전트 재위임 로직] ──
            # 직전 AI 메시지가 에이전트의 구체적 질문("?")이었다면,
            # 라우터가 CLARIFICATION으로 분류해도 해당 에이전트를 다시 호출하여
            # "어떤 말씀인지 모르겠다" 대신 구체적인 재질문을 생성합니다.
            last_agent_domain = None
            recent_ai_msgs = [m for m in request.chat_history[-6:] if m.get("role") == "ai"]
            if recent_ai_msgs and "?" in recent_ai_msgs[-1].get("content", ""):
                # 최근 AI 질문 직전의 TASK 도메인을 찾기 위해 에이전트 등록된 도메인 추정
                # chat_history에 domain 정보가 없으므로, 에이전트 등록 여부로 확인 가능한
                # 도메인을 router_engine의 이전 히스토리 기반으로 추론합니다.
                # → 가장 실용적인 방법: 현재 라우터에게 전체 맥락으로 재질의
                for domain_key in DOMAIN_AGENTS:
                    # 도메인 키워드가 최근 AI 질문에 포함된 경우 해당 에이전트 재호출
                    # (예: "오렌지 주스", "수건", "에어컨" 등)
                    pass
                # 실용적 접근: 직전에 에이전트가 물어본 맥락이 있으면 가장 최근 TASK 도메인으로 재위임
                # chat_history를 역순으로 탐색해 마지막 TASK 처리 도메인 흔적을 찾습니다.
                # 현재 chat_history에 domain 태그가 없으므로, 도메인별 키워드 사전으로 추론합니다.
                DOMAIN_KEYWORDS = {
                    "FB": ["주문", "룸서비스", "메뉴", "음식", "음료", "콜라", "주스", "커피", "맥주", "와인", "스테이크", "샐러드"],
                    "HK": ["수건", "타월", "베개", "이불", "침대", "어메니티", "칫솔", "샴푸", "비누", "슬리퍼"],
                    "FACILITY": ["에어컨", "TV", "와이파이", "냉장고", "전기", "수도", "변기", "샤워", "조명", "고장"],
                    "CONCIERGE": ["택시", "맡기", "짐", "레스토랑", "예약", "투어", "관광", "공항", "모닝콜"],
                }
                recent_context = " ".join(
                    m.get("content", "") for m in request.chat_history[-8:]
                )
                for domain_key, keywords in DOMAIN_KEYWORDS.items():
                    if domain_key in DOMAIN_AGENTS and any(kw in recent_context for kw in keywords):
                        last_agent_domain = domain_key
                        break

            if last_agent_domain:
                try:
                    agent_result = await DOMAIN_AGENTS[last_agent_domain](
                        user_message=request.text,
                        room_no=request.room_no,
                        chat_history=request.chat_history,
                        images=request.images
                    )
                    response = {
                        "guest_reply": agent_result.get("guest_reply", primary.clarification_question or _get_static_reply("CLARIFICATION", request.language)),
                        "summary": agent_result.get("summary", primary.summary or "추가 확인 필요"),
                        "domain_code": None if agent_result.get("missing_fields") else agent_result.get("domain_code", None),
                        "priority": agent_result.get("priority", "NORMAL"),
                        "entities": agent_result.get("entities", {}),
                        "confidence": agent_result.get("confidence", primary.confidence),
                        "missing_fields": agent_result.get("missing_fields", []),
                        "clarification_options": agent_result.get("clarification_options", []),
                        "reasoning": agent_result.get("reasoning", getattr(primary, 'reasoning', '알 수 없음'))
                    }
                    print(f"[Analyze] ❓ CLARIFICATION → {last_agent_domain} 에이전트 재위임 (구체적 재질문)")
                    print(f"[Analyze] 응답: {response}\n")
                    final_responses.append(response)
                    continue
                except Exception as e:
                    print(f"[Analyze] ⚠️ CLARIFICATION 에이전트 재위임 실패: {e}")

            # last_agent_domain이 없거나 실패한 경우, FRONT 에이전트(기본 라우팅 질문)로 처리
            try:
                agent_result = await DOMAIN_AGENTS["FRONT"](
                    user_message=request.text,
                    room_no=request.room_no,
                    chat_history=request.chat_history,
                    images=request.images
                )
                # FRONT 에이전트가 ESCALATION(직원 연결)을 결정한 경우 domain_code를 살려서 티켓 생성
                is_escalation = agent_result.get("entities", {}).get("intent") == "ESCALATION"
                response = {
                    "guest_reply": agent_result.get("guest_reply", _get_static_reply("CLARIFICATION", request.language)),
                    "summary": agent_result.get("summary", "추가 확인 필요"),
                    "domain_code": agent_result.get("domain_code") if is_escalation else None,
                    "priority": agent_result.get("priority", "NORMAL"),
                    "entities": agent_result.get("entities", {}),
                    "confidence": agent_result.get("confidence", primary.confidence),
                    "missing_fields": agent_result.get("missing_fields", []),
                    "clarification_options": agent_result.get("clarification_options", []),
                    "reasoning": agent_result.get("reasoning", getattr(primary, 'reasoning', '알 수 없음'))
                }
                print(f"[Analyze] ❓ CLARIFICATION → FRONT 에이전트 위임 (부서 라우팅 구체화)")
                print(f"[Analyze] 응답: {response}\n")
                final_responses.append(response)
                continue
            except Exception as e:
                print(f"[Analyze] ⚠️ FRONT 에이전트 실패, 정적 응답 폴백: {e}")
                response = {
                    "guest_reply": _get_static_reply("CLARIFICATION", request.language),
                    "summary": "추가 확인 필요",
                    "domain_code": None,
                    "priority": "NORMAL",
                    "entities": {},
                    "confidence": primary.confidence,
                    "clarification_options": primary.clarification_options or [],
                    "reasoning": getattr(primary, 'reasoning', '알 수 없음')
                }
                print(f"[Analyze] ❓ CLARIFICATION — reasoning: {primary.reasoning}")
                print(f"[Analyze] 응답: {response}\n")
                final_responses.append(response)
                continue

        # STEP 3-d: INFO → RAG 지식 기반 답변 (요청 미생성)
        if primary.route_type == "INFO":
            domain = primary.domain or "FRONT"
            
            # ── FB 도메인 INFO는 에이전트에게 위임 (메뉴 기반 알러지 추천 등) ──
            if domain == "FB" and "FB" in DOMAIN_AGENTS:
                try:
                    agent_result = await DOMAIN_AGENTS["FB"](
                        user_message=request.text,
                        room_no=request.room_no,
                        chat_history=request.chat_history,
                        images=request.images
                    )
                    response = {
                        "guest_reply": agent_result.get("guest_reply", "메뉴 정보를 확인 중입니다."),
                        "summary": agent_result.get("summary", "FB 정보 문의"),
                        "domain_code": None,
                        "priority": "NORMAL",
                        "entities": agent_result.get("entities", {}) if isinstance(agent_result, dict) else {},
                        "confidence": agent_result.get("confidence", primary.confidence) if isinstance(agent_result, dict) else primary.confidence,
                        "reasoning": agent_result.get("reasoning", getattr(primary, 'reasoning', '알 수 없음')) if isinstance(agent_result, dict) else getattr(primary, 'reasoning', '알 수 없음')
                    }
                    print(f"[Analyze] ℹ️ INFO+FB → FB 에이전트 위임 처리")
                    print(f"[Analyze] 응답: {response}\n")
                    final_responses.append(response)
                    continue
                except Exception as e:
                    print(f"[Analyze] ⚠️ FB 에이전트 INFO 위임 실패, RAG 폴백: {e}")

            try:
                context_lines = []
                for msg in request.chat_history[-3:]:
                    role = "고객" if msg.get("role") == "user" else "AI"
                    context_lines.append(f"{role}: {msg.get('content')}")
                context_str = "\n".join(context_lines)

                rewrite_prompt = (
                    f"[과거 대화 맥락]\n{context_str}\n\n"
                    f"[고객의 질문]\n{request.text}\n\n"
                    f"위 맥락을 참고하여, 고객이 궁극적으로 알고 싶은 '호텔 정책/정보'가 무엇인지 파악하고 지식 베이스 검색에 최적화된 구체적인 문장으로 재작성하세요."
                )
                if domain == "CONCIERGE":
                    sys_instruction = (
                        "당신은 호텔 검색 엔진 최적화 전문가입니다. "
                        "사용자가 대명사('이거', '다른데')나 생략된 표현을 사용했더라도, 반드시 [과거 대화 맥락]을 파악하여 사용자가 찾고자 하는 '명확한 대상(예: 식당, 관광지, 카페 등)'을 명시적으로 포함한 '단일 검색 쿼리 문장' 하나만 작성하세요. "
                        "절대로 고객에게 대답하거나 말을 걸지 마세요. 질문형으로 끝내지 말고, 검색어 형태로 명사형이나 평서문으로 작성하세요. "
                        "반드시 {\"reply\": \"재작성된 문장\"} 형식의 JSON으로만 출력하세요."
                    )
                else:
                    sys_instruction = (
                        "당신은 호텔 검색 엔진 최적화 전문가입니다. "
                        "사용자가 특정 사물이나 서비스를 지칭하지 않고 '왜', '얼마야' 등 생략된 표현을 사용했더라도, 반드시 [과거 대화 맥락]을 파악하여 질문 대상을 찾아 명시적으로 포함시키세요. (예: '생수 추가 요금이 발생하는 이유가 무엇인가요?') "
                        "**주의**: 사용자가 직접 언급하지 않은 구체적인 음식 이름이나 카테고리를 무단으로 추가하지 마세요. "
                        "반드시 {\"reply\": \"재작성된 문장\"} 형식의 JSON으로만 출력하세요."
                    )
                    
                search_query_raw = await call_gemini_async(
                    prompt=rewrite_prompt,
                    system_instruction=sys_instruction
                )
                search_query = search_query_raw.get("reply", request.text) if isinstance(search_query_raw, dict) else request.text
                print(f"[Analyze] 🔍 검색어 확장: '{request.text}' → '{search_query}'")

                # 🛠️ [검색 엔진 고도화]
                top_k = 10 if domain == "CONCIERGE" else 3
                threshold = 0.3 if domain == "CONCIERGE" else 0.5
                
                rag_results = rag_service.search_hybrid(search_query, domain_code=domain, top_k=top_k, threshold=threshold)
                
                # 🎨 [컨시어지 전용 리랭킹/셔플/네거티브 필터링]
                additional_instructions = ""
                import random
                if domain == "CONCIERGE" and rag_results:
                    rag_results = [r for r in rag_results if r.get('similarity', 1.0) >= 0.3]
                    
                    mentioned_places = []
                    if request.chat_history:
                        for msg in request.chat_history[-6:]:
                            if msg.get('role') == 'ai':
                                content = msg.get('content', '')
                                all_answers = rag_service.get_all_answers_by_domain("CONCIERGE")
                                
                                # 1) Find all places that appear in this message
                                found_in_msg = []
                                for ans in all_answers:
                                    found = re.findall(r"'([^']+)'", ans)
                                    for f in found:
                                        if f in content and f not in found_in_msg:
                                            found_in_msg.append(f)
                                
                                # 2) Sort them by the order they appear in the message
                                found_in_msg.sort(key=lambda x: content.find(x))
                                
                                # 3) Append to mentioned_places if not already there
                                for place in found_in_msg:
                                    if place not in mentioned_places:
                                        mentioned_places.append(place)
                    
                    fresh_results = [r for r in rag_results if not any(p in r['answer'] for p in mentioned_places)]
                    
                    fact_results = [r for r in fresh_results if "[fact]" in r['question'] and r.get('similarity', 0) >= 0.7]
                    rec_results = [r for r in fresh_results if "[recommendation]" in r['question']]
                    other_results = [r for r in fresh_results if "[fact]" not in r['question'] and "[recommendation]" not in r['question']]
                    
                    last_place = mentioned_places[-1] if mentioned_places else None
                    is_another_request = any(word in request.text for word in ["다른", "또", "더", "다음에", "더보기"])
                    
                    last_category = None
                    if last_place:
                        from app.domains.concierge.knowledge_data import CONCIERGE_KNOWLEDGE
                        for k in CONCIERGE_KNOWLEDGE:
                            if last_place in k['answer']:
                                last_category = k.get('category')
                                break
                    
                    if is_another_request and last_category:
                        # 동일 카테고리만 후보로 남김
                        rec_results = [r for r in rec_results if r.get('category') == last_category]

                    is_reconfirm = "RE-CONFIRM" in (primary.reasoning or "").upper()
                    if not is_reconfirm and rec_results:
                        # 셔플 풀 확대 (0.05 -> 0.15)
                        top_score = rec_results[0].get('similarity', 0)
                        candidates = [r for r in rec_results if top_score - r.get('similarity', 0) < 0.15]
                        others = [r for r in rec_results if top_score - r.get('similarity', 0) >= 0.15]
                        
                        random.shuffle(candidates)
                        rec_results = candidates + others
                        
                        # AI가 헷갈리지 않고 항상 새롭고 정확한 1개만 추천하도록 슬라이싱
                        rec_results = rec_results[:1]
                    
                    # 새 추천 결과가 있다면 이미 말한 것은 아예 빼버려서 AI의 착각을 방지
                    if rec_results:
                        rag_results = fact_results + rec_results + other_results
                    else:
                        already_said = [r for r in rag_results if any(p in r['answer'] for p in mentioned_places)]
                        if is_another_request and last_category:
                            already_said = [r for r in already_said if r.get('category') == last_category]
                        rag_results = fact_results + already_said

                    is_fact_included = any("[fact]" in r['question'] for r in rag_results)
                    fact_instruction = "\n- **중요**: [fact] 태그 정보는 질문에 대한 확정적 답변이므로 즉시 활용하세요." if is_fact_included else ""

                    mentioned_str = ", ".join([f"'{p}'" for p in mentioned_places])
                    if rec_results:
                        last_mention_instruction = f"이전 대화에서 이미 {mentioned_str} 등을 추천했음을 인지하세요. 고객이 '다른' 것을 원할 경우 이전에 추천한 곳을 절대 다시 추천하지 말고 제공된 새로운 [KNOWLEDGE BASE] 항목을 우선적으로 제시하세요. " if mentioned_places else ""
                        avoid_repeat_instruction = "\n- 이전 대화와 중복되는 장소 추천은 절대 피하세요."
                    else:
                        last_mention_instruction = "고객이 다른 장소를 원하지만 현재 지식 베이스에 더 이상 새로운 추천 장소가 없습니다. '현재 더 이상 새로운 장소를 안내해 드리기 어려워, 이전에 안내해 드렸던 장소 중 하나를 다시 추천해 드립니다'와 같이 양해를 구하고 [KNOWLEDGE BASE]에 있는 장소 하나를 자연스럽게 다시 추천하세요. " if mentioned_places else ""
                        avoid_repeat_instruction = ""

                    additional_instructions = (
                        f"\n- 답변 시 마크다운 강조(**)를 사용하지 말고 평문으로 작성하세요. {fact_instruction}"
                        f"\n- {last_mention_instruction}사용자의 요청 흐름에 맞춰 자연스럽게 대화를 이어가세요. "
                        f"\n- 안내한 내용이 택시 호출, 꽃배달, 짐 보관 등 '요청이나 예약'이 가능한 서비스라면, 답변 마지막에 반드시 '지금 바로 예약을 도와드릴까요?' 또는 '필요하시면 바로 접수해 드릴까요?'와 같이 서비스로 이어지는 질문을 포함하세요."
                        f"\n- 예: '파스타 외에 다른 맛집을 찾으신다면 ~는 어떠세요?', '택시는 정문에서 이용 가능합니다. 지금 바로 호출해 드릴까요?' 등"
                        f"{avoid_repeat_instruction}"
                    )

                if rag_results:
                    knowledge = "\n".join([f"Q: {r['question']}\nA: {r['answer']}" for r in rag_results])
                    info_prompt = (
                        f"고객 질문: {request.text}\n\n"
                        f"아래 제공된 [호텔 지식]은 고객 질문에 대해 검색된 공식 답변입니다. 반드시 이 지식을 활용하여 고객의 질문에 사용된 언어(또는 {request.language} 언어)로 친절하게 답변하세요. {additional_instructions}\n"
                        f"고객이 한 번 더 묻거나 구체적으로 묻더라도, 제공된 [호텔 지식]을 명확한 답으로 간주하고 답변을 작성하세요. "
                        f"그리고 답변 마지막에 반드시 '{_get_static_reply('NEED_MORE_INFO', request.language)}' 라는 문장을 덧붙이세요.\n"
                        f"만약 [호텔 지식]이 고객의 질문과 아예 무관하다면, 절대 유추하거나 지어내지 말고 "
                        f"'{_get_static_reply('INFO_NOT_FOUND', request.language)}' 라는 문장을 그대로 답변으로 사용하세요.\n\n"
                        f"[호텔 지식]\n{knowledge}"
                    )
                    raw = await call_gemini_async(
                        prompt=info_prompt, 
                        system_instruction='당신은 친절한 아눅(Anook) 호텔 컨시어지입니다. 반드시 {"reply": "답변내용"} 형식의 JSON으로만 출력하세요.'
                    )
                    guest_reply = raw.get("reply", _get_static_reply("INFO_NOT_FOUND", request.language)) if isinstance(raw, dict) else _get_static_reply("INFO_NOT_FOUND", request.language)
                else:
                    if domain == "CONCIERGE" and "CONCIERGE" in DOMAIN_AGENTS:
                        print(f"[Analyze] 💡 INFO → RAG 결과 없음. CONCIERGE 에이전트 폴백 실행")
                        agent_result = await DOMAIN_AGENTS["CONCIERGE"](
                            user_message=request.text,
                            room_no=request.room_no,
                            chat_history=request.chat_history,
                            images=request.images
                        )
                        guest_reply = agent_result.get("guest_reply", _get_static_reply("INFO_NOT_FOUND", request.language)) if isinstance(agent_result, dict) else _get_static_reply("INFO_NOT_FOUND", request.language)
                    else:
                        guest_reply = _get_static_reply("INFO_NOT_FOUND", request.language)
            except Exception as e:
                print(f"[Analyze] ⚠️ INFO 처리 중 에러 발생: {e}")
                guest_reply = _get_static_reply("INFO_NOT_FOUND", request.language)

            info_not_found_msg = _get_static_reply("INFO_NOT_FOUND", request.language)
            need_more_info_msg = _get_static_reply("NEED_MORE_INFO", request.language)
            if guest_reply == info_not_found_msg:
                response = {
                    "guest_reply": _get_static_reply("ESCALATION", request.language),
                    "summary": "AI 미학습 정보 (직원 연결)",
                    "domain_code": "FRONT",
                    "priority": "NORMAL",
                    "entities": {"intent": "ESCALATION"},
                    "confidence": 0.0,
                    "reasoning": getattr(primary, 'reasoning', '알 수 없음')
                }
            elif need_more_info_msg in guest_reply:
                response = {
                    "guest_reply": guest_reply,
                    "summary": "추가 정보 필요 (프론트 연결 제안)",
                    "domain_code": None,
                    "priority": "NORMAL",
                    "entities": {},
                    "confidence": primary.confidence,
                    "clarification_options": ["네", "아니요"],
                    "reasoning": getattr(primary, 'reasoning', '알 수 없음')
                }
            else:
                response = {
                    "guest_reply": guest_reply,
                    "summary": "정보 문의",
                    "domain_code": None,
                    "priority": "NORMAL",
                    "entities": {},
                    "confidence": primary.confidence,
                }
                
            print(f"[Analyze] ℹ️ INFO 응답")
            print(f"[Analyze] 응답: {response}\n")
            final_responses.append(response)
            continue

        # STEP 3-e: CANCEL → 요청 취소
        if primary.route_type == "CANCEL":
            text_lower = request.text.lower()
            is_all = any(word in text_lower for word in ["전부", "모두", "모든", "다 취소", "전체", "all", "everything"])
            
            # FALSE ALARM: EMERGENCY 도메인 취소 (오인 신고 정정)
            if primary.domain == "EMERGENCY":
                false_alarm_reply_ko = "확인되었습니다. 긴급 호출을 취소 처리하겠습니다. 혹시 다른 도움이 필요하시면 말씀해 주세요."
                false_alarm_reply_en = "Understood. The emergency call has been cancelled. Please let us know if you need anything else."
                response = {
                    "guest_reply": false_alarm_reply_ko if request.language == "ko" else false_alarm_reply_en,
                    "summary": "긴급 호출 취소 (오인 신고)",
                    "domain_code": "EMERGENCY",
                    "priority": "NORMAL",
                    "entities": {"intent": "CANCEL"},
                    "confidence": primary.confidence,
                    "action": "CANCEL_REQUEST",
                }
                print(f"[Analyze] 🛡️ FALSE ALARM CANCEL 응답")
                print(f"[Analyze] 응답: {response}\n")
                final_responses.append(response)
                continue
            elif is_all:
                response = {
                    "guest_reply": "대기 중인 요청은 즉시 취소 처리됩니다. 단, 이미 직원이 처리를 시작한 요청의 경우 담당 부서에 취소 가능 여부를 확인해 달라고 전달해 두겠습니다.",
                    "summary": "전체 요청 취소",
                    "domain_code": None,
                    "priority": "NORMAL",
                    "entities": {},
                    "confidence": primary.confidence,
                    "action": "CANCEL_ALL_REQUESTS",
                    "reasoning": getattr(primary, 'reasoning', '알 수 없음')
                }
            else:
                reply_key = "TARGETED_CANCEL" if primary.domain else "CANCEL"
                response = {
                    "guest_reply": _get_static_reply(reply_key, request.language),
                    "summary": "요청 취소",
                    "domain_code": primary.domain if primary.domain else None,
                    "priority": "NORMAL",
                    "entities": {"intent": "CANCEL"},
                    "confidence": primary.confidence,
                    "action": "CANCEL_REQUEST",
                    "reasoning": getattr(primary, 'reasoning', '알 수 없음')
                }
                if hasattr(primary, 'action_type'):
                    response["action_type"] = primary.action_type
                # [Keyword Targeting] 취소 대상 키워드 전달
                if hasattr(primary, 'target_keyword') and primary.target_keyword:
                    response["target_keyword"] = primary.target_keyword
            
            print(f"[Analyze] 🛑 CANCEL 응답")
            print(f"[Analyze] 응답: {response}\n")
            final_responses.append(response)
            continue
            
        # STEP 3-f: FRONT_ESCALATION → 명시적인 프론트 데스크 연결 요청
        if primary.route_type == "FRONT_ESCALATION":
            is_emergency = (primary.domain == "EMERGENCY")
            
            # 불만(Complaint) 여부 파악 (키워드 기반 휴리스틱)
            is_complaint = False
            if not is_emergency:
                text_lower = request.text.lower()
                summary_lower = (primary.summary or "").lower()
                reasoning_lower = (primary.reasoning or "").lower()
                complaint_keywords = ["불만", "컴플레인", "불편", "짜증", "최악", "환불", "태도", "실화", "이따구", "장난하", "엉망", "화가", "기분"]
                is_complaint = any(kw in text_lower or kw in summary_lower or kw in reasoning_lower for kw in complaint_keywords)
                
            escalation_key = "ESCALATION_INFO" if "INFO_ESCALATION" in (primary.reasoning or "") else "ESCALATION"
            
            if is_emergency:
                reply_key = "EMERGENCY_REPLY"
                summary_val = "긴급 구조 요청 (119/보안팀)"
            elif is_complaint:
                reply_key = "COMPLAINT"
                summary_val = "프론트 연결 (고객 불만)"
            else:
                reply_key = escalation_key
                summary_val = "프론트 연결 요청 (고객 확인)"
            
            response = {
                "guest_reply": _get_static_reply(reply_key, request.language),
                "summary": summary_val,
                "domain_code": "EMERGENCY" if is_emergency else "FRONT",
                "priority": "EMERGENCY" if is_emergency else "URGENT",
                "entities": {"intent": "EMERGENCY" if is_emergency else "ESCALATION"},
                "confidence": 0.0,
                "reasoning": getattr(primary, 'reasoning', '알 수 없음')
            }
            print(f"[Analyze] 🚨 FRONT_ESCALATION 응답")
            print(f"[Analyze] 응답: {response}\n")
            final_responses.append(response)
            continue

        # STEP 3-f-2: VOC → 단순 피드백 (티켓 생성 X)
        if primary.route_type == "VOC":
            sentiment = primary.sentiment if hasattr(primary, 'sentiment') else "POSITIVE"
            reply_ko = "따뜻한 말씀 감사드립니다! 담당 부서에 꼭 전달하겠습니다." if sentiment == "POSITIVE" else "소중한 의견 감사드립니다. 서비스 개선에 꼭 참고하겠습니다."
            reply_en = "Thank you for your kind words! We will definitely pass it on to the department." if sentiment == "POSITIVE" else "Thank you for your valuable feedback. We will use it to improve our service."
            response = {
                "guest_reply": reply_ko if request.language == "ko" else reply_en,
                "summary": "고객 피드백 (VOC)",
                "domain_code": None, # 티켓 생성 안 함
                "priority": "NORMAL",
                "entities": {"intent": "VOC", "sentiment": sentiment},
                "confidence": primary.confidence,
                "action": "VOC_FEEDBACK",
                "reasoning": getattr(primary, 'reasoning', '알 수 없음')
            }
            print(f"[Analyze] 📝 VOC 피드백 응답")
            print(f"[Analyze] 응답: {response}\n")
            final_responses.append(response)
            continue


        # STEP 3-g: STATUS_CHECK → 진행 상태 확인
        if primary.mode == "STATUS_CHECK":
            response = {
                "guest_reply": _get_static_reply("STATUS_CHECK", request.language),
                "summary": "요청 진행 상태 확인",
                "domain_code": None,
                "priority": "NORMAL",
                "entities": {"action": "STATUS_CHECK"},
                "confidence": primary.confidence,
                "action": "STATUS_CHECK",
                "reasoning": getattr(primary, 'reasoning', '알 수 없음')
            }
            print(f"[Analyze] 🔍 STATUS_CHECK 응답")
            print(f"[Analyze] 응답: {response}\n")
            final_responses.append(response)
            continue

    # ──────────────────────────────────────────────
    # STEP 3-g: 병렬 실행 대기 및 결과 합치기
    # ──────────────────────────────────────────────
    if agent_tasks:
        import asyncio
        coroutines = [coro for _, _, coro in agent_tasks]
        results = await asyncio.gather(*coroutines, return_exceptions=True)
        
        for (domain, primary, _), agent_result in zip(agent_tasks, results):
            if isinstance(agent_result, Exception):
                print(f"[Analyze] ⚠️ {domain} 에이전트 실패: {agent_result}")
                continue

            agent_confidence = agent_result.get("confidence", primary.confidence)
            final_domain_code = agent_result.get("domain_code", domain)
            final_entities = agent_result.get("entities", {})
            final_guest_reply = agent_result.get("guest_reply", "요청을 접수하였습니다.")
            final_summary = agent_result.get("summary", f"{domain} 요청")

            # (이전의 글로벌 이관 로직은 삭제됨: 잘못된 배정은 직원이 수동 이관함)

            # 🚨 [카드 생성 방지 로직] 필수값(missing_fields)이 아직 다 채워지지 않았다면 절대 카드를 생성하지 않음 (대화로만 처리)
            if agent_result.get("missing_fields"):
                final_domain_code = None

            response = {
                "guest_reply": final_guest_reply,
                "summary": final_summary,
                "domain_code": final_domain_code,
                "agent_domain": domain,
                "priority": agent_result.get("priority", "NORMAL"),
                "entities": final_entities,
                "confidence": agent_confidence,
                "missing_fields": agent_result.get("missing_fields", []),
                "clarification_options": agent_result.get("clarification_options", []),
                "reasoning": agent_result.get("reasoning", getattr(primary, 'reasoning', '알 수 없음'))
            }
            if "__ai_log_meta" in agent_result:
                response["__ai_log_meta"] = agent_result["__ai_log_meta"]
                
            # 우선순위: 1. 에이전트 entities, 2. 에이전트 루트, 3. 라우터 결과
            if "action_type" in agent_result.get("entities", {}):
                response["action_type"] = agent_result["entities"]["action_type"]
            elif "action_type" in agent_result:
                response["action_type"] = agent_result["action_type"]
            elif hasattr(primary, 'action_type'):
                response["action_type"] = primary.action_type

            # [Keyword Targeting] 변경 대상 키워드 전달
            if "target_keyword" in agent_result.get("entities", {}):
                response["target_keyword"] = agent_result["entities"]["target_keyword"]
            elif "target_keyword" in agent_result:
                response["target_keyword"] = agent_result["target_keyword"]
            elif hasattr(primary, 'target_keyword') and primary.target_keyword:
                response["target_keyword"] = primary.target_keyword
                
            print(f"[Analyze] ✅ {domain} 에이전트 병렬 처리 완료")
            print(f"[Analyze] 응답: {response}\n")
            final_responses.append(response)

    if not final_responses:
        return [_fallback_response(_get_static_reply("ERROR", request.language))]

    # ──────────────────────────────────────────────
    # STEP 4: 최종 응답 조립 및 메타데이터 복원
    # ──────────────────────────────────────────────
    for response in final_responses:
        # __ai_log_meta 추출 및 변환
        meta = response.pop("__ai_log_meta", None)
        if not meta:
            meta = ai_log_meta_ctx.get()
        if meta:
            meta_copy = meta.copy()
            meta_copy["is_fallback"] = (response.get("domain_code") == "FRONT" or response.get("confidence", 1.0) < 0.4)
            response["ai_log_meta"] = meta_copy

    # "아래 접수 내역을 확인해 주세요" 공통 문구 1회 추가 (취소 요청은 제외)
    task_responses = [
        r for r in final_responses 
        if r.get("domain_code") 
        and not (r.get("action") and str(r.get("action")).startswith("CANCEL"))
    ]
    if task_responses:
        last_task = task_responses[-1]
        if request.language == "ko":
            append_msg = "아래 접수 내역을 확인해 주세요."
        else:
            append_msg = "Please check the request details below."
        if last_task.get("guest_reply"):
            last_task["guest_reply"] = f"{last_task['guest_reply']}\n{append_msg}"
        else:
            last_task["guest_reply"] = append_msg

    return final_responses
