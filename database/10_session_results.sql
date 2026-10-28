begin;

-- Preserves the existing educator result/review response shape.
-- Legacy/manual submissions have a null realtime_session_id and outcome 'legacy'.
-- For Realtime calls, transcript is a finalized compatibility snapshot of canonical turns.
-- Realtime results must be created by finalize_realtime_session(), not the public submit route.
-- Existing transcript and autoScore submission endpoints still require backend hardening.
-- RESTRICT replaces the old cascade: deleting an assignment cannot erase its transcripts.
-- Explicit result deletion is provided by purge_session_result() below.
create table public.session_results (
    id integer generated always as identity primary key,
    created_at timestamptz not null default now(),
    assignment_id integer not null,
    student_id text not null,
    realtime_session_id uuid unique,
    transcript jsonb not null default '[]'::jsonb
        check (public.vera_valid_transcript(transcript)),
    outcome text not null default 'legacy'
        check (outcome in ('legacy', 'completed', 'interrupted', 'failed')),
    transcript_complete boolean not null default false,
    auto_score jsonb check (auto_score is null or jsonb_typeof(auto_score) = 'object'),
    educator_score numeric check (educator_score between 0 and 100),
    educator_feedback text not null default '',
    reviewed_by text references public.profiles(profile_key) on delete restrict,
    reviewed_at timestamptz,
    foreign key (assignment_id, student_id)
        references public.assignments(id, student_id) on delete restrict,
    foreign key (realtime_session_id, assignment_id, student_id)
        references public.realtime_sessions(id, assignment_id, student_id) on delete restrict,
    check ((realtime_session_id is null) = (outcome = 'legacy'))
);

create index session_results_assignment_idx
    on public.session_results(assignment_id, created_at, id);
create index session_results_student_idx
    on public.session_results(student_id, created_at desc, id desc);
create index session_results_reviewer_idx on public.session_results(reviewed_by);

alter table public.session_results enable row level security;
revoke all on public.session_results from public, anon, authenticated, service_role;
grant select, insert, update on public.session_results to service_role;
revoke all on sequence public.session_results_id_seq from public, anon, authenticated, service_role;
grant usage, select on sequence public.session_results_id_seq to service_role;

commit;

