begin;

-- Proposed persistent backing for the currently in-memory ScenarioStore.
-- The future store must map snake_case DB columns to the existing camelCase C++ JSON fields.
-- text[] columns appear as JSON arrays through the Supabase Data API.
create table public.scenarios (
    id integer generated always as identity primary key,
    created_at timestamptz not null default now(),
    title text not null check (length(title) > 0),
    summary text not null default '',
    setting text not null default '',
    difficulty text not null default '',
    learning_objectives text[] not null default '{}',
    instructions text not null default '',
    patient_situation text not null default '',
    required_tasks text[] not null default '{}',
    archived_at timestamptz
);

alter table public.scenarios enable row level security;
revoke all on public.scenarios from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.scenarios to service_role;
revoke all on sequence public.scenarios_id_seq from public, anon, authenticated, service_role;
grant usage, select on sequence public.scenarios_id_seq to service_role;

commit;

