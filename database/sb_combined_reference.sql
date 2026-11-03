begin;

-- 00_prerequisites.sql

-- VERA Supabase reference schema.
-- Run this combined script OR the numbered sections separately, not both.
-- Target: Supabase PostgreSQL 15+; run as postgres through the SQL Editor.
-- Fresh-install reference, not an automatic migration of an existing database.
-- Existing application tables cause an error; do not drop existing data to make it run.
-- No sample users, credentials, or application data are inserted.
-- The backend uses its server-only Supabase secret key. Browser roles get no table access.
-- RLS does not replace backend authentication/authorization when using that secret key.
-- Replace X-User-Id / DEV_USER_ID before allowing real student sessions.
-- Current C++ expects numeric profiles.id but string-valued student_id / assigned_by.
-- profiles.profile_key preserves that API contract while allowing real foreign keys.
-- All application integer identity IDs fit the current C++ int parsers.
-- Future verified Supabase Auth identities map through profiles.auth_user_id.
-- Auth account removal does not erase educational records.
-- Transcripts persist until explicit deletion. Assignments should be archived.
-- DB state alone does not stop an OpenAI call: the backend must hang up the call.
-- This schema intentionally retains no audio recording or OpenAI credential.
-- No Supabase Realtime publication is required for OpenAI WebRTC.
-- Global concurrency, educator ownership checks, provider API calls, usage pricing,
-- and collector lease renewal remain backend responsibilities.

do $$
declare
    object_name text;
begin
    if to_regclass('auth.users') is null then
        raise exception 'Run this reference in Supabase: auth.users is required';
    end if;

    if not exists (select 1 from pg_roles where rolname = 'service_role')
       or not exists (select 1 from pg_roles where rolname = 'anon')
       or not exists (select 1 from pg_roles where rolname = 'authenticated') then
        raise exception 'Supabase API roles are required';
    end if;

    foreach object_name in array array[
        'profiles', 'personas', 'learning_topics', 'scenarios', 'assignments',
        'realtime_deleted_sessions', 'realtime_sessions',
        'realtime_transcript_turns', 'realtime_usage', 'session_results'
    ] loop
        if to_regclass('public.' || object_name) is not null then
            raise exception
                'public.% already exists; use a reviewed migration instead',
                object_name;
        end if;
    end loop;
end;
$$;

create function public.vera_valid_transcript(value jsonb)
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
    select case
        when jsonb_typeof(value) <> 'array' then false
        else not exists (
            select 1
            from jsonb_array_elements(value) as entries(turn)
            where not coalesce(
                jsonb_typeof(turn) = 'object'
                and turn ->> 'role' in ('student', 'patient')
                and jsonb_typeof(turn -> 'text') = 'string',
                false
            )
        )
    end;
$$;

revoke all on function public.vera_valid_transcript(jsonb)
    from public, anon, authenticated, service_role;

grant execute on function public.vera_valid_transcript(jsonb)
    to service_role;


-- 01_profiles.sql

-- auth.cpp queries profiles.id and role.
-- The backend provisions profiles and assigns roles; never trust a requested client role.
-- Map a verified auth.users UUID to auth_user_id instead of treating UUIDs as numeric IDs.

create table public.profiles (
    id bigint generated always as identity primary key
        check (id between 1 and 999999999999999999),
    profile_key text generated always as (id::text) stored unique,
    auth_user_id uuid unique references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    name text not null default '',
    email text unique,
    role text not null default 'student'
        check (role in ('student', 'educator', 'admin'))
);

alter table public.profiles enable row level security;

revoke all on public.profiles
    from public, anon, authenticated, service_role;

grant select, insert, update, delete on public.profiles
    to service_role;

revoke all on sequence public.profiles_id_seq
    from public, anon, authenticated, service_role;

grant usage, select on sequence public.profiles_id_seq
    to service_role;


-- 02_personas.sql

-- Matches PersonaStore: id, created_at, title, data.
-- data contains the nested JSON returned by the persona serializer,
-- excluding id/createdAt/title.
-- Existing references restrict deletion; archive instead when encounters must be retained.

create table public.personas (
    id integer generated always as identity primary key,
    created_at timestamptz not null default now(),
    title text not null check (length(title) > 0),
    data jsonb not null default '{}'::jsonb
        check (jsonb_typeof(data) = 'object'),
    archived_at timestamptz
);

