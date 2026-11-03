begin;

-- Preserves AssignmentStore's text-valued profile references and existing status values.
-- persona_id is nullable for compatibility with today's creation route.
-- The backend must select an authorized persona before starting a Realtime session.
-- Once linked to a session, assignment identity fields cannot be changed independently.
-- Educator access should be checked against assigned_by, with an explicit admin override.
create table public.assignments (
    id integer generated always as identity primary key,
    created_at timestamptz not null default now(),
    scenario_id integer not null references public.scenarios(id) on delete restrict,
    persona_id integer references public.personas(id) on delete restrict,
    student_id text not null references public.profiles(profile_key) on delete restrict,
    assigned_by text references public.profiles(profile_key) on delete restrict,
    status text not null default 'assigned'
        check (status in ('assigned', 'in_progress', 'completed', 'reviewed')),
    archived_at timestamptz,
    unique (id, student_id),
    unique (id, student_id, scenario_id, persona_id)
);

create index assignments_student_idx on public.assignments(student_id, created_at desc, id desc);
create index assignments_educator_idx on public.assignments(assigned_by, created_at desc, id desc);
create index assignments_scenario_idx on public.assignments(scenario_id);
create index assignments_persona_idx on public.assignments(persona_id);

alter table public.assignments enable row level security;
revoke all on public.assignments from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.assignments to service_role;
revoke all on sequence public.assignments_id_seq from public, anon, authenticated, service_role;
grant usage, select on sequence public.assignments_id_seq to service_role;

commit;

