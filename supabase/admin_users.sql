-- Digital Marketing Pro — secure admin user management
-- Run this once in Supabase SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user','admin','super_admin')),
  premium boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles(email);

alter table public.profiles enable row level security;

-- Existing users → profiles
insert into public.profiles (id, email, role, created_at, updated_at)
select
  id,
  email,
  case
    when coalesce(raw_app_meta_data->>'role', '') in ('admin','super_admin')
      then raw_app_meta_data->>'role'
    else 'user'
  end,
  coalesce(created_at, now()),
  now()
from auth.users
on conflict (id) do update
set email = excluded.email,
    role = case
      when public.profiles.role in ('admin','super_admin') then public.profiles.role
      else excluded.role
    end;

-- Keep profiles in sync for newly registered users.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case
      when coalesce(new.raw_app_meta_data->>'role', '') in ('admin','super_admin')
        then new.raw_app_meta_data->>'role'
      else 'user'
    end
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

-- Admin-only read access; users can read their own profile.
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or coalesce(auth.jwt()->'app_metadata'->>'role','') in ('admin','super_admin')
);

-- No direct client updates. Changes go through the protected RPC below.
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
  current_meta jsonb;
  updated_profile public.profiles;
begin
  caller_role := coalesce(auth.jwt()->'app_metadata'->>'role','');

  if caller_role not in ('admin','super_admin') then
    raise exception 'not authorized';
  end if;

  if new_role not in ('user','admin','super_admin') then
    raise exception 'invalid role';
  end if;

  if target_user_id = auth.uid() and new_role not in ('admin','super_admin') then
    raise exception 'cannot remove your own admin access';
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

-- Keep direct table writes locked down.
revoke insert, update, delete on public.profiles from anon, authenticated;
