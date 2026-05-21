"""
Gemini API 공통 클라이언트 (Google GenAI SDK v1 적용)
──────────────────────────────────────────────────
모든 AI 모듈(라우터, 도메인 에이전트 등)이 공유하는 Gemini 호출 래퍼.
기존 google-generativeai 대신 최신 google-genai SDK를 사용합니다.
"""

import json
import time
import asyncio
import contextvars
import base64
from typing import Union, List, Dict, Any, Optional
from contextvars import ContextVar

from google import genai
from google.genai import types
from app.core.config import settings

# 로깅용 메타데이터 전역 컨텍스트 변수 (스레드/비동기 안전)
ai_log_meta_ctx: ContextVar[dict] = ContextVar("ai_log_meta", default={})

# ── 클라이언트 초기화 (Singleton 패턴처럼 사용) ──
client = genai.Client(api_key=settings.GEMINI_API_KEY)


def call_gemini(
    prompt: str,
    system_instruction: str,
    model_name: str = "gemini-2.5-flash", # 최신 모델명으로 권장
    temperature: float = 0.2,
    images: List[str] = None,
) -> Union[Dict[str, Any], List[Any]]:
    """
    Gemini에게 프롬프트를 보내고, JSON 딕셔너리 또는 리스트로 파싱하여 반환한다.
    """
    
    # [백엔드 아키텍처 해킹]: 다국어 룰 강제 주입
    global_i18n_rule = """
[GLOBAL SYSTEM RULE FOR MULTILINGUAL UX]
CRITICAL: You MUST write guest-facing fields (e.g., 'clarification_question', 'guest_reply', 'fallback_message') in the EXACT SAME LANGUAGE as the guest's input. Do NOT translate these to Korean if the guest speaks another language.
However, you MUST write staff-facing fields (e.g., 'summary', 'details', 'reasoning', 'item', 'menu') STRICTLY in KOREAN.
"""
    final_system_instruction = system_instruction + "\n" + global_i18n_rule

    # ── 콘텐츠 구성 (텍스트 + 이미지) ──
    contents = []
    
    # 1. 텍스트 프롬프트 추가
    contents.append(prompt)
    
    # 2. 이미지 데이터 추가 (Base64 -> Bytes)
    if images:
        for b64 in images:
            if b64.startswith("data:image"):
                b64 = b64.split(",", 1)[1]
            image_data = base64.b64decode(b64)
            contents.append(
                types.Part.from_bytes(data=image_data, mime_type="image/jpeg")
            )
            
    start_time = time.time()
    
    # ── Gemini 호출 (신규 SDK 방식) ──
    response = client.models.generate_content(
        model=model_name,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=final_system_instruction,
            temperature=temperature,
            response_mime_type="application/json", # JSON 출력 강제 (SDK 기능 활용)
        ),
    )
    
    latency_ms = int((time.time() - start_time) * 1000)
    
    # 응답 텍스트 추출
    raw_text = response.text.strip()
    
    # 마크다운 코드 블록 제거 (JSON 응답 시 발생 가능)
    if raw_text.startswith("```"):
        raw_text = raw_text.strip("`").lstrip("json").strip()
        
    # 토큰 사용량 정보 추출
    prompt_tokens = 0
    completion_tokens = 0
    if response.usage_metadata:
        prompt_tokens = response.usage_metadata.prompt_token_count or 0
        completion_tokens = response.usage_metadata.candidates_token_count or 0
        
    # 로깅 메타데이터 설정
    ai_log_meta_ctx.set({
        "model_name": model_name,
        "raw_prompt": prompt,
        "raw_response": raw_text,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "latency_ms": latency_ms
    })
    
    try:
        # LLM의 응답 문자열 내에 이스케이프되지 않은 개행 문자(\n) 등이 포함되어 있어도 
        # 파싱 에러를 던지지 않도록 strict=False 설정을 강제 부여합니다.
        parsed = json.loads(raw_text, strict=False)
        
        # [추가] reasoning 필드가 리스트로 올 경우 문자열로 변환 (모든 에이전트 공통)
        # Gemini Vision의 경우 bullet point가 리스트로 반환되어 줄바꿈이 무시되는 현상 방지
        if isinstance(parsed, dict) and isinstance(parsed.get("reasoning"), list):
            parsed["reasoning"] = "\n".join(parsed["reasoning"])
        elif isinstance(parsed, list):
            for item in parsed:
                if isinstance(item, dict) and isinstance(item.get("reasoning"), list):
                    item["reasoning"] = "\n".join(item["reasoning"])
                    
        return parsed
    except json.JSONDecodeError as e:
        raise ValueError(
            f"Gemini 응답이 유효한 JSON이 아닙니다.\n"
            f"원본 응답: {raw_text}\n"
            f"파싱 에러: {e}"
        )


async def call_gemini_async(
    prompt: str,
    system_instruction: str,
    model_name: str = "gemini-2.5-flash",
    temperature: float = 0.2,
    images: List[str] = None,
) -> Union[Dict[str, Any], List[Any]]:
    """
    call_gemini의 비동기 버전.
    """
    ctx = contextvars.copy_context()
    
    def _run():
        return call_gemini(prompt, system_instruction, model_name, temperature, images)
        
    # 신규 SDK는 아직 완전한 비동기 클라이언트를 지원하지 않을 수 있으므로 thread에서 실행
    result = await asyncio.to_thread(ctx.run, _run)
    
    meta = ctx.get(ai_log_meta_ctx)
    if meta and isinstance(result, dict):
        result["__ai_log_meta"] = meta
        
    return result
