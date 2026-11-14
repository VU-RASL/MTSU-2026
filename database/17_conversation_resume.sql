begin;

-- Pause / Resume / Rewind for voice conversations.
--
-- Resume and rewind both start a NEW voice call that continues an existing
-- practice attempt (conversation) from one of its lines:
--   resume -> from the attempt's bookmark (where the student left off)
--   rewind -> from an earlier line the student clicked; their next line
--             becomes a new branch. Nothing is deleted.
-- The backend gives the AI that branch's lines as "conversation so far",
-- so the patient remembers exactly what is on that branch and nothing else.
--
-- Requires 15_conversation_tree.sql.

-- The lines on the path from the top of the tree down to one line, oldest
-- first, for the AI's "conversation so far". Run before a resume/rewind call
-- starts. Returns {"code": ...}:
--   "ok"        -> also "startNodeId" and "lines": [{sender, text}, ...]
--   "saving"    -> the previous call is still being saved; retry shortly
--   "not_found" -> no such attempt for this student and assignment
--   "bad_line"  -> that line isn't in this attempt
create function public.vera_conversation_history(
    p_conversation uuid,
    p_from_node uuid,
    p_student text,
    p_assignment integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
    c public.conversations%rowtype;
    start_node uuid;
    path jsonb;
begin
    select * into c
    from public.conversations
    where id = p_conversation
      and student_id = p_student
      and assignment_id = p_assignment;

    if not found then
        return jsonb_build_object('code', 'not_found');
    end if;

    -- copy any finished calls into the tree first
    perform public.vera_build_conversation_nodes(cs.session_id)
    from public.conversation_sessions cs
    where cs.conversation_id = c.id and cs.built_at is null;

    if exists (
        select 1 from public.conversation_sessions
        where conversation_id = c.id and built_at is null
    ) then
        return jsonb_build_object('code', 'saving');
    end if;

    select active_node_id into c.active_node_id
    from public.conversations where id = c.id;

    start_node := coalesce(p_from_node, c.active_node_id);

    if not exists (
        select 1 from public.dialogue_nodes
        where id = start_node and conversation_id = c.id
    ) then
        return jsonb_build_object('code', 'bad_line');
    end if;

    with recursive up as (
        select id, parent_id, sender, text, 0 as depth
        from public.dialogue_nodes
        where id = start_node
        union all
        select n.id, n.parent_id, n.sender, n.text, up.depth + 1
        from public.dialogue_nodes n
        join up on n.id = up.parent_id
        where up.depth < 10000
    )
    select coalesce(
        jsonb_agg(
            jsonb_build_object('sender', sender, 'text', text)
            order by depth desc
        ),
        '[]'::jsonb
    ) into path
    from up
    where sender <> 'system';

    return jsonb_build_object(
        'code', 'ok',
        'startNodeId', start_node,
        'lines', path
    );
end;
$$;

-- Same as in 15_conversation_tree.sql, with two changes for continuing an
-- attempt: refuse while an earlier call is still being saved (otherwise its
-- lines could land on the wrong branch), and reopen a completed attempt
-- (pressing End again completes it again).
create or replace function public.vera_attach_conversation(
    p_session uuid,
    p_conversation uuid default null,
    p_from_node uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
    s public.realtime_sessions%rowtype;
    c public.conversations%rowtype;
    link public.conversation_sessions%rowtype;
    start_node uuid;
begin
    select * into s
    from public.realtime_sessions
    where id = p_session
    for update;

    if not found then
        raise exception 'Session not found';
    end if;

    select * into link
    from public.conversation_sessions
    where session_id = p_session;

    if found then
        return jsonb_build_object(
            'conversationId', link.conversation_id,
            'startNodeId', link.start_node_id
        );
    end if;

    if s.status in ('ended', 'failed') then
        raise exception 'Session already ended';
    end if;

    if p_conversation is null then
        if p_from_node is not null then
            raise exception 'A starting line needs its conversation';
        end if;

        insert into public.conversations (assignment_id, student_id)
        values (s.assignment_id, s.student_id)
        returning * into c;

        insert into public.dialogue_nodes (
            conversation_id, parent_id, sender, text, created_at
        ) values (
            c.id, null, 'system', 'Conversation started', c.created_at
        ) returning id into start_node;

        update public.conversations
        set root_node_id = start_node,
            active_node_id = start_node
        where id = c.id;
    else
        select * into c
        from public.conversations
        where id = p_conversation
        for update;

        if not found
           or c.assignment_id <> s.assignment_id
           or c.student_id <> s.student_id then
            raise exception 'Conversation does not belong to this assignment';
        end if;

        perform public.vera_build_conversation_nodes(cs.session_id)
        from public.conversation_sessions cs
        where cs.conversation_id = c.id and cs.built_at is null;

        if exists (
            select 1 from public.conversation_sessions
            where conversation_id = c.id and built_at is null
        ) then
            raise exception 'Previous call is still being saved';
        end if;

        select active_node_id into c.active_node_id
        from public.conversations where id = c.id;

        start_node := coalesce(p_from_node, c.active_node_id);

        if not exists (
            select 1 from public.dialogue_nodes
            where id = start_node and conversation_id = c.id
        ) then
            raise exception 'Starting line is not in this conversation';
        end if;

        update public.conversations
        set active_node_id = start_node,
            status = 'in_progress',
            completed_at = null,
            updated_at = clock_timestamp()
        where id = c.id;
    end if;

    insert into public.conversation_sessions (
        session_id, conversation_id, start_node_id
    ) values (
        p_session, c.id, start_node
    );

    return jsonb_build_object(
        'conversationId', c.id,
        'startNodeId', start_node
    );
end;
$$;

-- Same as in 15_conversation_tree.sql, with one fix: a call that failed
-- before it ever connected (no call_id) has nothing to collect, so the
-- collector never "closes" it. Treat it as done with no lines; otherwise
-- the attempt would wait on it forever.
create or replace function public.vera_build_conversation_nodes(p_session uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
    link public.conversation_sessions%rowtype;
    s public.realtime_sessions%rowtype;
    turn record;
    previous uuid;
    added uuid;
begin
    select * into link
    from public.conversation_sessions
    where session_id = p_session
    for update;

    if not found then
        return false;
    end if;
    if link.built_at is not null then
        return true;
    end if;

    select * into s
    from public.realtime_sessions
    where id = p_session;

    if not found or s.status not in ('ended', 'failed') then
        return false;
    end if;
    if s.collection_closed_at is null
       and not (s.status = 'failed' and s.call_id is null) then
        return false;
    end if;

    perform 1 from public.conversations
    where id = link.conversation_id
    for update;

    previous := link.start_node_id;

    for turn in
        select item_id, role, text, occurred_at, status
        from public.realtime_transcript_turns
        where session_id = p_session
          and btrim(text) <> ''
        order by sequence_no
    loop
        insert into public.dialogue_nodes (
            conversation_id, parent_id, sender, text, created_at,
            status, realtime_session_id, item_id
        ) values (
            link.conversation_id,
            previous,
            case when turn.role = 'student' then 'student' else 'persona' end,
            btrim(turn.text),
            turn.occurred_at,
            case when turn.status = 'completed' then 'completed'
                 else 'interrupted' end,
            p_session,
            turn.item_id
        )
        on conflict (realtime_session_id, item_id) do nothing
        returning id into added;

        if added is not null then
            previous := added;
        end if;
    end loop;

    update public.conversation_sessions
    set built_at = clock_timestamp()
    where session_id = p_session;

    update public.conversations
    set active_node_id = previous,
        updated_at = clock_timestamp()
    where id = link.conversation_id
      and active_node_id = link.start_node_id;

    return true;
end;
$$;

revoke all on function
    public.vera_build_conversation_nodes(uuid),
    public.vera_conversation_history(uuid, uuid, text, integer),
    public.vera_attach_conversation(uuid, uuid, uuid)
from public, anon, authenticated, service_role;

grant execute on function
    public.vera_build_conversation_nodes(uuid),
    public.vera_conversation_history(uuid, uuid, text, integer),
    public.vera_attach_conversation(uuid, uuid, uuid)
to service_role;

notify pgrst, 'reload schema';

commit;
