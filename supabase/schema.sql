-- CrunchDocs schema
-- Run this in the Supabase SQL editor (or `supabase db reset` with the file
-- placed in supabase/migrations). Safe to re-run.
--
-- All tables are prefixed with `docs_` so they can coexist with other tables
-- in a shared Supabase project.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.docs_users (
  id           uuid primary key default gen_random_uuid(),
  email        text not null unique,
  display_name text,
  created_at   timestamptz not null default now()
);

create table if not exists public.docs_documents (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.docs_users (id) on delete cascade,
  title        text not null default 'Untitled document',
  content_html text not null default '<p></p>',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists docs_documents_owner_id_idx on public.docs_documents (owner_id);

create table if not exists public.docs_document_shares (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.docs_documents (id) on delete cascade,
  user_id     uuid not null references public.docs_users (id) on delete cascade,
  permission  text not null default 'edit' check (permission in ('view', 'edit')),
  created_at  timestamptz not null default now(),
  unique (document_id, user_id)
);

create index if not exists docs_document_shares_user_id_idx on public.docs_document_shares (user_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.docs_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists docs_documents_touch_updated_at on public.docs_documents;
create trigger docs_documents_touch_updated_at
  before update on public.docs_documents
  for each row execute function public.docs_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- The app connects with the service_role key and enforces authorization in
-- application code (see lib/access.ts). RLS is enabled with no policies so
-- that the anon/public key cannot read or write these tables directly.
-- ---------------------------------------------------------------------------

alter table public.docs_users            enable row level security;
alter table public.docs_documents        enable row level security;
alter table public.docs_document_shares  enable row level security;

-- ---------------------------------------------------------------------------
-- Seed accounts (for the "sign in as" demo flow)
-- ---------------------------------------------------------------------------

insert into public.docs_users (email, display_name) values
  ('alice@crunchdocs.test', 'Alice Owner'),
  ('bob@crunchdocs.test',   'Bob Collaborator'),
  ('carol@crunchdocs.test', 'Carol Reader')
on conflict (email) do nothing;
