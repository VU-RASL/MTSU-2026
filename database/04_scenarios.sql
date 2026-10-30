begin;

-- Persistent backing for ScenarioStore (scenario_store.cpp).
-- Columns are camelCase to match the C++ fields and JSON API, so they must
-- be double-quoted in SQL. (Other tables use snake_case; see PR notes.)
-- text[] columns appear as JSON arrays through the Supabase Data API.
create table public.scenarios (
    id integer generated always as identity primary key,
    "createdAt" timestamptz not null default now(),
    title text not null check (length(title) > 0),
    summary text not null default '',
    setting text not null default '',
    difficulty text not null default '',
    "learningObjectives" text[] not null default '{}',
    instructions text not null default '',
    "patientSituation" text not null default '',
    "requiredTasks" text[] not null default '{}',
    "estimatedTime" integer not null default 0 check ("estimatedTime" >= 0),
    "archivedAt" timestamptz
);

alter table public.scenarios enable row level security;
revoke all on public.scenarios from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.scenarios to service_role;
revoke all on sequence public.scenarios_id_seq from public, anon, authenticated, service_role;
grant usage, select on sequence public.scenarios_id_seq to service_role;

commit;