import getpass
import json
import urllib.error
import urllib.parse
import urllib.request

people = {}
created_assignments = []
created_results = []
checks = 0

def require(condition, message):
    global checks
    if not condition:
        raise RuntimeError(message)
    checks += 1

def http(method, url, headers=None, body=None):
    headers = dict(headers or {})
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            status, raw = response.status, response.read()
    except urllib.error.HTTPError as error:
        status, raw = error.code, error.read()
    except urllib.error.URLError:
        raise RuntimeError("Could not reach " + urllib.parse.urlsplit(url).netloc) from None
    try:
        payload = json.loads(raw) if raw else None
    except ValueError:
        payload = None
    return status, payload

def api(actor, method, path, expected=200, body=None):
    headers = {}
    if actor is not None:
        headers["Authorization"] = "Bearer " + people[actor]["token"]
    status, payload = http(method, backend + path, headers, body)
    require(status == expected,
            str(actor) + " " + method + " " + path +
            ": expected HTTP " + str(expected) + ", got " + str(status))
    return payload

def login(label, role):
    print("\nSign in as " + label + " (required role: " + role + ")")
    email = input("Email: ").strip()
    password = getpass.getpass("Password: ")
    status, session = http(
        "POST", project + "/auth/v1/token?grant_type=password",
        {"apikey": publishable},
        {"email": email, "password": password}
    )
    require(status == 200 and isinstance(session, dict) and "access_token" in session,
            label + ": Supabase sign-in failed with HTTP " + str(status))
    people[label] = {"token": session["access_token"]}
    profile = api(label, "GET", "/api/auth/me")
    require(isinstance(profile, dict) and isinstance(profile.get("id"), str),
            label + ": invalid profile response")

    if profile.get("role") != role:
        print("In Supabase Table Editor, open profiles.")
        print("Set role to " + role + " for profile ID " + profile["id"] + ".")
        print("Auth UUID: " + session["user"]["id"])
        input("After saving that TEST account role, press Enter: ")
        profile = api(label, "GET", "/api/auth/me")

    require(profile.get("role") == role, label + ": profile role is still incorrect")
    people[label]["id"] = profile["id"]

def new_assignment(actor, student, pretend_owner):
    row = api(actor, "POST", "/api/assignments", 201, {
        "scenarioId": scenario,
        "studentId": people[student]["id"],
        "assignedBy": people[pretend_owner]["id"]
    })
    require(isinstance(row, dict) and type(row.get("id")) is int,
            "Assignment creation returned an invalid ID")
    created_assignments.append(row["id"])
    require(row.get("assignedBy") == people[actor]["id"],
            "Assignment owner was accepted from the request body")
    require(row.get("studentId") == people[student]["id"],
            "Assignment has the wrong student")
    return row["id"]

def assignment_path(assignment_id):
    return "/api/assignments/" + str(assignment_id)

def result_path(result_id):
    return "/api/results/" + str(result_id)

def check_list(actor, allowed, field=None, query=None):
    params = {"scenarioId": scenario}
    params.update(query or {})
    rows = api(actor, "GET", "/api/assignments?" + urllib.parse.urlencode(params))
    require(isinstance(rows, list), "Assignment listing did not return an array")
    ids = {row["id"] for row in rows}
    require(ids.intersection(set(created_assignments)) == set(allowed),
            actor + ": incorrect visibility of test assignments")
    if field is not None:
        require(all(row.get(field) == people[actor]["id"] for row in rows),
                actor + ": listing exposed another owner or student")

def new_result(actor, assignment_id):
    row = api(actor, "POST", assignment_path(assignment_id) + "/results", 201, {
        "transcript": [
            {"role": "student", "text": "BE-02 fictional test question."},
            {"role": "patient", "text": "BE-02 fictional test answer."}
        ],
        "studentId": people["student2"]["id"],
        "assignmentId": 0
    })
    require(isinstance(row, dict) and type(row.get("id")) is int,
            "Result creation returned an invalid ID")
    created_results.append(row["id"])
    require(row.get("studentId") == people["student1"]["id"] and
            row.get("assignmentId") == assignment_id,
            "Result identity was accepted from the request body")
    return row["id"]

def snapshot(assignment_id, result_id):
    return [
        api("admin", "GET", assignment_path(assignment_id)),
        api("admin", "GET", assignment_path(assignment_id) + "/results"),
        api("admin", "GET", result_path(result_id))
    ]

def deny_assignment_and_result(actor, assignment_id, result_id):
    before = snapshot(assignment_id, result_id)
    path = assignment_path(assignment_id)

    api(actor, "GET", path, 403)
    api(actor, "GET", path + "/results", 403)
    api(actor, "GET", result_path(result_id), 403)
    api(actor, "PUT", path, 403, {"status": "in_progress"})
    api(actor, "POST", path + "/results", 403, {
        "transcript": [{"role": "student", "text": "Must not be saved."}]
    })
    api(actor, "PUT", result_path(result_id) + "/review", 403, {
        "educatorScore": 1,
        "educatorFeedback": "Must not be saved."
    })
    api(actor, "DELETE", path, 403)

    require(snapshot(assignment_id, result_id) == before,
            actor + ": a denied request changed stored records")

