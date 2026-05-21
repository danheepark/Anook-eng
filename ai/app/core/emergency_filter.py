"""
긴급 상황 키워드 Pre-Filter (EM-217)
────────────────────────────────────
Gemini 호출 이전에 화재·의료·위협 키워드를 감지하여
즉시 EMERGENCY + URGENT로 반환한다.

매칭 시 Gemini 호출을 건너뛰어 지연 시간을 0에 가깝게 줄인다.
"""

import re
from typing import Optional, Dict, Any

EMERGENCY_KEYWORDS: Dict[str, Dict[str, Any]] = {
    "MEDICAL_ASSIST": {
        "patterns": [
            # 극단적으로 명백한 생명 직결 단어만 남김 (말장난 불가능한 수준)
            r"119", r"구급차", r"앰뷸런스", r"심정지", r"심장\s*마비", 
            r"살려\s*주세", r"응급실\s*불러", r"cpr", r"의식\s*없"
        ],
        "severity": 10,
    },
    "SECURITY": {
        "patterns": [
            # 폭동/범죄 등 경찰 개입이 필요한 명백한 단어
            r"강도", r"도둑", r"침입", r"경찰\s*불러", r"경찰\s*신고", r"살인"
        ],
        "severity": 10,
    },
    "WATER_LEAK": {
        "patterns": [r"물\s*바다", r"물\s*새", r"누수", r"홍수"],
        "severity": 10,
    },
    "URGENT_CLEANUP": {
        "patterns": [r"토했", r"구토", r"피\s*흘", r"오물", r"토\s*사물"],
        "severity": 9,
    }
}
# 긴급 상황별 다국어 응답 (한국어/영어만 지원)
EMERGENCY_REPLIES: Dict[str, Dict[str, str]] = {
    "MEDICAL_ASSIST": {
        "ko": "구급약품/의료 지원이 필요하시군요. 직원이 구급상자를 지참하여 즉시 객실로 출동하겠습니다. 안정을 취하고 잠시만 기다려주세요.",
        "en": "We received your medical assistance request. A staff member is bringing a first-aid kit to your room immediately. Please rest and wait.",
    },
    "SECURITY": {
        "ko": "고객님, 놀라게 해드려 죄송합니다. 즉시 보안팀과 직원이 해당 층으로 출동하여 안전을 확보하겠습니다. 안심하시고 객실 문을 잠근 채 대기해 주세요.",
        "en": "We apologize for the disturbance. Security and staff are on their way to your floor immediately to ensure your safety. Please lock your door and wait safely.",
    },
    "WATER_LEAK": {
        "ko": "🚨 객실 누수가 감지되었습니다! 감전 위험이 있으니 콘센트에서 떨어져 계세요. 시설팀이 즉시 출동하여 룸 체인지를 도와드리겠습니다.",
        "en": "🚨 Room flooding detected! Please stay away from electrical outlets. Our facility team is on the way to assist with a room change.",
    },
    "URGENT_CLEANUP": {
        "ko": "불쾌감을 드려 대단히 죄송합니다. 하우스키핑팀이 즉시 출동하여 해당 구역을 신속하고 깨끗하게 청소 및 소독 조치하겠습니다.",
        "en": "We sincerely apologize for the unpleasant experience. Housekeeping is on the way to immediately clean and sanitize the area.",
    }
}

import re

def emergency_pre_filter(text: str) -> Optional[Dict[str, Any]]:
    """
    키워드 기반 긴급 상황 사전 필터.
    한국어 조사나 띄어쓰기 변형에도 유연하게 대처하기 위해 정규식(Regex) 매칭 적용.
    """
    text_lower = text.lower()
    text_no_space = text_lower.replace(" ", "")

    for category, config in EMERGENCY_KEYWORDS.items():
        for pattern in config["patterns"]:
            match = re.search(pattern, text_lower)
            if match:
                return {
                    "category": category,
                    "matched_keyword": match.group(0),
                    "severity": config["severity"],
                }
                    
    return None


def get_emergency_reply(category: str, language: str = "ko") -> str:
    """긴급 상황 카테고리에 맞는 다국어 응답을 반환한다."""
    lang = (language or "ko").lower()
    if lang not in ("ko", "en"):
        lang = "en"
    return EMERGENCY_REPLIES.get(category, {}).get(lang, EMERGENCY_REPLIES[category]["en"])
