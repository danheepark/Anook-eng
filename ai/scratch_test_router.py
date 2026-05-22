import os
import asyncio
from dotenv import load_dotenv
load_dotenv()

from app.api.analyze import _analyze_message_core, AnalyzeRequest

async def main():
    req = AnalyzeRequest(
        text="우산과 자전거 빌릴 수 있나요?",
        room_no="301",
        language="ko",
        system_language="ko",
        chat_history=[],
        images=[],
        active_requests=[],
        room_inventory={}
    )
    results = await _analyze_message_core(req)
    for r in results:
        print("--- ANALYZE RESULT ---")
        print(f"guest_reply: {r.get('guest_reply')}")
        print(f"summary: {r.get('summary')}")
        print(f"domain_code: {r.get('domain_code')}")
        print(f"confidence: {r.get('confidence')}")
        print(f"target_keyword: {r.get('target_keyword')}")
        print(f"clarification_options: {r.get('clarification_options')}")

asyncio.run(main())
