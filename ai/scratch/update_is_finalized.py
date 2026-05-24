filepath = '/Users/dana/Desktop/team3-Anook/backend/src/main/java/com/anook/backend/message/application/service/SendMessageService.java'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip_dup = False
for line in lines:
    if 'boolean isFinalized = analysis.guestReply() != null &&' in line:
        # Replace this and the next line
        new_lines.append("""                    // [안전 장치] 고객 원문이 짧은 긍정 응답("네", "응" 등)이고 동일 도메인의 CREATED(확인 대기 중) 요청이 있는 경우,
                    // LLM의 [FORWARD_...] 응답 누락 여부와 무관하게 수락 확정으로 처리하여 중복 생성 방어
                    boolean isShortConfirmation = content != null && content.trim().toLowerCase()
                            .matches("^(네|응|어|예|ㅇㅇ|ok|okay|yes|yep|y|확인|진행|진행해|진행해줘|부탁해|알겠어|좋아|맞아|확인했습니다|수락|승인|sure|agree|confirm|はい|ええ|そうだ|お願い|お願いします|確認|是的|对|好|好的|没문제|是|确认|동의)$".replace("문제", "문제"));
                    
                    boolean hasPendingCreatedRequest = activeRequests.stream()
                            .anyMatch(req -> "CREATED".equals(req.get("status")) && domain.equals(req.get("department_id")));

                    boolean isFinalized = (analysis.guestReply() != null &&
                            analysis.guestReply().contains("[FORWARD_" + domain + "]"))
                            || (isShortConfirmation && hasPendingCreatedRequest);\n""")
        continue
    if 'analysis.guestReply().contains("[FORWARD_" + domain + "]");' in line:
        continue
        
    if 'boolean isShortConfirmation = content != null && content.trim().toLowerCase()' in line:
        # Inside the block, we already declared isShortConfirmation at the top, so we will skip redefining it
        new_lines.append("                        // isShortConfirmation is already declared above\n")
        skip_dup = True
        continue
        
    if skip_dup:
        if 'matches(' in line:
            continue
        if '^(네|응|어|예|ㅇㅇ|' in line:
            continue
        if '"^(네|응|어|예|ㅇㅇ|' in line:
            continue
        if '“^(네|응|어|예|ㅇㅇ|' in line:
            continue
        if '최종' in line or '확인' in line or '물품' in line or '수락' in line:
            # We hit another comment, stop skipping
            skip_dup = False
        else:
            # Skip the regex matches string
            continue

    new_lines.append(line)

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print("Updated successfully!")
