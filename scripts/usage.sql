-- Mesure interne de consommation (lib/usageMeter.js). À exécuter une fois dans Supabase → SQL Editor.
-- Une ligne par heure × app × soirée × route × méthode ; RLS sans policy : serveur uniquement.
create table if not exists public.usage_meter (
  hour timestamptz not null,        -- heure (UTC) du lot
  app text not null,                -- jukebox | clicclac | nuage | _autre (CPU hors routes mesurées)
  code text not null,               -- code de soirée / album / nuage, « - » sinon
  route text not null,              -- ex. « vote », « photos/* », « » pour la route principale
  method text not null,
  calls integer not null default 0,
  cpu_ms numeric not null default 0,
  primary key (hour, app, code, route, method)
);
alter table public.usage_meter enable row level security;
revoke all on public.usage_meter from anon, authenticated;
grant select, insert, update, delete on public.usage_meter to service_role;

create or replace function public.usage_add(p_rows jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.usage_meter as u (hour, app, code, route, method, calls, cpu_ms)
  select (r->>'hour')::timestamptz, r->>'app', r->>'code', coalesce(r->>'route', ''), coalesce(r->>'method', ''),
         coalesce((r->>'calls')::int, 0), coalesce((r->>'cpu_ms')::numeric, 0)
  from jsonb_array_elements(p_rows) r
  on conflict (hour, app, code, route, method)
  do update set calls = u.calls + excluded.calls, cpu_ms = u.cpu_ms + excluded.cpu_ms;
$$;
revoke all on function public.usage_add(jsonb) from public, anon, authenticated;
grant execute on function public.usage_add(jsonb) to service_role;
