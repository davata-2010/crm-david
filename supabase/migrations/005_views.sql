-- Vista con agregados por contacto: permite ordenar y paginar en la base de
-- datos en lugar de traerse toda la tabla al navegador.
-- security_invoker: hereda el RLS de las tablas base.

drop view if exists public.contact_rows;
create view public.contact_rows with (security_invoker = on) as
select
  c.id,
  c.workspace_id,
  c.owner_id,
  c.assigned_to,
  c.company_id,
  c.name,
  c.email,
  c.phone,
  c.role,
  c.status,
  c.source,
  c.timezone,
  c.tags,
  c.custom,
  c.deleted_at,
  c.created_at,
  c.updated_at,
  co.name as company_name,
  co.industry as company_industry,
  coalesce(d.open_value, 0)::numeric as open_value,
  coalesce(d.open_deals, 0)::int as open_deals,
  coalesce(a.last_activity, c.created_at) as last_activity,
  coalesce(a.open_tasks, 0)::int as open_tasks
from public.contacts c
left join public.companies co on co.id = c.company_id
left join lateral (
  select sum(value) as open_value, count(*) as open_deals
  from public.deals
  where contact_id = c.id and stage < 5 and deleted_at is null
) d on true
left join lateral (
  select
    max(occurred_at) filter (where occurred_at <= now()) as last_activity,
    count(*) filter (where due_date is not null and not completed) as open_tasks
  from public.activities
  where contact_id = c.id and deleted_at is null
) a on true;
