-- Digital Marketing Pro — public + staff chat
begin;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room text not null check (room in ('public','admin')),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_room_created_idx
  on public.chat_messages(room, created_at desc);

alter table public.chat_messages enable row level security;

drop policy if exists "chat_read_public" on public.chat_messages;
create policy "chat_read_public" on public.chat_messages
for select to authenticated
using (
  room = 'public'
  or public.role_level(public.current_profile_role()) >= 1
);

-- Direct INSERT is blocked: messages go through send_chat_message so mute/timeout/ban
-- and the admin-room hierarchy are enforced server-side.
drop policy if exists "chat_insert_none" on public.chat_messages;

create or replace function public.send_chat_message(
  chat_room text,
  message_body text
)
returns public.chat_messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  actor_level integer;
  result public.chat_messages;
  clean_body text := trim(coalesce(message_body, ''));
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if chat_room not in ('public','admin') then raise exception 'invalid chat room'; end if;
  if char_length(clean_body) < 1 or char_length(clean_body) > 2000 then raise exception 'message must be 1-2000 characters'; end if;

  actor_level := public.role_level(public.current_profile_role());

  if chat_room = 'admin' and actor_level < 1 then
    raise exception 'admin chat is restricted';
  end if;

  if public.user_is_banned(uid) then
    raise exception 'you are banned';
  end if;

  if chat_room = 'public' and public.user_is_chat_muted(uid) then
    raise exception 'you are muted from public chat';
  end if;

  insert into public.chat_messages(room, user_id, body)
  values(chat_room, uid, clean_body)
  returning * into result;

  return result;
end;
$$;

create or replace function public.get_chat_messages(
  chat_room text,
  message_limit integer default 100
)
returns table (
  id uuid,
  room text,
  user_id uuid,
  username text,
  role text,
  body text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_level integer := public.role_level(public.current_profile_role());
  lim integer := greatest(1, least(coalesce(message_limit, 100), 200));
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if chat_room not in ('public','admin') then raise exception 'invalid chat room'; end if;
  if chat_room = 'admin' and actor_level < 1 then raise exception 'admin chat is restricted'; end if;

  return query
  select m.id, m.room, m.user_id, p.username, p.role, m.body, m.created_at
  from public.chat_messages m
  left join public.profiles p on p.id = m.user_id
  where m.room = chat_room
  order by m.created_at desc
  limit lim;
end;
$$;

revoke all on public.chat_messages from anon, authenticated;
grant select on public.chat_messages to authenticated;
revoke all on function public.send_chat_message(text,text) from public, anon;
revoke all on function public.get_chat_messages(text,integer) from public, anon;
grant execute on function public.send_chat_message(text,text) to authenticated;
grant execute on function public.get_chat_messages(text,integer) to authenticated;

-- Enable Supabase Realtime for the chat table if it is not already present.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
exception when undefined_object then
  null;
end $$;

commit;
