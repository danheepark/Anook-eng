import re

with open('/Users/dana/Desktop/team3-Anook/ai/app/api/analyze.py', 'r') as f:
    content = f.read()

# 1. Update fallback round logic (Lines 225-244ish)
fallback_old = """            should_escalate = False
            if current_missing and clarification_rounds > 3:
                # Case 1: 에이전트가 missing_fields를 명시했고 3번 물어봤는데도(4라운드째) 미해소
                print(f"\\n[Analyze] 🚨 missing_fields {current_missing} 미해소 {clarification_rounds}라운드 → FRONT 강제 이관")
                should_escalate = True
            elif not current_missing and clarification_rounds > 3:
                # Case 2: 라우터-CLARIFICATION이 3번 물어봤는데도(4라운드째) 반복
                print(f"\\n[Analyze] 🚨 라우터-CLARIFICATION {clarification_rounds}라운드 반복 → FRONT 강제 이관")
                should_escalate = True

            if should_escalate:
                response = {
                    "guest_reply": _get_static_reply("FALLBACK_FAILURE", request.language),
                    "summary": "요청 처리 실패 (접수 불가)",
                    "domain_code": None,
                    "priority": "NORMAL",
                    "entities": {},
                    "confidence": 0.0,
                }"""

fallback_new = """            should_escalate = False
            if current_missing and clarification_rounds > 3:
                print(f"\\n[Analyze] 🚨 missing_fields {current_missing} 미해소 {clarification_rounds}라운드 → SOFT_FALLBACK 강제 전환")
                should_escalate = True
            elif not current_missing and clarification_rounds > 3:
                print(f"\\n[Analyze] 🚨 라우터-CLARIFICATION {clarification_rounds}라운드 반복 → SOFT_FALLBACK 강제 전환")
                should_escalate = True

            if should_escalate:
                response["guest_reply"] = _get_static_reply("FALLBACK_FAILURE", request.language)
                response["summary"] = "요청 처리 실패 (접수 불가)"
                response["domain_code"] = None
                response["priority"] = "NORMAL"
                response["entities"] = {}
                response["confidence"] = 0.0
                response["missing_fields"] = []
                response["clarification_options"] = []"""

content = content.replace(fallback_old, fallback_new)

# 2. Update task_domains (Line 317ish)
content = content.replace('task_domains = [r.domain for r in router_results if r.mode == "TASK" and r.domain]',
                          'task_domains = [r.domain for r in router_results if r.route_type in ("DEPARTMENT", "FRONT_ESCALATION", "INFO", "CANCEL") and r.domain]')

# 3. Update primary.mode == "TASK" to primary.route_type == "DEPARTMENT" (Line 335ish)
content = content.replace('if primary.mode == "TASK" and primary.domain:',
                          'if primary.route_type == "DEPARTMENT" and primary.domain:')
content = content.replace('print(f"\\n[Analyze] 🔀 라우터 결과: {[{\'mode\': r.mode, \'domain\': r.domain, \'confidence\': r.confidence} for r in router_results]}")',
                          'print(f"\\n[Analyze] 🔀 라우터 결과: {[{\'route_type\': r.route_type, \'domain\': r.domain, \'confidence\': r.confidence} for r in router_results]}")')
content = content.replace('print(f"[Analyze] 📌 TASK → domain: {domain} (에이전트 미등록, 기본 응답)")',
                          'print(f"[Analyze] 📌 DEPARTMENT → domain: {domain} (에이전트 미등록, 기본 응답)")')

# 4. Replace CHITCHAT and CLARIFICATION blocks with new route_types
# We'll use regex to replace from STEP 3-b up to STEP 3-d
pattern = re.compile(r'# STEP 3-b: CHITCHAT.*?# STEP 3-d: INFO', re.DOTALL)

replacement = """# STEP 3-b: SOFT_FALLBACK / NON_ACTIONABLE → 티켓 생성 없이 답변만
        if primary.route_type in ("SOFT_FALLBACK", "NON_ACTIONABLE"):
            guest_reply = primary.reply or _get_static_reply("FALLBACK_FAILURE", request.language)
            response = {
                "guest_reply": guest_reply,
                "summary": "안내 및 거절",
                "domain_code": None,
                "priority": "NORMAL",
                "entities": {},
                "confidence": primary.confidence,
            }
            print(f"[Analyze] 💬 {primary.route_type} 응답")
            print(f"[Analyze] 응답: {response}\\n")
            final_responses.append(response)
            continue

        # STEP 3-c: CLARIFICATION → 라우터가 던지는 되묻기
        if primary.route_type == "CLARIFICATION":
            response = {
                "guest_reply": primary.clarification_question or _get_static_reply("CLARIFICATION", request.language),
                "summary": "추가 확인 필요",
                "domain_code": None,
                "priority": "NORMAL",
                "entities": {},
                "confidence": primary.confidence,
                "missing_fields": [],
                "clarification_options": []
            }
            print(f"[Analyze] ❓ CLARIFICATION (라우터 레벨 되묻기)")
            print(f"[Analyze] 응답: {response}\\n")
            final_responses.append(response)
            continue

        # STEP 3-cc: FRONT_ESCALATION → 프론트로 긴급 전달
        if primary.route_type == "FRONT_ESCALATION":
            domain_code = primary.domain or "FRONT"
            response = {
                "guest_reply": _get_static_reply("COMPLAINT", request.language) if primary.priority == "HIGH" else _get_static_reply("ESCALATION", request.language),
                "summary": primary.summary or f"{domain_code} 관련 불편 사항",
                "domain_code": domain_code,
                "priority": "URGENT" if primary.priority == "HIGH" else "NORMAL",
                "entities": {"intent": "ESCALATION"},
                "confidence": primary.confidence,
            }
            if hasattr(primary, 'action_type'):
                response["action_type"] = primary.action_type
                
            print(f"[Analyze] 🚨 FRONT_ESCALATION 응답")
            print(f"[Analyze] 응답: {response}\\n")
            final_responses.append(response)
            continue

        # STEP 3-d: INFO"""

content = pattern.sub(replacement, content)

# 5. Update INFO
content = content.replace('if primary.mode == "INFO":', 'if primary.route_type == "INFO":')

# 6. Update CANCEL
content = content.replace('if primary.mode == "CANCEL":', 'if primary.route_type == "CANCEL":')

# 7. Update COMPLAINT removal (COMPLAINT mode is gone, handled by FRONT_ESCALATION)
pattern2 = re.compile(r'# STEP 3-f: COMPLAINT.*?continue', re.DOTALL)
content = pattern2.sub('', content)

# 8. Update STATUS_CHECK
content = content.replace('if primary.mode == "STATUS_CHECK":', 'if primary.route_type == "STATUS_CHECK":')

with open('/Users/dana/Desktop/team3-Anook/ai/app/api/analyze.py', 'w') as f:
    f.write(content)

print("Done")
