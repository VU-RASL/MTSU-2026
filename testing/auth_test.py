import getpass
import json
import threading
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

project = input("Supabase project URL: ").strip().rstrip("/")
if not project.startswith("https://"):
    raise SystemExit("Use the HTTPS project URL.")

publishable_key = getpass.getpass("Supabase publishable key: ").strip()
email = input("Fresh test account email: ").strip()
password = getpass.getpass("Test account password: ")

login_request = urllib.request.Request(
    project + "/auth/v1/token?grant_type=password",
    data=json.dumps({
        "email": email,
        "password": password
    }).encode(),
    headers={
        "apikey": publishable_key,
        "Content-Type": "application/json"
    }
)

try:
    with urllib.request.urlopen(login_request, timeout=30) as response:
        session = json.loads(response.read())
except urllib.error.HTTPError as error:
    raise SystemExit(
        "Supabase sign-in failed: HTTP " + str(error.code) +
        ". Check the account credentials and confirmation."
    )
except urllib.error.URLError:
    raise SystemExit("Could not reach Supabase.")

token = session["access_token"]
auth_id = session["user"]["id"]

print("Authentication UUID:", auth_id)
input("Confirm this UUID has NO profiles row, then press Enter.")

workers = 8
barrier = threading.Barrier(workers)

def first_login(number):
    req = urllib.request.Request(
        "http://localhost:18080/api/auth/me",
        headers={"Authorization": "Bearer " + token}
    )

    try:
        barrier.wait(timeout=20)
        with urllib.request.urlopen(req, timeout=60) as response:
            return number, response.status, json.loads(response.read())
    except urllib.error.HTTPError as error:
        return number, error.code, None
    except Exception as error:
        return number, type(error).__name__, None

with ThreadPoolExecutor(max_workers=workers) as pool:
    results = list(pool.map(first_login, range(1, workers + 1)))

profile_ids = set()
passed = True

for number, status, profile in results:
    print("Request", number, "returned", status)

    if status != 200 or not isinstance(profile, dict):
        passed = False
        continue

    profile_id = profile.get("id")
    if not isinstance(profile_id, str) or not profile_id:
        passed = False
        continue

    profile_ids.add(profile_id)

    if profile.get("role") != "student":
        passed = False

if not passed or len(profile_ids) != 1:
    raise SystemExit(
        "FAIL: all requests must return HTTP 200 and the same student profile."
    )

print("PASS: all eight requests returned the same student profile.")
print("Application profile ID:", next(iter(profile_ids)))
print("Now confirm Supabase contains exactly one profile for the UUID above.")
