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
    language: Optional[str] = "en"
    system_language: Optional[str] = "en"
    chat_history: List[dict] = []
    images: Optional[List[str]] = []
    active_requests: Optional[List[dict]] = []
    room_inventory: Optional[Dict[str, Any]] = {}
    special_notes: Optional[str] = None


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


import inspect

def invoke_domain_agent(domain: str, **kwargs) -> Awaitable[Dict[str, Any]]:
    """
    Dynamically calls the domain agent function with only the arguments it accepts in its signature.
    """
    agent_func = DOMAIN_AGENTS.get(domain)
    if not agent_func:
        raise ValueError(f"Agent function for domain '{domain}' not found.")
        
    sig = inspect.signature(agent_func)
    has_var_keyword = any(p.kind == inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values())
    
    filtered_kwargs = {}
    for k, v in kwargs.items():
        param_name = k
        # Map generic names to specific names if needed
        if k == "system_language" and "system_language" not in sig.parameters and "language" in sig.parameters:
            param_name = "language"
            
        if has_var_keyword or param_name in sig.parameters:
            filtered_kwargs[param_name] = v
            
    return agent_func(**filtered_kwargs)



# ── 다국어 정적 멘트 딕셔너리 ──
_background_tasks = set()

STATIC_REPLIES = {
    "ESCALATION": {
        "ko": "제가 바로 답변드리기 어려운 부분이라, 프론트 데스크 직원에게 바로 연결해 드릴게요. 잠시만 기다려 주세요!",
        "en": "Let me connect you to the front desk right away — they'll be able to help! Please hold on a moment. 😊",
        "ja": "すぐに対応できるよう、フロントデスクにお繋ぎいたします。少々お待ちくださいませ。😊",
        "zh": "我会立刻为您连接到前台以便进一步协助您。请稍等片刻！😊"
    },
    "ESCALATION_INFO": {
        "ko": "더 자세한 정보를 위해 프론트 데스크 직원에게 연결해 드릴게요! 잠시만 기다려 주세요.",
        "en": "Let me connect you to the front desk for more details! One moment, please. 😊",
        "ja": "より詳細な情報については、フロントデスクにお繋ぎいたします！少々お待ちください。😊",
        "zh": "为了提供更详细的信息，我会为您连接到前台！请稍等片刻。😊"
    },
    "CLARIFICATION": {
        "ko": "어떤 말씀이신지 조금만 더 자세히 알려주시겠어요? 말씀해주시면 바로 도와드릴게요!",
        "en": "Could you tell me a bit more about what you need? I'd love to help! 😊",
        "ja": "どのようなご用件か、もう少し詳しく教えていただけますか？すぐにお手伝いさせていただきます！😊",
        "zh": "您能详细告诉我您的需求吗？我很乐意立刻帮助您！😊"
    },
    "CANCEL_REJECTED": {
        "ko": "안타깝게도 해당 요청은 취소가 어렵습니다. 🥲 이미 처리가 시작되었거나 부서 확인이 필요한 상태이니 양해 부탁드립니다. 🙏",
        "en": "I'm sorry, but this request can't be cancelled — it's already in progress or needs department confirmation. 🥲🙏",
        "ja": "申し訳ありませんが、キャンセルリクエストは却下されました。すでに処理が開始されているか、部門の確認が必要です。🥲🙏",
        "zh": "抱歉，取消请求被拒绝。该请求已在处理中或需要部门批准。🥲🙏"
    },
    "CANCEL_SUCCESS": {
        "ko": "네, 요청하신 건이 정상적으로 즉시 취소 처리되었습니다. 😌 다른 필요하신 사항이 있다면 언제든 말씀해 주세요!",
        "en": "Done! Your request has been cancelled. 😌 Let me know if there's anything else I can help with!",
        "ja": "リクエストは正常にキャンセルされました。😌 他にご要望がございましたら、いつでもお申し付けください。",
        "zh": "您的请求已成功取消。😌 如果您还有其他需要，请随时告诉我！"
    },
    "CANCEL_PENDING": {
        "ko": "해당 건은 이미 처리가 진행 중이어서 담당 부서로 취소 가능 여부를 확인 중입니다. 🏃‍♂️ 확인 후 바로 안내해 드릴게요!",
        "en": "Your request is already being worked on, so I've sent a cancellation request to the team. \n I'll let you know as soon as it's confirmed!",
        "ja": "すでに処理が進行中のため、担当部署にキャンセルをリクエストしました. 🏃‍♂️ 確認次第お知らせいたします。",
        "zh": "您的请求正在处理中，因此我们已向相关部门发送了取消请求. 🏃‍♂️ 确认后我们将通知您。"
    },
    "CANCEL_IN_PROGRESS": {
        "ko": "네, 요청하신 건에 대해 취소를 접수해 드릴게요! 😌 아직 대기 중이라면 바로 취소되며, 이미 처리 중이라면 부서 확인 후 안내해 드리겠습니다.",
        "en": "I'll process the cancellation for you. Pending requests are cancelled right away, while ones already in progress will need a quick check with the team. 😌",
        "ja": "ご指定のリクエストのキャンセル手続きを行います. 待機中のものは即座にキャンセルされ, 対応中のものは部門の確認が必要となります. 😌",
        "zh": "我们将为您处理指定请求的取消操作。待处理的将立即取消，处理中的需要相关部门确认。😌"
    },
    "CANCEL": {
        "ko": "대기 중인 요청은 즉시 취소 처리됩니다. 단, 이미 직원이 처리를 시작한 경우 담당 부서 확인 후 취소됩니다.",
        "en": "Pending requests will be cancelled right away. If the staff has already started working on it, we'll confirm with the team first. 😌",
        "ja": "待機中のリクエストは即座にキャンセルされます。すでにスタッフが対応を開始している場合は、担当部門の確認後にキャンセルされます。😌",
        "zh": "待处理的请求将立即取消。如果工作人员已经开始处理，将在相关部门确认后取消。😌"
    },
    "STATUS_CHECK": {
        "ko": "현재 고객님의 최근 요청 진행 상태를 확인해 드리겠습니다.",
        "en": "Let me check on your most recent request right now. 🔍",
        "ja": "お客様の最新のリクエストの状況をただいま確認いたします。🔍",
        "zh": "我将立刻为您查询最近请求的处理状态。🔍"
    },
    "TARGETED_CANCEL": {
        "ko": "지목하신 요청의 취소를 진행합니다. 대기 중인 건은 즉시 취소되며, 처리 중인 건은 부서 확인 후 취소됩니다.",
        "en": "I'll process the cancellation for you. Pending requests are cancelled right away, while ones already in progress will need a quick check with the team. 😌",
        "ja": "ご指定のリクエストのキャンセル手続きを行います. 待機中のものは即座にキャンセルされ, 対応中のものは部門の確認が必要となります. 😌",
        "zh": "我们将为您处理指定请求的取消操作。待处理的将立即取消，处理中的需要相关部门确认。😌"
    },
    "TASK_WAIT": {
        "ko": "네, 알겠습니다! 담당 부서로 빠르게 전달해 두었습니다. 🚀 조금만 기다려 주시면 금방 조치해 드릴게요. 😊",
        "en": "Got it! I'll pass this on to the right department right away. Please give us just a moment. 🚀😊",
        "ja": "かしこまりました！すぐに担当部門にお伝えいたします。少々お待ちくださいませ。🚀😊",
        "zh": "明白！我会立刻将此转交给相关部门。请稍等片刻。🚀😊"
    },
    "INFO_NOT_FOUND": {
        "ko": "그 부분은 제가 바로 답변드리기 어려워 프론트 데스크로 즉시 전달해 두었습니다! 🥲 직원이 확인 후 바로 채팅으로 안내해 드릴 예정이니 잠시만 기다려 주세요. 🙏",
        "en": "I'm not quite sure about that one! I've passed your question along to the front desk — they'll get back to you here shortly. 🥲🙏",
        "ja": "申し訳ありません、そちらについてはお答えいたしかねます。フロントデスクのスタッフに質問を転送いたしましたので、確認後すぐにこちらでご返答させていただきます. 🥲🙏",
        "zh": "抱歉，关于这个问题我不太确定！我已经将您的问题转交给了前台员工。他们会核实后尽快在这里回复您。🥲🙏"
    },
    "ERROR": {
        "ko": "잠시 통신이 원활하지 않았나 봐요. 🥲 번거로우시겠지만 조금만 이따가 다시 한 번 말씀해 주시겠어요? 🙏",
        "en": "Looks like we hit a small hiccup. Could you try again in just a moment? 🥲🙏",
        "ja": "システムに一時的な問題が発生しているようです. 少し経ってからもう一度お試しいただけますか？ 🥲🙏",
        "zh": "系统似乎出现了暂时的故障。您能稍后再试一次吗？ 🥲🙏"
    },
    "CONVERSATION_END": {
        "ko": "네, 알겠습니다! 😊 필요하신 건이 생기시면 언제든 편하게 말씀해 주세요.",
        "en": "No worries! 😊 Feel free to reach out anytime you need help.",
        "ja": "かしこまりました！😊 何かございましたら、いつでもお気軽にお申し付けください。",
        "zh": "好的，没问题！😊 如果有需要，请随时告诉我。"
    },
    "COMPLAINT": {
        "ko": "불편을 드려 대단히 죄송합니다. 🥲 지금 바로 프론트 직원과 직접 연결하여 도움을 드리겠습니다.",
        "en": "I'm so sorry about the trouble. Let me connect you to the front desk right now. 🥲",
        "ja": "ご不便をおかけして大変申し訳ございません。ただいまフロントデスクに直接お繋ぎいたします。🥲",
        "zh": "给您带来不便，我们深表歉意。现在立刻为您直接连接到前台。🥲"
    },
    "FALLBACK_FAILURE": {
        "ko": "제가 정확한 의미를 파악하기 조금 어렵네요. 🥲 직원분의 도움이 필요하시다면 제가 연결해드릴까요?",
        "en": "I'm having a bit of trouble understanding — would you like me to connect you to the front desk? 🥲",
        "ja": "リクエストを理解できませんでした. フロントデスクのサポートが必要な場合は, フロントデスクにお繋ぎいたしましょうか？ 🥲",
        "zh": "我无法理解您的请求. 如果您需要前台的帮助, 需要我为您连接前台吗？ 🥲"
    },
    "NEED_MORE_INFO": {
        "ko": "조금 더 상세한 안내가 필요하시다면 프론트 데스크로 바로 연결해 드릴까요?",
        "en": "Would you like me to connect you to the front desk for more details? 😊",
        "ja": "より詳細な情報をご希望の場合は、フロントデスクにお繋ぎいたしましょうか？ 😊",
        "zh": "您需要我将您连接到前台以获取更详细的信息吗？ 😊"
    },
    "EMERGENCY_REPLY": {
        "ko": "🚨 응급 상황을 인지하였습니다. 즉시 호텔 보안팀을 호출하고 직원을 파견하겠습니다. 부디 안전한 곳에 머물러 주십시오.",
        "en": "🚨 Emergency noted. We're dispatching hotel security right away. Please stay somewhere safe.",
        "ja": "🚨 緊急事態を認識しました. 直ちにホテルのセキュリティチームを呼び, スタッフを派遣します. 安全な場所にとどまってください.",
        "zh": "🚨 我们已经确认了紧急情况. 将立即呼叫酒店安保团队, 并派遣员工. 请待在安全的地方."
    },
    "OPTION_YES": {
        "ko": "네",
        "en": "Yes",
        "ja": "はい",
        "zh": "是的"
    },
    "OPTION_NO": {
        "ko": "아니요",
        "en": "No",
        "ja": "いいえ",
        "zh": "不是"
    },
    "OPTION_ADD": {
        "ko": "추가",
        "en": "Add",
        "ja": "追加",
        "zh": "追加"
    },
    "OPTION_REPLACE": {
        "ko": "변경",
        "en": "Replace",
        "ja": "変更",
        "zh": "修改"
    },
    "DUPLICATE_CONFIRM": {
        "ko": "이미 '{summary}'을(를) 요청하셨는데, 이번 요청을 추가로 접수할까요? 아니면 기존 요청을 변경하시겠어요?",
        "en": "You already have an active request for '{summary}'. Would you like to add this as a new one, or replace the existing request?",
        "ja": "すでに「{summary}」をリクエストされていますが、追加でリクエストしますか？それとも既存のリクエストを変更しますか？",
        "zh": "您已经请求了「{summary}」，您想追加请求还是修改现有请求？"
    }
}

