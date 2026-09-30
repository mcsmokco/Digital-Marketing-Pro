-- Digital Marketing Pro — secure hierarchical role management
-- Run this once in Supabase SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user','moderator','administrator','co_admin','owner')),
  premium boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If profiles already existed with the old 3-role check, replace it safely.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('user','moderator','administrator','co_admin','owner'));

create index if not exists profiles_email_idx on public.profiles(email);

alter table public.profiles enable row level security;

-- Migrate the old roles: legacy admin accounts become Administrator.
update public.profiles
set role = 'administrator', updated_at = now()
where role in ('admin','super_admin');

-- Existing auth users → profiles.
insert into public.profiles (id, email, role, created_at, updated_at)
select
  id,
  email,
  case
    when email = 'mcsmok.co.founder@gmail.com' then 'owner'
    when coalesce(raw_app_meta_data->>'role', '') in ('admin','super_admin','administrator') then 'administrator'
    when coalesce(raw_app_meta_data->>'role', '') in ('moderator','co_admin','owner') then raw_app_meta_data->>'role'
    else 'user'
  end,
  coalesce(created_at, now()),
  now()
from auth.users
on conflict (id) do update
set email = excluded.email,
    role = case
      when auth.users.email = 'mcsmok.co.founder@gmail.com' then 'owner'
      when public.profiles.role = 'owner' then 'owner'
      when public.profiles.role in ('admin','super_admin') then 'administrator'
      else excluded.role
    end,
    updated_at = now();

-- Make the founder the single protected Owner / Founder.
update public.profiles p
set role = 'owner', updated_at = now()
from auth.users u
where u.id = p.id
  and u.email = 'mcsmok.co.founder@gmail.com';

-- Sync auth metadata so the browser session knows the hierarchy.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
  'role',
  case
    when email = 'mcsmok.co.founder@gmail.com' then 'owner'
    when coalesce(raw_app_meta_data->>'role','') in ('admin','super_admin') then 'administrator'
    when coalesce(raw_app_meta_data->>'role','') in ('moderator','administrator','co_admin','owner') then raw_app_meta_data->>'role'
    else 'user'
  end
)
where email is not null;

-- Keep profiles in sync for newly registered users.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

-- Read access: own profile, or any authenticated management role.
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or coalesce(auth.jwt()->'app_metadata'->>'role','') in ('administrator','co_admin','owner')
);

-- No direct client updates. All role changes go through the protected RPC.
drop policy if exists "profiles_update_admin_only" on public.profiles;

create or replace function public.admin_update_user(
  target_user_id uuid,
  new_role text,
  new_premium boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller_role text;
  target_current_role text;
  current_meta jsonb;
  updated_profile public.profiles;
  caller_level integer;
  target_level integer;
begin
  caller_role := coalesce(auth.jwt()->'app_metadata'->>'role','');
  caller_level := case caller_role
    when 'moderator' then 1
    when 'administrator' then 2
    when 'co_admin' then 3
    when 'owner' then 4
    else 0
  end;

  if caller_level < 2 then
    raise exception 'not authorized';
  end if;

  if new_role not in ('user','moderator','administrator','co_admin') then
    raise exception 'invalid role';
  end if;

  select role into target_current_role
  from public.profiles
  where id = target_user_id;

  if not found then
    raise exception 'user not found';
  end if;

  -- The Owner can manage all lower roles, but nobody can replace/demote the Owner.
  if target_current_role = 'owner' then
    raise exception 'owner is protected';
  end if;

  target_level := case target_current_role
    when 'moderator' then 1
    when 'administrator' then 2
    when 'co_admin' then 3
    when 'owner' then 4
    else 0
  end;

  -- Every non-owner manager can only change a strictly lower role.
  if caller_role <> 'owner' and target_level >= caller_level then
    raise exception 'you can only manage lower roles';
  end if;

  -- A non-owner cannot promote someone to their own level or above.
  if caller_role <> 'owner' then
    target_level := case new_role
      when 'moderator' then 1
      when 'administrator' then 2
      when 'co_admin' then 3
      else 0
    end;
    if target_level >= caller_level then
      raise exception 'you cannot assign your own level or higher';
    end if;
  end if;

  select raw_app_meta_data into current_meta
  from auth.users
  where id = target_user_id;

  if not found then
    raise exception 'user not found';
  end if;

  update auth.users
  set raw_app_meta_data = coalesce(current_meta, '{}'::jsonb) || jsonb_build_object('role', new_role)
  where id = target_user_id;

  update public.profiles
  set role = new_role,
      premium = coalesce(new_premium, false),
      updated_at = now()
  where id = target_user_id
  returning * into updated_profile;

  return updated_profile;
end;
$$;

revoke all on function public.admin_update_user(uuid,text,boolean) from public;
grant execute on function public.admin_update_user(uuid,text,boolean) to authenticated;

revoke insert, update, delete on public.profiles from anon, authenticated;
