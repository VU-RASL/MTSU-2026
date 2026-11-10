begin;

-- Content-free tombstones stop retries from recreating a purged session.
-- Do not store student IDs, transcript text, or snapshots here.
create table public.realtime_deleted_sessions (
    session_id uuid primary key,
    deleted_at timestamptz not null default now()
);

alter table public.realtime_deleted_sessions enable row level security;
revoke all on public.realtime_deleted_sessions from public, anon, authenticated, service_role;
grant select on public.realtime_deleted_sessions to service_role;

commit;

