begin;

alter table public.realtime_sessions
    add column collector_generation bigint not null default 0,
    add column collection_gap boolean not null default false,
    add column ordering_complete boolean not null default false,
    add column collection_closed_at timestamptz,
    add column stop_requested_at timestamptz,
    add column collected_event_count bigint not null default 0;

alter table public.realtime_usage
    alter column estimated_cost_usd drop not null,
    add column response_status text,
    add column usage_ready boolean not null default false;

alter table public.realtime_transcript_turns
    add column audio_end_ms integer check (audio_end_ms >= 0),
    add column context_deleted boolean not null default false,
    add column timestamp_source text not null default 'received'
        check (timestamp_source in ('received', 'provider')),
    drop constraint realtime_transcript_turns_session_id_sequence_no_key,
    add constraint realtime_transcript_turns_session_id_sequence_no_key
        unique (session_id, sequence_no) deferrable initially deferred;

create table public.realtime_collected_events (
    session_id uuid not null
        references public.realtime_sessions(id) on delete cascade,
    event_id text not null check (length(event_id) between 1 and 256),
    event_type text not null check (length(event_type) between 1 and 128),
    received_at timestamptz not null default clock_timestamp(),
    primary key (session_id, event_id)
);

create table public.realtime_conversation_items (
    session_id uuid not null
        references public.realtime_sessions(id) on delete cascade,
    item_id text not null check (length(item_id) between 1 and 256),
    previous_item_id text,
    previous_known boolean not null default false,
    first_seen integer not null,
    role text check (role in ('student', 'patient')),
    response_id text,
    context_deleted boolean not null default false,
    primary key (session_id, item_id),
    unique (session_id, first_seen)
);

alter table public.realtime_collected_events enable row level security;
alter table public.realtime_conversation_items enable row level security;

revoke all on public.realtime_collected_events,
    public.realtime_conversation_items
from public, anon, authenticated, service_role;

grant select on public.realtime_collected_events,
    public.realtime_conversation_items
to service_role;

-- Canonical writes must pass through the lease-checked RPC.
revoke insert, update on public.realtime_transcript_turns,
    public.realtime_usage
from service_role;

