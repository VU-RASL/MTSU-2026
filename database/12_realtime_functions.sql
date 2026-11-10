begin;

create or replace function public.vera_reserve_realtime(
    p_student text, p_assignment integer, p_request uuid,
    p_model text, p_voice text, p_version text,
    p_persona jsonb, p_scenario jsonb
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog
as $$
declare
    a public.assignments%rowtype;
    r public.realtime_sessions%rowtype;
begin
    perform pg_advisory_xact_lock(hashtextextended(p_student, 505));

    select * into r from public.realtime_sessions
    where student_id = p_student and request_key = p_request;

    if found then
        if r.assignment_id <> p_assignment then
            return jsonb_build_object(
                'code', 409,
                'error', 'Request key belongs to another assignment'
            );
        end if;

        return jsonb_build_object(
            'code', 200,
            'created', false,
            'session', to_jsonb(r),
            'deadline_epoch', extract(epoch from r.deadline_at)
        );
    end if;

    select * into a
    from public.assignments
    where id = p_assignment
    for update;

    if not found or a.student_id <> p_student or a.archived_at is not null then
        return jsonb_build_object(
            'code', 403,
            'error', 'Assignment is not available'
        );
    end if;

    if exists (
        select 1 from public.realtime_sessions
        where student_id = p_student
          and status in ('starting', 'active', 'ending')
    ) then
        return jsonb_build_object(
            'code', 409,
            'error', 'Student already has an unfinished session'
        );
    end if;

    if a.persona_id is null
       or (p_persona #>> '{source,id}') is distinct from a.persona_id::text
       or (p_scenario #>> '{source,id}') is distinct from a.scenario_id::text
       or (p_scenario ->> 'instructionVersion') is distinct from p_version
       or jsonb_typeof(p_scenario -> 'instructions') is distinct from 'string'
       or octet_length(p_scenario ->> 'instructions') not between 1 and 32768
       or octet_length(p_persona::text) > 262144
       or octet_length(p_scenario::text) > 262144 then
        return jsonb_build_object(
            'code', 409,
            'error', 'Instruction snapshots are invalid'
        );
    end if;

    insert into public.realtime_sessions (
        assignment_id, student_id, scenario_id, persona_id, request_key,
        model, voice, instruction_version, persona_snapshot, scenario_snapshot,
        deadline_at, max_output_tokens
    ) values (
        a.id, p_student, a.scenario_id, a.persona_id, p_request,
        p_model, p_voice, p_version, p_persona, p_scenario,
        clock_timestamp() + interval '10 minutes', 1024
    )
    returning * into r;

    return jsonb_build_object(
        'code', 201,
        'created', true,
        'session', to_jsonb(r),
        'deadline_epoch', extract(epoch from r.deadline_at)
    );
end;
$$;

create or replace function public.vera_change_realtime_setup(
    p_id uuid,
    p_call text,
    p_action text,
    p_reason text default null
) returns boolean
language plpgsql security definer
set search_path = pg_catalog
as $$
declare
    r public.realtime_sessions%rowtype;
begin
    select * into r
    from public.realtime_sessions
    where id = p_id
    for update;

    if not found then
        return false;
    end if;

    if r.call_id is not null and r.call_id is distinct from p_call then
        return false;
    end if;

    if p_action = 'bind' then
        if r.status <> 'starting' or p_call is null then
            return false;
        end if;

        update public.realtime_sessions
        set call_id = p_call
        where id = p_id;

    elsif p_action = 'activate' then
        if r.status <> 'starting'
           or r.call_id is null
           or r.deadline_at <= clock_timestamp() then
            return false;
        end if;

        update public.realtime_sessions
        set status = 'active',
            started_at = clock_timestamp()
        where id = p_id;

    elsif p_action in ('failed', 'ended') then
        if r.status in ('failed', 'ended') then
            return true;
        end if;

        if p_reason not in (
            'setup_failed', 'client_end', 'deadline',
            'monitor_lost', 'server_shutdown'
        ) or p_reason is null then
            return false;
        end if;

        update public.realtime_sessions
        set status = p_action,
            call_id = coalesce(call_id, p_call),
            ended_at = greatest(
                clock_timestamp(),
                coalesce(started_at, created_at)
            ),
            end_reason = p_reason,
            collector_id = null,
            collector_lease_until = null
        where id = p_id;

    else
        return false;
    end if;

    return true;
end;
$$;

revoke all on function public.vera_reserve_realtime(
    text, integer, uuid, text, text, text, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.vera_reserve_realtime(
    text, integer, uuid, text, text, text, jsonb, jsonb
) to service_role;

revoke all on function public.vera_change_realtime_setup(
    uuid, text, text, text
) from public, anon, authenticated;

grant execute on function public.vera_change_realtime_setup(
    uuid, text, text, text
) to service_role;

commit;

notify pgrst, 'reload schema';