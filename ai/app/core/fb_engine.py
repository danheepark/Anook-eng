# pyrefly: ignore [missing-import]
import httpx
import asyncio
from app.infrastructure.gemini.client import call_gemini_async
from app.prompts.fb_prompt import FB_SYSTEM_PROMPT
from app.schemas.common import HotelRequestSchema
from app.domains.rag import service as rag_service

import os

def _fetch_menu_context_raw() -> list:
    """백엔드 PMS API에서 메뉴 raw JSON 리스트를 반환 (가드레일 검증용)"""
    try:
        base_url = os.getenv("BACKEND_URL", "http://localhost:8080")
        with httpx.Client(timeout=3.0) as client:
            resp = client.get(f"{base_url}/pms/menus")
        if resp.status_code == 200:
            return resp.json()
        return []
    except Exception:
        return []

def _fetch_menu_context() -> str:
    """백엔드 PMS API를 호출하여 메뉴 데이터를 가져와 프롬프트 컨텍스트로 변환"""
    try:
        # 환경 변수에 BACKEND_URL이 있으면 사용하고 (배포용), 없으면 로컬 도커 환경의 호스트 접근 주소를 사용
        base_url = os.getenv("BACKEND_URL", "http://localhost:8080")
        with httpx.Client(timeout=3.0) as client:
            resp = client.get(f"{base_url}/pms/menus")
            
        if resp.status_code == 200:
            menus = resp.json()
            # 중복 메뉴 제거 (name 기준)
            seen = set()
            unique_menus = []
            for m in menus:
                if m.get("name") not in seen:
                    seen.add(m.get("name"))
                    unique_menus.append(m)

            menu_lines = []
            for m in unique_menus:
                name = m.get("name")
                price = m.get("price")
                category = m.get("category")
                allergens = m.get("allergens")
                options = m.get("options")
                allergy_str = f" (알러지: {allergens})" if allergens else ""
                
                option_str = ""
                if options:
                    if isinstance(options, str):
                        import json
                        try:
                            options_list = json.loads(options)
                        except:
                            options_list = []
                    else:
                        options_list = options

                    if isinstance(options_list, list):
                        for opt in options_list:
                            group_name = opt.get("groupName", "")
                            is_required = opt.get("isRequired", False)
                            items = opt.get("items", [])
                            items_str = "|".join(items)
                            if is_required:
                                option_str += f" [필수옵션] {group_name}:{items_str}"
                            else:
                                option_str += f" [선택옵션] {group_name}:{items_str}"
                    else:
                        option_str = f" [선택옵션] {options}"
                        
                menu_lines.append(f"- [{category}] {name}: ${price:.2f}{allergy_str}{option_str}")
            return "\n".join(menu_lines)
        else:
            print(f"[FB Agent] 메뉴 조회 API 실패: HTTP {resp.status_code}")
            return "메뉴 정보를 현재 불러올 수 없습니다."
    except Exception as e:
        print(f"[FB Agent] 메뉴 조회 API 호출 중 오류 발생: {e}")
        return "메뉴 정보를 현재 불러올 수 없습니다. 프론트데스크로 문의 부탁드립니다."

