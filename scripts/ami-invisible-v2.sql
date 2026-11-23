-- Ami Invisible v2 (/ami-invisible) — nouvelles tables.
-- À exécuter une fois dans Supabase → SQL Editor, AVANT de tester la v2.
-- RLS activée sans policy (deny-all) + droits retirés à anon / authenticated :
-- tous les accès passent par les routes serveur /api/ami-invisible* (service_role).
-- Les anciennes tables `tirages` et `carnet` ne servent plus (pas de reprise) ;
-- leur suppression est en bas, à exécuter plus tard, une fois la v2 validée.

-- Organisateur (compte apps360) : carnet de contacts et dernière activité
create table if not exists public.ai_organizers (
  user_id uuid primary key,
  email text,
  carnet jsonb not null default '[]'::jsonb,
  last_active_at timestamptz not null default now(),
  warned_at timestamptz,
  created_at timestamptz not null default now()
);

-- Tirage : brouillon (participants dans `draft`) puis tiré (lignes ai_participants)
create table if not exists public.ai_tirages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.ai_organizers(user_id) on delete cascade,
  name text not null default '',
  status text not null default 'draft', -- draft | drawn
  options jsonb not null default '{}'::jsonb, -- ton, date, lieu, budget, organisateur, participe, souhaits
  template text not null default '',
  draft jsonb not null default '[]'::jsonb, -- participants du brouillon
  exclusions jsonb not null default '[]'::jsonb,
  avoid jsonb not null default '[]'::jsonb, -- tirages dont on évite les paires
  journal jsonb not null default '[]'::jsonb,
  drawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_tirages_user on public.ai_tirages(user_id);

-- Participant d'un tirage effectué
create table if not exists public.ai_participants (
  id uuid primary key,
  tirage_id uuid not null references public.ai_tirages(id) on delete cascade,
  position int not null,
  prenom text not null,
  nom text not null default '',
  email text, -- null : coordonnées supprimées à sa demande
  receiver_id uuid,
  token text not null unique, -- lien personnel /ami-invisible/p/<token>
  sent_at timestamptz,
  sends int not null default 0,
  opened_at timestamptz,
  wishlist text,
  wishlist_at timestamptz,
  erased_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ai_participants_tirage on public.ai_participants(tirage_id);

alter table public.ai_organizers enable row level security;
alter table public.ai_tirages enable row level security;
alter table public.ai_participants enable row level security;
revoke all on public.ai_organizers, public.ai_tirages, public.ai_participants from anon, authenticated;
grant all on public.ai_organizers, public.ai_tirages, public.ai_participants to service_role;

-- vérification : doit renvoyer 0 ligne
select tablename, policyname from pg_policies where schemaname = 'public' and tablename like 'ai\_%';

-- ── PLUS TARD, une fois la v2 validée en prod : anciennes tables ──
-- drop table if exists public.tirages;
-- drop table if exists public.carnet;