def _get_static_reply(key: str, lang: str) -> str:
    # ── [프론트엔드 다국어 언어팩 연동 코드 맵핑] ──
    # 프론트엔드가 [FORWARD_FRONT] 또는 [INFO_NOT_FOUND] 코드를 감지하고
    # 각 언어팩(locale)에서 동적으로 번역된 멘트를 표시하도록 수정되었습니다.
    if key in ["COMPLAINT", "ESCALATION"]:
        return "[FORWARD_FRONT]"
    if key in ["INFO_NOT_FOUND", "ESCALATION_INFO"]:
        return "[INFO_NOT_FOUND]"

    lang = lang.lower()
    if lang not in ["ko", "en", "ja", "zh"]:
        lang = "en"
    return STATIC_REPLIES.get(key, {}).get(lang, STATIC_REPLIES.get(key, {}).get("en", "Working on your request — one moment!"))


# ── Guest Intent Classification (LLM-based) ──
# Replaces hardcoded pattern matching with natural language understanding.
# Used by the anti-infinite-loop guardrail to distinguish:
#   - NO_INTENT: Guest is being dismissive, joking, or withdrawing (→ Case 1: graceful close)
#   - HAS_INTENT: Guest has genuine service intent but AI can't resolve it (→ Case 2: Human Escalation)
def _classify_guest_intent(recent_messages: list, language: str) -> str:
    """
    Uses a single LLM call to classify whether the guest's recent responses
    show genuine service intent or are dismissive/nonsensical.
    Returns: "NO_INTENT" or "HAS_INTENT"
    """
    messages_text = "\n".join([f"- \"{msg}\"" for msg in recent_messages if msg])
    if not messages_text:
        return "NO_INTENT"
    
    prompt = (
        f"You are analyzing a hotel concierge AI conversation.\n"
        f"The AI has been repeatedly asking the guest for required information "
        f"(e.g., destination, time, quantity, restaurant name) to fulfill a service request, "
        f"but the guest has not provided the needed information after multiple attempts.\n\n"
        f"[Guest's Recent Messages]\n{messages_text}\n\n"
        f"Classify the guest's overall intent based on their recent messages:\n"
        f"- NO_INTENT: The guest is being dismissive, sending gibberish/spam, joking around, "
        f"withdrawing their request, or clearly has no interest in continuing the service request. "
        f"Examples: 'haha', 'never mind', 'ㅋㅋ', 'whatever', 'idk', meaningless characters, "
        f"'됐어', '算了', '結構です', repeated nonsense.\n"
        f"- HAS_INTENT: The guest is genuinely trying to provide information but the AI cannot "
        f"understand or process their answer. They have a real service need but are struggling "
        f"to communicate it precisely. "
        f"Examples: 'the place from yesterday', 'that Italian restaurant', 'the one near the station', "
        f"vague but sincere attempts to answer the AI's question.\n"
    )
    
    try:
        result = call_gemini(
            prompt=prompt,
            system_instruction='Output ONLY a JSON object: {"intent": "NO_INTENT"} or {"intent": "HAS_INTENT"}. No other text.'
        )
        classification = result.get("intent", "HAS_INTENT")
        print(f"[Analyze] 🧠 Guest intent classification: {classification} (messages: {recent_messages})")
        return classification
    except Exception as e:
        print(f"[Analyze] ⚠️ Guest intent classification failed (defaulting to HAS_INTENT): {e}")
        return "HAS_INTENT"  # Default to Case 2 (safer — offers escalation rather than terminating)

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

