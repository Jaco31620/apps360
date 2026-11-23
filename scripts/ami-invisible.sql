-- Ami Invisible (/ami-invisible) — fermeture des tables au navigateur.
-- À exécuter une fois dans Supabase → SQL Editor, APRÈS le déploiement du
-- passage côté serveur (routes /api/ami-invisible, clé service_role).
-- Avant : le navigateur lisait et écrivait `tirages` et `carnet` directement
-- (clé anon + session de l'utilisateur), donc les paires étaient lisibles.
-- Après : RLS activée sans aucune policy (deny-all) et droits retirés aux
-- rôles anon / authenticated ; seul service_role (serveur) y accède.

alter table public.tirages enable row level security;
alter table public.carnet enable row level security;

-- supprime toute policy existante (une policy USING(true) rouvrirait l'accès)
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('tirages', 'carnet') loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

revoke all on public.tirages from anon, authenticated;
revoke all on public.carnet from anon, authenticated;
grant select, insert, update, delete on public.tirages to service_role;
grant select, insert, update, delete on public.carnet to service_role;

-- vérification : doit renvoyer 0 ligne
select tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('tirages', 'carnet');