alter table public.personas enable row level security;

revoke all on public.personas
    from public, anon, authenticated, service_role;

grant select, insert, update, delete on public.personas
    to service_role;

revoke all on sequence public.personas_id_seq
    from public, anon, authenticated, service_role;

grant usage, select on sequence public.personas_id_seq
    to service_role;


-- 03_learning_topics.sql

-- Matches LearningTopicStore; lower position values appear first.

create table public.learning_topics (
    id integer generated always as identity primary key,
    created_at timestamptz not null default now(),
    title text not null check (length(title) > 0),
    content text not null default '',
    position integer not null default 0
);

create index learning_topics_order_idx
    on public.learning_topics(position, id);

alter table public.learning_topics enable row level security;

revoke all on public.learning_topics
    from public, anon, authenticated, service_role;

grant select, insert, update, delete on public.learning_topics
    to service_role;

revoke all on sequence public.learning_topics_id_seq
    from public, anon, authenticated, service_role;

grant usage, select on sequence public.learning_topics_id_seq
    to service_role;


-- 04_scenarios.sql

-- Proposed persistent backing for the currently in-memory ScenarioStore.
-- The future store must map snake_case DB columns to existing camelCase C++ JSON fields.
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

revoke all on public.scenarios
    from public, anon, authenticated, service_role;

grant select, insert, update, delete on public.scenarios
    to service_role;

revoke all on sequence public.scenarios_id_seq
    from public, anon, authenticated, service_role;

grant usage, select on sequence public.scenarios_id_seq
    to service_role;


-- 05_assignments.sql

-- Preserves AssignmentStore's text-valued profile references and existing status values.
-- persona_id is nullable for compatibility with today's creation route.
-- The backend must select an authorized persona before starting a Realtime session.
-- Once linked to a session, assignment identity fields cannot be changed independently.
-- Educator access should be checked against assigned_by, with an explicit admin override.

create table public.assignments (
    id integer generated always as identity primary key,
    created_at timestamptz not null default now(),
    scenario_id integer not null
        references public.scenarios(id) on delete restrict,
    persona_id integer
        references public.personas(id) on delete restrict,
    student_id text not null
        references public.profiles(profile_key) on delete restrict,
    assigned_by text
        references public.profiles(profile_key) on delete restrict,
    status text not null default 'assigned'
        check (status in ('assigned', 'in_progress', 'completed', 'reviewed')),
    archived_at timestamptz,
    unique (id, student_id),
    unique (id, student_id, scenario_id, persona_id)
);

create index assignments_student_idx
    on public.assignments(student_id, created_at desc, id desc);

create index assignments_educator_idx
    on public.assignments(assigned_by, created_at desc, id desc);

create index assignments_scenario_idx
    on public.assignments(scenario_id);

create index assignments_persona_idx
    on public.assignments(persona_id);

alter table public.assignments enable row level security;

revoke all on public.assignments
    from public, anon, authenticated, service_role;

grant select, insert, update, delete on public.assignments
    to service_role;

revoke all on sequence public.assignments_id_seq
    from public, anon, authenticated, service_role;

grant usage, select on sequence public.assignments_id_seq
    to service_role;


-- 06_realtime_deleted_sessions.sql

-- Content-free tombstones stop retries from recreating a purged session.
-- Do not store student IDs, transcript text, or snapshots here.

create table public.realtime_deleted_sessions (
    session_id uuid primary key,
    deleted_at timestamptz not null default now()
);

alter table public.realtime_deleted_sessions enable row level security;

revoke all on public.realtime_deleted_sessions
    from public, anon, authenticated, service_role;

grant select on public.realtime_deleted_sessions
    to service_role;


-- 07_realtime_sessions.sql

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
    instruction_version text not null
        check (length(instruction_version) between 1 and 128),
    persona_snapshot jsonb not null
        check (jsonb_typeof(persona_snapshot) = 'object'),
    scenario_snapshot jsonb not null
        check (jsonb_typeof(scenario_snapshot) = 'object'),
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
    max_output_tokens integer not null default 1024
        check (max_output_tokens > 0),
    collector_id uuid,
    collector_lease_until timestamptz,

    foreign key (assignment_id, student_id, scenario_id, persona_id)
        references public.assignments(id, student_id, scenario_id, persona_id)
        on delete restrict,

    unique (student_id, request_key),
    unique (id, assignment_id, student_id),

    check (
        deadline_at > created_at
        and deadline_at <= created_at + interval '60 minutes'
    ),

    check (started_at is null or started_at >= created_at),

    check (
        ended_at is null
        or ended_at >= coalesce(started_at, created_at)
    ),

    check (
        (status in ('ended', 'failed')) = (ended_at is not null)
    ),

    check (
        status not in ('active', 'ending')
        or (call_id is not null and started_at is not null)
    ),

    check (
        finalized_at is null
        or (ended_at is not null and finalized_at >= ended_at)
    ),

    check (
        (collector_id is null) = (collector_lease_until is null)
    )
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

