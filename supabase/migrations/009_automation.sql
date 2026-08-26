-- ============================================================
-- Automatizaciones y formularios públicos.
-- El motor vive en TypeScript; Postgres guarda la definición, el historial
-- de ejecuciones y las esperas pendientes.
-- ============================================================

create table if not exists public.workflows (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  name           text not null,
  description    text default '',
  trigger        text not null,
  trigger_config jsonb not null default '{}'::jsonb,
  conditions     jsonb not null default '[]'::jsonb,
  steps          jsonb not null default '[]'::jsonb,
  active         boolean not null default false,
  runs_count     int not null default 0,
  last_run_at    timestamptz,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists workflows_ws_idx on public.workflows(workspace_id, trigger) where active;

create table if not exists public.workflow_runs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workflow_id  uuid not null references public.workflows(id) on delete cascade,
  entity       text not null,
  record_id    uuid,
  record_label text default '',
  status       text not null default 'running',
  step_index   int not null default 0,
  resume_at    timestamptz,
  log          jsonb not null default '[]'::jsonb,
  error        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists runs_ws_idx on public.workflow_runs(workspace_id, created_at desc);
create index if not exists runs_due_idx on public.workflow_runs(resume_at)
  where status = 'waiting';

create table if not exists public.forms (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  name            text not null,
  slug            text not null unique,
  title           text not null default '',
  description     text default '',
  fields          jsonb not null default '[]'::jsonb,
  submit_label    text not null default 'Enviar',
  success_message text not null default '¡Gracias! Te escribimos en breve.',
  redirect_url    text default '',
  tags            text[] not null default '{}',
  active          boolean not null default true,
  submissions     int not null default 0,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists forms_slug_idx on public.forms(lower(slug));

create table if not exists public.form_submissions (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  form_id      uuid not null references public.forms(id) on delete cascade,
  contact_id   uuid references public.contacts(id) on delete set null,
  data         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists submissions_form_idx on public.form_submissions(form_id, created_at desc);

-- ------------------------------------------------------------------ RLS ---
alter table public.workflows        enable row level security;
alter table public.workflow_runs    enable row level security;
alter table public.forms            enable row level security;
alter table public.form_submissions enable row level security;

drop policy if exists "workflows ws" on public.workflows;
create policy "workflows ws" on public.workflows
  for all using (public.is_member(workspace_id)) with check (public.can_write(workspace_id));

drop policy if exists "runs ws" on public.workflow_runs;
create policy "runs ws" on public.workflow_runs
  for select using (public.is_member(workspace_id));

drop policy if exists "forms ws" on public.forms;
create policy "forms ws" on public.forms
  for all using (public.is_member(workspace_id)) with check (public.can_write(workspace_id));

drop policy if exists "submissions ws" on public.form_submissions;
create policy "submissions ws" on public.form_submissions
  for select using (public.is_member(workspace_id));

-- ---------------------------------------------------------- updated_at ---
create or replace function public.touch_row()
returns trigger language plpgsql as $fn$
begin
  new.updated_at = now();
  return new;
end $fn$;

drop trigger if exists workflows_touch on public.workflows;
create trigger workflows_touch before update on public.workflows
  for each row execute function public.touch_row();

drop trigger if exists runs_touch on public.workflow_runs;
create trigger runs_touch before update on public.workflow_runs
  for each row execute function public.touch_row();
