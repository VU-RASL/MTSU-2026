begin;

-- One row per provider response or input-transcription usage report.
-- provider_id should be response_id for responses and item/content identity for transcription.
-- usage stores usage counters only, never entire provider events containing transcript/audio.
-- pricing records the rate card used for the estimate. Compute cost in backend code.
-- Differentiate cached/uncached text/audio units; do not price total tokens at one rate.
create table public.realtime_usage (
    session_id uuid not null references public.realtime_sessions(id) on delete cascade,
    kind text not null check (kind in ('response', 'input_transcription')),
    provider_id text not null check (length(provider_id) between 1 and 512),
    created_at timestamptz not null default now(),
    model text not null,
    usage jsonb not null check (jsonb_typeof(usage) = 'object'),
    pricing jsonb not null check (jsonb_typeof(pricing) = 'object'),
    estimated_cost_usd numeric(16, 8) not null
        check (estimated_cost_usd >= 0 and estimated_cost_usd <= 1000000),
    primary key (session_id, kind, provider_id)
);

alter table public.realtime_usage enable row level security;
revoke all on public.realtime_usage from public, anon, authenticated, service_role;
grant select, insert, update on public.realtime_usage to service_role;

commit;

