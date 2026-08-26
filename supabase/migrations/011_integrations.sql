-- ============================================================
-- Integración con motores de automatización externos (n8n, Make).
-- ============================================================

create table if not exists public.integrations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider     text not null check (provider in ('n8n', 'make')),
  base_url     text not null default '',
  api_key      text not null default '',
  team_id      text default '',
  active       boolean not null default false,
  last_check   timestamptz,
  last_error   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, provider)
);

-- Dónde se ejecuta cada automatización y su reflejo en el motor externo.
alter table public.workflows add column if not exists engine text not null default 'aurum';
alter table public.workflows drop constraint if exists workflows_engine_check;
alter table public.workflows add constraint workflows_engine_check
  check (engine in ('aurum', 'n8n', 'make'));

alter table public.workflows add column if not exists external_id text;
alter table public.workflows add column if not exists external_url text;
alter table public.workflows add column if not exists external_name text;
alter table public.workflows add column if not exists external_synced_at timestamptz;
alter table public.workflows add column if not exists external_error text;

-- Las credenciales sólo las ve un administrador.
alter table public.integrations enable row level security;

drop policy if exists "integrations admin" on public.integrations;
create policy "integrations admin" on public.integrations
  for all using (public.is_admin(workspace_id)) with check (public.is_admin(workspace_id));

drop trigger if exists integrations_touch on public.integrations;
create trigger integrations_touch before update on public.integrations
  for each row execute function public.touch_row();
