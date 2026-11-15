begin;

-- VERA Supabase reference schema.
-- Run supabasereference.sql OR run the numbered split files in order, not both.
-- Target: Supabase PostgreSQL 15+; run as postgres through the SQL Editor.
-- Fresh-install reference, not an automatic migration of an existing database.
-- Existing application tables cause an error; do not drop existing data to make it run.
-- No sample users, credentials, or application data are inserted.
-- The backend uses its server-only Supabase secret key. Browser roles get no table access.
-- RLS does not replace backend authentication/authorization when using that secret key.
-- Replace X-User-Id / DEV_USER_ID before allowing real student sessions.
-- Current C++ expects numeric profiles.id but string-valued student_id / assigned_by.
-- profiles.profile_key preserves that API contract while allowing real foreign keys.
-- All application integer identity IDs fit the current C++ int parsers.
-- Future verified Supabase Auth identities map through profiles.auth_user_id.
-- Auth account removal does not erase educational records.
-- Transcripts persist until explicit deletion. Assignments should be archived.
-- DB state alone does not stop an OpenAI call: the backend must hang up the call.
-- This schema intentionally retains no audio recording or OpenAI credential.
-- No Supabase Realtime publication is required for OpenAI WebRTC.
-- Global concurrency, educator ownership checks, provider API calls, usage pricing,
-- and collector lease renewal remain backend responsibilities.

do $$
declare
    object_name text;
begin
    if to_regclass('auth.users') is null then
        raise exception 'Run this reference in Supabase: auth.users is required';
    end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role')
       or not exists (select 1 from pg_roles where rolname = 'anon')
       or not exists (select 1 from pg_roles where rolname = 'authenticated') then
        raise exception 'Supabase API roles are required';
    end if;
    foreach object_name in array array[
        'profiles', 'personas', 'learning_topics', 'scenarios', 'assignments',
        'realtime_deleted_sessions', 'realtime_sessions',
        'realtime_transcript_turns', 'realtime_usage', 'session_results'
    ] loop
        if to_regclass('public.' || object_name) is not null then
            raise exception 'public.% already exists; use a reviewed migration instead', object_name;
        end if;
    end loop;
end;
$$;

create function public.vera_valid_transcript(value jsonb)
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
    select case
        when jsonb_typeof(value) <> 'array' then false
        else not exists (
            select 1
            from jsonb_array_elements(value) as entries(turn)
            where not coalesce(
                jsonb_typeof(turn) = 'object'
                and turn ->> 'role' in ('student', 'patient')
                and jsonb_typeof(turn -> 'text') = 'string',
                false
            )
        )
    end;
$$;

revoke all on function public.vera_valid_transcript(jsonb)
    from public, anon, authenticated, service_role;
grant execute on function public.vera_valid_transcript(jsonb) to service_role;

commit;

