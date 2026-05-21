from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from app.core.concierge_engine import run_concierge_agent
from app.schemas.common import HotelRequestSchema

router = APIRouter()

class DomainRequest(BaseModel):
    message: str
    room_no: str
    chat_history: Optional[List[dict]] = []

@router.post("", response_model=HotelRequestSchema)
async def handle_concierge(request: DomainRequest):
    """
    컨시어지 에이전트 전용 엔드포인트 (Step 0-3)
    ──────────────────────────────────────
    개별 테스트 및 직접 호출을 위한 API.
    """
    return await run_concierge_agent(request.message, request.room_no, request.chat_history)
