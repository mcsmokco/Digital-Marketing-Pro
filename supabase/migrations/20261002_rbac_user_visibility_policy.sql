-- Digital Marketing Pro — RBAC user visibility policy
--
-- Policy:
-- 1) Management roles can see the complete user list, including higher/equal roles.
-- 2) Sensitive fields are returned only for users strictly below the viewer's role.
-- 3) Owner can see all fields for every profile.
-- 4) Regular users cannot call this RPC.
-- 5) This is server-side enforcement; UI filtering must not be relied upon.

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
  target_level integer;
  can_view_sensitive boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;

  actor_role := public.current_profile_role();
  actor_level := public.role_level(actor_role);

  -- Management roles only: user (level 0) cannot enumerate profiles.
  if actor_level < 1 then
    raise exception 'not authorized';
  end if;

  return query
  select
    p.id,
    case
      when actor_role = 'owner' then p.email
      when public.role_level(p.role) < actor_level then p.email
      else null
    end as email,
    p.username,
    case
      when actor_role = 'owner' then p.date_of_birth
      when public.role_level(p.role) < actor_level then p.date_of_birth
      else null
    end as date_of_birth,
    p.role,
    p.premium,
    case
      when actor_role = 'owner' then p.device_info
      when public.role_level(p.role) < actor_level then p.device_info
      else null
    end as device_info,
    case
      when actor_role = 'owner' then p.last_login_at
      when public.role_level(p.role) < actor_level then p.last_login_at
      else null
    end as last_login_at,
    p.created_at
  from public.profiles p
  order by p.created_at desc;
end;
$$;

revoke all on function public.admin_list_profiles() from public, anon;
grant execute on function public.admin_list_profiles() to authenticated;

commit;
