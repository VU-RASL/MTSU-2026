begin;

-- Realtime connection state is separate from assignment completion and educator review.
-- Reserve a row before creating the OpenAI call; save call_id after successful signaling.
-- request_key is a client-generated UUID reused for retries of the same start request.
-- Look up (student_id, request_key) before attempting a second provider call.
-- Snapshots must contain approved patient/scenario data, not browser-supplied instructions.
-- persona_id must already match the selected assignment persona.
-- A sideband collector claims collector_id / collector_lease_until using a conditional update.
-- The backend must enforce allowed state transitions and avoid reviving terminal calls.
create table public.realtime_sessions (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    assignment_id integer not null,
    student_id text not null,
    scenario_id integer not null,
    persona_id integer not null,
    request_key uuid not null,
    call_id text unique,
    model text not null check (length(model) between 1 and 128),
    voice text not null check (length(voice) between 1 and 64),
    instruction_version text not null check (length(instruction_version) between 1 and 128),
    persona_snapshot jsonb not null check (jsonb_typeof(persona_snapshot) = 'object'),
    scenario_snapshot jsonb not null check (jsonb_typeof(scenario_snapshot) = 'object'),
    status text not null default 'starting'
        check (status in ('starting', 'active', 'ending', 'ended', 'failed')),
    started_at timestamptz,
    deadline_at timestamptz not null,
    ended_at timestamptz,
    finalized_at timestamptz,
    end_reason text,
    transcript_complete boolean not null default false,
    budget_usd numeric(12, 6) not null default 3
        check (budget_usd > 0 and budget_usd <= 1000),
    max_output_tokens integer not null default 1024 check (max_output_tokens > 0),
    collector_id uuid,
    collector_lease_until timestamptz,
    foreign key (assignment_id, student_id, scenario_id, persona_id)
        references public.assignments(id, student_id, scenario_id, persona_id)
        on delete restrict,
    unique (student_id, request_key),
    unique (id, assignment_id, student_id),
    check (deadline_at > created_at and deadline_at <= created_at + interval '60 minutes'),
    check (started_at is null or started_at >= created_at),
    check (ended_at is null or ended_at >= coalesce(started_at, created_at)),
    check ((status in ('ended', 'failed')) = (ended_at is not null)),
    check (status not in ('active', 'ending') or (call_id is not null and started_at is not null)),
    check (finalized_at is null or (ended_at is not null and finalized_at >= ended_at)),
    check ((collector_id is null) = (collector_lease_until is null))
);

create unique index realtime_one_active_student_idx
    on public.realtime_sessions(student_id)
    where status in ('starting', 'active', 'ending');
create index realtime_sessions_assignment_idx
    on public.realtime_sessions(assignment_id, created_at desc);
create index realtime_sessions_deadline_idx
    on public.realtime_sessions(deadline_at)
    where status in ('starting', 'active', 'ending');
create index realtime_sessions_collector_idx
    on public.realtime_sessions(collector_lease_until)
    where status in ('starting', 'active', 'ending');

alter table public.realtime_sessions enable row level security;
revoke all on public.realtime_sessions from public, anon, authenticated, service_role;
grant select, insert, update on public.realtime_sessions to service_role;

commit;