async def run_fb_agent(user_message: str, room_no: str, chat_history: list = None, images: list = None, system_language: str = "en", active_requests: list = None, room_inventory: dict = None, special_notes: str = None, **kwargs) -> dict:
    """F&B 에이전트: 메뉴 조회, RAG 지식 결합, 2턴 주문 확인 로직 처리"""
    
    # 1. pms_menu 백엔드 조회
    menu_context = await asyncio.to_thread(_fetch_menu_context)
    
    # 2. RAG 검색 → FB 도메인 지식 (운영시간, 기타 정책 등)
    rag_context = ""
    try:
        rag_results = rag_service.search_hybrid(
            query=user_message, domain_code="FB", top_k=3, threshold=0.5
        )
        if rag_results:
            rag_context = "\n".join([f"- {r['question']}: {r['answer']}" for r in rag_results])
    except Exception as e:
        print(f"[FB Agent] RAG 검색 실패: {e}")

    # 3. 대화 맥락 조립
    prompt = ""
    if special_notes:
        prompt += f"[투숙객 PMS 특이사항 (Special Notes)]\n{special_notes}\n\n"

    if menu_context:
        prompt += f"[Available Menu]\n{menu_context}\n\n"
        
    if rag_context:
        prompt += f"[FB Knowledge]\n{rag_context}\n\n"
        
    if chat_history:
        context = "\n".join([
            f"{'Guest' if m.get('role')=='user' else 'AI'}: {m.get('content')}"
            for m in chat_history[-5:]
        ])
        prompt += f"[Chat History]\n{context}\n\n"
        
    if room_inventory:
        import json
        prompt += f"[Stateful Room Inventory (Daily Allowed Limits)]\n"
        prompt += f"This is the actual, current usage data for the room from the backend database. You MUST strictly adhere to this:\n"
        prompt += f"{json.dumps(room_inventory, ensure_ascii=False)}\n\n"
    
    prompt += f"[Current Request]\nGuest: {user_message}"

    # 4. Gemini 호출
    system_instruction_with_lang = FB_SYSTEM_PROMPT.replace("{system_language}", system_language)
    raw = await call_gemini_async(prompt=prompt, system_instruction=system_instruction_with_lang, images=images)

    # 5. Pydantic 검증
    if "request_id" not in raw or raw["request_id"] == "auto":
        raw["request_id"] = "auto"
    if "room_no" not in raw or raw["room_no"] == "unknown":
        raw["room_no"] = room_no
    if "domain" not in raw:
        raw["domain"] = "FB"
        
    # AI가 명시적으로 null을 반환한 경우 키를 제거하여 Pydantic의 기본값이 적용되도록 함
    raw = {k: v for k, v in raw.items() if v is not None}

    result = HotelRequestSchema(**raw)

    # ── CODE-LEVEL GUARDRAIL 0: Prevent Add/Replace infinite loop ──
    # The AI's duplicate-order detection (Rule 13) re-triggers every turn because
    # the active_requests list doesn't change until the order is finalized.
    # This guardrail checks chat history: if Add/Replace was ALREADY asked,
    # any subsequent Add/Replace question is suppressed unconditionally.
    if result.needs_clarification:
        clarification_opts = getattr(result, 'clarification_options', None) or []
        opts_lower = [o.lower() for o in clarification_opts]
        is_add_replace_q = any(o in opts_lower for o in ('add', 'replace'))

        # Also detect by question text (AI sometimes omits formal options)
        q_text = (getattr(result, 'clarification_question', '') or '').lower()
        if not is_add_replace_q and 'add' in q_text and 'replace' in q_text:
            is_add_replace_q = True

        if is_add_replace_q:
            user_lower = user_message.strip().lower()

            # Check if Add/Replace was already asked in a PREVIOUS turn
            previously_asked = False
            if chat_history:
                for msg in chat_history:
                    content = (msg.get('content') or '').lower()
                    role = msg.get('role', '')
                    if role != 'user' and 'add' in content and 'replace' in content:
                        previously_asked = True
                        break

            # Suppress if: (a) user is directly answering "Add"/"Replace", OR
            #               (b) this question was already asked before
            if user_lower in ('add', 'replace') or previously_asked:
                print(f"[FB Guard] ✅ Suppressing Add/Replace loop (prev_asked={previously_asked}, user='{user_lower}')")
                result.clarification_options = []

                if user_lower == 'replace':
                    raw["action_type"] = "REPLACE"
                else:
                    result.target_request_id = None
                    raw.pop("target_request_id", None)
                    raw["action_type"] = "ADD_DUPLICATE"

                # Generate next step instead of re-asking
                menu_items = result.entities.get("menu_items") or []
                missing = getattr(result, 'missing_fields', []) or []

                if not missing and menu_items:
                    items_parts = []
                    for mi in menu_items:
                        name = mi.get("name", "item")
                        qty = mi.get("quantity", 1)
                        opt = mi.get("selected_option")
                        label = f"{name}({opt}) x{qty}" if opt else f"{name} x{qty}"
                        items_parts.append(label)
                    items_str = ", ".join(items_parts)
                    result.clarification_question = f"Your order: {items_str}. Shall I proceed?"
                    result.missing_fields = []
                # else: missing fields remain — guardrail 2 will handle required options

    # ── CODE-LEVEL GUARDRAIL 1: Different-item duplicate order false positive ──
    # If AI incorrectly set target_request_id for a DIFFERENT menu item, invalidate it.
    if result.target_request_id and active_requests:
        new_items = [mi.get("name", "").lower() for mi in (result.entities.get("menu_items") or [])]
        target_id = result.target_request_id
        matched = False
        for ar in active_requests:
            ar_id = ar.get("id") or ar.get("request_id")
            if str(ar_id) == str(target_id):
                # Check if any item in the active request matches the new order
                ar_summary = (ar.get("summary") or "").lower()
                if any(item_name in ar_summary for item_name in new_items if item_name):
                    matched = True
                break
        if not matched:
            print(f"[FB Guard] ⛔ Different item detected — clearing target_request_id (was {target_id})")
            result.target_request_id = None
            raw.pop("target_request_id", None)
            # If AI was asking "Add or Replace?" for the wrong item, reset to process normally
            if result.needs_clarification and result.clarification_options:
                opts_lower = [o.lower() for o in result.clarification_options]
                if "add" in opts_lower or "change" in opts_lower or "replace" in opts_lower:
                    print(f"[FB Guard] ⛔ Resetting false Add/Replace clarification — processing as new order")
                    result.needs_clarification = True
                    result.clarification_options = []
                    # Ask for quantity/options instead
                    menu_items = result.entities.get("menu_items") or []
                    item_name = menu_items[0]["name"] if menu_items else "the item"
                    display_name = f"{item_name}es" if item_name.endswith(('ch', 'sh', 's', 'x')) else (f"{item_name}s" if not item_name.endswith('s') else item_name)
                    result.clarification_question = f"How many {display_name} would you like?"

    # ── CODE-LEVEL GUARDRAIL 2: Required option enforcement ──
    # After AI responds, cross-check with actual menu data to ensure required options are gathered.
    if not result.needs_clarification or (result.needs_clarification and not result.missing_fields):
        menu_items = result.entities.get("menu_items") or []
        _menu_cache = _fetch_menu_context_raw()
        if _menu_cache and menu_items:
            missing_options = []
            for mi in menu_items:
                item_name = mi.get("name", "")
                selected_option = mi.get("selected_option")
                if selected_option:
                    continue  # Option already selected
                # Find this item in the menu and check for required options
                for menu_item in _menu_cache:
                    if menu_item.get("name", "").lower() == item_name.lower():
                        options_data = menu_item.get("options")
                        if options_data:
                            if isinstance(options_data, str):
                                import json as _json
                                try:
                                    options_list = _json.loads(options_data)
                                except:
                                    options_list = []
                            else:
                                options_list = options_data
                            for opt in (options_list if isinstance(options_list, list) else []):
                                if opt.get("isRequired", False):
                                    group_name = opt.get("groupName", "Option")
                                    items = opt.get("items", [])
                                    missing_options.append((item_name, group_name, items))
                        break
            if missing_options:
                # Force clarification — override AI's premature finalization
                questions = []
                for item_name, group_name, items in missing_options:
                    options_str = " or ".join(items)
                    questions.append(f"For the {item_name}, which {group_name} would you like? ({options_str})")
                print(f"[FB Guard] ⛔ Required option missing — forcing clarification: {missing_options}")
                result.needs_clarification = True
                result.clarification_question = " ".join(questions)
                result.missing_fields = ["selected_option"]
                # Prevent domain_code from being set (no ticket creation yet)
                raw["needs_clarification"] = True

    # 6. BILLING_INQUIRY → 백엔드 API 호출로 실시간 데이터 기반 응답 생성
    if result.entities.get("intent") == "BILLING_INQUIRY":
        guest_reply = await asyncio.to_thread(_handle_billing_inquiry, room_no, user_message, system_language)
        return {
            "guest_reply": guest_reply,
            "summary": "식음료 이용 금액 조회",
            "domain_code": None,  # 정보 조회일 뿐, request 생성 불필요
            "priority": "NORMAL",
            "entities": {"intent": "BILLING_INQUIRY"},
            "confidence": result.confidence,
        }

    # 7. 자연스러운 응답 생성
    if result.needs_clarification:
        guest_reply = result.clarification_question
    else:
        fallback_msg = {
            "ko": "식음료 주문이 접수되었습니다.",
            "en": "Your food and beverage order has been received.",
            "ja": "飲食の注文が受付されました。",
            "zh": "餐饮订单已收到。"
        }
        guest_reply = result.final_reply or fallback_msg.get(system_language, fallback_msg["en"])

    # 8. analyze.py 응답 포맷 반환
    # [수정] 주문 확인 단계(needs_clarification=True, missing_fields가 비어있고, intent가 주문/변경 관련인 경우)
    # 에는 domain_code="FB"를 전달하여 DB에 수락 대기 상태의 요청 카드가 생성되게 하고,
    # 네/아니오 칩(clarification_options)을 비워 화면 하단에 퀵 리플레이 버튼이 나타나지 않도록 제어합니다.
    is_confirm_stage = (
        result.needs_clarification
        and not getattr(result, "missing_fields", [])
        and result.entities.get("intent") in ["ROOM_SERVICE", "ORDER_MODIFY"]
    )

    clarification_options = getattr(result, "clarification_options", [])
    if is_confirm_stage:
        domain_code = "FB"
        clarification_options = []
    else:
        domain_code = None if result.needs_clarification else "FB"

    action_type = result.entities.get("action_type") or raw.get("action_type") or "ADD"
    target_keyword = result.entities.get("target_keyword") or raw.get("target_keyword")
    target_request_id = result.target_request_id or result.entities.get("target_request_id") or raw.get("target_request_id")

    action_type = raw.get("action_type")
    if action_type is None:
        action_type = result.entities.get("action_type")
    if action_type is None:
        action_type = "ADD"

    return {
        "guest_reply": guest_reply,
        "summary": result.summary,
        "domain_code": domain_code,
        "priority": result.priority,
        "entities": result.entities,
        "confidence": result.confidence,
        "missing_fields": getattr(result, "missing_fields", []),
        "clarification_options": clarification_options,
        "reasoning": result.reasoning,
        "action_type": action_type,
        "target_keyword": target_keyword,
        "target_request_id": target_request_id,
    }


