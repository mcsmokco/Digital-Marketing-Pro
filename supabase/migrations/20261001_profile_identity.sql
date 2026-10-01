-- Digital Marketing Pro
-- Profile identity + login metadata
-- Run this migration once in the Supabase SQL Editor before testing the new signup/profile flow.

alter table public.profiles
  add column if not exists username text,
  add column if not exists date_of_birth date,
  add column if not exists device_info text,
  add column if not exists last_login_at timestamptz;

-- Usernames are unique regardless of letter case.
create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username))
  where username is not null;

-- Existing users can complete their own profile without being able to change
-- role/premium through the browser. The function only updates the four profile
-- fields intended for the account owner.
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
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if clean_username !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'Invalid username';
  end if;

  if p_date_of_birth is null or p_date_of_birth > current_date then
    raise exception 'Invalid date of birth';
  end if;

  update public.profiles
     set username = clean_username,
         date_of_birth = p_date_of_birth,
         device_info = nullif(trim(coalesce(p_device_info, '')), ''),
         last_login_at = coalesce(p_last_login_at, now())
   where id = auth.uid()
   returning * into result;

  if result.id is null then
    raise exception 'Profile not found';
  end if;

  return result;
exception
  when unique_violation then
    raise exception 'Username already taken';
end;
$$;

revoke all on function public.update_my_profile(text, date, text, timestamptz) from public;
grant execute on function public.update_my_profile(text, date, text, timestamptz) to authenticated;

-- Note: raw IP collection is intentionally not done in the browser.
-- If IP auditing is needed later, implement it server-side (Edge Function / log table)
-- with restricted admin access rather than storing an IP supplied by the client.