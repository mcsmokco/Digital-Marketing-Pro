-- Digital Marketing Pro — canonical RBAC + Premium administration
-- Run this file ONCE in Supabase SQL Editor.
-- The browser never receives a service_role/secret key.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user',
  premium boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('user','moderateur','administrateur','co_admin','admin','owner'));

create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists profiles_role_idx on public.profiles(role);

update public.profiles
set role = case role
  when 'moderator' then 'moderateur'
  when 'administrator' then 'administrateur'
  when 'super_admin' then 'owner'
  else role
end,
updated_at = now()
where role in ('moderator','administrator','super_admin');

insert into public.profiles (id, email, role, created_at, updated_at)
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
  coalesce(u.created_at, now()),
  now()
from auth.users u
on conflict (id) do update
set email = excluded.email,
    updated_at = now();

update auth.users u
set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
  'role',
  case
    when p.role = 'moderateur' then 'moderateur'
    when p.role = 'administrateur' then 'administrateur'
    when p.role = 'co_admin' then 'co_admin'
    when p.role = 'admin' then 'admin'
    when p.role = 'owner' then 'owner'
    else 'user'
  end
)
from public.profiles p
where p.id = u.id;

alter table public.profiles enable row level security;

create or replace function public.role_level(input_role text)
returns integer
language sql
immutable
security invoker
set search_path = ''
as $$
  select case input_role
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
set search_path = ''
as $$
  select coalesce((select p.role from public.profiles p where p.id = (select auth.uid())), 'user');
$$;

revoke all on function public.current_profile_role() from public;
grant execute on function public.current_profile_role() to authenticated;
revoke all on function public.role_level(text) from public;
grant execute on function public.role_level(text) to anon, authenticated;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
drop policy if exists "profiles_select_self_or_management" on public.profiles;
create policy "profiles_select_self_or_management"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (select public.role_level((select public.current_profile_role()))) >= 1
);

revoke insert, update, delete on public.profiles from anon, authenticated;

drop trigger if exists on_auth_user_created_profile on auth.users;
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role, premium)
  values (new.id, new.email, 'user', false)
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

create or replace function public.admin_update_user(
  target_user_id uuid,
  new_role text,
  new_premium boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
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
  if actor_level < 2 then raise exception 'not authorized'; end if;
  if target_user_id = (select auth.uid()) then raise exception 'cannot change your own role or premium state'; end if;
  if new_role not in ('user','moderateur','administrateur','co_admin','admin') then raise exception 'invalid role'; end if;

  select p.role into target_role from public.profiles p where p.id = target_user_id;
  if not found then raise exception 'user not found'; end if;
  if target_role = 'owner' then raise exception 'owner is protected'; end if;

  target_level := public.role_level(target_role);
  requested_level := public.role_level(new_role);
  if actor_role <> 'owner' and target_level >= actor_level then raise exception 'you can only manage lower roles'; end if;
  if actor_role <> 'owner' and requested_level >= actor_level then raise exception 'you cannot assign your own level or higher'; end if;

  update public.profiles
  set role = new_role, premium = coalesce(new_premium, false), updated_at = now()
  where id = target_user_id
  returning * into updated_profile;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role)
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
set search_path = ''
as $$
declare
  actor_role text;
  target_role text;
begin
  if (select auth.uid()) is null then raise exception 'not authenticated'; end if;
  actor_role := public.current_profile_role();
  if public.role_level(actor_role) < 3 then raise exception 'not authorized'; end if;
  if target_user_id = (select auth.uid()) then raise exception 'cannot remove yourself'; end if;

  select p.role into target_role from public.profiles p where p.id = target_user_id;
  if not found then raise exception 'user not found'; end if;
  if target_role = 'owner' then raise exception 'owner is protected'; end if;
  if public.role_level(target_role) >= public.role_level(actor_role) then raise exception 'you can only remove lower roles'; end if;

  delete from auth.users where id = target_user_id;
  return true;
end;
$$;

revoke all on function public.admin_remove_user(uuid) from public, anon;
grant execute on function public.admin_remove_user(uuid) to authenticated;
