-- Timer (/timer) — timers et favoris des comptes. À exécuter une fois dans Supabase → SQL Editor.
-- RLS sans policy (deny-all) : accès uniquement par /api/timer (clé service_role).
create table if not exists public.timer_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  active_at timestamptz not null default now()
);
create index if not exists timer_data_active_idx on public.timer_data(active_at);
alter table public.timer_data enable row level security;
grant select, insert, update, delete on public.timer_data to service_role;
