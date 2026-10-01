-- Digital Marketing Pro — administrative sanctions
-- No profile data is deleted. Sanctions are separate, auditable records.
-- Hierarchy: user 0 < moderateur 1 < administrateur 2 < co_admin 3 < admin 4 < owner 5.

begin;

create table if not exists public.admin_sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  issued_by uuid not null references auth.users(id),
  type text not null check (type in ('mute','timeout','ban')),
  reason text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id),
  constraint admin_sanctions_time_valid check (ends_at is null or ends_at > starts_at)
);

create index if not exists admin_sanctions_user_active_idx
  on public.admin_sanctions(user_id, active, type, ends_at desc);

alter table public.admin_sanctions enable row level security;

-- No direct browser INSERT/UPDATE/DELETE. All mutations go through RPCs.
drop policy if exists "admins_read_sanctions" on public.admin_sanctions;
create policy "admins_read_sanctions"
on public.admin_sanctions for select
to authenticated
using (public.role_level(public.current_profile_role()) >= 1);

create or replace function public.admin_apply_sanction(
  target_user_id uuid,
  sanction_type text,
  duration_minutes integer default null,
  sanction_reason text default null
)
returns public.admin_sanctions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_level integer := public.role_level(public.current_profile_role());
  target_role text;
  target_level integer;
  result public.admin_sanctions;
  clean_reason text := nullif(trim(coalesce(sanction_reason, '')), '');
  end_time timestamptz := null;
begin
  if (select auth.uid()) is null then raise exception 'not authenticated'; end if;
  if target_user_id is null then raise exception 'invalid target user'; end if;
  if target_user_id = (select auth.uid()) then raise exception 'cannot sanction yourself'; end if;
  if sanction_type not in ('mute','timeout','ban') then raise exception 'invalid sanction'; end if;
  if actor_level < 1 then raise exception 'not authorized'; end if;

  select p.role into target_role from public.profiles p where p.id = target_user_id;
  if not found then raise exception 'user not found'; end if;
  if target_role = 'owner' then raise exception 'owner is protected'; end if;
  target_level := public.role_level(target_role);
  if target_level >= actor_level then raise exception 'you can only sanction lower roles'; end if;

  if sanction_type = 'ban' and actor_level < 2 then
    raise exception 'ban requires administrator level';
  end if;

  if sanction_type = 'timeout' then
    if duration_minutes is null or duration_minutes < 1 or duration_minutes > 10080 then
      raise exception 'invalid timeout duration';
    end if;
    end_time := now() + make_interval(mins => duration_minutes);
  elsif sanction_type = 'mute' then
    if duration_minutes is not null then
      if duration_minutes < 1 or duration_minutes > 10080 then raise exception 'invalid mute duration'; end if;
      end_time := now() + make_interval(mins => duration_minutes);
    end if;
  end if;

  -- A new sanction of the same type supersedes older active sanctions.
  update public.admin_sanctions
     set active = false, revoked_at = now(), revoked_by = (select auth.uid())
   where user_id = target_user_id
     and type = sanction_type
     and active = true;

  insert into public.admin_sanctions(user_id, issued_by, type, reason, starts_at, ends_at)
  values(target_user_id, (select auth.uid()), sanction_type, clean_reason, now(), end_time)
  returning * into result;

  return result;
end;
$$;

create or replace function public.admin_revoke_sanction(
  target_user_id uuid,
  sanction_type text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_level integer := public.role_level(public.current_profile_role());
  target_role text;
  target_level integer;
begin
  if (select auth.uid()) is null then raise exception 'not authenticated'; end if;
  if sanction_type not in ('mute','timeout','ban') then raise exception 'invalid sanction'; end if;
  if actor_level < 1 then raise exception 'not authorized'; end if;

  select p.role into target_role from public.profiles p where p.id = target_user_id;
  if not found then raise exception 'user not found'; end if;
  if target_role = 'owner' then raise exception 'owner is protected'; end if;
  target_level := public.role_level(target_role);
  if target_level >= actor_level then raise exception 'you can only manage lower roles'; end if;
  if sanction_type = 'ban' and actor_level < 2 then raise exception 'ban requires administrator level'; end if;

  update public.admin_sanctions
     set active = false, revoked_at = now(), revoked_by = (select auth.uid())
   where user_id = target_user_id and type = sanction_type and active = true;

  return found;
end;
$$;

create or replace function public.admin_get_sanctions(target_user_id uuid)
returns table (
  id uuid,
  type text,
  reason text,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean,
  issued_by uuid,
  created_at timestamptz,
  revoked_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select auth.uid()) is null then raise exception 'not authenticated'; end if;
  if public.role_level(public.current_profile_role()) < 1 then raise exception 'not authorized'; end if;
  return query
  select s.id, s.type, s.reason, s.starts_at, s.ends_at, s.active,
         s.issued_by, s.created_at, s.revoked_at
  from public.admin_sanctions s
  where s.user_id = target_user_id
  order by s.created_at desc;
end;
$$;

-- Chat-ready helpers: a future public/admin chat can call these without exposing
-- the sanctions table directly to regular users.
create or replace function public.user_is_chat_muted(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admin_sanctions s
    where s.user_id = coalesce(target_user_id, auth.uid())
      and s.type in ('mute','timeout')
      and s.active = true
      and s.starts_at <= now()
      and (s.ends_at is null or s.ends_at > now())
  );
$$;

create or replace function public.user_is_banned(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admin_sanctions s
    where s.user_id = coalesce(target_user_id, auth.uid())
      and s.type = 'ban'
      and s.active = true
      and s.starts_at <= now()
      and (s.ends_at is null or s.ends_at > now())
  );
$$;

revoke all on public.admin_sanctions from anon, authenticated;
grant select on public.admin_sanctions to authenticated;
revoke all on function public.admin_apply_sanction(uuid,text,integer,text) from public, anon;
revoke all on function public.admin_revoke_sanction(uuid,text) from public, anon;
revoke all on function public.admin_get_sanctions(uuid) from public, anon;
revoke all on function public.user_is_chat_muted(uuid) from public, anon;
revoke all on function public.user_is_banned(uuid) from public, anon;
grant execute on function public.admin_apply_sanction(uuid,text,integer,text) to authenticated;
grant execute on function public.admin_revoke_sanction(uuid,text) to authenticated;
grant execute on function public.admin_get_sanctions(uuid) to authenticated;
grant execute on function public.user_is_chat_muted(uuid) to authenticated;
grant execute on function public.user_is_banned(uuid) to authenticated;

commit;