def _handle_billing_inquiry(room_no: str, user_message: str, system_language: str = "en") -> str:
    """백엔드 영수증 요약 API를 호출하여 이용 금액 안내 메시지를 생성"""
    try:
        base_url = os.getenv("BACKEND_URL", "http://localhost:8080")
        with httpx.Client(timeout=3.0) as client:
            resp = client.get(f"{base_url}/fb/receipts/room/{room_no}/summary")

        if resp.status_code == 200:
            data = resp.json()
            items = data.get("items", [])
            total = data.get("totalAmount", 0)

            if not items:
                return "현재까지 식음료 이용 내역이 없습니다."

            # 항목별 내역 구성
            lines = []
            for item in items:
                name = item.get("menuName", "")
                qty = item.get("quantity", 0)
                price = item.get("totalPrice", 0)
                lines.append(f"- {name} {qty}개: ${price:.2f}")

            detail = "\n".join(lines)

            # 고객 언어 감지 (간단한 휴리스틱)
            is_english = any(c.isascii() and c.isalpha() for c in user_message) and not any('\uac00' <= c <= '\ud7a3' for c in user_message)

            if is_english:
                return f"Here is your room service usage so far:\n{detail}\n\nTotal: ${total:.2f}"
            else:
                return f"현재까지 식음료 이용 내역입니다:\n{detail}\n\n총 금액: ${total:.2f}"
        else:
            print(f"[FB Agent] 영수증 조회 API 실패: HTTP {resp.status_code}")
            return "이용 내역 조회 중 오류가 발생했습니다. 프론트데스크로 문의 부탁드립니다."
    except Exception as e:
        print(f"[FB Agent] 영수증 조회 API 호출 중 오류 발생: {e}")
        return "이용 내역 조회 중 오류가 발생했습니다. 프론트데스크로 문의 부탁드립니다."
