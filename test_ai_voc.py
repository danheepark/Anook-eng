import urllib.request, json

req_data = {
    "text": "조식당 커피가 조금 썼어요",
    "room_no": "101",
    "language": "ko",
    "chat_history": []
}

req = urllib.request.Request('http://localhost:8000/analyze', data=json.dumps(req_data).encode('utf-8'), headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode())
except Exception as e:
    print("Error:", e)
    if hasattr(e, 'read'):
        print(e.read().decode())
