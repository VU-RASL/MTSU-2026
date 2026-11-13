begin;

-- Conversation tree (dialogue tree) storage.
--
-- One "conversation" = one practice attempt at an assignment. A student can
-- start as many attempts as they want; each one is its own tree.
-- One "dialogue node" = one line someone said. parent_id points at the line
-- right before it. Two lines with the same parent = a branch (the student
-- rewound and rephrased). Nothing is ever deleted when a student rewinds.
--
-- Matches the frontend ConversationTree / DialogueNode types in
-- frontend/src/types/tree.ts. childrenIds is NOT stored; the backend works it
-- out when it reads the tree.
--
-- How voice lines get here:
--   1. Starting a voice call links the realtime session to a conversation and
--      to the node it continues from (vera_attach_conversation).
--   2. The existing collector saves realtime_transcript_turns as usual.
--   3. After the call's collection closes, vera_build_conversation_nodes copies
--      that call's ordered turns into dialogue_nodes, chained from the start
--      node, and moves the conversation's bookmark (active_node_id) to the end.
--
-- Backend-only, like the other realtime tables: the browser never talks to
-- these directly.

create table public.conversations (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    assignment_id integer not null,
    student_id text not null,
    status text not null default 'in_progress'
        check (status in ('in_progress', 'completed')),
    completed_at timestamptz,
    root_node_id uuid,
    active_node_id uuid,
    foreign key (assignment_id, student_id)
        references public.assignments(id, student_id)
        on delete restrict,
    check ((status = 'completed') = (completed_at is not null))
);

create index conversations_assignment_idx
    on public.conversations(assignment_id, created_at desc);

create table public.dialogue_nodes (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null
        references public.conversations(id) on delete cascade,
    parent_id uuid references public.dialogue_nodes(id) on delete restrict,
    sender text not null check (sender in ('student', 'persona', 'system')),
    text text not null check (octet_length(text) <= 262144),
    created_at timestamptz not null default now(),
    -- 'interrupted' = the line was cut off (the student talked over the
    -- patient, or the call ended mid-sentence).
    status text not null default 'completed'
        check (status in ('completed', 'interrupted')),
    realtime_session_id uuid,
    item_id text,
    check ((parent_id is null) = (sender = 'system')),
    unique (realtime_session_id, item_id)
);

create index dialogue_nodes_conversation_idx
    on public.dialogue_nodes(conversation_id, created_at);
create index dialogue_nodes_parent_idx
    on public.dialogue_nodes(parent_id);

alter table public.conversations
    add foreign key (root_node_id) references public.dialogue_nodes(id)
        deferrable initially deferred,
    add foreign key (active_node_id) references public.dialogue_nodes(id)
        deferrable initially deferred;

-- Which conversation each voice call belongs to, and where in the tree it
-- picks up. Kept in its own table so Will's guarded realtime_sessions table is
-- not altered.
create table public.conversation_sessions (
    session_id uuid primary key
        references public.realtime_sessions(id) on delete cascade,
    conversation_id uuid not null
        references public.conversations(id) on delete cascade,
    start_node_id uuid not null references public.dialogue_nodes(id),
    built_at timestamptz
);

create index conversation_sessions_conversation_idx
    on public.conversation_sessions(conversation_id);

-- Link a realtime session to a conversation.
--   p_conversation null -> start a brand-new attempt (new tree with a root).
--   otherwise           -> continue that attempt from p_from_node, or from
--                          its bookmark when p_from_node is null. Continuing
--                          from an earlier line is how a rewind branches.
-- Safe to retry: a session that is already linked returns its existing link.
-- Returns {"conversationId": ..., "startNodeId": ...}.
create function public.vera_attach_conversation(
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

        -- make sure earlier calls are in the tree before picking a spot
        perform public.vera_build_conversation_nodes(cs.session_id)
        from public.conversation_sessions cs
        where cs.conversation_id = c.id and cs.built_at is null;

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

-- Copy one finished call's transcript into the tree.
-- Does nothing (returns false) until the call's collection has closed, so it
-- is safe to call any time. Returns true once the call's lines are in.
-- Safe to retry: a call is only ever copied once.
create function public.vera_build_conversation_nodes(p_session uuid)
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

    if not found
       or s.status not in ('ended', 'failed')
       or s.collection_closed_at is null then
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

    -- The bookmark only moves if nobody moved it since this call started.
    update public.conversations
    set active_node_id = previous,
        updated_at = clock_timestamp()
    where id = link.conversation_id
      and active_node_id = link.start_node_id;

    return true;
end;
$$;

-- Bring every attempt for an assignment up to date (copies any finished
-- calls that have not been copied yet). Called before reading trees so a
-- missed copy (for example after a server restart) heals itself.
create function public.vera_sync_assignment_conversations(p_assignment integer)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
    perform public.vera_build_conversation_nodes(cs.session_id)
    from public.conversation_sessions cs
    join public.conversations c on c.id = cs.conversation_id
    where c.assignment_id = p_assignment
      and cs.built_at is null;
end;
$$;

alter table public.conversations enable row level security;
alter table public.dialogue_nodes enable row level security;
alter table public.conversation_sessions enable row level security;

revoke all on public.conversations, public.dialogue_nodes,
    public.conversation_sessions
from public, anon, authenticated, service_role;

grant select, update on public.conversations to service_role;
grant select on public.dialogue_nodes, public.conversation_sessions
to service_role;

revoke all on function
    public.vera_attach_conversation(uuid, uuid, uuid),
    public.vera_build_conversation_nodes(uuid),
    public.vera_sync_assignment_conversations(integer)
from public, anon, authenticated, service_role;

grant execute on function
    public.vera_attach_conversation(uuid, uuid, uuid),
    public.vera_build_conversation_nodes(uuid),
    public.vera_sync_assignment_conversations(integer)
to service_role;

notify pgrst, 'reload schema';

commit;
