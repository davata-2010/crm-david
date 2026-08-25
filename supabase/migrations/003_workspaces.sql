-- ============================================================
-- Aurum CRM — migración v3
-- Workspaces multiusuario, papelera, auditoría, vistas guardadas,
-- campos personalizados, adjuntos y clave de API por workspace.
-- Idempotente.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------
-- 1. Workspaces y membresías
-- ------------------------------------------------------------------
create table if not exists public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'Mi workspace',
  api_key    text not null unique default ('aur_live_' || encode(gen_random_bytes(20), 'hex')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

do $do$ begin
  create type member_role as enum ('owner', 'admin', 'member', 'viewer');
exception when duplicate_object then null; end $do$;

create table if not exists public.memberships (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         member_role not null default 'member',
  created_at   timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index if not exists memberships_user_idx on public.memberships(user_id);

create table if not exists public.invitations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email        text not null,
  role         member_role not null default 'member',
  token        text not null unique default encode(gen_random_bytes(18), 'hex'),
  invited_by   uuid references auth.users(id) on delete set null,
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists invitations_email_idx on public.invitations(lower(email));

-- ------------------------------------------------------------------
-- 2. Helpers de seguridad (SECURITY DEFINER: evitan recursión en RLS)
-- ------------------------------------------------------------------
create or replace function public.is_member(ws uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.memberships m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$fn$;

create or replace function public.can_write(ws uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.memberships m
    where m.workspace_id = ws and m.user_id = auth.uid()
      and m.role in ('owner', 'admin', 'member')
  );
$fn$;

create or replace function public.is_admin(ws uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.memberships m
    where m.workspace_id = ws and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$fn$;

-- ------------------------------------------------------------------
-- 3. Columnas nuevas en las tablas de negocio
-- ------------------------------------------------------------------
alter table public.companies  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.contacts   add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.deals      add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.activities add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

alter table public.companies  add column if not exists deleted_at timestamptz;
alter table public.contacts   add column if not exists deleted_at timestamptz;
alter table public.deals      add column if not exists deleted_at timestamptz;
alter table public.activities add column if not exists deleted_at timestamptz;

alter table public.contacts add column if not exists assigned_to uuid references auth.users(id) on delete set null;
alter table public.deals    add column if not exists assigned_to uuid references auth.users(id) on delete set null;

alter table public.contacts add column if not exists custom jsonb not null default '{}'::jsonb;
alter table public.deals    add column if not exists custom jsonb not null default '{}'::jsonb;

create index if not exists companies_ws_idx  on public.companies(workspace_id)  where deleted_at is null;
create index if not exists contacts_ws_idx   on public.contacts(workspace_id)   where deleted_at is null;
create index if not exists deals_ws_idx      on public.deals(workspace_id)      where deleted_at is null;
create index if not exists activities_ws_idx on public.activities(workspace_id) where deleted_at is null;
create index if not exists contacts_search_idx on public.contacts using gin (
  to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(email,'') || ' ' || coalesce(role,''))
);

-- ------------------------------------------------------------------
-- 4. Backfill: un workspace por cada usuario existente
-- ------------------------------------------------------------------
do $mig$
declare
  u record;
  ws uuid;
begin
  for u in select distinct owner_id from public.contacts
           union select distinct owner_id from public.companies
           union select distinct owner_id from public.deals
           union select distinct owner_id from public.activities
           union select id from public.profiles
  loop
    if u.owner_id is null then continue; end if;

    select m.workspace_id into ws
    from public.memberships m
    where m.user_id = u.owner_id and m.role = 'owner'
    limit 1;

    if ws is null then
      insert into public.workspaces (name, created_by) values ('Mi agencia', u.owner_id)
      returning id into ws;
      insert into public.memberships (workspace_id, user_id, role)
      values (ws, u.owner_id, 'owner')
      on conflict do nothing;
    end if;

    update public.companies  set workspace_id = ws where owner_id = u.owner_id and workspace_id is null;
    update public.contacts   set workspace_id = ws where owner_id = u.owner_id and workspace_id is null;
    update public.deals      set workspace_id = ws where owner_id = u.owner_id and workspace_id is null;
    update public.activities set workspace_id = ws where owner_id = u.owner_id and workspace_id is null;

    update public.contacts set assigned_to = owner_id where owner_id = u.owner_id and assigned_to is null;
    update public.deals    set assigned_to = owner_id where owner_id = u.owner_id and assigned_to is null;
  end loop;
end $mig$;

-- ------------------------------------------------------------------
-- 5. Auditoría
-- ------------------------------------------------------------------
create table if not exists public.audit_log (
  id           bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,
  entity       text not null,
  entity_id    uuid not null,
  action       text not null,
  label        text default '',
  changes      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists audit_ws_idx on public.audit_log(workspace_id, created_at desc);
create index if not exists audit_entity_idx on public.audit_log(entity, entity_id);

create or replace function public.write_audit()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  changed jsonb := '{}'::jsonb;
  k text;
  act text;
  ws uuid;
  lbl text;
  ignored text[] := array['updated_at', 'created_at'];
begin
  if TG_OP = 'INSERT' then
    act := 'create';
    ws := new.workspace_id;
    lbl := new.name;
  elsif TG_OP = 'DELETE' then
    act := 'purge';
    ws := old.workspace_id;
    lbl := old.name;
  else
    ws := new.workspace_id;
    lbl := new.name;
    if old.deleted_at is null and new.deleted_at is not null then
      act := 'delete';
    elsif old.deleted_at is not null and new.deleted_at is null then
      act := 'restore';
    else
      act := 'update';
      for k in select jsonb_object_keys(to_jsonb(new)) loop
        if k = any(ignored) then continue; end if;
        if to_jsonb(new) -> k is distinct from to_jsonb(old) -> k then
          changed := changed || jsonb_build_object(
            k, jsonb_build_object('de', to_jsonb(old) -> k, 'a', to_jsonb(new) -> k)
          );
        end if;
      end loop;
      if changed = '{}'::jsonb then return new; end if;
    end if;
  end if;

  if ws is null then
    return coalesce(new, old);
  end if;

  insert into public.audit_log (workspace_id, user_id, entity, entity_id, action, label, changes)
  values (ws, auth.uid(), TG_TABLE_NAME, coalesce(new.id, old.id), act, coalesce(lbl, ''), changed);

  return coalesce(new, old);
end $fn$;

drop trigger if exists contacts_audit on public.contacts;
create trigger contacts_audit after insert or update or delete on public.contacts
  for each row execute function public.write_audit();

drop trigger if exists deals_audit on public.deals;
create trigger deals_audit after insert or update or delete on public.deals
  for each row execute function public.write_audit();

drop trigger if exists companies_audit on public.companies;
create trigger companies_audit after insert or update or delete on public.companies
  for each row execute function public.write_audit();

-- ------------------------------------------------------------------
-- 6. Vistas guardadas y adjuntos
-- ------------------------------------------------------------------
create table if not exists public.saved_views (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  entity       text not null default 'contacts',
  name         text not null,
  config       jsonb not null default '{}'::jsonb,
  shared       boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists saved_views_ws_idx on public.saved_views(workspace_id, entity);

create table if not exists public.attachments (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id   uuid references public.contacts(id) on delete cascade,
  deal_id      uuid references public.deals(id) on delete cascade,
  name         text not null,
  path         text not null,
  size         bigint not null default 0,
  mime         text default '',
  uploaded_by  uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists attachments_ws_idx on public.attachments(workspace_id);

-- ------------------------------------------------------------------
-- 7. Campos personalizados por workspace
-- ------------------------------------------------------------------
create table if not exists public.custom_fields (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity       text not null check (entity in ('contacts', 'deals')),
  key          text not null,
  label        text not null,
  type         text not null default 'text' check (type in ('text', 'number', 'date', 'select', 'checkbox')),
  options      text[] not null default '{}',
  position     int not null default 0,
  created_at   timestamptz not null default now(),
  unique (workspace_id, entity, key)
);

-- ------------------------------------------------------------------
-- 8. Alta automática: cada usuario nuevo estrena workspace propio
-- ------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  ws uuid;
  inv record;
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;

  -- Si venía invitado, se une al workspace que le invitó.
  select * into inv from public.invitations
  where lower(email) = lower(new.email) and accepted_at is null
  order by created_at desc limit 1;

  if inv.id is not null then
    insert into public.memberships (workspace_id, user_id, role)
    values (inv.workspace_id, new.id, inv.role)
    on conflict do nothing;
    update public.invitations set accepted_at = now() where id = inv.id;
    return new;
  end if;

  insert into public.workspaces (name, created_by) values ('Mi agencia', new.id)
  returning id into ws;
  insert into public.memberships (workspace_id, user_id, role)
  values (ws, new.id, 'owner')
  on conflict do nothing;

  return new;
end $fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------
-- 9. RLS: de "mis filas" a "las filas de mi workspace"
-- ------------------------------------------------------------------
alter table public.workspaces    enable row level security;
alter table public.memberships   enable row level security;
alter table public.invitations   enable row level security;
alter table public.audit_log     enable row level security;
alter table public.saved_views   enable row level security;
alter table public.attachments   enable row level security;
alter table public.custom_fields enable row level security;

drop policy if exists "workspaces read"  on public.workspaces;
create policy "workspaces read" on public.workspaces
  for select using (public.is_member(id));
drop policy if exists "workspaces write" on public.workspaces;
create policy "workspaces write" on public.workspaces
  for update using (public.is_admin(id)) with check (public.is_admin(id));

drop policy if exists "memberships read" on public.memberships;
create policy "memberships read" on public.memberships
  for select using (user_id = auth.uid() or public.is_member(workspace_id));
drop policy if exists "memberships manage" on public.memberships;
create policy "memberships manage" on public.memberships
  for all using (public.is_admin(workspace_id)) with check (public.is_admin(workspace_id));

drop policy if exists "invitations manage" on public.invitations;
create policy "invitations manage" on public.invitations
  for all using (public.is_admin(workspace_id)) with check (public.is_admin(workspace_id));

drop policy if exists "audit read" on public.audit_log;
create policy "audit read" on public.audit_log
  for select using (public.is_member(workspace_id));

drop policy if exists "views own" on public.saved_views;
create policy "views own" on public.saved_views
  for all using (
    public.is_member(workspace_id) and (user_id = auth.uid() or shared)
  ) with check (public.is_member(workspace_id) and user_id = auth.uid());

drop policy if exists "attachments ws" on public.attachments;
create policy "attachments ws" on public.attachments
  for all using (public.is_member(workspace_id)) with check (public.can_write(workspace_id));

drop policy if exists "fields ws" on public.custom_fields;
create policy "fields ws" on public.custom_fields
  for select using (public.is_member(workspace_id));
drop policy if exists "fields manage" on public.custom_fields;
create policy "fields manage" on public.custom_fields
  for all using (public.is_admin(workspace_id)) with check (public.is_admin(workspace_id));

-- Tablas de negocio: lectura para miembros, escritura para roles con permiso.
drop policy if exists "companies own" on public.companies;
drop policy if exists "companies read" on public.companies;
create policy "companies read" on public.companies
  for select using (public.is_member(workspace_id));
drop policy if exists "companies write" on public.companies;
create policy "companies write" on public.companies
  for all using (public.can_write(workspace_id)) with check (public.can_write(workspace_id));

drop policy if exists "contacts own" on public.contacts;
drop policy if exists "contacts read" on public.contacts;
create policy "contacts read" on public.contacts
  for select using (public.is_member(workspace_id));
drop policy if exists "contacts write" on public.contacts;
create policy "contacts write" on public.contacts
  for all using (public.can_write(workspace_id)) with check (public.can_write(workspace_id));

drop policy if exists "deals own" on public.deals;
drop policy if exists "deals read" on public.deals;
create policy "deals read" on public.deals
  for select using (public.is_member(workspace_id));
drop policy if exists "deals write" on public.deals;
create policy "deals write" on public.deals
  for all using (public.can_write(workspace_id)) with check (public.can_write(workspace_id));

drop policy if exists "activities own" on public.activities;
drop policy if exists "activities read" on public.activities;
create policy "activities read" on public.activities
  for select using (public.is_member(workspace_id));
drop policy if exists "activities write" on public.activities;
create policy "activities write" on public.activities
  for all using (public.can_write(workspace_id)) with check (public.can_write(workspace_id));

-- Los perfiles del equipo deben ser legibles entre compañeros.
drop policy if exists "profiles self" on public.profiles;
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from public.memberships a
      join public.memberships b on a.workspace_id = b.workspace_id
      where a.user_id = auth.uid() and b.user_id = public.profiles.id
    )
  );
drop policy if exists "profiles write" on public.profiles;
create policy "profiles write" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- ------------------------------------------------------------------
-- 10. Realtime para las tablas nuevas
-- ------------------------------------------------------------------
alter table public.audit_log   replica identity full;
alter table public.memberships replica identity full;

do $do$ begin
  alter publication supabase_realtime add table public.audit_log;
exception when duplicate_object then null; end $do$;
do $do$ begin
  alter publication supabase_realtime add table public.memberships;
exception when duplicate_object then null; end $do$;