def review(actor, result_id, assignment_id):
    row = api(actor, "PUT", result_path(result_id) + "/review", 200, {
        "educatorScore": 90,
        "educatorFeedback": "BE-02 fictional review.",
        "reviewedBy": people["student2"]["id"]
    })
    saved = api("admin", "GET", result_path(result_id))
    require(row.get("reviewedBy") == people[actor]["id"] and
            saved.get("reviewedBy") == people[actor]["id"] and
            saved.get("educatorScore") == 90,
            "Review did not save the verified reviewer and score")
    assignment = api("admin", "GET", assignment_path(assignment_id))
    require(assignment.get("status") == "reviewed", "Review status was not saved")

def delete_empty(actor, assignment_id):
    api(actor, "DELETE", assignment_path(assignment_id), 204)
    api("admin", "GET", assignment_path(assignment_id), 404)

def run_tests():
    global scenario
    for label, role in [
        ("educatorA", "educator"), ("educatorB", "educator"),
        ("student1", "student"), ("student2", "student"), ("admin", "admin")
    ]:
        login(label, role)
    require(len({person["id"] for person in people.values()}) == 5,
            "Use five different test accounts")

    scenario = int(input("\nExisting test scenario ID: "))
    require(scenario > 0, "Scenario ID must be positive")
    print("\nCreating fictional test assignments...")

    a = new_assignment("educatorA", "student1", "educatorB")
    b = new_assignment("educatorB", "student1", "educatorA")
    other = new_assignment("educatorA", "student2", "educatorB")
    disposable = new_assignment("educatorB", "student1", "educatorA")
    admin_created = new_assignment("admin", "student1", "educatorA")

    api(None, "GET", "/api/assignments", 401)
    check_list("educatorA", [a, other], "assignedBy")
    check_list("educatorB", [b, disposable], "assignedBy")
    check_list("student1", [a, b, disposable, admin_created], "studentId")
    check_list("student2", [other], "studentId")
    check_list("admin", created_assignments)

    check_list("educatorA", [a, other], "assignedBy",
               {"assignedBy": people["educatorB"]["id"]})
    check_list("educatorA", [a], "assignedBy",
               {"studentId": people["student1"]["id"]})
    check_list("student1", [a, b, disposable, admin_created], "studentId",
               {"studentId": people["student2"]["id"]})
    print("PASS: list ownership and forged filters")

    api("student1", "POST", "/api/assignments", 403, {
        "scenarioId": scenario, "studentId": people["student1"]["id"]
    })
    api("student1", "PUT", assignment_path(a), 200, {"status": "in_progress"})
    api("educatorA", "PUT", assignment_path(other), 200, {"status": "in_progress"})
    api("admin", "PUT", assignment_path(b), 200, {"status": "in_progress"})
    api("student2", "GET", assignment_path(other))
    api("student2", "GET", assignment_path(a), 403)
    api("student1", "GET", assignment_path(other), 403)

    ra = new_result("student1", a)
    rb = new_result("educatorB", b)

    for actor, assignment_id, result_id in [
        ("educatorA", a, ra), ("educatorB", b, rb),
        ("student1", a, ra), ("student1", b, rb),
        ("admin", a, ra), ("admin", b, rb)
    ]:
        api(actor, "GET", assignment_path(assignment_id))
        rows = api(actor, "GET", assignment_path(assignment_id) + "/results")
        require(any(row["id"] == result_id for row in rows), "Expected result missing")
        api(actor, "GET", result_path(result_id))
    print("PASS: authorized assignment and result access")

    review("educatorA", ra, a)
    review("admin", rb, b)

    deny_assignment_and_result("educatorA", b, rb)
    deny_assignment_and_result("educatorB", a, ra)
    deny_assignment_and_result("student2", a, ra)
    api(None, "GET", result_path(ra), 401)
    print("PASS: cross-educator and cross-student access blocked without changes")

    before = snapshot(a, ra)
    api("student1", "PUT", result_path(ra) + "/review", 403, {
        "educatorScore": 100, "educatorFeedback": "Must not be saved."
    })
    api("student1", "PUT", assignment_path(a), 403, {"status": "completed"})
    api("student1", "DELETE", assignment_path(a), 403)
    require(snapshot(a, ra) == before, "Denied student requests changed records")

    empty_before = api("admin", "GET", assignment_path(other))
    api("educatorB", "DELETE", assignment_path(other), 403)
    api("student2", "DELETE", assignment_path(other), 403)
    require(api("admin", "GET", assignment_path(other)) == empty_before,
            "Unauthorized deletion changed the empty assignment")

    delete_empty("educatorA", other)
    delete_empty("admin", disposable)
    delete_empty("admin", admin_created)
    print("PASS: owner deletion, administrator override, and student restrictions")
    print("\nPASS: BE-02 checks completed (" + str(checks) + " assertions).")

def show_cleanup():
    if not created_assignments and not created_results:
        return
    print("\nTest record IDs:")
    print("Assignments:", created_assignments)
    print("Results:", created_results)
    print("\nOptional cleanup SQL for ONLY these test records:")
    print("begin;")
    for result_id in created_results:
        print("select public.purge_session_result(" + str(result_id) + ");")
    if created_assignments:
        ids = ", ".join(str(value) for value in created_assignments)
        print("delete from public.assignments where id in (" + ids + ");")
    print("commit;")
    print("Test accounts, profiles, and the scenario are retained.")

project = input("Supabase project URL: ").strip().rstrip("/")
if not project.startswith("https://"):
    raise SystemExit("Use the HTTPS project URL.")
publishable = getpass.getpass("Supabase publishable key: ").strip()
backend = "http://localhost:18080"

try:
    run_tests()
except (RuntimeError, ValueError, KeyError, TypeError) as error:
    print("\nFAIL:", error)
    raise SystemExit(1)
finally:
    show_cleanup()
