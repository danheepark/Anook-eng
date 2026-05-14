import urllib.request, json
try:
    print("Trying without token...")
    req = urllib.request.Request('http://localhost:8080/admin/messages/vocs', headers={'Content-Type': 'application/json'})
    res = urllib.request.urlopen(req)
    print(res.read().decode())
except Exception as e:
    print("Error:", e)