revoke all on public.realtime_sessions
    from public, anon, authenticated, service_role;

grant select, insert, update on public.realtime_sessions
    to service_role;


-- 08_realtime_transcript_turns.sql

-- Canonical transcript. Assign sequence_no from conversation ordering, not transcript arrival.
-- Upsert by (session_id, item_id, content_index) to avoid duplicate turns.
-- previous_item_id supports reconstruction when provider events arrive out of order.
-- A completed generated utterance does not prove the student heard all of its audio.
-- Record interruptions explicitly. The backend must supply the actual provider timestamps.

create table public.realtime_transcript_turns (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null
        references public.realtime_sessions(id) on delete cascade,
    item_id text not null check (length(item_id) between 1 and 256),
    response_id text,
    previous_item_id text,
    content_index integer not null default 0 check (content_index >= 0),
    sequence_no bigint not null check (sequence_no >= 0),
    role text not null check (role in ('student', 'patient')),
    text text not null default '' check (octet_length(text) <= 262144),
    occurred_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    status text not null default 'partial'
        check (status in ('partial', 'completed', 'interrupted', 'failed')),
    unique (session_id, item_id, content_index),
    unique (session_id, sequence_no)
);

alter table public.realtime_transcript_turns enable row level security;

revoke all on public.realtime_transcript_turns
    from public, anon, authenticated, service_role;

grant select, insert, update on public.realtime_transcript_turns
    to service_role;


-- 09_realtime_usage.sql

-- One row per provider response or input-transcription usage report.
-- provider_id should be response_id for responses and item/content identity for transcription.
-- usage stores usage counters only, never entire provider events containing transcript/audio.
-- pricing records the rate card used for the estimate. Compute cost in backend code.
-- Differentiate cached/uncached text/audio units; do not price total tokens at one rate.

create table public.realtime_usage (
    session_id uuid not null
        references public.realtime_sessions(id) on delete cascade,
    kind text not null check (kind in ('response', 'input_transcription')),
    provider_id text not null check (length(provider_id) between 1 and 512),
    created_at timestamptz not null default now(),
    model text not null,
    usage jsonb not null check (jsonb_typeof(usage) = 'object'),
    pricing jsonb not null check (jsonb_typeof(pricing) = 'object'),
    estimated_cost_usd numeric(16, 8) not null
        check (
            estimated_cost_usd >= 0
            and estimated_cost_usd <= 1000000
        ),
    primary key (session_id, kind, provider_id)
);

alter table public.realtime_usage enable row level security;

revoke all on public.realtime_usage
    from public, anon, authenticated, service_role;

grant select, insert, update on public.realtime_usage
    to service_role;


-- 10_session_results.sql

-- Preserves the existing educator result/review response shape.
-- Legacy/manual submissions have a null realtime_session_id and outcome 'legacy'.
-- For Realtime calls, transcript is a finalized compatibility snapshot of canonical turns.
-- Realtime results must be created by finalize_realtime_session(), not the public submit route.
-- Existing transcript and autoScore submission endpoints still require backend hardening.
-- RESTRICT replaces the old cascade: deleting an assignment cannot erase its transcripts.
-- Explicit result deletion is provided by purge_session_result() below.

