# Personas API (C++ / Crow)

The backend for the Personas page. A small C++ server that the React frontend calls to list, create, edit, and delete personas.

- **Framework:** [Crow](https://crowcpp.org) 1.3.5 (included in `crow/`)
- **Port:** 18080 by default
- **Storage:** in memory for now, so data resets every time the server restarts

---

## 1. Install the prerequisites

You need a C++17 compiler, CMake 3.15 or newer, and the **asio** library. Crow is already in the repo, so you don't need to download it.

**macOS**

```bash
xcode-select --install       # compiler (skip if already installed)
brew install cmake asio
```

**Linux (Ubuntu/Debian)**

```bash
sudo apt install g++ cmake libasio-dev
```

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

```bash
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

curl http://localhost:18080/api/personas
# a list with one sample persona (Gloria) that loads on startup
```

---

## API

All routes send and receive JSON.

| Method | Route | What it does |
|---|---|---|
| GET | `/api/health` | Checks that the server is up |
| GET | `/api/personas` | Lists all personas. Add `?search=text` to filter. |
| GET | `/api/personas/:id` | Gets one persona |
| POST | `/api/personas` | Creates a persona (`title` is required) |
| PUT | `/api/personas/:id` | Updates a persona. Only the fields you send change. |
| DELETE | `/api/personas/:id` | Deletes a persona |

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
  "identity":     { "name": "", "age": "", "ethnicity": "", "sex": "", "gender": "", "sexualOrientation": "" },
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

Errors come back as `{"error": "message"}` with a 400 (bad input) or 404 (persona not found).

---

## Connecting the frontend

CORS is set up for the Vite dev server at `http://localhost:5173`, so React can call the API directly:

```js
const res = await fetch("http://localhost:18080/api/personas");
const personas = await res.json();
```

Run both at the same time: the backend in one terminal, `npm run dev` in `frontend/` in another.

---

## Project layout

```
backend/
├── CMakeLists.txt
├── crow/Crow-1.3.5/      Crow framework (don't edit)
└── src/
    ├── main.cpp           routes: matches each request to the right handler
    ├── persona.h/.cpp     the Persona data and its JSON conversion
    └── persona_store.h/.cpp   in-memory storage (thread-safe)
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

**`address already in use`**
A server is already running on that port. Stop it with Ctrl+C, or on Mac/Linux run `lsof -ti :18080 | xargs kill`.

**Changed `CMakeLists.txt` and things got weird?**
Delete `build-server/` and run both build commands again. CMake caches old settings.
