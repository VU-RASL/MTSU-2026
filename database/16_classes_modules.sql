begin;

-- Classes and modules for the Educator Portal (issue #73), plus
-- "End conversation = complete".
--
--   module        = a reusable practice setup: name + scenario + persona.
--   class         = a course section an educator owns, with real students.
--   class_modules = which modules a class has been given.
--
-- Giving a module to a class creates one real assignment per student
-- (assignments.class_id / module_id say where it came from). A student added
-- to a class later automatically gets the class's existing modules.
--
-- Removing a module or student (or deleting a class/module) deletes the
-- matching assignments ONLY if the student has not started them. Assignments
-- with any attempt are kept, so practice history is never lost.
--
-- Every function here is backend-only. The C++ routes check the caller is
-- the educator who owns the class/module (or an admin) before calling them.

-- ---------------------------------------------------------------------------
-- Student emails, so educators can pick real students.
-- New profiles copy their email from Supabase Auth; existing ones backfill.
-- ---------------------------------------------------------------------------

create function public.vera_profile_email()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
    if new.auth_user_id is not null and new.email is null then
        select u.email into new.email
        from auth.users u
        where u.id = new.auth_user_id;
    end if;
    return new;
end;
$$;

create trigger vera_profile_email
before insert or update of auth_user_id on public.profiles
for each row execute function public.vera_profile_email();

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.auth_user_id
  and p.email is null;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.modules (
    id integer generated always as identity primary key,
    created_at timestamptz not null default now(),
    name text not null check (length(btrim(name)) between 1 and 200),
    scenario_id integer not null references public.scenarios(id) on delete restrict,
    persona_id integer not null references public.personas(id) on delete restrict,
    created_by text not null references public.profiles(profile_key) on delete restrict,
    archived_at timestamptz
);

create index modules_owner_idx on public.modules(created_by, created_at desc);

create table public.classes (
    id integer generated always as identity primary key,
    created_at timestamptz not null default now(),
    course_code text not null check (length(btrim(course_code)) between 1 and 100),
    section text not null default '' check (length(section) <= 100),
    owner_id text not null references public.profiles(profile_key) on delete restrict
);

create index classes_owner_idx on public.classes(owner_id, created_at desc);

create table public.class_members (
    class_id integer not null references public.classes(id) on delete cascade,
    student_id text not null references public.profiles(profile_key) on delete restrict,
    added_at timestamptz not null default now(),
    primary key (class_id, student_id)
);

create table public.class_modules (
    class_id integer not null references public.classes(id) on delete cascade,
    module_id integer not null references public.modules(id) on delete cascade,
    assigned_at timestamptz not null default now(),
    primary key (class_id, module_id)
);

alter table public.assignments
    add column class_id integer references public.classes(id) on delete set null,
    add column module_id integer references public.modules(id) on delete set null;

create index assignments_class_module_idx
    on public.assignments(class_id, module_id, student_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- True once a student has started this assignment in any way.
create function public.vera_assignment_has_attempts(p_assignment integer)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
    select exists (select 1 from public.conversations where assignment_id = p_assignment)
        or exists (select 1 from public.realtime_sessions where assignment_id = p_assignment)
        or exists (select 1 from public.session_results where assignment_id = p_assignment);
$$;

-- Give one student every module their class already has (skips ones they have).
-- Returns how many assignments were created.
create function public.vera_fill_class_assignments(p_class integer, p_student text)
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
    made integer;
begin
    insert into public.assignments (
        scenario_id, persona_id, student_id, assigned_by, class_id, module_id
    )
    select m.scenario_id, m.persona_id, p_student, c.owner_id, c.id, m.id
    from public.class_modules cm
    join public.classes c on c.id = cm.class_id
    join public.modules m on m.id = cm.module_id
    where cm.class_id = p_class
      and m.archived_at is null
      and not exists (
          select 1 from public.assignments a
          where a.class_id = p_class
            and a.module_id = m.id
            and a.student_id = p_student
            and a.archived_at is null
      );
    get diagnostics made = row_count;
    return made;
end;
$$;

-- Delete matching class assignments nobody has started.
-- Returns {"removed": n, "kept": n}.
create function public.vera_clear_class_assignments(
    p_class integer,
    p_module integer default null,
    p_student text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
    removed integer;
    kept integer;
begin
    delete from public.assignments a
    where a.class_id = p_class
      and (p_module is null or a.module_id = p_module)
      and (p_student is null or a.student_id = p_student)
      and not public.vera_assignment_has_attempts(a.id);
    get diagnostics removed = row_count;

    select count(*) into kept
    from public.assignments a
    where a.class_id = p_class
      and (p_module is null or a.module_id = p_module)
      and (p_student is null or a.student_id = p_student);

    return jsonb_build_object('removed', removed, 'kept', kept);
end;
$$;

-- ---------------------------------------------------------------------------
-- Actions the routes call
-- ---------------------------------------------------------------------------

-- Add a student to a class; they get the class's existing modules.
-- Returns {"created": n}. Safe to repeat.
create function public.vera_add_class_member(p_class integer, p_student text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
    perform 1 from public.classes where id = p_class for update;
    if not found then
        raise exception 'Class not found';
    end if;
    if not exists (
        select 1 from public.profiles
        where profile_key = p_student and role = 'student'
    ) then
        raise exception 'Not a student account';
    end if;

    insert into public.class_members (class_id, student_id)
    values (p_class, p_student)
    on conflict do nothing;

    return jsonb_build_object(
        'created', public.vera_fill_class_assignments(p_class, p_student)
    );
end;
$$;

-- Remove a student from a class. Their unstarted class assignments go away;
-- started ones stay. Returns {"removed": n, "kept": n}.
create function public.vera_remove_class_member(p_class integer, p_student text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
    perform 1 from public.classes where id = p_class for update;
    delete from public.class_members
    where class_id = p_class and student_id = p_student;
    return public.vera_clear_class_assignments(p_class, null, p_student);
end;
$$;

-- Give a module to a whole class: one assignment per student.
-- Returns {"created": n}. Safe to repeat (nobody gets it twice).
create function public.vera_assign_module_to_class(p_class integer, p_module integer)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
    made integer := 0;
    member record;
begin
    perform 1 from public.classes where id = p_class for update;
    if not found then
        raise exception 'Class not found';
    end if;
    if not exists (
        select 1 from public.modules where id = p_module and archived_at is null
    ) then
        raise exception 'Module not found';
    end if;

    insert into public.class_modules (class_id, module_id)
    values (p_class, p_module)
    on conflict do nothing;

    for member in
        select student_id from public.class_members where class_id = p_class
    loop
        made := made + public.vera_fill_class_assignments(p_class, member.student_id);
    end loop;

    return jsonb_build_object('created', made);
end;
$$;

-- Take a module away from a class. Unstarted assignments go away; started
-- ones stay. Returns {"removed": n, "kept": n}.
create function public.vera_unassign_module_from_class(p_class integer, p_module integer)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
    perform 1 from public.classes where id = p_class for update;
    delete from public.class_modules
    where class_id = p_class and module_id = p_module;
    return public.vera_clear_class_assignments(p_class, p_module, null);
end;
$$;

-- Delete a class. Unstarted assignments go away; started ones stay (they just
-- stop pointing at the class). Returns {"removed": n, "kept": n}.
create function public.vera_delete_class(p_class integer)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
    result jsonb;
begin
    perform 1 from public.classes where id = p_class for update;
    if not found then
        raise exception 'Class not found';
    end if;
    result := public.vera_clear_class_assignments(p_class, null, null);
    delete from public.classes where id = p_class;
    return result;
end;
$$;

-- Delete a module: take it away from every class (same keep-if-started rule),
-- then hide it. It's archived, not erased, because kept assignments may still
-- point at it. Returns {"removed": n, "kept": n}.
create function public.vera_delete_module(p_module integer)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
    removed integer := 0;
    kept integer := 0;
    one jsonb;
    cm record;
begin
    perform 1 from public.modules where id = p_module for update;
    if not found then
        raise exception 'Module not found';
    end if;

    for cm in
        select class_id from public.class_modules where module_id = p_module
    loop
        one := public.vera_unassign_module_from_class(cm.class_id, p_module);
        removed := removed + (one->>'removed')::integer;
        kept := kept + (one->>'kept')::integer;
    end loop;

    update public.modules set archived_at = clock_timestamp()
    where id = p_module and archived_at is null;

    return jsonb_build_object('removed', removed, 'kept', kept);
end;
$$;

-- "End conversation" = complete. Called after the student presses End and
-- the call has ended. Marks that attempt completed and the assignment
-- completed (an already "reviewed" assignment stays reviewed).
-- A call that failed or was cut off is NOT marked complete.
-- Returns true if anything was marked.
create function public.vera_complete_conversation(p_session uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
    link public.conversation_sessions%rowtype;
    s public.realtime_sessions%rowtype;
begin
    select * into s from public.realtime_sessions where id = p_session;
    if not found or s.status <> 'ended' then
        return false;
    end if;

    select * into link from public.conversation_sessions where session_id = p_session;
    if found then
        update public.conversations
        set status = 'completed',
            completed_at = coalesce(completed_at, clock_timestamp()),
            updated_at = clock_timestamp()
        where id = link.conversation_id;
    end if;

    update public.assignments
    set status = 'completed'
    where id = s.assignment_id
      and status in ('assigned', 'in_progress');

    return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissions (backend only, same as the other tables)
-- ---------------------------------------------------------------------------

alter table public.modules enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.class_modules enable row level security;

revoke all on public.modules, public.classes, public.class_members, public.class_modules
from public, anon, authenticated, service_role;

grant select, insert, update on public.modules to service_role;
grant select, insert, update on public.classes to service_role;
grant select on public.class_members, public.class_modules to service_role;
revoke all on sequence public.modules_id_seq, public.classes_id_seq
from public, anon, authenticated, service_role;
grant usage, select on sequence public.modules_id_seq, public.classes_id_seq to service_role;

revoke all on function
    public.vera_profile_email(),
    public.vera_assignment_has_attempts(integer),
    public.vera_fill_class_assignments(integer, text),
    public.vera_clear_class_assignments(integer, integer, text),
    public.vera_add_class_member(integer, text),
    public.vera_remove_class_member(integer, text),
    public.vera_assign_module_to_class(integer, integer),
    public.vera_unassign_module_from_class(integer, integer),
    public.vera_delete_class(integer),
    public.vera_delete_module(integer),
    public.vera_complete_conversation(uuid)
from public, anon, authenticated, service_role;

grant execute on function
    public.vera_add_class_member(integer, text),
    public.vera_remove_class_member(integer, text),
    public.vera_assign_module_to_class(integer, integer),
    public.vera_unassign_module_from_class(integer, integer),
    public.vera_delete_class(integer),
    public.vera_delete_module(integer),
    public.vera_complete_conversation(uuid)
to service_role;

notify pgrst, 'reload schema';

commit;
