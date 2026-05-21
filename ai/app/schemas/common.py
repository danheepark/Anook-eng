from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional

class HotelRequestSchema(BaseModel):
    target_request_id: Optional[int] = Field(default=None, description="중복 또는 변경 대상이 되는 기존 요청의 ID")
    """
    아늑(Aneuk) 호텔 AI 시스템의 공통 JSON 응답 스키마
    모든 도메인 에이전트(HK, FB, FACILITY 등)는 이 규격에 맞추어 JSON을 반환해야 합니다.
    """
    # --- [1. 백엔드 DB & 직원 대시보드용 데이터 (ERD 호환)] ---
    request_id: str = Field(description="요청 고유 ID (예: REQ_1029)")
    room_no: str = Field(description="객실 번호 (예: 101)")
    
    domain: str = Field(description="담당 부서 코드 (HK, FB, FACILITY, CONCIERGE, FRONT, COMMON)")
    
    summary: str = Field(description="어떤 요청/문의인지 프론트데스크 직원이 바로 이해할 수 있도록 3줄 요약 (반드시 전달받은 system_language 언어로 작성)")
    priority: str = Field(description="긴급도 (직원 UI 화면에 빨간색 긴급 뱃지로 표시: NORMAL, URGENT)")
    status: str = Field(default="PENDING", description="티켓 상태 (PENDING, ASSIGNED, IN_PROGRESS, COMPLETED 등)")
    confidence: float = Field(description="AI 확신도 (0.0 ~ 1.0)")
    reasoning: str = Field(default="", description="AI가 이 판단을 내린 논리적 근거 (디버깅/업무 상세용)")
    action_type: Optional[str] = Field(default=None, description="ADD, REPLACE, ADD_DUPLICATE 등")
    
    # --- [2. 챗봇 UX & 부서별 가변 데이터 (동적 데이터)] ---
    # [부서별 entities 작성 가이드]
    # 부서마다 달라지는 동적 데이터를 담는 주머니입니다.
    # 대시보드 '최다 요청 항목' 통계를 위해 'intent' 키는 모든 부서 필수입니다. (이거 꼭지키기)
    # 예시:
    #   HK:        {'intent': 'TOWEL', 'item': '수건', 'count': 2}
    #   FB:        {'intent': 'ROOM_SERVICE', 'menu': '콜라', 'price': 5000}
    #   FACILITY:  {'intent': 'AC_REPAIR', 'symptom': '안 켜짐', 'location': '침실'}
    #   CONCIERGE: {'intent': 'TAXI', 'destination': '인천공항', 'time': '14:00'}
    #   FRONT: {'intent': 'LATE_CHECKOUT', 'time': '14:00'}
    entities: Dict[str, Any] = Field(
        default_factory=dict, 
        description="부서마다 달라지는 동적 데이터 (대시보드 통계용 'intent' 키 필수 포함)"
    )
    missing_fields: List[str] = Field(
        default_factory=list, 
        description="필수 정보 중 누락된 항목 목록"
    )
    needs_clarification: bool = Field(
        default=False, 
        description="이 값이 true일 경우, 백엔드는 DB에 저장하지 않고 채팅창에 바로 질문을 튕겨냄"
    )
    clarification_question: str = Field(
        default="", 
        description="고객에게 되물을 구체적 질문 (예: '수건을 몇 개 가져다드릴까요?'). 반드시 고객이 입력한 언어(예: 영어면 영어)와 정확히 동일한 언어로 번역하여 작성하세요. 누락된 정보(예: 수량, 옵션)를 정확하게 콕 집어서 물어봐야 하며, '어떤 도움이 필요하신가요?' 같은 범용적인 질문은 절대 금지합니다. 만약 이전 대화에서 이미 같은 정보를 물어봤는데도 고객이 대답하지 않거나 'what?', '뭐라고?' 처럼 이해하지 못한 반응을 보인다면, 누락된 핵심 키워드(예: 수량, 종류)를 다시 한 번 명확하게 언급하며 더 쉬운 표현으로 구체적인 질문을 던지세요."
    )
    final_reply: str = Field(
        default="", 
        description="요청이 최종 접수되었을 때 고객에게 안내할 완료 멘트 (반드시 고객이 사용한 언어로 작성)"
    )
    clarification_options: List[str] = Field(
        default_factory=list,
        description="채팅창 UI에 띄워줄 선택지 칩(Pill Tab) 텍스트 배열 (예: ['생수병', '얼음물']). 반드시 고객이 입력한 언어와 동일한 언어로 번역해서 제공하세요."
    )
