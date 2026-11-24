# Database setup (Supabase)

VERA stores everything (users, personas, scenarios, classes, assignments, voice
calls and conversation trees) in a **Supabase** project: a hosted Postgres
database plus email/password login.

> **Joining the existing team project?** It's already set up. You only need the
> `.env` values from a teammate. This guide is for standing up a **new** database
> (a fresh Supabase project, a new semester, a backup copy).

---

## 1. Create a Supabase project

1. Sign in at [supabase.com](https://supabase.com) → **New project**.
2. Pick a name, a region, and a **database password**. Save the password
   somewhere safe; you only need it for command-line access.
3. Wait a minute or two for the project to finish setting up.

---

## 2. Run the migrations, in order

Open **SQL Editor → New query**. For each file below, paste the whole file and
click **Run**, one file at a time, **top to bottom**:

| # | File | What it adds |
| --- | --- | --- |
| 1 | `00_prerequisites.sql` | Checks it's running in Supabase; shared setup |
| 2 | `01_profiles.sql` | User profiles and roles (student / educator / admin) |
| 3 | `02_personas.sql` | Patient personas |
| 4 | `03_learning_topics.sql` | Learning page topics |
| 5 | `04_scenarios.sql` | Scenarios |
| 6 | `05_assignments.sql` | Assignments (a scenario + persona given to a student) |
| 7 | `06_realtime_deleted_sessions.sql` | Record of deleted voice sessions |
| 8 | `07_realtime_sessions.sql` | Voice calls |
| 9 | `08_realtime_transcript_turns.sql` | Transcript lines from voice calls |
| 10 | `09_realtime_usage.sql` | Voice usage tracking |
| 11 | `10_session_results.sql` | Finished-session results (legacy grading path) |
| 12 | `11_realtime_functions.sql` | Voice session functions |
| 13 | `12_realtime_functions.sql` | More voice session functions |
| 14 | `13_realtime_collection.sql` | Saving transcripts during a call |
| 15 | `13_scenario_estimated_time.sql` | Scenario estimated time |
| 16 | `14_realtime_ordering_fix.sql` | Transcript ordering fix |
| 17 | `15_conversation_tree.sql` | Practice attempts saved as dialogue trees |
| 18 | `16_classes_modules.sql` | Classes, modules, student emails, "End = complete" |
| 19 | `17_conversation_resume.sql` | Pause / resume / rewind |

Each file runs as one transaction (`begin; … commit;`), so if one fails,
nothing from that file is applied. Fix the problem and run that file again.

**Things that are normal:**
- Supabase may warn about **"destructive operations"**. The files contain words
  like `delete` and `revoke` inside function definitions and permission settings.
  Nothing is deleted when they run on a new database. Click **Run** anyway.
- "Success. No rows returned" is what success looks like.

**Do NOT run:**
- `database/sb_combined_reference.sql`: an **outdated** all-in-one copy that stops
  at file 11. It's missing the conversation tree, classes, and resume tables.
- `educator_tables.sql` (in the repo root or `database/`): an **old prototype**
  of the assignments table that conflicts with `05_assignments.sql`.
- Any file **twice** on the same database. They create tables, so a second run
  errors out with "already exists" (no harm done, but nothing is applied).

<details>
<summary><strong>Prefer the command line?</strong> Run them all with <code>psql</code></summary>

Get the connection string from Supabase → **Connect** → **Session pooler**, and
put your database password in it. Then, from the repo root:

```bash
export DB_URL='postgresql://postgres.YOURREF:YOUR-DB-PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres'

for f in database/0*.sql database/1*.sql; do
  echo "== $f"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f" || break
done
```

The glob runs them in the same order as the table above. Install `psql` with
`brew install libpq` (Mac) or `apt install postgresql-client` (Linux). Never
commit the connection string, because it contains the password.
</details>

---

## 3. Auth settings

In **Authentication → Sign In / Providers**:

- **Email** must be enabled (it is by default).
- **Confirm email**: on by default, which means new users must click a link in a
  real inbox before they can log in. For local development and demos you can
  turn it **off** so test accounts (`student1@test.com`) work right away.

No other auth setup is needed. Sign-up and login happen in the app.

---

## 4. Copy the keys into `.env`

Supabase → **Project Settings → API Keys** (and **Data API** for the URL):

```dotenv
SUPABASE_URL=https://YOURREF.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...            # backend only, keep private
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_SUPABASE_URL=https://YOURREF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

See the root [README](../README.md#3-create-env) for the full list, including the
OpenAI settings. Restart with `docker compose up -d` after changing `.env`.

---

## 5. Users and roles

Every account that signs up starts as a **student**. The app can't create
educators, so nobody can make themselves one. A profile row is created the
first time a user **logs in**, and it gets their email automatically.

Promote an account in the SQL Editor:

```sql
-- make an educator
update public.profiles set role = 'educator' where email = 'teacher@example.com';

-- make an admin (can see and manage every educator's classes and modules)
update public.profiles set role = 'admin' where email = 'admin@example.com';

-- see everyone
select id, email, role, created_at from public.profiles order by id;
```

The user may need to refresh the page for the new role to show.

---

## 6. Optional: demo data

[`database/demo_gloria.sql`](../database/demo_gloria.sql) adds one persona and a
matching scenario: Gloria Nellie No Braids, a Navajo grandmother who is hesitant
about her grandson's second MMR shot. Run it once in the SQL Editor.

Then, in the app as an educator: create a **module** with Gloria's scenario and
persona, create a **class** with your test student, and assign the module.

---

## 7. Check that it worked

In the SQL Editor:

```sql
select table_name from information_schema.tables
where table_schema = 'public' order by table_name;
```

You should see **19 tables**, including `conversations`, `dialogue_nodes`,
`classes`, and `modules`.

Then in the app: register, log in, and check the account appears in
`public.profiles`. Promote it to educator, create a persona, and you're set.

---

## How the data fits together

```text
profiles (users + roles)
   │
   ├── classes ── class_members (students)
   │      └──── class_modules ── modules (scenario + persona)
   │
   └── assignments (one scenario + persona for one student; may come from a class/module)
          │
          ├── conversations (one per practice attempt)
          │      └── dialogue_nodes (one row per line; parent_id makes the tree)
          │
          └── realtime_sessions (one per voice call)
                 ├── realtime_transcript_turns (raw transcript)
                 └── conversation_sessions (which attempt + line the call continued from)
```

- When a voice call ends, its transcript is copied into that attempt's tree.
- **Rewind** = a new call that continues from an earlier line. The next line gets
  the same parent as an existing line, which makes a branch. Nothing is deleted.
- **Assigning a module to a class** creates one assignment per student. Students
  added later get the class's modules automatically.
- **Removing** a module, student, or class only deletes assignments nobody has
  started. Started work is always kept.

More detail: [conversation-tree.md](conversation-tree.md) and
[educator-portal.md](educator-portal.md).

**Security model:** the browser has **no** direct access to any table. Row Level
Security is on, and browser roles get nothing. Every request goes through the C++
backend, which checks who the user is and what they're allowed to do, then talks
to Supabase with the secret key.

---

## Hiding or resetting test data

**Hide (recommended, undoable).** Archived items disappear from lists, but
nothing is deleted:

```sql
begin;
update public.personas    set archived_at = now() where archived_at is null;
update public.scenarios   set archived_at = now() where archived_at is null;
update public.modules     set archived_at = now() where archived_at is null;
update public.assignments set archived_at = now() where archived_at is null;
commit;
```

Undo for items hidden today (repeat for each table):
`update public.personas set archived_at = null where archived_at > now() - interval '1 day';`

**Full wipe (permanent, no undo).** Deletes all personas and scenarios and
**everything that depends on them**: modules, assignments, voice calls,
transcripts and conversation trees. Accounts, classes, and learning topics stay.

```sql
truncate table public.personas, public.scenarios cascade;
```

**Start completely over:** create a new Supabase project and follow this guide again.

---

## Changing the database

1. **Never edit a file that has already been run.** Other copies of the database
   won't see the change. Add a new file with the next number instead, e.g.
   `database/18_my_change.sql`.
2. Follow the pattern of the existing files:
   - wrap everything in `begin; … commit;`
   - new tables: `enable row level security`, `revoke all … from public, anon, authenticated, service_role`,
     then `grant` only what the backend needs to `service_role`
   - new functions: `security definer`, `set search_path = pg_catalog`, and only
     `service_role` may execute them
   - end with `notify pgrst, 'reload schema';` so the API sees the change right away
3. Test it on a copy first if you can (a second Supabase project, or local Postgres).
4. Run it on the team project, commit the file, and tell the team in the PR
   description so nobody runs it twice.
