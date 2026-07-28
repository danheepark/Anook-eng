import os

prompts = [
    "/Users/dana/Desktop/team3-Anook/ai/app/prompts/fb_prompt.py",
    "/Users/dana/Desktop/team3-Anook/ai/app/prompts/hk_prompt.py",
    "/Users/dana/Desktop/team3-Anook/ai/app/prompts/router_prompt.py"
]

replacements = {
    # Menu names
    "'한우 불고기 덮밥'": "'Beef Bulgogi Rice Bowl'",
    "'제로콜라'": "'Coke'", # Zero is in option
    "'클래식 치즈버거'": "'Classic Cheeseburger'",
    "'스테이크 샌드위치'": "'Steak Sandwich'",
    "'아메리카노'": "'Americano'",
    "'아이스 아메리카노'": "'Americano'",
    "'바닐라 아이스크림'": "'Vanilla Ice Cream'",
    "'감자튀김'": "'French Fries'",
    "'뉴욕 치즈케이크'": "'New York Cheesecake'",
    "'미니바 와인'": "'Minibar Wine'",
    "'수건'": "'Extra Towel'",
    "'생수'": "'Extra Bottled Water'",
    "'물'": "'Extra Bottled Water'",
    
    # Prompt text replacements for FB
    '\"[메뉴명]([옵션]) [수량]개 주문\"': '\"Order: [Item]([Option]) x[Qty]\"',
    '\"[메뉴명] [수량]개 주문\"': '\"Order: [Item] x[Qty]\"',
    '\"[첫 번째 메뉴명]([옵션]) [첫 번째 메뉴 수량]개 외 [n]건 주문\"': '\"Order: [First Item] x[Qty] and [N] others\"',
    '\"뉴욕 치즈케이크 2개 외 1건 주문\"': '\"Order: New York Cheesecake x2 and 1 others\"',
    '\"바닐라 아이스크림 1개, 감자튀김 1개 주문\"': '\"Order: Vanilla Ice Cream x1 and 1 others\"',
    
    # Prompt text replacements for HK
    '\"수건 2장 요청\"': '\"Request: Extra Towel x2\"',
    '\"청소 요청\"': '\"Request: Room Cleaning\"',
    '\"수건 2장 및 14시 청소 (비대면)\"': '\"Request: Extra Towel x2 & Cleaning at 14:00 (Contactless)\"',
    '\"기존 요청에서 수건 취소 및 생수 2병 유지 요청\"': '\"Cancel Extra Towel, keep Extra Bottled Water x2\"',
    '\"수건 2개, 생수 1병 요청\"': '\"Request: Extra Towel x2, Extra Bottled Water x1\"',
}

for prompt_file in prompts:
    if os.path.exists(prompt_file):
        with open(prompt_file, "r", encoding="utf-8") as f:
            content = f.read()
        for k, v in replacements.items():
            content = content.replace(k, v)
        with open(prompt_file, "w", encoding="utf-8") as f:
            f.write(content)

print("done prompts")
