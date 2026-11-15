begin;

create or replace function public.vera_collect_node(
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
            realtime_conversation_items.role,
            excluded.role
        ),
        previous_known =
            realtime_conversation_items.previous_known
            or excluded.previous_known,
        previous_item_id =
            case when excluded.previous_known then
                coalesce(
                    excluded.previous_item_id,
                    realtime_conversation_items.previous_item_id
                )
            else
                realtime_conversation_items.previous_item_id
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

-- Keep this helper private to the database functions.
revoke all on function
    public.vera_collect_node(uuid, text, text, boolean, text, text)
from public, anon, authenticated, service_role;

commit;