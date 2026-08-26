-- ============================================================
-- Vistas con agregados para empresas y deals, equivalentes a contact_rows.
-- security_invoker: heredan el RLS de las tablas base.
-- ============================================================

drop view if exists public.company_rows;
create view public.company_rows with (security_invoker = on) as
select
  co.id,
  co.workspace_id,
  co.owner_id,
  co.name,
  co.industry,
  co.website,
  co.country,
  co.size,
  co.notes,
  co.deleted_at,
  co.created_at,
  coalesce(c.contact_count, 0)::int        as contact_count,
  coalesce(d.deal_count, 0)::int           as deal_count,
  coalesce(d.open_deals, 0)::int           as open_deals,
  coalesce(d.open_value, 0)::numeric       as open_value,
  coalesce(d.won_value, 0)::numeric        as won_value,
  a.last_activity
from public.companies co
left join lateral (
  select count(*) as contact_count
  from public.contacts
  where company_id = co.id and deleted_at is null
) c on true
left join lateral (
  select
    count(*)                                          as deal_count,
    count(*) filter (where stage < 5)                 as open_deals,
    sum(value) filter (where stage < 5)               as open_value,
    sum(value) filter (where stage = 5)               as won_value
  from public.deals
  where company_id = co.id and deleted_at is null
) d on true
left join lateral (
  select max(occurred_at) as last_activity
  from public.activities act
  where act.deleted_at is null
    and act.occurred_at <= now()
    and (
      act.deal_id in (select id from public.deals where company_id = co.id and deleted_at is null)
      or act.contact_id in (select id from public.contacts where company_id = co.id and deleted_at is null)
    )
) a on true;

drop view if exists public.deal_rows;
create view public.deal_rows with (security_invoker = on) as
select
  d.id,
  d.workspace_id,
  d.owner_id,
  d.assigned_to,
  d.company_id,
  d.contact_id,
  d.name,
  d.value,
  d.stage,
  d.project_type,
  d.close_date,
  d.notes,
  d.lost_reason,
  d.tags,
  d.custom,
  d.owner_initials,
  d.deleted_at,
  d.created_at,
  d.updated_at,
  d.closed_at,
  co.name as company_name,
  c.name  as contact_name,
  -- Probabilidad por etapa, la misma tabla que usa el forecast de la app.
  (d.value * (case d.stage
    when 0 then 0.10 when 1 then 0.25 when 2 then 0.50
    when 3 then 0.65 when 4 then 0.80 when 5 then 1.00
    else 0 end))::numeric as weighted_value,
  (case d.stage
    when 0 then 10 when 1 then 25 when 2 then 50
    when 3 then 65 when 4 then 80 when 5 then 100
    else 0 end)::int as probability,
  extract(day from (coalesce(d.closed_at, now()) - d.created_at))::int as days_open,
  case
    when d.close_date is null or d.stage >= 5 then null
    else (d.close_date - current_date)::int
  end as days_to_close,
  coalesce(a.activity_count, 0)::int as activity_count,
  a.last_activity
from public.deals d
left join public.companies co on co.id = d.company_id
left join public.contacts  c  on c.id  = d.contact_id
left join lateral (
  select
    count(*)                as activity_count,
    max(occurred_at) filter (where occurred_at <= now()) as last_activity
  from public.activities
  where deal_id = d.id and deleted_at is null
) a on true;
