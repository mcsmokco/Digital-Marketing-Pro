-- Digital Marketing Pro — canonical RBAC/security consolidation
-- This migration is the single source of truth for profile visibility and
-- privileged user management. It intentionally does not delete profile data.
-- Hierarchy: user < moderateur < administrateur < co_admin < admin < owner.
-- A manager can only read/manage strictly lower roles; self-read remains allowed.

begin;

alter table public.profiles enable row level security;

-- Canonical role helper. Unknown/null roles are treated as the lowest role.
create or replace function public.role_level(input_role text)
returns integer
language sql
immutable
security invoker
set search_path = ''
as $$
  select case lower(coalesce(input_role, 'user'))
    when 'user' then 0
    when 'moderateur' then 1
    when 'administrateur' then 2
    when 'co_admin' then 3
    when 'admin' then 4
    when 'owner' then 5
    else 0
  end;
$$;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select p.role from public.profiles p where p.id = (select auth.uid())),
    'user'
  );
$$;

revoke all on function public.role_level(text) from public;
grant execute on function public.role_level(text) to authenticated;
revoke all on function public.current_profile_role() from public, anon;
grant execute on function public.current_profile_role() to authenticated;

-- Profile creation: one trigger only. Remove the legacy duplicate trigger/function.
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created_profile on auth.users;

drop function if exists public.handle_new_user();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, role, premium, created_at, updated_at)
  values (new.id, new.email, 'user', false, coalesce(new.created_at, now()), now())
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

revoke all on function public.handle_new_user_profile() from public, anon, authenticated;

-- Keep historical profiles synchronized without changing privileged roles.
insert into public.profiles (id, email, role, premium, created_at, updated_at)
select
  u.id,
  u.email,
  case
    when coalesce(u.raw_app_meta_data->>'role','') in ('moderator','moderateur') then 'moderateur'
    when coalesce(u.raw_app_meta_data->>'role','') in ('administrator','administrateur') then 'administrateur'
    when coalesce(u.raw_app_meta_data->>'role','') = 'co_admin' then 'co_admin'
    when coalesce(u.raw_app_meta_data->>'role','') = 'admin' then 'admin'
    when coalesce(u.raw_app_meta_data->>'role','') in ('super_admin','owner') then 'owner'
    else 'user'
  end,
  false,
  coalesce(u.created_at, now()),
  now()
from auth.users u
on conflict (id) do update
set email = excluded.email,
    updated_at = now();

-- Replace the conflicting SELECT policies with two explicit rules:
-- 1) everybody can read their own row;
-- 2) managers can read only strictly lower roles.
drop policy if exists "profiles_select_self_or_management" on public.profiles;
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Managers can read profiles" on public.profiles;
drop policy if exists "Managers can read non-owner profiles" on public.profiles;
drop policy if exists "Managers can read lower role profiles" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "profiles_select_lower_roles"
on public.profiles
for select
to authenticated
using (
  public.role_level((select public.current_profile_role())) >= 1
  and public.role_level(role) < public.role_level((select public.current_profile_role()))
);

-- Browser profile setup/update: own row only. The BEFORE trigger in
-- profile_identity.sql protects role/premium from self-edits.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (
  id = (select auth.uid())
  and role = 'user'
  and premium = false
);

drop policy if exists "profiles_self_update_identity" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- No browser-side profile deletion. User deletion goes through the protected
-- admin_remove_user() RPC below.
revoke delete on public.profiles from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;

-- Server-side profile setup RPC. This avoids relying on direct table updates.
create or replace function public.update_my_profile(
  p_username text,
  p_date_of_birth date,
  p_device_info text default null,
  p_last_login_at timestamptz default now()
)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result public.profiles;
  clean_username text := trim(p_username);
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated'; end if;
  if clean_username !~ '^[A-Za-z0-9_]{3,20}$' then raise exception 'Invalid username'; end if;
  if p_date_of_birth is null or p_date_of_birth > current_date then raise exception 'Invalid date of birth'; end if;

  update public.profiles
     set username = clean_username,
         date_of_birth = p_date_of_birth,
         device_info = nullif(trim(coalesce(p_device_info, '')), ''),
         last_login_at = coalesce(p_last_login_at, now()),
         updated_at = now()
   where id = (select auth.uid())
   returning * into result;

  if result.id is null then raise exception 'Profile not found'; end if;
  return result;
exception
  when unique_violation then raise exception 'Username already taken';
end;
$$;

revoke all on function public.update_my_profile(text, date, text, timestamptz) from public, anon;
grant execute on function public.update_my_profile(text, date, text, timestamptz) to authenticated;