create function public.vera_claim_collector(p_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
    r public.realtime_sessions%rowtype;
    owner_id uuid;
begin
    select * into r
    from public.realtime_sessions
    where id = p_session
    for update;

    if not found
       or r.finalized_at is not null
       or r.collection_closed_at is not null
       or r.status not in ('starting', 'active', 'ending')
       or r.call_id is null then
        return jsonb_build_object('acquired', false);
    end if;

    if r.collector_lease_until > clock_timestamp() then
        return jsonb_build_object('acquired', false);
    end if;

    owner_id := gen_random_uuid();

    update public.realtime_sessions
    set collector_id = owner_id,
        collector_lease_until = clock_timestamp() + interval '90 seconds',
        collector_generation = collector_generation + 1,
        collection_gap =
            collection_gap or collector_generation > 0 or status <> 'starting'
    where id = p_session
    returning * into r;

    return jsonb_build_object(
        'acquired', true,
        'owner', owner_id,
        'sessionId', r.id,
        'callId', r.call_id,
        'studentId', r.student_id,
        'assignmentId', r.assignment_id,
        'requestKey', r.request_key,
        'deadlineEpoch', extract(epoch from r.deadline_at),
        'instructions', r.scenario_snapshot->>'instructions',
        'status', r.status,
        'gap', r.collection_gap,
        'stop', r.stop_requested_at is not null
    );
end;
$$;

create function public.vera_collector_heartbeat(
    p_session uuid,
    p_owner uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
    r public.realtime_sessions%rowtype;
begin
    select * into r
    from public.realtime_sessions
    where id = p_session
    for update;

    if not found
       or r.collector_id is distinct from p_owner
       or r.collector_lease_until is null
       or r.collector_lease_until <= clock_timestamp()
       or r.finalized_at is not null
       or r.collection_closed_at is not null then
        return jsonb_build_object('owned', false);
    end if;

    update public.realtime_sessions
    set collector_lease_until = clock_timestamp() + interval '90 seconds'
    where id = p_session;

    return jsonb_build_object(
        'owned', true,
        'stop', r.stop_requested_at is not null
    );
end;
$$;

create function public.vera_recoverable_collectors()
returns jsonb
language sql
security definer
set search_path = pg_catalog
as $$
    select coalesce(jsonb_agg(id), '[]'::jsonb)
    from (
        select id
        from public.realtime_sessions
        where status in ('starting', 'active', 'ending')
          and call_id is not null
          and finalized_at is null
          and collection_closed_at is null
          and (
              collector_lease_until is null
              or collector_lease_until <= clock_timestamp()
          )
          and created_at < clock_timestamp() - interval '30 seconds'
        order by deadline_at
        limit 5
    ) candidates;
$$;

create function public.vera_request_realtime_stop(p_session uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
    update public.realtime_sessions
    set stop_requested_at =
        coalesce(stop_requested_at, clock_timestamp())
    where id = p_session
      and status in ('starting', 'active', 'ending');

    return found;
end;
$$;

-- Private helper. The caller holds the parent session lock.
create function public.vera_collect_node(
    p_session uuid,
    p_item text,
    p_role text default null,
    p_known boolean default false,
    p_previous text default null,
    p_response text default null
)
returns void
language plpgsql
set search_path = pg_catalog
as $$
begin
    if p_item is null or length(p_item) not between 1 and 256 then
        raise exception 'Invalid item identifier';
    end if;

    insert into public.realtime_conversation_items(
        session_id, item_id, first_seen, role,
        previous_known, previous_item_id, response_id
    )
    select p_session, p_item, coalesce(max(first_seen), -1) + 1,
           p_role, p_known, p_previous, p_response
    from public.realtime_conversation_items
    where session_id = p_session
    on conflict (session_id, item_id) do update
    set role = coalesce(
            realtime_conversation_items.role, excluded.role
        ),
        previous_known =
            realtime_conversation_items.previous_known
            or excluded.previous_known,
        previous_item_id =
            case when excluded.previous_known
                then excluded.previous_item_id
                else realtime_conversation_items.previous_item_id
            end,
        response_id = coalesce(
            excluded.response_id,
            realtime_conversation_items.response_id
        );

    if p_role is not null and exists (
        select 1
        from public.realtime_conversation_items
        where session_id = p_session
          and item_id = p_item
          and role <> p_role
    ) then
        raise exception 'Conflicting item role';
    end if;

    if p_response is not null then
        update public.realtime_transcript_turns
        set response_id = p_response
        where session_id = p_session
          and item_id = p_item
          and response_id is null;
    end if;
end;
$$;

create function public.vera_collect_turn(
    p_session uuid,
    p_item text,
    p_role text,
    p_index integer,
    p_text text,
    p_append boolean,
    p_status text,
    p_response text default null,
    p_audio_end integer default null
)
returns void
language plpgsql
set search_path = pg_catalog
as $$
declare
    response_key text;
    response_state text;
    effective_status text := p_status;
    deleted boolean;
begin
    if p_index is null
       or p_index not between 0 and 63
       or octet_length(coalesce(p_text, '')) > 262144 then
        raise exception 'Invalid transcript part';
    end if;

    perform public.vera_collect_node(
        p_session, p_item, p_role, false, null, p_response
    );

    select response_id, context_deleted
    into response_key, deleted
    from public.realtime_conversation_items
    where session_id = p_session and item_id = p_item;

    if response_key is not null then
        insert into public.realtime_usage(
            session_id, kind, provider_id, model, usage, pricing,
            estimated_cost_usd, response_status, usage_ready
        )
        select id, 'response', response_key, model, '{}'::jsonb,
               '{"status":"unpriced"}'::jsonb,
               null, 'in_progress', false
        from public.realtime_sessions
        where id = p_session
        on conflict (session_id, kind, provider_id) do nothing;

        select response_status into response_state
        from public.realtime_usage
        where session_id = p_session
          and kind = 'response'
          and provider_id = response_key;

        if response_state in ('cancelled', 'incomplete') then
            effective_status := 'interrupted';
        end if;

        if response_state = 'failed' then
            effective_status := 'failed';
        end if;
    end if;

    insert into public.realtime_transcript_turns(
        session_id, item_id, role, content_index, sequence_no, text,
        status, response_id, audio_end_ms, context_deleted
    )
    select p_session, p_item, p_role, p_index,
           coalesce(max(sequence_no), -1) + 1,
           coalesce(p_text, ''), effective_status,
           response_key, p_audio_end, deleted
    from public.realtime_transcript_turns
    where session_id = p_session
    on conflict (session_id, item_id, content_index) do update
    set text =
        case
            when p_text is null then realtime_transcript_turns.text
            when p_append then
                case when realtime_transcript_turns.status = 'partial'
                    then realtime_transcript_turns.text || p_text
                    else realtime_transcript_turns.text
                end
            when p_status = 'partial'
                 and realtime_transcript_turns.status <> 'partial'
                then realtime_transcript_turns.text
            else p_text
        end,
        status =
        case
            when realtime_transcript_turns.status = 'failed'
                 or effective_status = 'failed' then 'failed'
            when realtime_transcript_turns.status = 'interrupted'
                 or effective_status = 'interrupted' then 'interrupted'
            when realtime_transcript_turns.status = 'completed'
                 or effective_status = 'completed' then 'completed'
            else 'partial'
        end,
        response_id = coalesce(
            response_key, realtime_transcript_turns.response_id
        ),
        audio_end_ms =
        case
            when p_audio_end is null
                then realtime_transcript_turns.audio_end_ms
            else least(
                coalesce(realtime_transcript_turns.audio_end_ms, p_audio_end),
                p_audio_end
            )
        end,
        context_deleted =
            realtime_transcript_turns.context_deleted or deleted;
end;
$$;

create function public.vera_collect_item(
    p_session uuid,
    p_item jsonb,
    p_known boolean,
    p_previous text,
    p_response text,
    p_final boolean
)
returns void
language plpgsql
set search_path = pg_catalog
as $$
declare
    role_name text;
    part jsonb;
    part_index integer := 0;
    response_key text;
begin
    role_name :=
        case p_item->>'role'
            when 'user' then 'student'
            when 'assistant' then 'patient'
            else null
        end;

    perform public.vera_collect_node(
        p_session, p_item->>'id', role_name,
        p_known, p_previous, p_response
    );

    select response_id into response_key
    from public.realtime_conversation_items
    where session_id = p_session
      and item_id = p_item->>'id';

    if role_name is null
       or (role_name = 'patient' and response_key is null) then
        return;
    end if;

    for part in
        select value
        from jsonb_array_elements(coalesce(p_item->'content', '[]'::jsonb))
    loop
        if role_name = 'student'
           and part->>'type' in ('input_audio', 'audio') then
            perform public.vera_collect_turn(
                p_session, p_item->>'id', role_name,
                part_index, null, false, 'partial'
            );

        elsif role_name = 'student'
              and part->>'type' in ('input_text', 'text') then
            perform public.vera_collect_turn(
                p_session, p_item->>'id', role_name,
                part_index, coalesce(part->>'text', ''),
                false, 'completed'
            );

        elsif role_name = 'patient'
              and part->>'type' in (
                  'output_audio', 'audio', 'output_text', 'text'
              ) then
            perform public.vera_collect_turn(
                p_session, p_item->>'id', role_name,
                part_index,
                coalesce(part->>'transcript', part->>'text'),
                false,
                case when p_final then 'completed' else 'partial' end,
                response_key
            );
        end if;

        part_index := part_index + 1;
    end loop;
end;
$$;

create function public.vera_order_collected_turns(p_session uuid)
returns void
language plpgsql
set search_path = pg_catalog
as $$
declare
    node_count integer;
    reached integer;
    roots integer;
    forks boolean;
begin
    select count(*),
           count(*) filter (
               where previous_known and previous_item_id is null
           )
    into node_count, roots
    from public.realtime_conversation_items
    where session_id = p_session;

    if node_count > 2048 then
        raise exception 'Conversation item limit exceeded';
    end if;

    select exists (
        select previous_item_id
        from public.realtime_conversation_items
        where session_id = p_session
          and previous_known
          and previous_item_id is not null
        group by previous_item_id
        having count(*) > 1
    ) into forks;

    with recursive walk as (
        select item_id,
               array[item_id] as visited,
               array[first_seen] as path
        from public.realtime_conversation_items
        where session_id = p_session
          and previous_known
          and previous_item_id is null

        union all

        select child.item_id,
               walk.visited || child.item_id,
               walk.path || child.first_seen
        from walk
        join public.realtime_conversation_items child
          on child.session_id = p_session
         and child.previous_known
         and child.previous_item_id = walk.item_id
        where not child.item_id = any(walk.visited)
    ), ranked as (
        select t.id,
               n.previous_item_id,
               row_number() over (
                   order by walk.path nulls last,
                            n.first_seen,
                            t.content_index
               ) - 1 as seq
        from public.realtime_transcript_turns t
        join public.realtime_conversation_items n
          on n.session_id = t.session_id
         and n.item_id = t.item_id
        left join walk on walk.item_id = t.item_id
        where t.session_id = p_session
    ), reordered as (
        update public.realtime_transcript_turns t
        set sequence_no = ranked.seq,
            previous_item_id = ranked.previous_item_id
        from ranked
        where t.id = ranked.id
        returning t.id
    )
    select count(*) into reached from walk;

    update public.realtime_sessions
    set ordering_complete =
        node_count = 0
        or (roots = 1 and reached = node_count and not forks)
    where id = p_session;
end;
$$;

create function public.vera_collect_events(
    p_session uuid,
    p_owner uuid,
    p_events jsonb,
    p_gap boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
    r public.realtime_sessions%rowtype;
    e jsonb;
    event_name text;
    index_no integer;
    item jsonb;
    part jsonb;
    response jsonb;
    counters jsonb;
    response_state text;
    inserted integer;
begin
    select * into r
    from public.realtime_sessions
    where id = p_session
    for update;

    if not found
       or r.collector_id is distinct from p_owner
       or r.collector_lease_until is null
       or r.collector_lease_until <= clock_timestamp()
       or r.finalized_at is not null
       or r.collection_closed_at is not null then
        return false;
    end if;

    if jsonb_typeof(p_events) is distinct from 'array'
       or jsonb_array_length(p_events) > 16
       or octet_length(p_events::text) > 2097152 then
        raise exception 'Invalid collector batch';
    end if;

    update public.realtime_sessions
    set collection_gap = collection_gap or coalesce(p_gap, true)
    where id = p_session;

    for e in select value from jsonb_array_elements(p_events)
    loop
        event_name := e->>'type';

        if jsonb_typeof(e) <> 'object'
           or e->>'event_id' is null
           or event_name is null then
            raise exception 'Invalid collector event';
        end if;

        insert into public.realtime_collected_events(
            session_id, event_id, event_type
        )
        values (p_session, e->>'event_id', event_name)
        on conflict (session_id, event_id) do nothing;

        get diagnostics inserted = row_count;
        if inserted = 0 then
            continue;
        end if;

        update public.realtime_sessions
        set collected_event_count = collected_event_count + 1
        where id = p_session;

        index_no := coalesce((e->>'content_index')::integer, 0);

        if event_name in (
            'conversation.item.added',
            'conversation.item.created',
            'conversation.item.done'
        ) then
            perform public.vera_collect_item(
                p_session, e->'item',
                e ? 'previous_item_id', e->>'previous_item_id',
                null, event_name = 'conversation.item.done'
            );

        elsif event_name = 'input_audio_buffer.committed' then
            perform public.vera_collect_node(
                p_session, e->>'item_id', 'student',
                e ? 'previous_item_id', e->>'previous_item_id'
            );
            perform public.vera_collect_turn(
                p_session, e->>'item_id', 'student',
                0, null, false, 'partial'
            );

        elsif event_name in (
            'response.output_item.added',
            'response.output_item.done'
        ) then
            perform public.vera_collect_item(
                p_session, e->'item', false, null,
                e->>'response_id',
                event_name = 'response.output_item.done'
            );

        elsif event_name in (
            'response.content_part.added',
            'response.content_part.done'
        ) then
            part := e->'part';

            if part->>'type' in (
                'audio', 'output_audio', 'text', 'output_text'
            ) then
                perform public.vera_collect_turn(
                    p_session, e->>'item_id', 'patient', index_no,
                    coalesce(part->>'transcript', part->>'text'),
                    false,
                    case
                        when event_name = 'response.content_part.done'
                            then 'completed'
                        else 'partial'
                    end,
                    e->>'response_id'
                );
            end if;

        elsif event_name in (
            'response.output_audio_transcript.delta',
            'response.output_text.delta',
            'response.output_audio_transcript.done',
            'response.output_text.done'
        ) then
            perform public.vera_collect_turn(
                p_session, e->>'item_id', 'patient', index_no,
                coalesce(e->>'transcript', e->>'text', e->>'delta'),
                right(event_name, 6) = '.delta',
                case
                    when right(event_name, 5) = '.done' then 'completed'
                    else 'partial'
                end,
                e->>'response_id'
            );

        elsif event_name in (
            'conversation.item.input_audio_transcription.delta',
            'conversation.item.input_audio_transcription.completed',
            'conversation.item.input_audio_transcription.failed'
        ) then
            perform public.vera_collect_turn(
                p_session, e->>'item_id', 'student', index_no,
                coalesce(e->>'transcript', e->>'delta'),
                right(event_name, 6) = '.delta',
                case
                    when right(event_name, 7) = '.failed' then 'failed'
                    when right(event_name, 10) = '.completed'
                        then 'completed'
                    else 'partial'
                end
            );

            if right(event_name, 10) = '.completed' then
                counters := coalesce(e->'usage', '{}'::jsonb);

                insert into public.realtime_usage(
                    session_id, kind, provider_id, model, usage,
                    pricing, estimated_cost_usd, usage_ready
                )
                values (
                    p_session,
                    'input_transcription',
                    (e->>'item_id') || ':' || index_no,
                    'unknown',
                    counters,
                    '{"status":"unpriced"}'::jsonb,
                    null,
                    (
                        counters ? 'input_tokens'
                        and counters ? 'output_tokens'
                    ) or counters ? 'seconds'
                )
                on conflict (session_id, kind, provider_id) do update
                set usage = excluded.usage,
                    usage_ready = excluded.usage_ready,
                    pricing = excluded.pricing,
                    estimated_cost_usd = null;
            end if;

        elsif event_name in ('response.created', 'response.done') then
            response := e->'response';
            response_state :=
                coalesce(response->>'status', 'in_progress');
            counters := coalesce(response->'usage', '{}'::jsonb);

            insert into public.realtime_usage(
                session_id, kind, provider_id, model, usage, pricing,
                estimated_cost_usd, response_status, usage_ready
            )
            values (
                p_session,
                'response',
                response->>'id',
                r.model,
                counters,
                '{"status":"unpriced"}'::jsonb,
                null,
                response_state,
                event_name = 'response.done'
                    and counters ? 'input_tokens'
                    and counters ? 'output_tokens'
            )
            on conflict (session_id, kind, provider_id) do update
            set usage = excluded.usage,
                response_status = excluded.response_status,
                usage_ready = excluded.usage_ready,
                pricing = excluded.pricing,
                estimated_cost_usd = null
            where event_name = 'response.done';

            if event_name = 'response.done' then
                if response->>'conversation_id' is not null then
                    for item in
                        select value
                        from jsonb_array_elements(
                            coalesce(response->'output', '[]'::jsonb)
                        )
                    loop
                        perform public.vera_collect_item(
                            p_session, item, false, null,
                            response->>'id', true
                        );
                    end loop;
                end if;

                if response_state in (
                    'cancelled', 'incomplete', 'failed'
                ) then
                    update public.realtime_transcript_turns
                    set status =
                        case when response_state = 'failed'
                            then 'failed'
                            else 'interrupted'
                        end
                    where session_id = p_session
                      and response_id = response->>'id'
                      and status <> 'failed';
                end if;
            end if;

        elsif event_name = 'conversation.item.truncated' then
            perform public.vera_collect_turn(
                p_session, e->>'item_id', 'patient', index_no,
                null, false, 'interrupted', null,
                (e->>'audio_end_ms')::integer
            );

        elsif event_name = 'conversation.item.deleted' then
            perform public.vera_collect_node(
                p_session, e->>'item_id'
            );

            update public.realtime_conversation_items
            set context_deleted = true
            where session_id = p_session
              and item_id = e->>'item_id';

            update public.realtime_transcript_turns
            set context_deleted = true
            where session_id = p_session
              and item_id = e->>'item_id';

        else
            raise exception 'Unsupported collected event';
        end if;
    end loop;

    if (
        select collected_event_count > 50000
        from public.realtime_sessions
        where id = p_session
    ) or (
        select count(*) > 2048
            or coalesce(sum(octet_length(text)), 0) > 2097152
        from public.realtime_transcript_turns
        where session_id = p_session
    ) then
        raise exception 'Collection limit exceeded';
    end if;

    perform public.vera_order_collected_turns(p_session);
    return true;
end;
$$;

create function public.vera_finish_collection(
    p_session uuid,
    p_owner uuid,
    p_status text,
    p_reason text,
    p_gap boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
    r public.realtime_sessions%rowtype;
begin
    select * into r
    from public.realtime_sessions
    where id = p_session
    for update;

    if not found then
        return false;
    end if;

    if r.collection_closed_at is not null
       and r.status in ('ended', 'failed') then
        return true;
    end if;

    if r.collector_id is distinct from p_owner
       or r.collector_lease_until is null
       or r.collector_lease_until <= clock_timestamp()
       or r.finalized_at is not null then
        return false;
    end if;

    if p_status is null
       or p_status not in ('ended', 'failed')
       or p_reason is null
       or p_reason not in (
           'client_end', 'deadline', 'server_shutdown',
           'monitor_lost', 'setup_failed'
       ) then
        raise exception 'Invalid collection termination';
    end if;

    -- Backend invokes this only after confirmed provider hangup.
    update public.realtime_sessions
    set status = p_status,
        ended_at = greatest(
            clock_timestamp(), coalesce(started_at, created_at)
        ),
        end_reason = p_reason,
        collection_closed_at = clock_timestamp(),
        collection_gap =
            collection_gap
            or coalesce(p_gap, true)
            or not ordering_complete
            or exists (
                select 1
                from public.realtime_transcript_turns
                where session_id = p_session
                  and status in ('partial', 'failed')
            )
            or exists (
                select 1
                from public.realtime_usage
                where session_id = p_session
                  and not usage_ready
            ),
        collector_id = null,
        collector_lease_until = null
    where id = p_session;

    return true;
end;
$$;

create function public.vera_guard_collection_completion()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
    if old.collection_gap and not new.collection_gap then
        raise exception 'A recorded collection gap cannot be cleared';
    end if;

    if new.transcript_complete and (
        new.collection_gap
        or not new.ordering_complete
        or new.collection_closed_at is null
    ) then
        raise exception 'Collection is incomplete';
    end if;

    return new;
end;
$$;

create trigger vera_guard_collection_completion
before update on public.realtime_sessions
for each row execute function public.vera_guard_collection_completion();

revoke all on function
    public.vera_claim_collector(uuid),
    public.vera_collector_heartbeat(uuid, uuid),
    public.vera_recoverable_collectors(),
    public.vera_request_realtime_stop(uuid),
    public.vera_collect_node(uuid, text, text, boolean, text, text),
    public.vera_collect_turn(
        uuid, text, text, integer, text, boolean, text, text, integer
    ),
    public.vera_collect_item(uuid, jsonb, boolean, text, text, boolean),
    public.vera_order_collected_turns(uuid),
    public.vera_collect_events(uuid, uuid, jsonb, boolean),
    public.vera_finish_collection(uuid, uuid, text, text, boolean),
    public.vera_guard_collection_completion()
from public, anon, authenticated, service_role;

grant execute on function
    public.vera_claim_collector(uuid),
    public.vera_collector_heartbeat(uuid, uuid),
    public.vera_recoverable_collectors(),
    public.vera_request_realtime_stop(uuid),
    public.vera_collect_events(uuid, uuid, jsonb, boolean),
    public.vera_finish_collection(uuid, uuid, text, text, boolean)
to service_role;

notify pgrst, 'reload schema';

commit;