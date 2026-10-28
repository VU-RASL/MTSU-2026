begin;

-- Matches PersonaStore: id, created_at, title, data.
-- data contains the nested JSON returned by the persona serializer, excluding id/createdAt/title.
-- Existing references restrict deletion; archive instead when encounters must be retained.
create table public.personas (
    id integer generated always as identity primary key,
    created_at timestamptz not null default now(),
    title text not null check (length(title) > 0),
    data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
    archived_at timestamptz
);

alter table public.personas enable row level security;
revoke all on public.personas from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.personas to service_role;
revoke all on sequence public.personas_id_seq from public, anon, authenticated, service_role;
grant usage, select on sequence public.personas_id_seq to service_role;

commit;

