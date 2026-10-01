-- Digital Marketing Pro — hierarchical profile visibility
-- Safe follow-up migration: keeps the existing RBAC / role-assignment rules.
-- Each management role can only receive profiles strictly below its own role.
-- Owner can see every lower role, but never another Owner because Owner is unique/protected.
-- Sensitive Owner fields remain masked server-side.

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
  actor_level := public.role_level(actor_role);

  if actor_level < 1 then
    raise exception 'Not authorized';
  end if;

  return query
  select
    p.id,
    p.email,
    p.username,
    p.date_of_birth,
    p.role,
    p.premium,
    p.device_info,
    p.last_login_at,
    p.created_at
  from public.profiles p
  where public.role_level(p.role) < actor_level
  order by p.created_at desc;
end;
$$;

revoke all on function public.admin_list_profiles() from public, anon;
grant execute on function public.admin_list_profiles() to authenticated;
