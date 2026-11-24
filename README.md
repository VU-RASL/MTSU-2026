# VERA: AI patient conversation practice

VERA lets students practice clinical conversations by **talking out loud** with an
AI patient. Educators build personas and scenarios, assign them to classes, and
review every attempt as a **dialogue tree**. Students can pause, resume, and rewind
to any line to try a different approach.

| Part | Tech | Folder |
| --- | --- | --- |
| Frontend | React + TypeScript + Vite | [`frontend/`](frontend/) |
| Backend API | C++17, [Crow](https://crowcpp.org) | [`backend/`](backend/) |
| Database and logins | [Supabase](https://supabase.com) (Postgres + Auth) | [`database/`](database/) |
| Voice | OpenAI Realtime API over WebRTC | backend `realtime_*` files |
| Patient avatar | Unity WebGL build (Git LFS) | [`frontend/public/unity/`](frontend/public/unity/) |
| Running it | Docker Compose | [`compose.yaml`](compose.yaml) |

```text
Browser (React, Unity avatar)
   │  /api/...                   ▲ patient's voice (WebRTC, direct)
   ▼                             │
Vite dev server ──proxy──► C++ backend ──► Supabase (Postgres + Auth)
                                 │
                                 └──► OpenAI (creates the voice call with the
                                      server's key, then saves the transcript)
```

The browser never talks to the database directly, and the OpenAI key never
leaves the backend.

---

## Quick start

You need: **Docker Desktop**, **Git LFS**, a **Supabase project**, and (for voice)
an **OpenAI API key**.

### 1. Clone, including the avatar files

The Unity build (~470 MB) is stored with Git LFS. Install it once before cloning:

```bash
brew install git-lfs          # Windows: https://git-lfs.com  · Linux: apt install git-lfs
git lfs install
git clone https://github.com/VU-RASL/MTSU-2026.git
cd MTSU-2026
git lfs pull
```

Check: `ls -lh frontend/public/unity/UMA/Build` should show `UMA.data` at a few
hundred MB. If it's ~130 bytes, run `git lfs pull` again.

### 2. Set up the database

Follow **[docs/database-setup.md](docs/database-setup.md)**. In short:
create a Supabase project, run `database/00_…` through `17_…` in order in the SQL
Editor, and copy your project URL and keys.

> Joining the existing team project? The database is already set up. Ask a
> teammate for the `.env` values and skip to step 3.

### 3. Create `.env`

Copy the example and fill it in:

```bash
cp .env.example .env
```

| Variable | Where to find it | Used by |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL | backend |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → **secret** key | backend only |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → **publishable** key | backend |
| `VITE_SUPABASE_URL` | same as `SUPABASE_URL` | browser |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | same as `SUPABASE_PUBLISHABLE_KEY` | browser |
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com/api-keys) | backend only (voice) |
| `OPENAI_REALTIME_MODEL` | e.g. `gpt-realtime-2.1-mini` for dev, `gpt-realtime-2.1` for demos | backend (voice) |

`.env` is git-ignored. **Never commit it, and never put the secret key or the
OpenAI key in a `VITE_` variable**: anything starting with `VITE_` is sent to the browser.

### 4. Run it

```bash
docker compose up --build
```

The first start takes a few minutes while the backend compiles. When Vite says
it's ready, open **http://localhost:5173**.

Quick check in another terminal:

```bash
curl http://localhost:18080/api/health     # {"status":"ok"}
```

### 5. Create your first educator

Every new account starts as a **student**. Register in the app, then promote
yourself in the Supabase SQL Editor:

```sql
update public.profiles set role = 'educator' where email = 'you@example.com';
```

(The profile is created the first time you log in, so log in once before running this.)

Optional: load the demo persona and scenario (Gloria, MMR vaccine hesitancy)
with [`database/demo_gloria.sql`](database/demo_gloria.sql).

---

## Using the app

**Educator:** Educator Portal → create a **module** (scenario + persona) →
create a **class** and add students → assign the module to the class. Each student
gets their own assignment, including students added later. **Audit** opens a
student's saved conversation trees.

**Student:** Student Portal → **Start** → allow the microphone → talk.
- **Pause / Resume**: hang up and pick up later from the same spot.
- **↩ Continue from here**: rewind to any line; your next line starts a new branch.
- **End conversation**: marks the assignment complete. You can keep practicing afterward.

---

## Day-to-day

| You changed… | Do this |
| --- | --- |
| Frontend code | Save. The browser updates by itself. |
| Backend C++ | `docker compose restart backend` (recompiles; watch `docker compose logs -f backend`) |
| `.env` | `docker compose up -d` |
| A Dockerfile or `package.json` | `docker compose up --build` |
| The database | Add a new numbered file in `database/` and run it in the SQL Editor (see [database guide](docs/database-setup.md#changing-the-database)) |

Stop everything with **Ctrl+C**, or `docker compose down`.

---

## More docs

| Doc | What's in it |
| --- | --- |
| [docs/database-setup.md](docs/database-setup.md) | Standing up Supabase, running migrations, roles, demo data, resetting |
| [DOCKER.md](DOCKER.md) | How the Docker setup works, ports, volumes, FAQ |
| [backend/README.md](backend/README.md) | API routes, running the backend without Docker |
| [frontend/README.md](frontend/README.md) | Frontend notes, sign-in, Unity avatar |
| [docs/conversation-tree.md](docs/conversation-tree.md) | How attempts are saved as dialogue trees |
| [docs/educator-portal.md](docs/educator-portal.md) | Educator Portal features |
| [docs/learning-topics.md](docs/learning-topics.md) | Learning page and topics API |

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `SUPABASE_URL is required` when starting | `.env` is missing or not in the repo root. See step 3. |
| Frontend never starts | The backend is still compiling or failed. Check `docker compose logs backend`. |
| Logged in but sent back to Login / "Login required" | The backend restarted or your session expired. Refresh and log in again. |
| Avatar stuck on "Loading patient…" or errors | The Unity files are LFS placeholders. Run `git lfs pull`. |
| "Microphone access was blocked" | Allow the microphone for `localhost:5173` in your browser's site settings. |
| Voice start fails with a 5xx | `OPENAI_API_KEY` / `OPENAI_REALTIME_MODEL` missing or wrong in `.env`, then `docker compose up -d`. |
| "Still saving your last call…" | Normal for a few seconds after hanging up. It retries automatically. |
| Port 5173 or 18080 in use | Stop the other server, or set `FRONTEND_PORT` / `BACKEND_PORT` in `.env`. |
