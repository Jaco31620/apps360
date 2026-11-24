-- Nuage de mots (/nuage) — tables + fonction d'agrégation.
-- À exécuter une fois dans Supabase → SQL Editor.
-- RLS activée sans policy (deny-all) : tous les accès passent par les routes
-- serveur /api/nuage/* (clé service_role), comme pour le dispositif FFBB.

create table if not exists public.nuage_sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  question text not null,
  admin_hash text not null,
  status text not null default 'open',
  max_per_participant int not null default 3,
  hidden jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.nuage_words (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.nuage_sessions(id) on delete cascade,
  word_key text not null,
  word text not null,
  participant_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists nuage_words_session_idx on public.nuage_words(session_id);
create index if not exists nuage_words_participant_idx on public.nuage_words(session_id, participant_id);

alter table public.nuage_sessions enable row level security;
alter table public.nuage_words enable row level security;

grant all on public.nuage_sessions, public.nuage_words to service_role;

-- Agrégat pour l'affichage : un objet par mot (clé, forme la plus fréquente,
-- nombre d'envois, premier envoi) + totaux.
create or replace function public.nuage_stats(sid uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'words', coalesce((
      select jsonb_agg(jsonb_build_object('k', word_key, 'w', w, 'n', n, 't', t) order by n desc, t asc)
      from (
        select word_key, mode() within group (order by word) as w, count(*) as n, min(created_at) as t
        from public.nuage_words where session_id = sid group by word_key
      ) s
    ), '[]'::jsonb),
    'total', (select count(*) from public.nuage_words where session_id = sid),
    'participants', (select count(distinct participant_id) from public.nuage_words where session_id = sid)
  );
$$;

revoke execute on function public.nuage_stats(uuid) from public, anon, authenticated;
grant execute on function public.nuage_stats(uuid) to service_role;

-- v2 (17/10/2026) : style d'affichage (palette + fond) choisi par le présentateur.
alter table public.nuage_sessions add column if not exists style jsonb not null default '{}'::jsonb;

-- v3 (23/11/2026) : moins de lectures en base + purge des nuages inactifs.
--  rev       : version du nuage, changée à CHAQUE modification (mot ajouté,
--              corrigé, supprimé ; question, statut, style, masquage…). Les écrans
--              ne relisent la liste des mots que si elle a changé.
--  del_rev   : changée seulement quand des mots sont SUPPRIMÉS (le participant ne
--              recompte alors ses envois que dans ce cas).
--  active_at : dernière modification → purge après 6 mois d'inactivité.
alter table public.nuage_sessions add column if not exists rev bigint not null default 0;
alter table public.nuage_sessions add column if not exists del_rev bigint not null default 0;
alter table public.nuage_sessions add column if not exists active_at timestamptz not null default now();

-- nuages existants : dernière activité = dernier mot envoyé (ou création)
update public.nuage_sessions s set active_at = greatest(s.created_at,
  coalesce((select max(w.created_at) from public.nuage_words w where w.session_id = s.id), s.created_at));

create or replace function public.nuage_session_touch() returns trigger language plpgsql as $$
begin
  new.rev := old.rev + 1;
  new.active_at := now();
  return new;
end $$;
drop trigger if exists nuage_session_touch on public.nuage_sessions;
create trigger nuage_session_touch before update on public.nuage_sessions
  for each row execute function public.nuage_session_touch();

-- mots ajoutés / corrigés / supprimés → version du nuage (une seule mise à jour par requête)
create or replace function public.nuage_words_changed() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    update public.nuage_sessions set del_rev = del_rev + 1 where id in (select distinct session_id from old_rows);
  else
    update public.nuage_sessions set rev = rev where id in (select distinct session_id from new_rows);
  end if;
  return null;
end $$;
drop trigger if exists nuage_words_ins on public.nuage_words;
drop trigger if exists nuage_words_upd on public.nuage_words;
drop trigger if exists nuage_words_del on public.nuage_words;
create trigger nuage_words_ins after insert on public.nuage_words
  referencing new table as new_rows for each statement execute function public.nuage_words_changed();
create trigger nuage_words_upd after update on public.nuage_words
  referencing new table as new_rows for each statement execute function public.nuage_words_changed();
create trigger nuage_words_del after delete on public.nuage_words
  referencing old table as old_rows for each statement execute function public.nuage_words_changed();

-- stats : une seule lecture des mots ; « humans » = participants sans les ajouts admin
create or replace function public.nuage_stats(sid uuid)
returns jsonb
language sql
stable
as $$
  with w as (
    select word_key, word, participant_id, created_at from public.nuage_words where session_id = sid
  ), g as (
    select word_key, mode() within group (order by word) as w, count(*) as n, min(created_at) as t
    from w group by word_key
  )
  select jsonb_build_object(
    'words', coalesce((select jsonb_agg(jsonb_build_object('k', word_key, 'w', g.w, 'n', n, 't', t) order by n desc, t asc) from g), '[]'::jsonb),
    'total', (select count(*) from w),
    'participants', (select count(distinct participant_id) from w),
    'humans', (select count(distinct participant_id) filter (where participant_id <> 'admin') from w)
  );
$$;
revoke execute on function public.nuage_stats(uuid) from public, anon, authenticated;
grant execute on function public.nuage_stats(uuid) to service_role;

create index if not exists nuage_sessions_active_idx on public.nuage_sessions(active_at);

-- v4 (24/11/2026) : code présentateur, compte facultatif, super-admin.
-- À exécuter APRÈS la v3 (s'arrête tout seul si elle manque).
--  presenter_code : 8 caractères, lisible par le serveur (renvoyé sans couper
--                   les appareils) ; le changer déconnecte tous les appareils.
--  owner_id : compte apps360 (facultatif) · note : interne au super-admin
--  keep : jamais purgé · mail_ok : image par e-mail sans compte
--  warned_at : alerte avant purge envoyée (effacée à la moindre activité)
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'nuage_sessions' and column_name = 'active_at')
  then raise exception 'Appliquer d''abord le SQL v3 du nuage'; end if;
end $$;

create or replace function public.nuage_new_code() returns text
language sql volatile set search_path = public as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
    get_byte(u.b, i) % 32 + 1, 1), '')
  from (select uuid_send(gen_random_uuid()) as b) u,
    unnest(array[0,1,2,3,4,5,10,11]) as i
$$;
revoke execute on function public.nuage_new_code() from public, anon, authenticated;
grant execute on function public.nuage_new_code() to service_role;

alter table public.nuage_sessions
  add column if not exists presenter_code text not null default public.nuage_new_code(),
  add column if not exists owner_id uuid references auth.users(id) on delete set null,
  add column if not exists note text not null default '',
  add column if not exists keep boolean not null default false,
  add column if not exists mail_ok boolean not null default false,
  add column if not exists warned_at timestamptz;
alter table public.nuage_sessions alter column admin_hash drop not null;
create index if not exists nuage_sessions_owner_idx on public.nuage_sessions(owner_id);

-- la gestion (note, code, compte, conservation, alerte) n'est pas une activité
create or replace function public.nuage_session_touch() returns trigger language plpgsql as $$
begin
  if (new.presenter_code, new.owner_id, new.note, new.keep, new.mail_ok, new.warned_at)
    is distinct from
    (old.presenter_code, old.owner_id, old.note, old.keep, old.mail_ok, old.warned_at)
  then return new; end if;
  new.rev := old.rev + 1;
  new.active_at := now();
  new.warned_at := null;
  return new;
end $$;
notify pgrst, 'reload schema';
