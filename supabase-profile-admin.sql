-- Digital Marketing Pro — secure profile roles + Premium administration
-- Run this ONCE in Supabase SQL Editor after confirming public.profiles has:
-- id uuid, email text, role text, premium boolean, created_at timestamptz.
-- This migration never uses or exposes the service_role key.

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'user');
$$;

revoke all on function public.current_profile_role() from public;
revoke all on function public.current_profile_role() from anon;
grant execute on function public.current_profile_role() to authenticated;

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select to authenticated
using (auth.uid() = id);

drop policy if exists "Managers can read profiles" on public.profiles;
create policy "Managers can read profiles"
on public.profiles for select to authenticated
using (public.current_profile_role() in ('administrateur','co_admin','admin','owner'));

create or replace function public.admin_update_user(
  target_user_id uuid,
  new_role text,
  new_premium boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  target_role text;
  actor_level integer;
  target_level integer;
  requested_level integer;
begin
  actor_role := public.current_profile_role();
  target_role := coalesce((select role from public.profiles where id = target_user_id), 'user');

  actor_level := case actor_role
    when 'user' then 0
    when 'moderateur' then 1
    when 'administrateur' then 2
    when 'co_admin' then 3
    when 'admin' then 4
    when 'owner' then 5
    else 0 end;

  target_level := case target_role
    when 'user' then 0
    when 'moderateur' then 1
    when 'administrateur' then 2
    when 'co_admin' then 3
    when 'admin' then 4
    when 'owner' then 5
    else 0 end;

  requested_level := case new_role
    when 'user' then 0
    when 'moderateur' then 1
    when 'administrateur' then 2
    when 'co_admin' then 3
    when 'admin' then 4
    when 'owner' then 5
    else -1 end;

  if actor_level < 2 then
    raise exception 'Not authorized';
  end if;

  if requested_level < 0 then
    raise exception 'Invalid role';
  end if;

  if target_role = 'owner' then
    raise exception 'Owner is protected';
  end if;

  if target_level >= actor_level then
    raise exception 'Cannot manage an equal or higher role';
  end if;

  if requested_level >= actor_level then
    raise exception 'Cannot assign an equal or higher role';
  end if;

  update public.profiles
  set role = new_role,
      premium = coalesce(new_premium, false)
  where id = target_user_id;

  if not found then
    raise exception 'User profile not found';
  end if;
end;
$$;

revoke all on function public.admin_update_user(uuid,text,boolean) from public;
revoke all on function public.admin_update_user(uuid,text,boolean) from anon;
grant execute on function public.admin_update_user(uuid,text,boolean) to authenticated;
