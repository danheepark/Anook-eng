from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict, Any
from app.infrastructure.gemini.client import call_gemini

router = APIRouter()

# Simple in-memory translation cache to avoid duplicate LLM calls
TRANSLATION_CACHE: Dict[str, str] = {}

class TranslateRequest(BaseModel):
    text: str
    target_language: str

@router.post("/translate")
async def translate_message(request: TranslateRequest) -> Dict[str, Any]:
    """
    직원의 메시지를 투숙객의 언어로 번역합니다.
    """
    cache_key = f"{request.target_language}:{request.text}"
    if cache_key in TRANSLATION_CACHE:
        cached_result = TRANSLATION_CACHE[cache_key]
        print(f"[Translate] ⚡ 캐시 히트! (성능 최적화) - Text: '{request.text}' -> '{cached_result}'")
        return {"translated_text": cached_result}

    print(f"\n[Translate] 📩 번역 요청 - Text: '{request.text}', Target: {request.target_language}")

    # 언어 코드 → 정식 언어명 매핑 (Gemini가 "ko"를 제대로 인식 못하는 문제 방지)
    LANG_MAP = {
        "ko": "Korean (한국어)",
        "en": "English",
        "ja": "Japanese (日本語)",
        "zh": "Chinese (中文)",
        "es": "Spanish (Español)",
        "fr": "French (Français)",
        "de": "German (Deutsch)",
    }
    target_lang_name = LANG_MAP.get(request.target_language, request.target_language)

    try:
        raw = call_gemini(
            prompt=(
                f"Translate the following text into {target_lang_name}. "
                f"Do NOT summarize, paraphrase, or explain. Only translate.\n\n"
                f"Text: {request.text}"
            ),
            system_instruction=(
                'You are a professional hotel translator. '
                'Translate the given text exactly as-is into the target language. '
                'Use polite, natural hotel-style expressions. '
                'Do NOT summarize or shorten the text. '
                'Output ONLY a JSON: {"translated_text": "translation result"}'
            )
        )
        translated = raw.get("translated_text", request.text)
        TRANSLATION_CACHE[cache_key] = translated
        print(f"[Translate] ✅ 번역 완료: {translated}\n")
        return {"translated_text": translated}
    except Exception as e:
        print(f"[Translate] ❌ 번역 실패: {e}\n")
        # 실패 시 원문 반환
        return {"translated_text": request.text}
