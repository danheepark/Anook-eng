import os
import httpx

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8080")


async def fetch_billing_summary(room_no: str, category: str = None, language: str = "en") -> dict:
    """백엔드 /pms/billing/summary API 호출"""
    params = {"roomNo": room_no, "language": language}
    if category and category != "ALL":
        params["category"] = category

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{BACKEND_URL}/pms/billing/summary", params=params)
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        print(f"[Billing] ⚠️ 백엔드 Billing API 호출 실패: {e}")
        raise
