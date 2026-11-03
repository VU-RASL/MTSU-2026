begin;

-- Canonical transcript. Assign sequence_no from conversation ordering, not transcript arrival.
-- Upsert by (session_id, item_id, content_index) to avoid duplicate turns.
-- previous_item_id supports reconstruction when provider events arrive out of order.
-- A completed generated utterance does not prove the student heard all of its audio.
-- Record interruptions explicitly. The backend must supply the actual provider timestamps.
create table public.realtime_transcript_turns (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references public.realtime_sessions(id) on delete cascade,
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
revoke all on public.realtime_transcript_turns from public, anon, authenticated, service_role;
grant select, insert, update on public.realtime_transcript_turns to service_role;

commit;