async def _synthesize_multi_replies(replies: List[str], original_text: str, language: str) -> str:
    if not replies:
        return ""
    
    # [FORWARD_...] 나 [PII_...] 등 특수 액션 코드가 있는 경우는 합성하지 않고 결합하여 폴백 처리
    has_special_code = any(("[FORWARD_" in r) or ("[PII_" in r) or ("INFO_NOT_FOUND" in r) for r in replies)
    if has_special_code:
        return "\n".join(replies)
        
    valid_replies = [r for r in replies if r.strip()]
    if len(valid_replies) <= 1:
        return "\n".join(replies)
        
    try:
        replies_text = "\n---\n".join([f"답변 {i+1}: {r}" for i, r in enumerate(valid_replies)])
        prompt = (
            f"[고객의 원본 질문]\n{original_text}\n\n"
            f"[AI가 작성한 개별 답변 리스트]\n{replies_text}\n\n"
            f"위 개별 답변들을 하나로 자연스럽게 흐르도록 병합하고 윤문하여 친절하고 완벽한 단일 답변으로 작성해 주세요.\n\n"
            f"**지침**:\n"
            f"1. 각 개별 답변의 핵심 정보(예: 장소, 정책, 대여 방법 등)는 누락 없이 모두 포함하세요.\n"
            f"2. **[매우 중요]** 각 답변에 흩어져 있는 되묻기 및 연결 제안 멘트(예: '연결해 드릴까요?', '도와드릴까요?', '확인해 드릴까요?')는 **중간에 중복 노출되지 않도록 모두 삭제하고, 답변의 맨 마지막에만 단 한 번만** 오도록 자연스럽게 하나로 통합하세요.\n"
            f"   - *나쁜 예시*: '우산은 프런트에서 대여 가능합니다. 프런트로 연결해 드릴까요? 자전거는 대여가 어렵습니다. 더 필요한 정보가 있다면 연결해 드릴까요?'\n"
            f"   - *좋은 예시*: '우산은 프런트 데스크에서 대여하실 수 있으며, 자전거는 대여가 어렵지만 호텔 앞 따릉이를 이용하실 수 있습니다. 혹시 이와 관련하여 프런트 데스크로 연결해 드릴까요?'\n"
            f"3. 절대로 답변을 새로 지어내거나 기존 답변에 없던 정보를 추가하지 마세요.\n"
            f"4. 고객 질문 언어(또는 {language})로 친절하고 예의 바르게 답변하세요.\n"
            f"5. 마크다운 강조(**)는 사용하지 마세요.\n"
        )
        
        raw = await call_gemini_async(
            prompt=prompt,
            system_instruction='당신은 호텔 컨시어지 답변 합성 전문가입니다. 반드시 {"reply": "합성 및 윤문된 단일 답변 내용"} 형식의 JSON으로만 출력하세요. 연결/되묻기 질문은 전체 답변의 맨 끝에 딱 한 번만 포함해야 하며, 절대 본문 중간에 중복해서 넣지 마십시오.'
        )
        if isinstance(raw, dict) and "reply" in raw:
            return raw["reply"]
        return "\n".join(valid_replies)
    except Exception as e:
        print(f"[Analyze] ⚠️ 다중 답변 합성 실패 (폴백 사용): {e}")
        return "\n".join(replies)

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

    # ── [개인정보 보호 필터링 및 자동 거절 (PII Masking & Privacy Guard)] ──
    if has_pii(request.text):
        masked_text = mask_pii(request.text)
        print(f"[PII Guard] 민감 정보 차단: {masked_text}")
        
        return [{
            "guest_reply": "[PII_GUARD]",
            "summary": "개인정보 보호 차단",
            "domain_code": None,
            "priority": "NORMAL",
            "entities": {},
            "confidence": 1.0,
            "action": "PII_GUARD"
        }]

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
                # ── [Case 1 vs Case 2 Branch] ──
                # Use LLM to naturally classify whether the guest has real service intent
                # or is being dismissive/nonsensical, instead of hardcoded pattern matching.
                recent_user_msgs = [m.get("content", "").strip() for m in request.chat_history[-6:] if m.get("role") == "user"]
                # Include current turn's message (not yet in chat_history)
                recent_user_msgs.append(request.text.strip())
                # Check only the last 3 messages
                recent_user_msgs = recent_user_msgs[-3:]
                
                guest_intent = _classify_guest_intent(recent_user_msgs, request.language)
                
                if guest_intent == "NO_INTENT":
                    # ━━ Case 1: No service intent → Graceful conversation close (no escalation offer) ━━
                    print(f"\n[Analyze] 🚫 Case 1: NO_INTENT detected → Graceful conversation close (no escalation offer)")
                    response["guest_reply"] = _get_static_reply("CONVERSATION_END", request.language)
                    response["summary"] = "Conversation closed (no intent)"
                    response["domain_code"] = None
                    response["action_type"] = "NONE"
                    response["priority"] = "NORMAL"
                    response["entities"] = {}
                    response["confidence"] = 0.0
                    response["missing_fields"] = []
                    response["clarification_options"] = []  # No buttons!
                else:
                    # ━━ Case 2: Has intent but AI can't resolve → Human Escalation proposal ━━
                    print(f"\n[Analyze] 🤝 Case 2: HAS_INTENT but AI cannot resolve → Human Escalation proposal")
                    try:
                        recent_chat = "\n".join([f"{m.get('role', 'user')}: {m.get('content', '')}" for m in request.chat_history[-4:]])
                        escalation_prompt = (
                            f"This is a conversation between a hotel AI concierge and a guest. "
                            f"The AI has asked multiple questions but could not extract the required information.\n"
                            f"The guest clearly wants a service but the AI has reached its limit and cannot resolve it alone.\n"
                            f"Politely acknowledge the AI's limitation and ask whether the guest would like to be connected to the front desk staff for assistance.\n"
                            f"You MUST write the response in the guest's language (primary language: {request.language}).\n\n"
                            f"[Recent Conversation]\n{recent_chat}"
                        )
                        raw_fallback = call_gemini(
                            prompt=escalation_prompt,
                            system_instruction='Output ONLY a JSON object: {"reply": "your polite escalation message here"}. No other text.'
                        )
                        generated_reply = raw_fallback.get("reply", _get_static_reply("FALLBACK_FAILURE", request.language))
                    except Exception as e:
                        print(f"[Analyze] ⚠️ Fallback message generation failed: {e}")
                        generated_reply = _get_static_reply("FALLBACK_FAILURE", request.language)

                    response["guest_reply"] = generated_reply
                    response["summary"] = "AI resolution failed (staff connection offered)"
                    response["domain_code"] = None
                    response["action_type"] = "NONE"
                    response["priority"] = "NORMAL"
                    response["entities"] = {}
                    response["confidence"] = 0.0
                    response["missing_fields"] = []
                    response["clarification_options"] = [
                        _get_static_reply("OPTION_YES", request.language),
                        _get_static_reply("OPTION_NO", request.language)
                    ]
        
        # ── [비동기 로깅 메타데이터 주입] ──
        # STEP 4에서 이미 에이전트별 메타가 세팅되었으면 스킵 (이중 주입 방지)
        if "ai_log_meta" not in response:
            meta = ai_log_meta_ctx.get()
            if meta:
                meta_copy = meta.copy()
                meta_copy["is_fallback"] = (response.get("domain_code") == "FRONT" or response.get("confidence", 1.0) < 0.4)
                response["ai_log_meta"] = meta_copy
            
        final_responses.append(response)
        
    if len(final_responses) > 1:
        valid_replies = [r.get("guest_reply", "").strip() for r in final_responses]
        synthesized = await _synthesize_multi_replies(valid_replies, request.text, request.language)
        
        # 첫 번째 응답에만 합성된 답변을 세팅하고, 나머지는 ""로 비움
        final_responses[0]["guest_reply"] = synthesized
        for resp in final_responses[1:]:
            resp["guest_reply"] = ""
            
        # 옵션 중복 제거 및 "아니요" -> "아니오" 표준화
        all_options = []
        for resp in final_responses:
            opts = resp.get("clarification_options")
            if opts and isinstance(opts, list):
                for opt in opts:
                    cleaned_opt = opt.strip()
                    if cleaned_opt == "아니요":
                        cleaned_opt = "아니오"
                    if cleaned_opt not in all_options:
                        all_options.append(cleaned_opt)
                        
        final_responses[0]["clarification_options"] = all_options
        for resp in final_responses[1:]:
            resp["clarification_options"] = []
            
    return final_responses


