with open('/Users/dana/Desktop/team3-Anook/backend/src/main/java/com/anook/backend/message/application/service/SendMessageService.java', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace both occurrences of the coreKeywords end line
target = '"슬리퍼", "slipper", "スリッパ", "拖鞋");'
replacement = '"슬리퍼", "slipper", "スリッパ", "拖鞋", "꽃", "flower", "꽃배달", "장미", "rose", "장미꽃");'

if target in content:
    content = content.replace(target, replacement)
    with open('/Users/dana/Desktop/team3-Anook/backend/src/main/java/com/anook/backend/message/application/service/SendMessageService.java', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success!")
else:
    print("Target not found!")
