from fastapi import APIRouter
from app.api.v1.endpoints.router import router as router_endpoint
from app.api.v1.endpoints.rag import router as rag_endpoint
from app.api.v1.endpoints.knowledge_extract import router as knowledge_extract_endpoint
from app.api.v1.endpoints.facility import router as facility_endpoint
from app.api.v1.endpoints.hk import router as hk_endpoint
from app.api.v1.endpoints.fb import router as fb_endpoint
from app.api.v1.endpoints.concierge import router as concierge_endpoint

api_router = APIRouter()

# ── 메인 라우터 (AN-194: 도메인 분류) ──
api_router.include_router(router_endpoint, tags=["router"])
api_router.include_router(rag_endpoint, prefix="/rag", tags=["rag"])
api_router.include_router(knowledge_extract_endpoint, prefix="/rag", tags=["rag"])

# 도메인별 라우터를 향후 여기서 import 하여 등록합니다.
api_router.include_router(facility_endpoint, prefix="/facility", tags=["facility"])
api_router.include_router(concierge_endpoint, prefix="/concierge", tags=["concierge"])
api_router.include_router(hk_endpoint, prefix="/hk", tags=["housekeeping"])
api_router.include_router(fb_endpoint, prefix="/fb", tags=["food_beverage"])
