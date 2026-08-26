-- app_bootstrap devuelve también la identidad, sacada del propio JWT.
--
-- Así el servidor ya no necesita llamar a /auth/v1/user en cada render: la
-- llamada RPC va firmada con el JWT y Postgres valida la firma, de modo que
-- si devuelve datos es que la sesión es válida. Un viaje transatlántico menos
-- por página.
create or replace function public.app_bootstrap(want uuid default null)
returns jsonb
language plpgsql
stable
as $fn$
declare
  uid   uuid  := auth.uid();
  mail  text  := coalesce(auth.jwt() ->> 'email', '');
  ws    uuid;
  out   jsonb;
begin
  if uid is null then
    return null;
  end if;

  select m.workspace_id into ws
  from public.memberships m
  where m.user_id = uid
  order by (m.workspace_id = want) desc, m.created_at asc
  limit 1;

  -- Autenticado pero sin workspace todavía: la app lo crea.
  if ws is null then
    return jsonb_build_object('user_id', uid, 'email', mail, 'workspace', null);
  end if;

  select jsonb_build_object(
    'user_id', uid,
    'email', mail,
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
          'id', m.id, 'workspace_id', m.workspace_id, 'user_id', m.user_id,
          'role', m.role, 'created_at', m.created_at, 'profile', to_jsonb(p)
        ) order by m.created_at
      )
      from public.memberships m
      left join public.profiles p on p.id = m.user_id
      where m.workspace_id = ws
    ), '[]'::jsonb),
    'counts', jsonb_build_object(
      'contacts',   (select count(*) from public.contacts   where workspace_id = ws and deleted_at is null),
      'companies',  (select count(*) from public.companies  where workspace_id = ws and deleted_at is null),
      'deals',      (select count(*) from public.deals      where workspace_id = ws and deleted_at is null and stage < 5),
      'activities', (select count(*) from public.activities where workspace_id = ws and deleted_at is null),
      'tasks',      (select count(*) from public.activities where workspace_id = ws and deleted_at is null and due_date is not null and not completed),
      'overdue',    (select count(*) from public.activities where workspace_id = ws and deleted_at is null and due_date is not null and not completed and due_date < now()),
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
