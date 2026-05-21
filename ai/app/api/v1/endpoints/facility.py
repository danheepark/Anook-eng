from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from app.core.facility_engine import run_facility_agent
from app.schemas.common import HotelRequestSchema

router = APIRouter()

class DomainRequest(BaseModel):
    message: str
    room_no: str
    chat_history: List[dict] = []

@router.post("")
async def handle_facility(request: DomainRequest):
    return await run_facility_agent(request.message, request.room_no, request.chat_history)
