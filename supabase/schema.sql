-- ============================================================
-- Aurum CRM — esquema completo
-- Ejecutar en Supabase Studio -> SQL Editor -> Run
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- profiles ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  role        text not null default 'Head of Growth',
  email       text not null default '',
  phone       text not null default '',
  prefs       jsonb not null default '{"digest":true,"mentions":true,"autoLog":false,"weighted":true}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ---------- companies ----------
create table if not exists public.companies (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  industry    text default '',
  website     text default '',
  notes       text default '',
  created_at  timestamptz not null default now()
);
create index if not exists companies_owner_idx on public.companies(owner_id);

-- ---------- contacts ----------
do $do$ begin
  create type contact_status as enum ('lead', 'prospect', 'customer');
exception when duplicate_object then null; end $do$;

create table if not exists public.contacts (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  company_id  uuid references public.companies(id) on delete set null,
  name        text not null,
  email       text default '',
  phone       text default '',
  role        text default '',
  status      contact_status not null default 'lead',
  source      text default '',
  timezone    text default 'CET - Madrid',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists contacts_owner_idx on public.contacts(owner_id);
create index if not exists contacts_company_idx on public.contacts(company_id);

-- ---------- deals ----------
create table if not exists public.deals (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  company_id     uuid references public.companies(id) on delete set null,
  contact_id     uuid references public.contacts(id) on delete set null,
  name           text not null,
  value          numeric(14,2) not null default 0,
  stage          smallint not null default 0 check (stage between 0 and 5),
  project_type   text not null default 'Agentes',
  close_date     date,
  notes          text default '',
  owner_initials text default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  closed_at      timestamptz
);
create index if not exists deals_owner_idx on public.deals(owner_id);
create index if not exists deals_stage_idx on public.deals(stage);
create index if not exists deals_contact_idx on public.deals(contact_id);

-- ---------- activities ----------
create table if not exists public.activities (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  contact_id   uuid references public.contacts(id) on delete cascade,
  deal_id      uuid references public.deals(id) on delete cascade,
  kind         text not null default 'Nota',
  title        text not null,
  body         text default '',
  author       text default '',
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index if not exists activities_owner_idx on public.activities(owner_id);
create index if not exists activities_contact_idx on public.activities(contact_id);
create index if not exists activities_deal_idx on public.activities(deal_id);
create index if not exists activities_when_idx on public.activities(occurred_at desc);

-- ---------- updated_at + closed_at ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $fn$
begin
  new.updated_at = now();
  if TG_TABLE_NAME = 'deals' then
    if new.stage = 5 and (old.stage is distinct from 5) then
      new.closed_at = now();
    end if;
    if new.stage <> 5 then
      new.closed_at = null;
    end if;
  end if;
  return new;
end $fn$;

drop trigger if exists contacts_touch on public.contacts;
create trigger contacts_touch before update on public.contacts
  for each row execute function public.touch_updated_at();

drop trigger if exists deals_touch on public.deals;
create trigger deals_touch before update on public.deals
  for each row execute function public.touch_updated_at();

-- ---------- perfil automatico al registrarse ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end $fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- RLS: cada usuario solo ve y edita sus propios datos
-- ============================================================
alter table public.profiles   enable row level security;
alter table public.companies  enable row level security;
alter table public.contacts   enable row level security;
alter table public.deals      enable row level security;
alter table public.activities enable row level security;

drop policy if exists "profiles self" on public.profiles;
create policy "profiles self" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "companies own" on public.companies;
create policy "companies own" on public.companies
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "contacts own" on public.contacts;
create policy "contacts own" on public.contacts
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "deals own" on public.deals;
create policy "deals own" on public.deals
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "activities own" on public.activities;
create policy "activities own" on public.activities
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ============================================================
-- Realtime
-- ============================================================
alter table public.companies  replica identity full;
alter table public.contacts   replica identity full;
alter table public.deals      replica identity full;
alter table public.activities replica identity full;

do $do$ begin
  alter publication supabase_realtime add table public.companies;
exception when duplicate_object then null; end $do$;
do $do$ begin
  alter publication supabase_realtime add table public.contacts;
exception when duplicate_object then null; end $do$;
do $do$ begin
  alter publication supabase_realtime add table public.deals;
exception when duplicate_object then null; end $do$;
do $do$ begin
  alter publication supabase_realtime add table public.activities;
exception when duplicate_object then null; end $do$;
