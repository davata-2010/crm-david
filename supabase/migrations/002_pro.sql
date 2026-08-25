-- ============================================================
-- Aurum CRM — migración "pro"
-- Etapa de deal perdido, tareas, etiquetas y datos de empresa.
-- Idempotente: se puede ejecutar varias veces.
-- ============================================================

-- ---------- deals: etapa 6 = Cerrado perdido ----------
alter table public.deals drop constraint if exists deals_stage_check;
alter table public.deals add constraint deals_stage_check check (stage between 0 and 6);
alter table public.deals add column if not exists lost_reason text default '';
alter table public.deals add column if not exists tags text[] not null default '{}';

-- ---------- contacts: etiquetas ----------
alter table public.contacts add column if not exists tags text[] not null default '{}';

-- ---------- companies: ficha más completa ----------
alter table public.companies add column if not exists country text default '';
alter table public.companies add column if not exists size text default '';

-- ---------- activities: tareas ----------
alter table public.activities add column if not exists due_date timestamptz;
alter table public.activities add column if not exists completed boolean not null default false;
alter table public.activities add column if not exists completed_at timestamptz;

create index if not exists activities_due_idx on public.activities(due_date)
  where due_date is not null;
create index if not exists activities_pending_idx on public.activities(completed, due_date)
  where completed = false;
create index if not exists contacts_tags_idx on public.contacts using gin (tags);
create index if not exists deals_tags_idx on public.deals using gin (tags);

-- ---------- trigger: cerrado = ganado (5) o perdido (6) ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $fn$
begin
  new.updated_at = now();
  if TG_TABLE_NAME = 'deals' then
    if new.stage >= 5 and (old.stage is null or old.stage < 5) then
      new.closed_at = now();
    end if;
    if new.stage < 5 then
      new.closed_at = null;
      new.lost_reason = '';
    end if;
  end if;
  return new;
end $fn$;

-- ---------- trigger: completed_at automático ----------
create or replace function public.touch_activity_completed()
returns trigger language plpgsql as $fn$
begin
  if new.completed and not coalesce(old.completed, false) then
    new.completed_at = now();
  elsif not new.completed then
    new.completed_at = null;
  end if;
  return new;
end $fn$;

drop trigger if exists activities_completed on public.activities;
create trigger activities_completed before update on public.activities
  for each row execute function public.touch_activity_completed();
