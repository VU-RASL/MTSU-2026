begin;

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
revoke all on public.profiles from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.profiles to service_role;
revoke all on sequence public.profiles_id_seq from public, anon, authenticated, service_role;
grant usage, select on sequence public.profiles_id_seq to service_role;

commit;

