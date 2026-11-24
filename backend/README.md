# VERA backend API (C++ / Crow)

The server behind the app: logins and roles, personas, scenarios, learning
topics, classes and modules, assignments, voice calls with the AI patient, and
saved conversation trees.

- **Framework:** [Crow](https://crowcpp.org) 1.3.5 (included in `crow/`)
- **Port:** 18080 by default
- **Storage:** Supabase (Postgres) for everything. Set up with [docs/database-setup.md](../docs/database-setup.md)
- **Logins:** Supabase Auth. Every route except `/api/health` and `/api/scenarios/schema` needs `Authorization: Bearer <token>`
- **Voice:** OpenAI Realtime API. The server creates each call with its own key, so the key never reaches the browser

> **Most people should run it with Docker** (`docker compose up --build` from the
> repo root; see the [README](../README.md)). The steps below are for running the
> backend directly on your computer.

---

## 1. Install the prerequisites

You need a C++17 compiler, CMake 3.15 or newer, **asio**, and **libcurl**
(with WebSocket support, curl 8.11 or newer, for voice). Crow is already in the
repo, so you don't need to download it.

**macOS**

```bash
xcode-select --install       # compiler (skip if already installed)
brew install cmake asio curl
```

**Linux (Ubuntu/Debian)**

```bash
sudo apt install g++ cmake libasio-dev libcurl4-openssl-dev
```

Debian 12 / older Ubuntu ship a curl without WebSocket support. Voice calls will
fail there; everything else works. (The Docker image uses Debian 13 for this reason.)

**Windows:** the easiest path is WSL (Ubuntu). Then follow the Linux steps.

---

## 2. Build

From the `backend/` folder:

```bash
cmake -S . -B build-server
cmake --build build-server
```

You know it worked when the last line says `[100%] Built target server`.

---

## 3. Run

The server reads its settings from environment variables (the same names as the
root `.env`). Load them, then start it:

```bash
set -a; source ../.env; set +a      # loads SUPABASE_* and OPENAI_* into this terminal
./build-server/server
```

Leave that terminal open. The server only runs while it's open. Press **Ctrl+C** to stop it.

To use a different port:

```bash
PORT=9000 ./build-server/server
```

---

## 4. Check that it works

In a **second terminal**:

```bash
curl http://localhost:18080/api/health
# {"status":"ok"}

curl -i http://localhost:18080/api/personas
# 401 {"error":"Login required"}: auth is on. Use the app to test real routes.
```

---

## API

All routes send and receive JSON and (except `/api/health` and
`/api/scenarios/schema`) need a logged-in
user: `Authorization: Bearer <Supabase access token>`. The frontend adds this for
you (`frontend/src/api/http.ts`).

**Who** = minimum role. *Educator* routes also allow admins. Educators only see
and change their own classes, modules and assignments; admins see all.

| Method | Route | Who | What it does |
|---|---|---|---|
| GET | `/api/health` | anyone | Is the server up? |
| GET | `/api/auth/me` | any user | Your profile id and role |
| **Personas** | | | |
| GET | `/api/personas` | educator | List personas (`?search=text`) |
| GET | `/api/personas/schema` | educator | Persona form fields |
| GET / PUT / DELETE | `/api/personas/:id` | educator | Get / update (only fields sent) / delete one |
| POST | `/api/personas` | educator | Create (`title` required) |
| **Scenarios** | | | |
| GET | `/api/scenarios` | any user | List (`?search=text`). Students get a trimmed view |
| GET | `/api/scenarios/schema` | anyone | Scenario form fields |
| GET | `/api/scenarios/:id` | any user | Get one |
| POST / PUT / DELETE | `/api/scenarios`, `/api/scenarios/:id` | educator | Create / update / delete |
| **Learning topics** | | | |
| GET | `/api/learning-topics`, `/api/learning-topics/:id` | any user | List / get |
| POST / PUT / DELETE | `/api/learning-topics`, `/api/learning-topics/:id` | educator | Create / update / delete |
| **Classes and modules** ([docs](../docs/educator-portal.md)) | | | |
| GET | `/api/students` | educator | Real student accounts (`id`, `email`, `name`) |
| GET / POST | `/api/modules` | educator | List / create (`name`, `scenarioId`, `personaId`) |
| DELETE | `/api/modules/:id` | educator | Remove from all classes (keeps started work), then hide |
| GET / POST | `/api/classes` | educator | List / create (`courseCode`, `section`, `studentIds`) |
| DELETE | `/api/classes/:id` | educator | Delete class (keeps started work) |
| POST | `/api/classes/:id/students` | educator | Add a student; they get the class's modules |
| DELETE | `/api/classes/:id/students/:studentId` | educator | Remove a student (keeps started work) |
| POST | `/api/classes/:id/modules` | educator | Assign a module: one assignment per student |
| DELETE | `/api/classes/:id/modules/:moduleId` | educator | Unassign (keeps started work) |
| **Assignments** | | | |
| GET | `/api/assignments` | any user | Students: their own. Educators: ones they assigned |
| POST | `/api/assignments` | educator | Assign one scenario + persona to one student |
| GET / PUT / DELETE | `/api/assignments/:id` | owner | Get / change status / delete |
| GET | `/api/assignments/:id/context` | owner | Scenario + persona for the voice page |
| GET | `/api/assignments/:id/instructions` | educator | Preview the AI patient's instructions |
| GET / POST | `/api/assignments/:id/results` | owner | Legacy session results |
| GET / PUT | `/api/results/:id`, `/api/results/:id/review` | owner / educator | Legacy result + review |
| **Voice** ([how it works](#voice-calls)) | | | |
| POST | `/api/realtime/session` | student | Start a call: `{assignmentId, requestKey, sdp, conversationId?, fromNodeId?}` |
| GET | `/api/realtime/session/:id` | student (own call) | Call status |
| POST | `/api/realtime/session/:id/end` | student (own call) | Hang up. `{"complete": true}` also marks the assignment complete |
| **Conversation trees** ([docs](../docs/conversation-tree.md)) | | | |
| GET | `/api/assignments/:id/conversations` | owner | Every practice attempt, newest first |
| GET | `/api/conversations/:id/tree` | owner | One attempt as a `ConversationTree` |

*Owner* = the student the assignment belongs to, or the educator who assigned it.

Errors come back as `{"error": "message"}`: 400 bad input, 401 not logged in,
403 wrong role, 404 not found (also used for "not yours"), 409 try again shortly
(e.g. "Still saving your last call"), 5xx server/Supabase/OpenAI problem.

### Voice calls

1. The browser makes a WebRTC offer and sends it to `POST /api/realtime/session`.
2. The backend checks the student and assignment, builds the patient's
   instructions (persona + scenario, plus "conversation so far" when resuming or
   rewinding), creates the call at OpenAI with the server key, and returns OpenAI's answer.
3. Audio then flows directly between the browser and OpenAI. The backend listens
   in on the call over a WebSocket and saves each transcript line.
4. When the call ends, the lines are copied into that attempt's dialogue tree.
   Pause/resume and rewind start a new call that continues the same attempt.

The persona schema includes the full set of persona details and returns each
field's description, section, input type, and nested JSON path. The create form
uses that schema to build a request compatible with the persona API.

Example create:

```bash
curl -X POST http://localhost:18080/api/personas \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Persona", "identity": {"name": "Jane"}}'
```

The JSON is nested to match the sections on the persona page:

```json
{
  "id": 1,
  "createdAt": "2026-10-03",
  "title": "...",
  "summary": "...",
  "color": "#F4C542",
  "metadata":     { "contentWarnings": [] },
  "identity":     { "name": "", "age": -1, "ethnicity": "", "sex": "", "gender": "", "sexualOrientation": "" },
  "presentation": { "affect": "", "speech": "", "misc": "" },
  "health": {
    "chiefComplaint": "",
    "diagnosis": { "actual": "", "differential": [] },
    "historyOfPresentIllness": { "medicationsAndAllergies": [] },
    "pastMedicalHistory": [],
    "familyMedicalHistory": [],
    "psychiatricProfile": ""
  },
  "goals": [], "challenges": [], "thoughtsAndFeelings": [], "tasksAndActivities": [],
  "influencesAndSupports": [], "socialHistory": [], "culturalComponents": [],
  "emotionalWellbeing": [], "socialDeterminantsOfHealth": [], "promptsAndSpecialInstructions": []
}
```
`identity.age` of `-1` means the age hasn't been set yet.

Errors come back as `{"error": "message"}` with a 400 (bad input), 404 (record not found), or 500 (storage/request failure).

---

## Connecting the frontend

The frontend calls relative URLs like `/api/personas`, and Vite forwards them
to the backend (see [DOCKER.md](../DOCKER.md#how-requests-reach-the-backend)). Use
the helpers in `frontend/src/api/` (they add the login token):

```ts
import { api } from './http'
const personas = await api<Persona[]>('/api/personas')
```

Without Docker: run the backend in one terminal and `npm run dev` in `frontend/`
in another.

---

## Project layout

```
backend/
├── CMakeLists.txt         add new .cpp files to the source list here
├── Dockerfile
├── crow/Crow-1.3.5/       Crow framework (don't edit)
└── src/
    ├── main.cpp                   startup, health, personas, learning topics; registers the other route files
    ├── auth.h/.cpp                verifies the Supabase token, finds/creates the profile, roles
    ├── supabase_client.h/.cpp     small HTTP client for Supabase's REST API
    ├── persona*.h/.cpp            persona data, JSON conversion, storage
    ├── scenario*.h/.cpp           scenario data, routes, storage
    ├── learning_topic*.h/.cpp     learning topics
    ├── educator_routes.h/.cpp     assignments and legacy results
    ├── assignment*.h/.cpp         assignment data, storage, access rules
    ├── class_routes.h/.cpp        students, modules, classes
    ├── conversation_routes.h/.cpp saved conversation trees
    ├── patient_instructions.*     builds the AI patient's instructions
    └── realtime_*.h/.cpp          voice: start/end calls, transcript collector
```

**Adding a new persona field:** add it to the `Persona` struct in `persona.h`, then add one row to the field table at the top of `persona.cpp`. Nothing else needs to change.

---

## Troubleshooting

**`Check for working CXX compiler ... - broken` / `unknown architecture arm64e`** (macOS)
Your Command Line Tools are out of date. Run `softwareupdate --list`, install the newest "Command Line Tools" entry, then delete `build-server/` and build again.

**Lots of errors about `std::optional`, `std::filesystem`, or `from_chars`**
The build isn't using C++17. Make sure `CMakeLists.txt` has `set(CMAKE_CXX_STANDARD 17)`, then delete `build-server/` and rebuild.

**`Could not find asio`**
Install it (step 1), then delete `build-server/` and rebuild.

**Server exits with `Missing Supabase environment variables`**
The environment variables aren't loaded in this terminal. See step 3.

**Voice start fails with "needs WSS support"**
Your libcurl is too old for WebSockets. Use Docker, or install a newer curl (step 1).

**`address already in use`**
A server is already running on that port. Stop it with Ctrl+C, or on Mac/Linux run `lsof -ti :18080 | xargs kill`.

**Changed `CMakeLists.txt` and things got weird?**
Delete `build-server/` and run both build commands again. CMake caches old settings.
