-- Digital Marketing Pro — account settings hardening
-- Keeps the existing RPC contract used by account-settings.js.
-- Adds server-side validation so browser validation is never the only guard.

begin;

create or replace function public.update_my_account_settings(
  new_username text default null,
  new_date_of_birth date default null,
  new_language text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := (select auth.uid());
  old_profile public.profiles;
  updated_profile public.profiles;
  clean_username text;
  clean_language text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into old_profile
  from public.profiles
  where id = uid
  for update;

  if not found then
    raise exception 'profile not found';
  end if;

  clean_username := nullif(trim(coalesce(new_username, old_profile.username)), '');
  clean_language := lower(coalesce(nullif(trim(new_language), ''), old_profile.preferred_language, 'ar'));

  if clean_username is not null and length(clean_username) > 40 then
    raise exception 'username too long';
  end if;

  if clean_username is not null and clean_username !~ '^[A-Za-z0-9_.-]{3,40}$' then
    raise exception 'invalid username';
  end if;

  if clean_language not in ('ar','fr','en') then
    raise exception 'invalid language';
  end if;

  if new_date_of_birth is not null and new_date_of_birth > current_date then
    raise exception 'invalid date of birth';
  end if;

  if clean_username is distinct from old_profile.username then
    if exists (
      select 1
      from public.profiles
      where lower(username) = lower(clean_username)
        and id <> uid
    ) then
      raise exception 'username already in use';
    end if;

    insert into public.profile_change_audit(user_id, changed_by, field_name, old_value, new_value)
    values(uid, uid, 'username', old_profile.username, clean_username);
  end if;

  if new_date_of_birth is distinct from old_profile.date_of_birth then
    insert into public.profile_change_audit(user_id, changed_by, field_name, old_value, new_value)
    values(uid, uid, 'date_of_birth', old_profile.date_of_birth::text, new_date_of_birth::text);
  end if;

  if clean_language is distinct from old_profile.preferred_language then
    insert into public.profile_change_audit(user_id, changed_by, field_name, old_value, new_value)
    values(uid, uid, 'preferred_language', old_profile.preferred_language, clean_language);
  end if;

  update public.profiles
  set username = clean_username,
      date_of_birth = new_date_of_birth,
      preferred_language = clean_language,
      updated_at = now()
  where id = uid
  returning * into updated_profile;

  return updated_profile;
exception
  when unique_violation then
    raise exception 'username already in use';
end;
$$;

revoke all on function public.update_my_account_settings(text, date, text) from public, anon;
grant execute on function public.update_my_account_settings(text, date, text) to authenticated;

commit;
