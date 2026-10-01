-- Digital Marketing Pro — Owner visibility fix
-- Owner must see the complete user list, including the Owner profile itself.
-- Non-owner managers continue to see only strictly lower roles.

begin;

create or replace function public.admin_list_profiles()
returns table (
  id uuid,
  email text,
  username text,
  date_of_birth date,
  role text,
  premium boolean,
  device_info text,
  last_login_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text;
  actor_level integer;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;

  actor_role := public.current_profile_role();
  actor_level := public.role_level(actor_role);

  if actor_level < 1 then
    raise exception 'not authorized';
  end if;

  return query
  select
    p.id,
    case when actor_role = 'owner' or p.role <> 'owner' then p.email else null end,
    case when actor_role = 'owner' or p.role <> 'owner' then p.username else 'Owner / Founder' end,
    case when actor_role = 'owner' or p.role <> 'owner' then p.date_of_birth else null end,
    p.role,
    p.premium,
    case when actor_role = 'owner' or p.role <> 'owner' then p.device_info else null end,
    case when actor_role = 'owner' or p.role <> 'owner' then p.last_login_at else null end,
    p.created_at
  from public.profiles p
  where actor_role = 'owner'
     or public.role_level(p.role) < actor_level
  order by p.created_at desc;
end;
$$;

revoke all on function public.admin_list_profiles() from public, anon;
grant execute on function public.admin_list_profiles() to authenticated;

commit;
