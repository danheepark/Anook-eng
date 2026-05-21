import sys
import asyncio
import json
from app.core.hk_engine import process_message

async def main():
    chat_history = [
        {"role": "user", "content": "수건 2장 더 주세요"},
        {"role": "ai", "content": "이전에 하우스키핑 요청 내역이 있습니다. 추가로 새 요청을 진행해 드릴까요?"},
        {"role": "user", "content": "네"}
    ]
    active_requests = [{"id": 90, "department_id": "HK", "status": "IN_PROGRESS", "summary": "수건 2장 요청", "entities": '{"intent": "MULTIPLE_HK", "items": [{"item": "TOWEL", "count": 2}]}'}]
    
    result = await process_message("101", chat_history, active_requests, "ko")
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
