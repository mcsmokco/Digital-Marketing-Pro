-- Digital Marketing Pro
-- Profile identity + login metadata
-- Run once in the Supabase SQL Editor.

alter table public.profiles
  add column if not exists username text,
  add column if not exists date_of_birth date,
  add column if not exists device_info text,
  add column if not exists last_login_at timestamptz;

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username))
  where username is not null;

-- Browser users may update their own profile fields, but can never change
-- their own role or Premium flag. Admin RPCs can still update those fields
-- because they operate on another user's row.
create or replace function public.protect_my_privileged_profile_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is not null and auth.uid() = old.id then
    new.role := old.role;
    new.premium := old.premium;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_my_privileged_profile_fields on public.profiles;
create trigger protect_my_privileged_profile_fields
before update on public.profiles
for each row execute function public.protect_my_privileged_profile_fields();

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_self_update_identity'
  ) then
    create policy profiles_self_update_identity
      on public.profiles
      for update
      to authenticated
      using (id = auth.uid())
      with check (id = auth.uid());
  end if;
end $$;

create or replace function public.update_my_profile(
  p_username text,
  p_date_of_birth date,
  p_device_info text default null,
  p_last_login_at timestamptz default now()
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.profiles;
  clean_username text := trim(p_username);
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if clean_username !~ '^[A-Za-z0-9_]{3,20}$' then raise exception 'Invalid username'; end if;
  if p_date_of_birth is null or p_date_of_birth > current_date then raise exception 'Invalid date of birth'; end if;

  update public.profiles
     set username = clean_username,
         date_of_birth = p_date_of_birth,
         device_info = nullif(trim(coalesce(p_device_info, '')), ''),
         last_login_at = coalesce(p_last_login_at, now())
   where id = auth.uid()
   returning * into result;

  if result.id is null then raise exception 'Profile not found'; end if;
  return result;
exception
  when unique_violation then raise exception 'Username already taken';
end;
$$;

revoke all on function public.update_my_profile(text, date, text, timestamptz) from public;
grant execute on function public.update_my_profile(text, date, text, timestamptz) to authenticated;

-- Raw IP is intentionally not collected from browser JavaScript. If IP auditing
-- is needed later, implement it server-side with restricted admin access.