import os

file_path = "/Users/dana/Desktop/team3-Anook/backend/src/main/resources/data.sql"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

replacements = {
    "'클래식 치즈버거'": "'Classic Cheeseburger'",
    "'트러플 머쉬룸 리조또'": "'Truffle Mushroom Risotto'",
    "'한우 불고기 덮밥'": "'Beef Bulgogi Rice Bowl'",
    "'시저 샐러드'": "'Caesar Salad'",
    "'해산물 파스타'": "'Seafood Pasta'",
    "'스테이크 샌드위치'": "'Steak Sandwich'",
    "'감자튀김'": "'French Fries'",
    "'시즌 과일 플레이트'": "'Seasonal Fruit Plate'",
    "'모짜렐라 스틱'": "'Mozzarella Sticks'",
    "'콜라'": "'Coke'",
    "'오렌지 주스'": "'Orange Juice'",
    "'아메리카노'": "'Americano'",
    "'캐모마일 티'": "'Chamomile Tea'",
    "'뉴욕 치즈케이크'": "'New York Cheesecake'",
    "'초콜릿 브라우니'": "'Chocolate Brownie'",
    "'바닐라 아이스크림'": "'Vanilla Ice Cream'",
    "'추가 수건'": "'Extra Towel'",
    "'생수 추가'": "'Extra Bottled Water'",
    "'어메니티 팩'": "'Amenity Pack'",
    "'엑스트라 베드'": "'Extra Bed'",
    "'긴급 세탁'": "'Express Laundry'",
    "'일반 세탁'": "'Standard Laundry'",
    "'미니바 맥주'": "'Minibar Beer'",
    "'미니바 와인'": "'Minibar Wine'",
    "'미니바 스낵'": "'Minibar Snack'",
    
    # Options
    "'[{\"groupName\": \"드레싱\", \"isRequired\": true, \"items\": [\"시저\", \"발사믹\", \"없음\"]}]'": "'[{\"groupName\": \"Dressing\", \"isRequired\": true, \"items\": [\"Caesar\", \"Balsamic\", \"None\"]}]'",
    "'[{\"groupName\": \"굽기\", \"isRequired\": true, \"items\": [\"레어\", \"미디엄\", \"웰던\"]}]'": "'[{\"groupName\": \"Doneness\", \"isRequired\": true, \"items\": [\"Rare\", \"Medium\", \"Well-done\"]}]'",
    "'[{\"groupName\": \"종류\", \"isRequired\": true, \"items\": [\"일반\", \"제로\"]}]'": "'[{\"groupName\": \"Type\", \"isRequired\": true, \"items\": [\"Regular\", \"Zero\"]}]'",
    "'[{\"groupName\": \"온도\", \"isRequired\": true, \"items\": [\"HOT\", \"ICE\"]}]'": "'[{\"groupName\": \"Temperature\", \"isRequired\": true, \"items\": [\"HOT\", \"ICE\"]}]'"
}

for k, v in replacements.items():
    content = content.replace(k, v)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("done")