async def _analyze_message_core(request: AnalyzeRequest) -> List[Dict[str, Any]]:
    # ── [비동기 로깅 메타데이터 처리 보류] ──
    # agent_result 안에서 __ai_log_meta를 반환하도록 처리

    from app.core.emergency_filter import emergency_pre_filter, get_emergency_reply
    
    # ── [긴급 상황 사전 필터 (1-Tier)] ──
    em_match = emergency_pre_filter(request.text)
    if em_match:
        category = em_match["category"]
        print(f"[Analyze] 🚨 긴급 상황 키워드 감지: {category}")
        return [{
            "guest_reply": get_emergency_reply(category, request.language),
            "summary": f"긴급 상황 자동 접수 ({category})",
            "domain_code": "EMERGENCY",
            "priority": "EMERGENCY",
            "entities": {"intent": "EMERGENCY", "category": category},
            "confidence": 1.0,
            "reasoning": f"• Emergency keyword '{em_match['matched_keyword']}' detected in the guest's message.\n• Immediate routing to emergency response team.\n• This is an automated safety protocol."
        }]

    # ── [실무 최적화: 역질문 단답형(네/아니요) 강제 라우팅 인터셉트] ──
    if request.chat_history:
        last_ai = None
        for msg in reversed(request.chat_history):
            if msg.get("role") == "ai":
                last_ai = msg.get("content", "")
                break
        
        if last_ai and "프론트 데스크의 직접적인 조치나 확인이 필요하신 상황일까요" in last_ai:
            text_lower = request.text.lower().replace(" ", "")
            if any(w in text_lower for w in ["네", "응", "조치해", "필요해", "부탁해", "해주", "yes", "요청"]):
                print(f"[Analyze] ⚡ 역질문 단답형 '네' 감지 → FRONT_ESCALATION 강제 라우팅")
                return [{
                    "guest_reply": "제가 바로 답변드리기 어려운 부분이라, 프론트 데스크 직원에게 바로 연결해 드릴게요. 잠시만 기다려 주세요!",
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


    # [수정] STEP 0, STEP 1 (라우터 이전의 조기 RAG 검색)은 다중 의도(멀티 인텐트)
    # 분할을 방해하므로 제거되었습니다. 대신 라우터 엔진(STEP 2)이 
    # 문장을 의도별로 분할한 뒤, 각 INFO 의도(STEP 3-d)에서 개별적으로 RAG를 수행합니다.

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
        router_results = route(request.text, chat_history=request.chat_history, images=request.images, system_language=request.system_language, active_requests=getattr(request, 'active_requests', []), special_notes=getattr(request, 'special_notes', None))
        print(f"\n[Analyze] 🔀 Router result: {[{'route_type': r.route_type, 'domain': r.domain, 'confidence': r.confidence} for r in router_results]}")
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
    # STEP 2-2: [전체 취소 + EMERGENCY 오분류 보정]
    # "모든 요청 취소" 시 대부분의 route가 CANCEL인데 EMERGENCY만 FRONT_ESCALATION으로
    # 분류되는 경우, EMERGENCY도 CANCEL로 강제 오버라이드 (새 긴급 티켓 생성 방지)
    # ──────────────────────────────────────────────
    is_cancel_intent = any(getattr(r, 'cancel_scope', None) == "ALL" for r in router_results if r.route_type == "CANCEL")
    cancel_routes = [r for r in router_results if r.route_type == "CANCEL"]
    emergency_escalation_routes = [r for r in router_results if r.route_type == "FRONT_ESCALATION" and r.domain == "EMERGENCY"]

    if is_cancel_intent and emergency_escalation_routes:
        print(f"[Analyze] 🛡️ 전체 취소 + EMERGENCY 오분류 보정 — FRONT_ESCALATION → CANCEL 오버라이드")
        for r in emergency_escalation_routes:
            r.route_type = "CANCEL"
            r.confidence = 1.0

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
            print(f"[Analyze] ✅ Progress event sent successfully (status: {resp.status_code})")
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
                # [공통 주문 보존 규칙] 활성 요청 목록을 chat_history 앞에 주입하여
                # 모든 부서 에이전트가 REPLACE 시 기존 아이템을 보존하도록 컨텍스트 제공
                enriched_history = list(request.chat_history)
                if request.active_requests:
                    import json
                    filtered = [{"id": r.get("id"), "summary": r.get("summary")} for r in request.active_requests]
                    active_ctx = (
                        f"[고객의 현재 활성 요청(주문) 목록]\n"
                        f"{json.dumps(filtered, ensure_ascii=False)}\n\n"
                        f"[주문 수정 및 부분 취소 규칙 (CRITICAL)]\n"
                        f"기존 주문을 수정하거나 일부 항목만 취소할 때(REPLACE):\n"
                        f"1. 대상 파악 주의: 직전 대화 주제에 무조건 의존하지 마세요. 사용자의 요청(예: '물 1병으로 바꿔줘')에 포함된 키워드('물')가 위 [현재 활성 요청 목록] 중 어느 티켓(예: '물 2병 및 수건 2개 요청')과 일치하는지 먼저 찾아야 합니다.\n"
                        f"2. 위 목록에서 귀하의 부서와 관련된 기존 아이템들을 정확히 파악하세요.\n"
                        f"3. 사용자의 취소/변경 요청을 반영하여 최종적으로 남게 되는 아이템들의 상태를 계산하세요.\n"
                        f"4. 취소된 아이템은 entities에서 완전히 제외(삭제)하고, 절대 음수(-) 수량을 사용하지 마세요.\n"
                        f"5. 변경되지 않고 남은 아이템들은 반드시 entities 출력에 그대로 포함해야 합니다. 누락 시 영구 삭제됩니다.\n"
                    )
                    user_message_with_ctx = request.text + "\n\n" + active_ctx
                else:
                    user_message_with_ctx = request.text

                coro = invoke_domain_agent(
                    domain,
                    user_message=user_message_with_ctx,
                    room_no=request.room_no,
                    chat_history=request.chat_history,
                    images=request.images,
                    system_language=request.language,
                    active_requests=getattr(request, 'active_requests', []),
                    room_inventory=getattr(request, 'room_inventory', {}),
                    special_notes=getattr(request, 'special_notes', None)
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
                "reasoning": getattr(primary, 'reasoning', 'Unknown'),
            }
            if hasattr(primary, 'action_type'):
                response["action_type"] = primary.action_type

            print(f"[Analyze] 📌 DEPARTMENT → domain: {domain} (에이전트 미등록, 기본 응답)")
            print(f"[Analyze] Response: {response}\n")
            final_responses.append(response)
            continue

        # STEP 3-b: SOFT_FALLBACK / NON_ACTIONABLE → 티켓 생성 없이 답변만
        if primary.route_type in ("SOFT_FALLBACK", "NON_ACTIONABLE"):
            guest_reply = primary.reply or _get_static_reply("FALLBACK_FAILURE", request.language)
            fallback_msg = _get_static_reply("FALLBACK_FAILURE", request.language)
            response = {
                "guest_reply": guest_reply,
                "summary": "안내 및 거절",
                "domain_code": None,
                "priority": "NORMAL",
                "entities": {},
                "confidence": primary.confidence,
                "reasoning": getattr(primary, 'reasoning', 'Unknown')
            }
            if guest_reply == fallback_msg:
                response["clarification_options"] = [
                    _get_static_reply("OPTION_YES", request.language),
                    _get_static_reply("OPTION_NO", request.language)
                ]
            print(f"[Analyze] 💬 {primary.route_type} 응답")
            print(f"[Analyze] Response: {response}\n")
            final_responses.append(response)
            continue

        # STEP 3-c: CLARIFICATION → 되묻기
        if primary.route_type == "CLARIFICATION":
            # ── [라우터 직접 생성 검증] ──
            # 라우터가 직접 구체적인 질문/선택지를 생성했다면 (예: Ambiguous Cancellation), 에이전트 위임 없이 즉시 반환
            if hasattr(primary, 'clarification_options') and primary.clarification_options and len(primary.clarification_options) > 0:
                guest_reply = getattr(primary, 'clarification_question', None) or _get_static_reply("CLARIFICATION", request.language)
                response = {
                    "guest_reply": guest_reply,
                    "summary": getattr(primary, 'summary', None) or "추가 확인 필요",
                    "domain_code": None,
                    "priority": "NORMAL",
                    "entities": {},
                    "confidence": primary.confidence,
                    "missing_fields": [],
                    "clarification_options": primary.clarification_options,
                    "reasoning": getattr(primary, 'reasoning', 'Unknown')
                }
                print(f"[Analyze] ❓ CLARIFICATION → 라우터 직접 생성 옵션 사용")
                print(f"[Analyze] Response: {response}\n")
                final_responses.append(response)
                continue

            # ── [에이전트 재위임 로직] ──
            # 직전 AI 메시지가 에이전트의 구체적 질문("?")이었다면,
            # 라우터가 CLARIFICATION으로 분류해도 해당 에이전트를 다시 호출하여
            # "어떤 말씀인지 모르겠다" 대신 구체적인 재질문을 생성합니다.
            last_agent_domain = None
            recent_ai_msgs = [m for m in request.chat_history[-6:] if m.get("role") == "ai"]
            if recent_ai_msgs and "?" in recent_ai_msgs[-1].get("content", ""):
                last_ai_content = recent_ai_msgs[-1].get("content", "")
                
                # 지능형 키워드 기반 도메인 분석 (발표용 100% 정확도 보장)
                hk_kws = ["수건", "타월", "어메니티", "베개", "이불", "청소", "생수", "물", "비누", "칫솔", "샴푸", "휴지", "화장지", "towel", "amenity", "water", "blanket", "cleaning", "가운", "샤워가운", "슬리퍼", "침대", "침구류"]
                facility_kws = ["에어컨", "히터", "난방", "보일러", "수압", "변기", "와이파이", "조명", "tv", "리모컨", "콘센트", "키카드", "잠김", "충전기", "고장", "냉장고", "전기", "수도", "샤워", "aircon", "heating", "wifi", "toilet", "light", "charger"]
                fb_kws = ["주문", "룸서비스", "메뉴", "식음료", "음료", "와인잔", "오프너", "얼음", "디쉬", "식사", "밥", "콜라", "주스", "커피", "맥주", "와인", "스테이크", "샐러드", "room service", "wine", "ice", "opener", "coke", "사이다"]
                concierge_kws = ["맛집", "식당", "예약", "파스타", "삼겹살", "돈까스", "국수", "관광", "투어", "경복궁", "ddp", "남산", "택시", "꽃배달", "꽃", "꽃다발", "장미", "장미꽃", "짐", "캐리어", "보관", "짐보관", "공항버스", "6001", "버스", "약국", "응급실", "병원", "모닝콜", "맡기", "맡겨", "맡기기", "recommend", "restaurant", "taxi", "flower", "booking"]
                front_kws = ["체크인", "체크아웃", "프론트", "영수증", "소음", "시끄", "방음", "방변경", "room change", "checkin", "checkout", "receipt", "noise"]
                emergency_kws = ["경보기", "화재", "환자", "응급", "피", "대피", "싸움", "다툼", "fire", "emergency", "hurt"]
                
                content_lower = last_ai_content.lower()
                if any(kw in content_lower for kw in concierge_kws):
                    last_agent_domain = "CONCIERGE"
                elif any(kw in content_lower for kw in hk_kws):
                    last_agent_domain = "HK"
                elif any(kw in content_lower for kw in fb_kws):
                    last_agent_domain = "FB"
                elif any(kw in content_lower for kw in facility_kws):
                    last_agent_domain = "FACILITY"
                elif any(kw in content_lower for kw in front_kws):
                    last_agent_domain = "FRONT"
                elif any(kw in content_lower for kw in emergency_kws):
                    last_agent_domain = "EMERGENCY"
                
                # 기존 활성 요청(active_requests) 폴백
                if not last_agent_domain and getattr(request, 'active_requests', []):
                    last_agent_domain = request.active_requests[0].get("department_id")

            if last_agent_domain:
                try:
                    agent_result = await invoke_domain_agent(
                        last_agent_domain,
                        user_message=request.text,
                        room_no=request.room_no,
                        chat_history=request.chat_history,
                        images=request.images,
                        system_language=request.language,
                        active_requests=getattr(request, 'active_requests', [])
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
                        "reasoning": agent_result.get("reasoning", getattr(primary, 'reasoning', 'Unknown'))
                    }
                    print(f"[Analyze] ❓ CLARIFICATION → {last_agent_domain} 에이전트 재위임 (구체적 재질문)")
                    print(f"[Analyze] Response: {response}\n")
                    final_responses.append(response)
                    continue
                except Exception as e:
                    print(f"[Analyze] ⚠️ CLARIFICATION 에이전트 재위임 실패: {e}")

            # last_agent_domain이 없거나 실패한 경우, FRONT 에이전트(기본 라우팅 질문)로 처리
            try:
                agent_result = await invoke_domain_agent(
                    "FRONT",
                    user_message=request.text,
                    room_no=request.room_no,
                    chat_history=request.chat_history,
                    images=request.images,
                    system_language=request.language,
                    active_requests=getattr(request, 'active_requests', [])
                )
                # FRONT 에이전트가 ESCALATION(직원 연결)을 결정한 경우 domain_code를 살려서 티켓 생성
                # 단, 선택지(clarification_options)가 있다면 아직 묻고 있는 단계이므로 티켓 생성 보류
                is_escalation = agent_result.get("entities", {}).get("intent") == "ESCALATION"
                has_options = len(agent_result.get("clarification_options", [])) > 0
                response = {
                    "guest_reply": agent_result.get("guest_reply", _get_static_reply("CLARIFICATION", request.language)),
                    "summary": agent_result.get("summary", "추가 확인 필요"),
                    "domain_code": agent_result.get("domain_code") if (is_escalation and not has_options) else None,
                    "priority": agent_result.get("priority", "NORMAL"),
                    "entities": agent_result.get("entities", {}),
                    "confidence": agent_result.get("confidence", primary.confidence),
                    "missing_fields": agent_result.get("missing_fields", []),
                    "clarification_options": agent_result.get("clarification_options", []),
                    "reasoning": agent_result.get("reasoning", getattr(primary, 'reasoning', 'Unknown'))
                }
                print(f"[Analyze] ❓ CLARIFICATION → FRONT 에이전트 위임 (부서 라우팅 구체화)")
                print(f"[Analyze] Response: {response}\n")
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
                    "reasoning": getattr(primary, 'reasoning', 'Unknown')
                }
                print(f"[Analyze] ❓ CLARIFICATION — reasoning: {primary.reasoning}")
                print(f"[Analyze] Response: {response}\n")
                final_responses.append(response)
                continue

        # STEP 3-d: INFO → RAG 지식 기반 답변 (요청 미생성)
        if primary.route_type == "INFO":
            domain = primary.domain or "FRONT"
            
            # ── FB 도메인 INFO는 에이전트에게 위임 (메뉴 기반 알러지 추천 등) ──
            if domain == "FB" and "FB" in DOMAIN_AGENTS:
                try:
                    agent_result = await invoke_domain_agent(
                        "FB",
                        user_message=request.text,
                        room_no=request.room_no,
                        chat_history=request.chat_history,
                        images=request.images,
                        system_language=request.language,
                        active_requests=getattr(request, 'active_requests', [])
                    )
                    response = {
                        "guest_reply": agent_result.get("guest_reply", "메뉴 정보를 확인 중입니다."),
                        "summary": agent_result.get("summary", "FB 정보 문의"),
                        "domain_code": None,
                        "priority": "NORMAL",
                        "entities": agent_result.get("entities", {}) if isinstance(agent_result, dict) else {},
                        "confidence": agent_result.get("confidence", primary.confidence) if isinstance(agent_result, dict) else primary.confidence,
                        "reasoning": agent_result.get("reasoning", getattr(primary, 'reasoning', 'Unknown')) if isinstance(agent_result, dict) else getattr(primary, 'reasoning', 'Unknown')
                    }
                    print(f"[Analyze] ℹ️ INFO+FB → FB 에이전트 위임 처리")
                    print(f"[Analyze] Response: {response}\n")
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

                target_word = getattr(primary, 'target_keyword', None) or primary.summary or "관련 정보"
                rewrite_prompt = (
                    f"[과거 대화 맥락]\n{context_str}\n\n"
                    f"[고객의 전체 질문]\n{request.text}\n\n"
                    f"[이번 검색 타겟 키워드]\n{target_word}\n\n"
                    f"위 맥락과 검색 타겟 키워드({target_word})를 반드시 참고하여, 고객의 여러 질문 중 이 키워드에 해당하는 특정 '호텔 정책/정보'에 대해서만 지식 베이스 검색에 최적화된 구체적인 문장 하나로만 재작성하세요."
                )
                if domain == "CONCIERGE":
                    sys_instruction = (
                        "당신은 호텔 검색 엔진 최적화 전문가입니다. "
                        "사용자가 대명사('이거', '다른데')나 생략된 표현을 사용했더라도, 반드시 [과거 대화 맥락]을 파악하여 타겟 키워드에 해당하는 '명확한 대상(예: 식당, 관광지, 카페 등)'을 명시적으로 포함한 '단일 검색 쿼리 문장' 하나만 작성하세요. "
                        "절대로 고객에게 대답하거나 말을 걸지 마세요. 질문형으로 끝내지 말고, 검색어 형태로 명사형이나 평서문으로 작성하세요. "
                        "반드시 {\"reply\": \"재작성된 문장\"} 형식의 JSON으로만 출력하세요."
                    )
                else:
                    sys_instruction = (
                        "당신은 호텔 검색 엔진 최적화 전문가입니다. "
                        "사용자가 특정 사물이나 서비스를 지칭하지 않고 '왜', '얼마야' 등 생략된 표현을 사용했더라도, 반드시 [과거 대화 맥락]과 타겟 키워드를 파악하여 질문 대상을 찾아 명시적으로 포함시키세요. "
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
                    rag_results = [r for r in rag_results if r.get('similarity', 1.0) >= 0.5]
                    
                    # --- [추가] 카테고리 주입 및 목표 카테고리 감지 ---
                    from app.domains.concierge.knowledge_data import CONCIERGE_KNOWLEDGE
                    answer_to_cat = {k['answer']: k.get('category') for k in CONCIERGE_KNOWLEDGE}
                    for r in rag_results:
                        r['category'] = answer_to_cat.get(r['answer'])
                        
                    target_category = None
                    query_text = (search_query + " " + request.text).lower()
                    
                    restaurant_keywords = [
                        "식당", "맛집", "먹을", "식사", "밥", "음식점", "레스토랑", "펍", "술집", 
                        "restaurant", "food", "eat", "dining", "meal", "bar", "pub", "hungry", "cafe"
                    ]
                    tour_keywords = [
                        "관광", "명소", "투어", "구경", "볼거리", "여행지", "가볼만한", "가볼 만한",
                        "tour", "attraction", "sightseeing", "place to visit", "visit", "explore", "landmark"
                    ]
                    
                    if any(kw in query_text for kw in restaurant_keywords):
                        target_category = "restaurant"
                    elif any(kw in query_text for kw in tour_keywords):
                        target_category = "tour"
                    # -----------------------------------------------

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
                        for k in CONCIERGE_KNOWLEDGE:
                            if last_place in k['answer']:
                                last_category = k.get('category')
                                break
                    
                    if is_another_request and last_category:
                        # 동일 카테고리만 후보로 남김
                        filtered_rec = [r for r in rec_results if r.get('category') == last_category]
                        if filtered_rec:
                            rec_results = filtered_rec
                    elif target_category:
                        # 첫 요청이라도 타겟 카테고리가 있으면 필터링
                        filtered_rec = [r for r in rec_results if r.get('category') == target_category]
                        if filtered_rec:
                            rec_results = filtered_rec

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
                        rag_results = fact_results + other_results + already_said

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
                    
                    target_focus = f"\n- **핀포인트 답변 지침 (중요)**: 고객의 전체 질문 중 오직 '{target_word}'에 직접적으로 관련된 정보만 핀포인트로 친절하게 답변하세요. 질문의 다른 동시 주제나 질문 대상(예: 다른 키워드에 해당하는 항목)에 대한 언급은 답변에서 완전히 제외하고 무시하세요." if target_word else ""
                    
                    # [수정] 컨시어지 도메인인 경우, 지식 베이스를 더 적극적으로 활용하고 서비스 유도를 지시함
                    if domain == "CONCIERGE":
                        info_prompt = (
                            f"고객 질문: {request.text}\n\n"
                            f"아래 제공된 [호텔 지식]을 바탕으로 고객의 질문에 친절하게 답변하세요. {additional_instructions}{target_focus}\n"
                            f"**중요**: 제공된 [호텔 지식]이 고객의 질문과 아예 무관하거나 답을 알 수 없다면, 절대 답변을 지어내지 말고 반드시 정확히 '{_get_static_reply('INFO_NOT_FOUND', request.language)}' 라는 문장만 그대로 출력하세요.\n"
                            f"만약 답변 내용이 택시, 꽃배달, 예약 등 서비스 관련 내용이거나, 프론트 데스크 연결을 제안하는 내용이라면, 답변 마지막에 반드시 '지금 바로 예약을 도와드릴까요?' 또는 '필요하시면 바로 접수해 드릴까요?'와 같이 서비스 이용을 유도하는 질문을 포함하세요.\n"
                            f"**주의**: 질문형으로 대화를 끝맺었다면, 고객이 누를 수 있는 답변 버튼(예: ['네', '아니오'])을 clarification_options에 반드시 제공하세요.\n\n"
                            f"[호텔 지식]\n{knowledge}"
                        )
                    else:
                        info_prompt = (
                            f"고객 질문: {request.text}\n\n"
                            f"아래 제공된 [호텔 지식]은 고객 질문에 대해 검색된 공식 답변입니다. 반드시 이 지식을 활용하여 고객의 질문에 사용된 언어(또는 {request.language} 언어)로 친절하게 답변하세요. {additional_instructions}{target_focus}\n"
                            f"만약 [호텔 지식]에 고객 질문에 대한 답변이 있다면 그 내용을 바탕으로 친절하고 명확하게 답변하세요.\n"
                            f"만약 [호텔 지식]이 고객의 질문과 아예 무관하거나 답을 알 수 없다면, 절대 내용을 지어내거나 추측하지 말고 "
                            f"반드시 정확히 '{_get_static_reply('INFO_NOT_FOUND', request.language)}' 라는 문장만 단독으로 출력하세요. (이 경우 추가적인 질문이나 선택지를 절대 덧붙이지 마세요.)\n\n"
                            f"[호텔 지식]\n{knowledge}"
                        )
                    raw = await call_gemini_async(
                        prompt=info_prompt, 
                        system_instruction='당신은 친절한 아눅(Anook) 호텔 컨시어지입니다. 반드시 {"reply": "답변내용", "clarification_options": ["옵션1", "옵션2"]} 형식의 JSON으로만 출력하세요. 선택지가 필요 없으면 빈 배열을 넣으세요.'
                    )
                    guest_reply = raw.get("reply", _get_static_reply("INFO_NOT_FOUND", request.language)) if isinstance(raw, dict) else _get_static_reply("INFO_NOT_FOUND", request.language)
                    info_clarification_options = raw.get("clarification_options", []) if isinstance(raw, dict) else []
                else:
                    # [수정] RAG 결과가 없을 때 에이전트 폴백 실행 시, 에이전트의 전체 결과를 response로 활용함
                    if domain == "CONCIERGE" and "CONCIERGE" in DOMAIN_AGENTS:
                        print(f"[Analyze] 💡 INFO → RAG 결과 없음. CONCIERGE 에이전트 폴백 실행")
                        agent_result = await invoke_domain_agent(
                            "CONCIERGE",
                            user_message=request.text,
                            room_no=request.room_no,
                            chat_history=request.chat_history,
                            images=request.images,
                            system_language=request.language
                        )
                        # 네/아니오를 묻고 있는 단계라면 티켓 생성을 보류함
                        is_escalation_fallback = agent_result.get("entities", {}).get("intent") == "ESCALATION"
                        has_options_fallback = len(agent_result.get("clarification_options", [])) > 0
                        
                        # 에이전트 결과를 통째로 response 객체로 만듦
                        response = {
                            "guest_reply": agent_result.get("guest_reply", _get_static_reply("INFO_NOT_FOUND", request.language)),
                            "summary": agent_result.get("summary", "정보 문의"),
                            "domain_code": agent_result.get("domain_code") if not (is_escalation_fallback and has_options_fallback) else None,
                            "priority": agent_result.get("priority", "NORMAL"),
                            "entities": agent_result.get("entities", {}),
                            "confidence": agent_result.get("confidence", primary.confidence),
                            "missing_fields": agent_result.get("missing_fields", []),
                            "clarification_options": agent_result.get("clarification_options", [])
                        }
                        
                        # 컨시어지는 웬만한 경우 에스컬레이션 없이 직접 답변하도록 신뢰도 보정
                        if response["confidence"] < 0.5 and response["domain_code"] != "FRONT":
                            response["confidence"] = 0.5 

                        print(f"[Analyze] ℹ️ INFO → CONCIERGE 에이전트 결과 채택")
                        print(f"[Analyze] Response: {response}\n")
                        final_responses.append(response)
                        continue
                    else:
                        guest_reply = _get_static_reply("INFO_NOT_FOUND", request.language)
            except Exception as e:
                print(f"[Analyze] ⚠️ INFO 처리 중 에러 발생: {e}")
                guest_reply = _get_static_reply("INFO_NOT_FOUND", request.language)

            info_not_found_msg = _get_static_reply("INFO_NOT_FOUND", request.language)
            need_more_info_msg = _get_static_reply("NEED_MORE_INFO", request.language)
            
            if guest_reply == info_not_found_msg or "[INFO_NOT_FOUND]" in guest_reply or (info_not_found_msg and info_not_found_msg in guest_reply):
                # ── [원칙 1: AI가 답을 못하고, 해결 주체가 명확함 → 바로 FRONT Handoff] ──
                print(f"[Analyze] 🚨 지식 부재(INFO_NOT_FOUND) → 프론트 데스크 즉시 Handoff 티켓 발행")
                response = {
                    "guest_reply": _get_static_reply("INFO_NOT_FOUND", request.language),
                    "summary": f"{request.text[:20]}... (프론트 이관)",
                    "domain_code": "FRONT",
                    "priority": "URGENT",
                    "entities": {"intent": "ESCALATION", "reason": "LACK_OF_KNOWLEDGE"},
                    "confidence": 1.0,
                    "missing_fields": [],
                    "clarification_options": [],
                    "reasoning": getattr(primary, 'reasoning', f"• Lack of knowledge for: '{request.text}'.\n• Immediate handoff to front desk.")
                }
            elif need_more_info_msg in guest_reply:
                # ── [원칙 2: handoff 자체가 선택적인 상황 → Confirmation ([Yes] [No])] ──
                response = {
                    "guest_reply": guest_reply,
                    "summary": "추가 정보 안내 (프론트 연결 제안)",
                    "domain_code": None,
                    "priority": "NORMAL",
                    "entities": {},
                    "confidence": primary.confidence,
                    "clarification_options": [
                        _get_static_reply("OPTION_YES", request.language),
                        _get_static_reply("OPTION_NO", request.language)
                    ],
                    "reasoning": getattr(primary, 'reasoning', 'Unknown')
                }
            else:
                # LLM이 생성한 clarification_options가 있으면 사용
                options = info_clarification_options if 'info_clarification_options' in locals() else []
                response = {
                    "guest_reply": guest_reply,
                    "summary": "정보 문의",
                    "domain_code": None,
                    "priority": "NORMAL",
                    "entities": {},
                    "confidence": primary.confidence,
                    "clarification_options": options
                }
                
            print(f"[Analyze] ℹ️ INFO 응답")
            print(f"[Analyze] Response: {response}\n")
            final_responses.append(response)
            continue

        # STEP 3-e: CANCEL → 요청 취소
        if primary.route_type == "CANCEL":
            text_lower = request.text.lower()
            is_all = any(word in text_lower for word in ["전부", "모두", "모든", "다 취소", "전체", "all", "everything"])
            
            # AI가 명시적으로 특정 요청 ID를 지정하여 취소하려고 한 경우, 전체 취소로 오버라이드하지 않고 핀포인트 취소로 처리함
            if hasattr(primary, 'target_request_id') and primary.target_request_id is not None:
                is_all = False
            
            # FALSE ALARM: EMERGENCY 도메인 취소 (오인 신고 정정)
            if primary.domain == "EMERGENCY":
                false_alarm_reply_ko = "확인되었습니다. 긴급 호출을 취소 처리하겠습니다. 혹시 다른 도움이 필요하시면 말씀해 주세요."
                false_alarm_reply_en = "Got it — the emergency call has been cancelled. Let me know if there's anything else you need."
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
                print(f"[Analyze] Response: {response}\n")
                final_responses.append(response)
                continue
            else:
                # active_requests에서 실제 취소할 대상 찾기
                targets = []
                active_reqs = getattr(request, 'active_requests', []) or []
                
                if is_all:
                    targets = active_reqs
                else:
                    # 핀포인트 매칭 (ID, 키워드, 도메인 순)
                    target_id = getattr(primary, 'target_request_id', None)
                    target_kw = getattr(primary, 'target_keyword', None)
                    target_dm = primary.domain
                    
                    if target_id is not None:
                        targets = [r for r in active_reqs if r.get("id") == target_id]
                    elif target_kw:
                        kw_lower = target_kw.lower()
                        targets = [r for r in active_reqs if r.get("summary") and kw_lower in r.get("summary", "").lower()]
                    elif target_dm:
                        dept_map = {"HK": "HK", "FACILITY": "FACILITY", "COFFEE": "FB", "FB": "FB", "CONCIERGE": "CONCIERGE"}
                        target_dept_id = dept_map.get(target_dm)
                        if target_dept_id:
                            targets = [r for r in active_reqs if r.get("department_id") == target_dept_id]
                    
                    # 매칭된 대상이 전혀 없다면, 기본 폴백으로 가장 최신(첫 번째) active_request를 취소 대상으로 간주
                    if not targets and active_reqs:
                        targets = [active_reqs[0]]

                # 타겟들의 상태 분석
                has_pending = False
                has_in_progress = False
                for r in targets:
                    status = r.get("status")
                    if status in ("CREATED", "PENDING", "ESCALATED"):
                        has_pending = True
                    elif status in ("IN_PROGRESS", "ASSIGNED", "ACCEPTED"):
                        has_in_progress = True

                # 멘트 결정
                if is_all:
                    if has_pending and not has_in_progress:
                        reply_text = _get_static_reply("CANCEL_SUCCESS", request.language)
                    elif has_in_progress and not has_pending:
                        reply_text = _get_static_reply("CANCEL_PENDING", request.language)
                    else:
                        # 믹스 혹은 기본값
                        reply_text = "대기 중인 요청은 즉시 취소 처리됩니다. 단, 이미 직원이 처리를 시작한 요청의 경우 담당 부서에 취소 가능 여부를 확인해 달라고 전달해 두겠습니다."
                        if request.language != "ko":
                            reply_text = _get_static_reply("CANCEL_IN_PROGRESS", request.language)
                    
                    response = {
                        "guest_reply": reply_text,
                        "summary": "전체 요청 취소",
                        "domain_code": None,
                        "priority": "NORMAL",
                        "entities": {},
                        "confidence": primary.confidence,
                        "action": "CANCEL_ALL_REQUESTS",
                        "reasoning": getattr(primary, 'reasoning', 'Unknown')
                    }
                else:
                    if has_pending and not has_in_progress:
                        reply_text = _get_static_reply("CANCEL_SUCCESS", request.language)
                    elif has_in_progress and not has_pending:
                        reply_text = _get_static_reply("CANCEL_PENDING", request.language)
                    else:
                        # 대기/처리중 믹스이거나 대상이 없는 경우
                        reply_key = "TARGETED_CANCEL" if primary.domain else "CANCEL"
                        reply_text = _get_static_reply(reply_key, request.language)
                        
                    response = {
                        "guest_reply": reply_text,
                        "summary": "요청 취소",
                        "domain_code": primary.domain if primary.domain else None,
                        "priority": "NORMAL",
                        "entities": {"intent": "CANCEL"},
                        "confidence": primary.confidence,
                        "action": "CANCEL_REQUEST",
                        "reasoning": getattr(primary, 'reasoning', 'Unknown')
                    }
                    if hasattr(primary, 'action_type'):
                        response["action_type"] = primary.action_type
                    # [Keyword Targeting] 취소 대상 키워드 전달
                    if hasattr(primary, 'target_keyword') and primary.target_keyword:
                        response["target_keyword"] = primary.target_keyword
                    # [ID Targeting] 취소 대상 ID 전달
                    if hasattr(primary, 'target_request_id') and primary.target_request_id is not None:
                        response["target_request_id"] = primary.target_request_id
            
            print(f"[Analyze] 🛑 CANCEL 응답")
            print(f"[Analyze] Response: {response}\n")
            final_responses.append(response)
            continue
            
        # STEP 3-f: FRONT_ESCALATION → 명시적인 프론트 데스크 연결 요청
        if primary.route_type == "FRONT_ESCALATION":
            is_emergency = (primary.domain == "EMERGENCY")
            
            # 불만(Complaint) 여부 파악 (라우터가 추출한 entities.intent 속성 사용)
            is_complaint = (getattr(primary, 'entities', {}) or {}).get("intent") == "COMPLAINT"
                
            escalation_key = "ESCALATION_INFO" if "INFO_ESCALATION" in (primary.reasoning or "") else "ESCALATION"
            
            if is_emergency:
                reply_key = "EMERGENCY_REPLY"
            elif is_complaint:
                reply_key = "COMPLAINT"
            else:
                reply_key = escalation_key
            
            # Request card title (summary)는 라우터가 분석한 상세 내용을 최대한 보존합니다.
            base_summary = getattr(primary, 'summary', None)
            if base_summary and base_summary not in ["프론트 데스크 직원 연결", "고객 직접 요청", "고객 직접 문의"]:
                summary_val = f"[프론트 연결] {base_summary}"
            else:
                if is_emergency:
                    summary_val = "[프론트 연결] 긴급 구조 요청"
                elif is_complaint:
                    summary_val = "[프론트 연결] 고객 불만"
                else:
                    summary_val = "[프론트 연결] 고객 직접 문의"
            
            response = {
                "guest_reply": _get_static_reply(reply_key, request.language),
                "summary": summary_val,
                "domain_code": "EMERGENCY" if is_emergency else "FRONT",
                "priority": "EMERGENCY" if is_emergency else getattr(primary, 'priority', 'NORMAL'),
                "entities": {"intent": "EMERGENCY" if is_emergency else ("COMPLAINT" if is_complaint else "ESCALATION")},
                "confidence": 0.0,
                "reasoning": getattr(primary, 'reasoning', 'Unknown')
            }
            print(f"[Analyze] 🚨 FRONT_ESCALATION 응답")
            print(f"[Analyze] Response: {response}\n")
            final_responses.append(response)
            continue

        # STEP 3-f-2: VOC → 단순 피드백 (티켓 생성 X)
        if primary.route_type == "VOC":
            sentiment = primary.sentiment if hasattr(primary, 'sentiment') else "POSITIVE"
            reply_ko = "따뜻한 말씀 감사드립니다! 담당 부서에 꼭 전달하겠습니다." if sentiment == "POSITIVE" else "소중한 의견 감사드립니다. 서비스 개선에 꼭 참고하겠습니다."
            reply_en = "Thank you so much for the kind words! We'll definitely pass this along to the team." if sentiment == "POSITIVE" else "We really appreciate your feedback — we'll use it to keep improving."
            response = {
                "guest_reply": reply_ko if request.language == "ko" else reply_en,
                "summary": "고객 피드백 (VOC)",
                "domain_code": None, # 티켓 생성 안 함
                "priority": "NORMAL",
                "entities": {"intent": "VOC", "sentiment": sentiment},
                "confidence": primary.confidence,
                "action": "VOC_FEEDBACK",
                "reasoning": getattr(primary, 'reasoning', 'Unknown')
            }
            print(f"[Analyze] 📝 VOC 피드백 응답")
            print(f"[Analyze] Response: {response}\n")
            final_responses.append(response)
            continue


        # STEP 3-f2: BILLING_INQUIRY → 가상 PMS 비용 조회
        if primary.route_type == "BILLING_INQUIRY":
            from app.domains.billing.service import fetch_billing_summary
            from app.prompts.billing_prompt import build_billing_prompt, BILLING_SYSTEM_PROMPT

            entities = getattr(primary, 'entities', {}) or {}
            target_category = entities.get("category") if isinstance(entities, dict) else None

            try:
                billing_data = await fetch_billing_summary(request.room_no, target_category, request.language)
                items = billing_data.get("items", [])

                if not items:
                    cat_label = target_category or "전체"
                    guest_reply_ko = f"현재까지 {cat_label} 이용 내역이 없습니다."
                    guest_reply_en = f"There are no {cat_label} charges on your room at the moment."
                    guest_reply = guest_reply_ko if request.language == "ko" else guest_reply_en
                else:
                    prompt_text = build_billing_prompt(billing_data, request.language)
                    sys_inst = BILLING_SYSTEM_PROMPT + '\n반드시 {"reply": "응답 내용"} 형식의 JSON으로만 출력하세요.'
                    raw = await call_gemini_async(
                        prompt=prompt_text,
                        system_instruction=sys_inst
                    )
                    if isinstance(raw, dict):
                        guest_reply = raw.get("reply") or raw.get("text") or prompt_text
                    else:
                        guest_reply = prompt_text

                response = {
                    "guest_reply": guest_reply,
                    "summary": "비용 조회",
                    "domain_code": None,
                    "priority": "NORMAL",
                    "entities": {"intent": "BILLING_INQUIRY", "category": target_category or "ALL"},
                    "confidence": primary.confidence,
                    "action": "BILLING_INQUIRY",
                    "reasoning": getattr(primary, 'reasoning', 'Billing inquiry')
                }
            except Exception as e:
                print(f"[Analyze] ⚠️ BILLING_INQUIRY 처리 실패: {e}")
                err_ko = "비용 조회에 일시적 오류가 발생했습니다. 프론트 데스크에 문의해 주세요."
                err_en = "We ran into a temporary issue pulling up your billing info. Please check with the front desk."
                response = {
                    "guest_reply": err_ko if request.language == "ko" else err_en,
                    "summary": "비용 조회 오류",
                    "domain_code": None,
                    "priority": "NORMAL",
                    "entities": {"intent": "BILLING_INQUIRY"},
                    "confidence": primary.confidence,
                    "action": "BILLING_INQUIRY",
                    "reasoning": getattr(primary, 'reasoning', 'Billing inquiry')
                }

            print(f"[Analyze] 💰 BILLING_INQUIRY 응답")
            print(f"[Analyze] Response: {response}\n")
            final_responses.append(response)
            continue

        # STEP 3-g: STATUS_CHECK → 진행 상태 확인
        if primary.route_type == "STATUS_CHECK":
            response = {
                "guest_reply": _get_static_reply("STATUS_CHECK", request.language),
                "summary": "요청 진행 상태 확인",
                "domain_code": None,
                "priority": "NORMAL",
                "entities": {"action": "STATUS_CHECK"},
                "confidence": primary.confidence,
                "action": "STATUS_CHECK",
                "reasoning": getattr(primary, 'reasoning', 'Unknown')
            }
            print(f"[Analyze] 🔍 STATUS_CHECK 응답")
            print(f"[Analyze] Response: {response}\n")
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

            # 🚨 [카드 생성 방지 로직] 필수값(missing_fields)이 아직 다 채워지지 않았거나, 에이전트가 아직 최종 접수(ADD/REPLACE)를 확정하지 않았다면 절대 카드를 생성하지 않음 (대화로만 처리)
            # 단, 에스컬레이션/컴플레인 상황에서는 예외적으로 티켓을 무조건 생성하도록 방어 우회
            is_escalation = final_entities.get("intent") in ["ESCALATION", "COMPLAINT", "EMERGENCY"]
            
            action_type = agent_result.get("action_type")
            if action_type is None:
                action_type = final_entities.get("action_type")
            if action_type is None:
                action_type = getattr(primary, 'action_type', None)
            
            if (agent_result.get("missing_fields") or action_type not in ["ADD", "REPLACE", "ADD_DUPLICATE"]) and not is_escalation:
                final_domain_code = None

            # ── 중복 주문 감지 게이트 ──────────────────────────
            # 에이전트가 ADD로 판단했지만 같은 부서에 동일 아이템의 활성 요청이 있으면,
            # LLM이 놓친 중복을 코드 레벨에서 잡아 확인 질문을 강제합니다.
            # "네" → ADD_DUPLICATE / "아니 그거 취소해" → REPLACE
            #
            # [AN-342] 부서(department) 단위가 아닌 아이템(item) 단위로 비교.
            # 브라우니 주문 후 콜라를 추가 주문하는 것은 정상이므로 중복 질문 X.
            # 브라우니 주문 후 브라우니를 다시 주문하면 중복 질문 O.
            # ──────────────────────────────────────────────
            if (final_domain_code
                    and action_type == "ADD"
                    and not is_escalation
                    and hasattr(request, 'active_requests') and request.active_requests):

                # 1) 새 요청의 아이템 키워드 추출
                _new_items = set()
                if isinstance(final_entities, dict):
                    # REQ_ITEM 필드 (라우터/에이전트 공통)
                    _req_items = final_entities.get("REQ_ITEM", [])
                    if isinstance(_req_items, list):
                        _new_items.update(str(i).strip().lower() for i in _req_items if i)
                    elif isinstance(_req_items, str) and _req_items.strip():
                        _new_items.add(_req_items.strip().lower())

                    # items 필드 (에이전트 상세 형식: [{item, count}, ...])
                    _items_list = final_entities.get("items", [])
                    if isinstance(_items_list, list):
                        for _item_dict in _items_list:
                            if isinstance(_item_dict, dict) and _item_dict.get("item"):
                                _new_items.add(str(_item_dict["item"]).strip().lower())

                    # menu_items 필드 (FB 에이전트 형식: [{name, quantity}, ...])
                    _menu_items = final_entities.get("menu_items", [])
                    if isinstance(_menu_items, list):
                        for _mi in _menu_items:
                            if isinstance(_mi, dict) and _mi.get("name"):
                                _new_items.add(str(_mi["name"]).strip().lower())

                # 2) 기존 활성 요청 중 아이템이 겹치는 건만 매칭
                _existing_req = None
                for req in request.active_requests:
                    if (req.get("department_id") == domain
                            and req.get("status") in ("PENDING", "IN_PROGRESS", "ASSIGNED")):
                        _existing_summary = (req.get("summary") or "").lower()
                        # 아이템 키워드가 없으면 (엔티티 파싱 실패 등) 중복 감지 스킵
                        if not _new_items:
                            break
                        # 새 요청의 아이템 중 하나라도 기존 요청 summary에 포함되면 중복
                        if any(item in _existing_summary for item in _new_items):
                            _existing_req = req
                            break

                if _existing_req:
                    _existing_summary = _existing_req.get("summary", "이전 요청")
                    _existing_id = _existing_req.get("id")

                    print(f"[Analyze] 🔄 중복 주문 감지: 동일 아이템 발견 (id={_existing_id}, summary='{_existing_summary}', matched_items={_new_items})")

                    _lang = getattr(request, 'language', 'ko')
                    _dup_question = _get_static_reply("DUPLICATE_CONFIRM", _lang).format(summary=_existing_summary)

                    # 티켓 생성 차단 + 확인 질문 강제
                    final_domain_code = None
                    final_guest_reply = _dup_question
                    agent_result["missing_fields"] = []
                    agent_result["clarification_options"] = [
                        _get_static_reply("OPTION_ADD", _lang),
                        _get_static_reply("OPTION_REPLACE", _lang)
                    ]
                    # 기존 요청 ID를 agent_result에 주입 → L1693에서 response에 복사됨
                    agent_result["target_request_id"] = _existing_id

            # 🛡️ [컨시어지 확인 질문 방어] 로직 삭제됨 (AN-344: 확인 질문과 동시에 정적 카드를 띄우기 위해 차단 해제)
            
            # 이중 방어: FRONT 에이전트이고 에스컬레이션인데 여전히 domain_code가 없다면 강제 복구
            if domain == "FRONT" and is_escalation and not final_domain_code:
                final_domain_code = "FRONT"

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
                "reasoning": agent_result.get("reasoning", getattr(primary, 'reasoning', 'Unknown'))
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

            # [Target Request ID Targeting] 중복 대상 요청 ID 전달
            if "target_request_id" in agent_result.get("entities", {}):
                response["target_request_id"] = agent_result["entities"]["target_request_id"]
            elif "target_request_id" in agent_result:
                response["target_request_id"] = agent_result["target_request_id"]
            elif hasattr(primary, 'target_request_id') and getattr(primary, 'target_request_id', None):
                response["target_request_id"] = getattr(primary, 'target_request_id', None)
                
            print(f"[Analyze] ✅ {domain} agent parallel processing complete")
            print(f"[Analyze] Response: {response}\n")
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

    return final_responses


class TranslateRequest(BaseModel):
    text: str
    target_language: str

@router.post("/translate-summary")
async def translate_text(request: TranslateRequest) -> dict:
    prompt = f"Translate the following hotel dashboard summary into {request.target_language}. Keep it extremely concise, like a short title or noun phrase (e.g., 'Request for 2 towels' instead of 'I would like to request 2 towels'). Respond ONLY with the translated text.\n\nText: {request.text}"
    translated_text = await call_gemini_async(
        prompt=prompt,
        system_instruction="You are a professional translator for a hotel dashboard UI. Provide exact, concise translations without formatting or conversational filler."
    )
    return {"translated_text": translated_text}

