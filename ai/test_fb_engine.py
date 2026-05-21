import asyncio
from app.core.fb_engine import _fetch_menu_context
print(asyncio.run(_fetch_menu_context()))
