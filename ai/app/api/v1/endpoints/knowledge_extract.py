from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from app.domains.rag.extractor import extract_rag_candidates

router = APIRouter()

class ChatMessage(BaseModel):
    sender_type: str      # 'GUEST', 'STAFF', 'AI'
    content: str

class ExtractRequest(BaseModel):
    messages: List[ChatMessage]

class KnowledgeCandidate(BaseModel):
    question: str
    answer: str
    domain_code: str
    confidence: float

class ExtractResponse(BaseModel):
    candidates: List[KnowledgeCandidate]

@router.post("/extract-from-chat", response_model=ExtractResponse)
async def extract_from_chat_endpoint(request: ExtractRequest):
    """
    대화 내용에서 RAG 지식(Q&A) 후보들을 추출하고 분류합니다.
    """
    try:
        # ChatMessage Pydantic 모델을 dict 리스트로 변환
        messages_dict = [{"sender_type": msg.sender_type, "content": msg.content} for msg in request.messages]
        result = await extract_rag_candidates(messages_dict)
        return ExtractResponse(candidates=result.get("candidates", []))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract knowledge: {str(e)}")
