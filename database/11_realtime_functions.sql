begin;

-- All RPCs below are backend-only. The backend must authenticate the caller and authorize
-- the referenced assignment/result before invoking them. Do not send the secret key to React.
-- Permanent keys, WebRTC offers/answers, and client secrets are not stored by these functions.
-- Backend sequence:
-- 1. Reserve realtime_sessions with assignment identities, approved snapshots, and deadline.
-- 2. Create the provider call; save call_id, started_at, status='active'.
-- 3. Persist transcript turns and deduplicated usage while monitoring the deadline.
-- 4. Hang up OpenAI over HTTPS, then set ended_at, status='ended'/'failed', and end_reason.
-- 5. Drain late transcription for a bounded period; call finalize_realtime_session.
-- 6. Educators use existing GET result APIs. Use purge_session_result for explicit deletion.
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
            select 1 from public.realtime_deleted_sessions where session_id = new.id
        ) then
            raise exception 'This session was explicitly deleted';
        end if;
        if new.status <> 'starting' or new.finalized_at is not null then
            raise exception 'New sessions must start in starting state';
        end if;
        select * into assignment_row
        from public.assignments where id = new.assignment_id for update;
        if not found or assignment_row.archived_at is not null then
            raise exception 'Assignment is missing or archived';
        end if;
        if not exists (
            select 1 from public.profiles
            where profile_key = new.student_id and role = 'student'
        ) then
            raise exception 'Session owner must be a student';
        end if;
        if not exists (
            select 1 from public.personas where id = new.persona_id and archived_at is null
        ) or not exists (
            select 1 from public.scenarios where id = new.scenario_id and archived_at is null
        ) then
            raise exception 'Persona or scenario is missing or archived';
        end if;
    else
        if (new.id, new.assignment_id, new.student_id, new.scenario_id,
            new.persona_id, new.request_key, new.persona_snapshot,
            new.scenario_snapshot, new.instruction_version, new.created_at)
            is distinct from
           (old.id, old.assignment_id, old.student_id, old.scenario_id,
            old.persona_id, old.request_key, old.persona_snapshot,
            old.scenario_snapshot, old.instruction_version, old.created_at) then
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
    if tg_op = 'UPDATE' and
       (new.id, new.session_id, new.item_id, new.content_index, new.role)
       is distinct from
       (old.id, old.session_id, old.item_id, old.content_index, old.role) then
        raise exception 'Transcript turn identity is immutable';
    end if;
    select finalized_at into parent_finalized
    from public.realtime_sessions where id = new.session_id for update;
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
    from public.realtime_sessions where id = p_session_id for update;
    if not found then
        raise exception 'Session is missing or deleted';
    end if;

    select id into result_id from public.session_results
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
            select 1 from public.realtime_transcript_turns
            where session_id = p_session_id and status in ('partial', 'failed')
        )
        or not exists (
            select 1 from public.realtime_transcript_turns
            where session_id = p_session_id and role = 'student'
        )
        or not exists (
            select 1 from public.realtime_transcript_turns
            where session_id = p_session_id and role = 'patient'
        )
    ) then
        raise exception 'Cannot mark this transcript complete';
    end if;

    perform 1 from public.assignments
    where id = session_row.assignment_id for update;

    select coalesce(jsonb_agg(
        jsonb_build_object(
            'id', item_id,
            'contentIndex', content_index,
            'role', role,
            'text', text,
            'at', occurred_at,
            'status', status
        ) order by sequence_no
    ), '[]'::jsonb)
    into transcript_json
    from public.realtime_transcript_turns where session_id = p_session_id;

    result_outcome := case
        when session_row.status = 'failed' then 'failed'
        when p_transcript_complete then 'completed'
        else 'interrupted'
    end;

    insert into public.session_results (
        assignment_id, student_id, realtime_session_id,
        transcript, outcome, transcript_complete
    ) values (
        session_row.assignment_id, session_row.student_id, p_session_id,
        transcript_json, result_outcome, p_transcript_complete
    ) returning id into result_id;

    update public.realtime_sessions
    set finalized_at = clock_timestamp(),
        transcript_complete = p_transcript_complete,
        collector_id = null,
        collector_lease_until = null
    where id = p_session_id;

    if result_outcome = 'completed' and not exists (
        select 1 from public.realtime_sessions
        where assignment_id = session_row.assignment_id
          and status in ('starting', 'active', 'ending')
    ) then
        update public.assignments set status = 'completed'
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
    select realtime_session_id, assignment_id into target_session, target_assignment
    from public.session_results where id = p_result_id;
    if not found then
        return false;
    end if;

    if target_session is not null then
        perform pg_advisory_xact_lock(hashtextextended(target_session::text, 0));
        select status into call_status from public.realtime_sessions
        where id = target_session for update;
        if not found then
            return false;
        end if;
        if call_status not in ('ended', 'failed') then
            raise exception 'End the provider call before deleting its result';
        end if;
    end if;

    perform 1 from public.assignments where id = target_assignment for update;
    perform 1 from public.session_results where id = p_result_id for update;
    if not found then
        return false;
    end if;

    if target_session is not null then
        insert into public.realtime_deleted_sessions(session_id)
        values (target_session) on conflict (session_id) do nothing;
    end if;
    delete from public.session_results where id = p_result_id;
    if target_session is not null then
        delete from public.realtime_sessions where id = target_session;
    end if;

    if not exists (
        select 1 from public.realtime_sessions
        where assignment_id = target_assignment
          and status in ('starting', 'active', 'ending')
    ) then
        select * into latest_result from public.session_results
        where assignment_id = target_assignment order by created_at desc, id desc limit 1;
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

-- Restrict finalization snapshot edits while retaining existing manual results and review updates.
-- The guard allows only the schema owner (the SECURITY DEFINER finalizer) to create
-- Realtime-linked results. Ordinary backend service-role table inserts cannot forge them.
create function public.vera_guard_session_result()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
    if tg_op = 'INSERT' and new.realtime_session_id is not null
       and current_user = 'service_role' then
        raise exception 'Use finalize_realtime_session for Realtime results';
    end if;
    if tg_op = 'UPDATE' then
        if (new.id, new.assignment_id, new.student_id, new.realtime_session_id)
            is distinct from
           (old.id, old.assignment_id, old.student_id, old.realtime_session_id) then
            raise exception 'Result identity is immutable';
        end if;
        if old.realtime_session_id is not null and
           (new.transcript, new.outcome, new.transcript_complete)
           is distinct from
           (old.transcript, old.outcome, old.transcript_complete) then
            raise exception 'Finalized Realtime transcript snapshots are immutable';
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
grant execute on function public.finalize_realtime_session(uuid, boolean) to service_role;
grant execute on function public.purge_session_result(integer) to service_role;

-- Only the listed application objects receive privileges; unrelated Supabase tables are untouched.
-- Database permissions are deliberately backend-only. No permissive browser RLS policies exist.
grant usage on schema public to service_role;
notify pgrst, 'reload schema';

commit;