create table public.session_results (
    id integer generated always as identity primary key,
    created_at timestamptz not null default now(),
    assignment_id integer not null,
    student_id text not null,
    realtime_session_id uuid unique,
    transcript jsonb not null default '[]'::jsonb
        check (public.vera_valid_transcript(transcript)),
    outcome text not null default 'legacy'
        check (outcome in ('legacy', 'completed', 'interrupted', 'failed')),
    transcript_complete boolean not null default false,
    auto_score jsonb
        check (auto_score is null or jsonb_typeof(auto_score) = 'object'),
    educator_score numeric check (educator_score between 0 and 100),
    educator_feedback text not null default '',
    reviewed_by text
        references public.profiles(profile_key) on delete restrict,
    reviewed_at timestamptz,

    foreign key (assignment_id, student_id)
        references public.assignments(id, student_id)
        on delete restrict,

    foreign key (realtime_session_id, assignment_id, student_id)
        references public.realtime_sessions(id, assignment_id, student_id)
        on delete restrict,

    check (
        (realtime_session_id is null) = (outcome = 'legacy')
    )
);

create index session_results_assignment_idx
    on public.session_results(assignment_id, created_at, id);

create index session_results_student_idx
    on public.session_results(student_id, created_at desc, id desc);

create index session_results_reviewer_idx
    on public.session_results(reviewed_by);

alter table public.session_results enable row level security;

revoke all on public.session_results
    from public, anon, authenticated, service_role;

grant select, insert, update on public.session_results
    to service_role;

revoke all on sequence public.session_results_id_seq
    from public, anon, authenticated, service_role;

grant usage, select on sequence public.session_results_id_seq
    to service_role;


-- 11_realtime_functions.sql

-- All RPCs below are backend-only. The backend must authenticate the caller and authorize
-- the referenced assignment/result before invoking them. Do not send the secret key to React.
-- Permanent keys, WebRTC offers/answers, and client secrets are not stored by these functions.
--
-- Backend sequence:
-- 1. Reserve realtime_sessions with assignment identities, approved snapshots, and deadline.
-- 2. Create the provider call; save call_id, started_at, status='active'.
-- 3. Persist transcript turns and deduplicated usage while monitoring the deadline.
-- 4. Hang up OpenAI over HTTPS, then set ended_at, status='ended'/'failed', and end_reason.
-- 5. Drain late transcription for a bounded period; call finalize_realtime_session.
-- 6. Educators use existing GET result APIs. Use purge_session_result for explicit deletion.
--
-- If provider creation fails, set status='failed' and ended_at; release the active reservation.
-- SQL cannot hang up an external call and expiration does not automatically change status.
-- Global concurrency and collector claiming require backend transactions/conditional updates.
-- The old result-submit endpoint must not accept client-authored Realtime results or auto scores.

create function public.vera_guard_realtime_session()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
    assignment_row public.assignments%rowtype;
begin
    if tg_op = 'INSERT' then
        perform pg_advisory_xact_lock(hashtextextended(new.id::text, 0));

        if exists (
            select 1
            from public.realtime_deleted_sessions
            where session_id = new.id
        ) then
            raise exception 'This session was explicitly deleted';
        end if;

        if new.status <> 'starting' or new.finalized_at is not null then
            raise exception 'New sessions must start in starting state';
        end if;

        select * into assignment_row
        from public.assignments
        where id = new.assignment_id
        for update;

        if not found or assignment_row.archived_at is not null then
            raise exception 'Assignment is missing or archived';
        end if;

        if not exists (
            select 1
            from public.profiles
            where profile_key = new.student_id
              and role = 'student'
        ) then
            raise exception 'Session owner must be a student';
        end if;

        if not exists (
            select 1
            from public.personas
            where id = new.persona_id
              and archived_at is null
        ) or not exists (
            select 1
            from public.scenarios
            where id = new.scenario_id
              and archived_at is null
        ) then
            raise exception 'Persona or scenario is missing or archived';
        end if;
    else
        if (
            new.id,
            new.assignment_id,
            new.student_id,
            new.scenario_id,
            new.persona_id,
            new.request_key,
            new.persona_snapshot,
            new.scenario_snapshot,
            new.instruction_version,
            new.created_at
        ) is distinct from (
            old.id,
            old.assignment_id,
            old.student_id,
            old.scenario_id,
            old.persona_id,
            old.request_key,
            old.persona_snapshot,
            old.scenario_snapshot,
            old.instruction_version,
            old.created_at
        ) then
            raise exception 'Session identity and snapshots are immutable';
        end if;

        if old.finalized_at is not null then
            raise exception 'Finalized sessions are immutable';
        end if;

        if old.status in ('ended', 'failed') and new.status <> old.status then
            raise exception 'Terminal sessions cannot be restarted';
        end if;

        if old.status in ('active', 'ending') and new.status = 'starting' then
            raise exception 'Session state cannot return to starting';
        end if;

        if old.status = 'ending' and new.status = 'active' then
            raise exception 'Ending sessions cannot become active';
        end if;
    end if;

    return new;
