-- Formulaire de contact (/contact). À exécuter une fois dans Supabase → SQL Editor.
-- RLS sans policy (deny-all) : accès uniquement par le serveur (clé service_role).
create table if not exists public.contact_messages (
  id uuid primary key,                       -- tiré par le navigateur : un renvoi ne crée pas de doublon
  num bigint generated always as identity (start with 1001) unique,
  created_at timestamptz not null default now(),
  kind text not null,                        -- question | souci | idee | avis
  app text not null,                         -- icône de lib/apps.js, ou apps360
  name text,
  email text,
  message text not null,
  device text,
  status text not null default 'todo',       -- todo | answered | closed
  answered_at timestamptz,
  replies jsonb not null default '[]'::jsonb, -- [{ at, via: back|mail, text }]
  note text
);
create index if not exists contact_messages_created_idx on public.contact_messages(created_at);
alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from anon, authenticated;
grant select, insert, update, delete on public.contact_messages to service_role;
