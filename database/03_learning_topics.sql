begin;

-- Matches LearningTopicStore exactly; lower position values appear first.
create table public.learning_topics (
    id integer generated always as identity primary key,
    created_at timestamptz not null default now(),
    title text not null check (length(title) > 0),
    content text not null default '',
    position integer not null default 0
);

create index learning_topics_order_idx on public.learning_topics(position, id);

alter table public.learning_topics enable row level security;
revoke all on public.learning_topics from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.learning_topics to service_role;
revoke all on sequence public.learning_topics_id_seq from public, anon, authenticated, service_role;
grant usage, select on sequence public.learning_topics_id_seq to service_role;

commit;