create or replace function public.record_my_login_metadata(
  p_device_info text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated'; end if;
  update public.profiles
     set device_info = nullif(trim(coalesce(p_device_info, '')), ''),
         last_login_at = now(),
         updated_at = now()
   where id = (select auth.uid());
end;
$$;

revoke all on function public.record_my_login_metadata(text) from public, anon;
grant execute on function public.record_my_login_metadata(text) to authenticated;

-- Canonical management RPC. The RPC returns the updated row for the admin UI.
create or replace function public.admin_update_user(
  target_user_id uuid,
  new_role text,
  new_premium boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text;
  target_role text;
  actor_level integer;
  target_level integer;
  requested_level integer;
  updated_profile public.profiles;
begin
  if (select auth.uid()) is null then raise exception 'not authenticated'; end if;

  actor_role := public.current_profile_role();
  actor_level := public.role_level(actor_role);
  requested_level := public.role_level(new_role);

  if actor_level < 2 then raise exception 'not authorized'; end if;
  if target_user_id = (select auth.uid()) then raise exception 'cannot change your own role or premium state'; end if;
  if new_role not in ('user','moderateur','administrateur','co_admin','admin') then raise exception 'invalid role'; end if;

  select p.role into target_role
  from public.profiles p
  where p.id = target_user_id;

  if not found then raise exception 'user not found'; end if;
  if target_role = 'owner' then raise exception 'owner is protected'; end if;

  target_level := public.role_level(target_role);
  if target_level >= actor_level then raise exception 'you can only manage lower roles'; end if;
  if requested_level >= actor_level then raise exception 'you cannot assign your own level or higher'; end if;

  update public.profiles
  set role = new_role,
      premium = coalesce(new_premium, false),
      updated_at = now()
  where id = target_user_id
  returning * into updated_profile;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', new_role)
  where id = target_user_id;

  return updated_profile;
end;
$$;

revoke all on function public.admin_update_user(uuid,text,boolean) from public, anon;
grant execute on function public.admin_update_user(uuid,text,boolean) to authenticated;

create or replace function public.admin_remove_user(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text;
  actor_level integer;
  target_role text;
  target_level integer;
begin
  if (select auth.uid()) is null then raise exception 'not authenticated'; end if;
  if target_user_id is null then raise exception 'invalid target user'; end if;
  if target_user_id = (select auth.uid()) then raise exception 'cannot remove yourself'; end if;

  actor_role := public.current_profile_role();
  actor_level := public.role_level(actor_role);
  if actor_level < 3 then raise exception 'not authorized'; end if;

  select p.role into target_role from public.profiles p where p.id = target_user_id;
  if not found then raise exception 'user not found'; end if;
  if target_role = 'owner' then raise exception 'owner is protected'; end if;

  target_level := public.role_level(target_role);
  if target_level >= actor_level then raise exception 'you can only remove lower roles'; end if;

  delete from auth.users where id = target_user_id;
  if not found then raise exception 'user not found'; end if;
  return true;
end;
$$;

revoke all on function public.admin_remove_user(uuid) from public, anon;
grant execute on function public.admin_remove_user(uuid) to authenticated;

-- Admin profile list: only strictly lower roles are returned. Owner personal
-- fields are masked for every non-owner actor at the database boundary.
drop function if exists public.admin_list_profiles();
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
  if (select auth.uid()) is null then raise exception 'not authenticated'; end if;
  actor_role := public.current_profile_role();
  actor_level := public.role_level(actor_role);
  if actor_level < 1 then raise exception 'not authorized'; end if;

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
  where public.role_level(p.role) < actor_level
  order by p.created_at desc;
end;
$$;

revoke all on function public.admin_list_profiles() from public, anon;
grant execute on function public.admin_list_profiles() to authenticated;

-- Missing-profile repair is restricted to management roles and never changes
-- existing role/premium values.
create or replace function public.admin_sync_missing_profiles()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_level integer := public.role_level(public.current_profile_role());
  inserted_count integer := 0;
begin
  if actor_level < 1 then raise exception 'not authorized'; end if;
  insert into public.profiles (id, email, role, premium, created_at, updated_at)
  select u.id, u.email, 'user', false, coalesce(u.created_at, now()), now()
  from auth.users u
  left join public.profiles p on p.id = u.id
  where p.id is null;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.admin_sync_missing_profiles() from public, anon;
grant execute on function public.admin_sync_missing_profiles() to authenticated;

commit;
