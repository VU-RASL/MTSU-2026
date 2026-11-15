-- =============================================================================
-- Educator portal tables: assignments and session_results
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run
-- =============================================================================

-- One row per "this scenario is assigned to this student".
create table public.assignments (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  scenario_id  bigint not null,   -- link to scenarios(id) once scenarios are in Supabase
  student_id   text   not null,   -- text until the user tables exist (fits UUID or number)
  assigned_by  text,              -- the educator's user id
  status       text   not null default 'assigned'
               check (status in ('assigned', 'in_progress', 'completed', 'reviewed'))
);

-- One row per attempt at an assignment (the saved session + the educator's review).
create table public.session_results (
  id                bigint generated always as identity primary key,
  created_at        timestamptz not null default now(),
  assignment_id     bigint not null references public.assignments (id) on delete cascade,
  student_id        text   not null,
  transcript        jsonb  not null default '[]'::jsonb,  -- [{ "id", "role", "text", "at" }]
  auto_score        jsonb,                                 -- system/AI score, shape TBD
  educator_score    numeric check (educator_score between 0 and 100),
  educator_feedback text   not null default '',
  reviewed_by       text,
  reviewed_at       timestamptz
);

-- Fast lookups the API uses
create index assignments_student_id_idx      on public.assignments (student_id);
create index session_results_assignment_idx  on public.session_results (assignment_id);

-- Lock both tables to the backend (its secret key bypasses RLS)
alter table public.assignments     enable row level security;
alter table public.session_results enable row level security;
