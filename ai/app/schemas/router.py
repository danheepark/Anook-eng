from pydantic import BaseModel, Field
from typing import Optional

class RouterOutputSchema(BaseModel):
    """
    메인 라우터(Front Desk)가 사용자 입력의 의도를 최우선으로 판단할 때 사용하는 전용 스키마
    """
    route_type: str = Field(
        description="처리 유형 (DEPARTMENT, CLARIFICATION, FRONT_ESCALATION, SOFT_FALLBACK, NON_ACTIONABLE, INFO, CANCEL, STATUS_CHECK)"
    )
    domain: Optional[str] = Field(
        default=None, 
        description="담당 부서 코드 (HK, FB, FACILITY, CONCIERGE, FRONT, COMMON, EMERGENCY). DEPARTMENT, INFO, CANCEL 등에서 지정."
    )
    confidence: float = Field(
        description="도메인 및 라우트 분류 확신도 (0.0 ~ 1.0)"
    )
    reasoning: str = Field(
        description="이 도메인/유형으로 분류한 논리적 이유 (개발자 디버깅 및 로깅용)"
    )
    action_type: str = Field(
        default="ADD",
        description="요청 유형: ADD(새로운 요청 추가) 또는 REPLACE(이전 요청을 수정/변경). 고객이 '아니', '바꿔줘' 등으로 기존 요청을 번복하면 REPLACE."
    )
    target_keyword: Optional[str] = Field(
        default=None,
        description="취소/변경 대상이 되는 구체적인 아이템 명칭."
    )
    reply: Optional[str] = Field(
        default=None,
        description="고객에게 직접 반환할 자연스러운 AI 응답 (SOFT_FALLBACK, NON_ACTIONABLE 등에서 사용)."
    )
    create_ticket: bool = Field(
        default=True,
        description="DB에 티켓을 생성할지 여부 (SOFT_FALLBACK, NON_ACTIONABLE, CLARIFICATION 등에서는 False)."
    )
    summary: Optional[str] = Field(
        default=None,
        description="프론트 에스컬레이션 등에서 사용할 요청 요약 (명사형)."
    )
    priority: Optional[str] = Field(
        default="NORMAL",
        description="긴급도 (NORMAL, URGENT)."
    )
    clarification_question: Optional[str] = Field(
        default=None,
        description="정보가 부족할 때 고객에게 되물을 구체적인 질문 내용."
    )
    clarification_options: Optional[list] = Field(
        default_factory=list,
        description="고객이 쉽게 선택할 수 있는 짧은 답변 옵션 리스트 (예: ['무료 생수', '유료 음료']). CLARIFICATION 시 제공."
    )
    sentiment: Optional[str] = Field(
        default=None,
        description="고객 피드백(VOC)에 대한 감정 태그 (POSITIVE, NEGATIVE)"
    )
