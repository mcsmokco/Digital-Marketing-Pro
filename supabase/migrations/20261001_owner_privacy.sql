-- Digital Marketing Pro — Owner privacy for the admin users list
-- Run once in the Supabase SQL Editor.
-- Owner can see all profile metadata. Admin / Co Admin / lower roles
-- can manage users but receive masked Owner personal metadata.

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
set search_path = public
as $$
declare
  actor_role text;
  actor_level integer;
begin
  actor_role := public.current_profile_role();
  actor_level := case actor_role
    when 'user' then 0
    when 'moderateur' then 1
    when 'administrateur' then 2
    when 'co_admin' then 3
    when 'admin' then 4
    when 'owner' then 5
    else 0
  end;

  if actor_level < 1 then
    raise exception 'Not authorized';
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
  order by p.created_at desc;
end;
$$;

revoke all on function public.admin_list_profiles() from public;
revoke all on function public.admin_list_profiles() from anon;
grant execute on function public.admin_list_profiles() to authenticated;
