filepath = '/Users/dana/Desktop/team3-Anook/backend/src/main/java/com/anook/backend/message/application/service/SendMessageService.java'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if '// isShortConfirmation is already declared above' in line:
        new_lines.append("                        // isShortConfirmation is already declared above\n")
        new_lines.append("                        if (pendingRequest != null) {\n")
        continue
    new_lines.append(line)

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print("Brace fixed successfully!")