end;
$$;

create trigger vera_guard_realtime_session
before insert or update on public.realtime_sessions
for each row execute function public.vera_guard_realtime_session();


create function public.vera_guard_transcript_turn()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
    parent_finalized timestamptz;
begin
    if tg_op = 'UPDATE' and (
        new.id,
        new.session_id,
        new.item_id,
        new.content_index,
        new.role
    ) is distinct from (
        old.id,
        old.session_id,
        old.item_id,
        old.content_index,
        old.role
    ) then
        raise exception 'Transcript turn identity is immutable';
    end if;

    select finalized_at into parent_finalized
    from public.realtime_sessions
    where id = new.session_id
    for update;

    if not found then
        raise exception 'Session is missing or deleted';
    end if;

    if parent_finalized is not null then
        raise exception 'Finalized transcripts cannot be overwritten';
    end if;

    new.updated_at = clock_timestamp();

    return new;
end;
$$;

create trigger vera_guard_transcript_turn
before insert or update on public.realtime_transcript_turns
for each row execute function public.vera_guard_transcript_turn();


-- RPC POST /rest/v1/rpc/finalize_realtime_session
-- Body: {"p_session_id":"UUID","p_transcript_complete":true}
-- Returns the existing/new result ID. Retries cannot create duplicate attempts.
-- Pass false for missing transcription or incomplete delivery of final events.
-- Interrupted patient speech remains marked in the saved transcript.

create function public.finalize_realtime_session(
    p_session_id uuid,
    p_transcript_complete boolean default true
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
    session_row public.realtime_sessions%rowtype;
    result_id integer;
    transcript_json jsonb;
    result_outcome text;
begin
    if p_transcript_complete is null then
        raise exception 'Transcript completeness must be specified';
    end if;

    select * into session_row
    from public.realtime_sessions
    where id = p_session_id
    for update;

    if not found then
        raise exception 'Session is missing or deleted';
    end if;

    select id into result_id
    from public.session_results
    where realtime_session_id = p_session_id;

    if found then
        return result_id;
    end if;

    if session_row.status not in ('ended', 'failed') then
        raise exception 'Hang up and end the provider call before finalizing';
    end if;

    if session_row.finalized_at is not null then
        raise exception 'Finalized session is missing its result';
    end if;

    if p_transcript_complete and (
        session_row.status = 'failed'
        or exists (
            select 1
            from public.realtime_transcript_turns
            where session_id = p_session_id
              and status in ('partial', 'failed')
        )
        or not exists (
            select 1
            from public.realtime_transcript_turns
            where session_id = p_session_id
              and role = 'student'
        )
        or not exists (
            select 1
            from public.realtime_transcript_turns
            where session_id = p_session_id
              and role = 'patient'
        )
    ) then
        raise exception 'Cannot mark this transcript complete';
    end if;

    perform 1
    from public.assignments
    where id = session_row.assignment_id
    for update;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', item_id,
                'contentIndex', content_index,
                'role', role,
                'text', text,
                'at', occurred_at,
                'status', status
            )
            order by sequence_no
        ),
        '[]'::jsonb
    )
    into transcript_json
    from public.realtime_transcript_turns
    where session_id = p_session_id;

    result_outcome := case
        when session_row.status = 'failed' then 'failed'
        when p_transcript_complete then 'completed'
        else 'interrupted'
    end;

    insert into public.session_results (
        assignment_id,
        student_id,
        realtime_session_id,
        transcript,
        outcome,
        transcript_complete
    ) values (
        session_row.assignment_id,
        session_row.student_id,
        p_session_id,
        transcript_json,
        result_outcome,
        p_transcript_complete
    )
    returning id into result_id;

    update public.realtime_sessions
    set finalized_at = clock_timestamp(),
        transcript_complete = p_transcript_complete,
        collector_id = null,
        collector_lease_until = null
    where id = p_session_id;

    if result_outcome = 'completed' and not exists (
        select 1
        from public.realtime_sessions
        where assignment_id = session_row.assignment_id
          and status in ('starting', 'active', 'ending')
    ) then
        update public.assignments
        set status = 'completed'
        where id = session_row.assignment_id;
    end if;

    return result_id;
