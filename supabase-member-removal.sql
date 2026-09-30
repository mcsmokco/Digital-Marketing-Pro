-- Digital Marketing Pro — secure member removal
-- Run once in the Supabase SQL Editor.
-- Owner, Admin and Coadmin can remove only lower-ranked members.
-- Owner can never be removed, and self-removal is blocked.

create or replace function public.admin_remove_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_role text;
  target_role text;
  actor_level integer;
  target_level integer;
begin
  if target_user_id is null then
    raise exception 'Invalid target user';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'You cannot remove your own account';
  end if;

  actor_role := public.current_profile_role();
  target_role := coalesce((select role from public.profiles where id = target_user_id), 'user');

  actor_level := case actor_role
    when 'user' then 0
    when 'moderateur' then 1
    when 'administrateur' then 2
    when 'co_admin' then 3
    when 'admin' then 4
    when 'owner' then 5
    else 0
  end;

  target_level := case target_role
    when 'user' then 0
    when 'moderateur' then 1
    when 'administrateur' then 2
    when 'co_admin' then 3
    when 'admin' then 4
    when 'owner' then 5
    else 0
  end;

  if actor_role not in ('owner', 'admin', 'co_admin') then
    raise exception 'Not authorized';
  end if;

  if target_role = 'owner' then
    raise exception 'Owner is protected';
  end if;

  if target_level >= actor_level then
    raise exception 'Cannot remove an equal or higher role';
  end if;

  delete from auth.users
  where id = target_user_id;

  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

revoke all on function public.admin_remove_user(uuid) from public;
revoke all on function public.admin_remove_user(uuid) from anon;
grant execute on function public.admin_remove_user(uuid) to authenticated;
