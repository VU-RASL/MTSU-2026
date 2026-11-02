begin;

-- Adds the scenario's estimated length in whole minutes.
-- The Student Portal shows it as "Duration"; the API calls it estimatedTime.
-- Safe on the live database: existing scenarios get 0 (unknown).
alter table public.scenarios
    add column if not exists estimated_time integer not null default 0
        check (estimated_time >= 0);

commit;
