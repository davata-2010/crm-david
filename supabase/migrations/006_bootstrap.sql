-- ============================================================
-- Rendimiento: agrupar en una sola llamada lo que antes eran
-- ~10 consultas sueltas por navegación.
--
-- Contexto: Supabase está en eu-west-1 y las funciones de Netlify en
-- us-east-2, así que cada consulta cruza el Atlántico. Bajar el número
-- de idas y vueltas es lo que más se nota.
-- ============================================================

-- Sesión completa + contadores de la barra lateral en una llamada.
create or replace function public.app_bootstrap(want uuid default null)
returns jsonb
language plpgsql
stable
as $fn$
declare
  uid uuid := auth.uid();
  ws  uuid;
  out jsonb;
begin
  if uid is null then
    return null;
  end if;

  -- Workspace pedido por cookie si el usuario pertenece; si no, el primero.
  select m.workspace_id into ws
  from public.memberships m
  where m.user_id = uid
  order by (m.workspace_id = want) desc, m.created_at asc
  limit 1;

  if ws is null then
    return null;
  end if;

  select jsonb_build_object(
    'workspace', (select to_jsonb(w) from public.workspaces w where w.id = ws),
    'role', (
      select m.role from public.memberships m
      where m.workspace_id = ws and m.user_id = uid
    ),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = uid),
    'workspaces', coalesce((
      select jsonb_agg(to_jsonb(w) order by w.created_at)
      from public.workspaces w
      join public.memberships m on m.workspace_id = w.id
      where m.user_id = uid
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'workspace_id', m.workspace_id,
          'user_id', m.user_id,
          'role', m.role,
          'created_at', m.created_at,
          'profile', to_jsonb(p)
        ) order by m.created_at
      )
      from public.memberships m
      left join public.profiles p on p.id = m.user_id
      where m.workspace_id = ws
    ), '[]'::jsonb),
    'counts', jsonb_build_object(
      'contacts', (
        select count(*) from public.contacts
        where workspace_id = ws and deleted_at is null
      ),
      'companies', (
        select count(*) from public.companies
        where workspace_id = ws and deleted_at is null
      ),
      'deals', (
        select count(*) from public.deals
        where workspace_id = ws and deleted_at is null and stage < 5
      ),
      'activities', (
        select count(*) from public.activities
        where workspace_id = ws and deleted_at is null
      ),
      'tasks', (
        select count(*) from public.activities
        where workspace_id = ws and deleted_at is null
          and due_date is not null and not completed
      ),
      'overdue', (
        select count(*) from public.activities
        where workspace_id = ws and deleted_at is null
          and due_date is not null and not completed and due_date < now()
      ),
      'trash',
        (select count(*) from public.contacts   where workspace_id = ws and deleted_at is not null)
      + (select count(*) from public.companies  where workspace_id = ws and deleted_at is not null)
      + (select count(*) from public.deals      where workspace_id = ws and deleted_at is not null)
      + (select count(*) from public.activities where workspace_id = ws and deleted_at is not null)
    )
  ) into out;

  return out;
end
$fn$;

-- Facetas de la tabla de contactos: sustituye 4 consultas de conteo
-- más un escaneo de 2.000 filas para sacar las etiquetas.
create or replace function public.contact_facets()
returns jsonb
language sql
stable
as $fn$
  select jsonb_build_object(
    'all', count(*),
    'lead', count(*) filter (where status = 'lead'),
    'prospect', count(*) filter (where status = 'prospect'),
    'customer', count(*) filter (where status = 'customer'),
    'tags', coalesce((
      select jsonb_agg(t order by t)
      from (
        select distinct unnest(tags) as t
        from public.contacts
        where deleted_at is null
      ) tags_list
    ), '[]'::jsonb)
  )
  from public.contacts
  where deleted_at is null;
$fn$;

-- Índices que faltaban para los filtros habituales.
create index if not exists activities_ws_due_idx
  on public.activities (workspace_id, due_date)
  where deleted_at is null and due_date is not null and completed = false;

create index if not exists activities_ws_occurred_idx
  on public.activities (workspace_id, occurred_at desc)
  where deleted_at is null;

create index if not exists deals_ws_stage_idx
  on public.deals (workspace_id, stage)
  where deleted_at is null;

create index if not exists contacts_ws_status_idx
  on public.contacts (workspace_id, status)
  where deleted_at is null;
