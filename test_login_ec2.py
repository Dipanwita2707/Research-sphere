import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def test_login(url, username, password):
    payload = json.dumps({"username": username, "password": password}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
            data = resp.read().decode("utf-8")
            print(f"[{resp.status}] SUCCESS for {username}: {data[:120]}...")
            return True
    except urllib.error.HTTPError as e:
        data = e.read().decode("utf-8")
        print(f"[{e.code}] FAILED for {username}: {data[:120]}")
        return False
    except Exception as e:
        print(f"ERROR for {username}: {e}")
        return False

print("--- Testing via local frontend port 3000 ---")
test_login("http://127.0.0.1:3000/api/v1/auth/login", "admin", "admin123")
test_login("http://127.0.0.1:3000/api/v1/auth/login", "SUPER001", "Test@123")
test_login("http://127.0.0.1:3000/api/v1/auth/login", "FAC001", "Test@123")

print("\n--- Testing via public domain (if accessible locally) ---")
test_login("https://researchsphere.tech/api/v1/auth/login", "admin", "admin123")
