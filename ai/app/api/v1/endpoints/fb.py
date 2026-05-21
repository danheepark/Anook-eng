from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from app.core.fb_engine import run_fb_agent
from app.schemas.common import HotelRequestSchema

router = APIRouter()

class DomainRequest(BaseModel):
    message: str
    room_no: str
    chat_history: List[dict] = []

@router.post("", response_model=HotelRequestSchema)
async def handle_fb(request: DomainRequest):
    return await run_fb_agent(request.message, request.room_no, request.chat_history)