end;
$$;


-- RPC POST /rest/v1/rpc/purge_session_result
-- Body: {"p_result_id":123}
-- Authorize educator/admin ownership in Crow FIRST.
-- Deletes review content, transcript snapshot, canonical turns, usage, and session snapshots.
-- The only Realtime deletion record retained is the content-free session-ID tombstone.
-- Does not contact OpenAI or erase copies already exported by users or held in backups.
-- Backup expiration must be configured separately. No automatic retention TTL is installed.

create function public.purge_session_result(p_result_id integer)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
    target_session uuid;
    target_assignment integer;
    call_status text;
    latest_result public.session_results%rowtype;
begin
    select realtime_session_id, assignment_id
    into target_session, target_assignment
    from public.session_results
    where id = p_result_id;

    if not found then
        return false;
    end if;

    if target_session is not null then
        perform pg_advisory_xact_lock(
            hashtextextended(target_session::text, 0)
        );

        select status into call_status
        from public.realtime_sessions
        where id = target_session
        for update;

        if not found then
            return false;
        end if;

        if call_status not in ('ended', 'failed') then
            raise exception 'End the provider call before deleting its result';
        end if;
    end if;

    perform 1
    from public.assignments
    where id = target_assignment
    for update;

    perform 1
    from public.session_results
    where id = p_result_id
    for update;

    if not found then
        return false;
    end if;

    if target_session is not null then
        insert into public.realtime_deleted_sessions(session_id)
        values (target_session)
        on conflict (session_id) do nothing;
    end if;

    delete from public.session_results
    where id = p_result_id;

    if target_session is not null then
        delete from public.realtime_sessions
        where id = target_session;
    end if;

    if not exists (
        select 1
        from public.realtime_sessions
        where assignment_id = target_assignment
          and status in ('starting', 'active', 'ending')
    ) then
        select * into latest_result
        from public.session_results
        where assignment_id = target_assignment
        order by created_at desc, id desc
        limit 1;

        update public.assignments
        set status = case
            when latest_result.reviewed_at is not null then 'reviewed'
            when latest_result.outcome in ('completed', 'legacy') then 'completed'
            else 'assigned'
        end
        where id = target_assignment;
    end if;

    return true;
end;
$$;


-- Restrict finalization snapshot edits while retaining existing manual results
-- and educator review updates.
-- The SECURITY DEFINER finalizer creates Realtime-linked results.
-- Ordinary backend service-role table inserts cannot forge those linked results.

create function public.vera_guard_session_result()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
    if tg_op = 'INSERT'
       and new.realtime_session_id is not null
       and current_user = 'service_role' then
        raise exception 'Use finalize_realtime_session for Realtime results';
    end if;

    if tg_op = 'UPDATE' then
        if (
            new.id,
            new.assignment_id,
            new.student_id,
            new.realtime_session_id
        ) is distinct from (
            old.id,
            old.assignment_id,
            old.student_id,
            old.realtime_session_id
        ) then
            raise exception 'Result identity is immutable';
        end if;

        if old.realtime_session_id is not null and (
            new.transcript,
            new.outcome,
            new.transcript_complete
        ) is distinct from (
            old.transcript,
            old.outcome,
            old.transcript_complete
        ) then
            raise exception
                'Finalized Realtime transcript snapshots are immutable';
        end if;
    end if;

    return new;
end;
$$;

create trigger vera_guard_session_result
before insert or update on public.session_results
for each row execute function public.vera_guard_session_result();


revoke all on function public.vera_guard_realtime_session()
    from public, anon, authenticated, service_role;

revoke all on function public.vera_guard_transcript_turn()
    from public, anon, authenticated, service_role;

revoke all on function public.vera_guard_session_result()
    from public, anon, authenticated, service_role;

revoke all on function public.finalize_realtime_session(uuid, boolean)
    from public, anon, authenticated, service_role;

revoke all on function public.purge_session_result(integer)
    from public, anon, authenticated, service_role;

grant execute on function public.finalize_realtime_session(uuid, boolean)
    to service_role;

grant execute on function public.purge_session_result(integer)
    to service_role;

-- Only the listed application objects receive privileges.
-- Unrelated Supabase tables are untouched.
-- Database permissions are backend-only. No permissive browser RLS policies exist.

grant usage on schema public to service_role;

notify pgrst, 'reload schema';

commit;
