-- Digital Marketing Pro — automatic profile synchronization
-- Run this SQL ONCE in Supabase SQL Editor.
-- After this, every new auth.users account automatically gets a public.profiles row.
-- No manual sync/search is needed on each admin login.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, premium, created_at)
  values (
    new.id,
    new.email,
    'user',
    false,
    coalesce(new.created_at, now())
  )
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;

-- Keep the trigger idempotent: re-running this file replaces the same trigger safely.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- One-time repair for any historical account that somehow has no profile.
insert into public.profiles (id, email, role, premium, created_at)
select
  u.id,
  u.email,
  'user',
  false,
  coalesce(u.created_at, now())
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
