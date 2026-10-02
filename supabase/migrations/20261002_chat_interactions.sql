-- Digital Marketing Pro — chat mentions, replies, editing, deletion and notifications
-- Additive migration: no user/profile data is deleted.
begin;

alter table public.chat_messages
  add column if not exists reply_to_id uuid references public.chat_messages(id) on delete set null,
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

create index if not exists chat_messages_reply_idx
  on public.chat_messages(reply_to_id);

create table if not exists public.chat_message_mentions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  mentioned_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(message_id, mentioned_user_id)
);

create index if not exists chat_mentions_user_created_idx
  on public.chat_message_mentions(mentioned_user_id, created_at desc);

create table if not exists public.chat_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('mention','reply')),
  message_id uuid references public.chat_messages(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique(recipient_user_id, type, message_id)
);

create index if not exists chat_notifications_recipient_idx
  on public.chat_notifications(recipient_user_id, created_at desc);

alter table public.chat_message_mentions enable row level security;
alter table public.chat_notifications enable row level security;

drop policy if exists "chat_mentions_self_read" on public.chat_message_mentions;
create policy "chat_mentions_self_read" on public.chat_message_mentions
for select to authenticated
using (mentioned_user_id = auth.uid());

drop policy if exists "chat_notifications_self_read" on public.chat_notifications;
create policy "chat_notifications_self_read" on public.chat_notifications
for select to authenticated
using (recipient_user_id = auth.uid());

drop policy if exists "chat_notifications_self_update" on public.chat_notifications;
create policy "chat_notifications_self_update" on public.chat_notifications
for update to authenticated
using (recipient_user_id = auth.uid())
with check (recipient_user_id = auth.uid());

revoke all on public.chat_message_mentions from anon, authenticated;
revoke all on public.chat_notifications from anon, authenticated;
grant select on public.chat_message_mentions to authenticated;
grant select on public.chat_notifications to authenticated;
grant update on public.chat_notifications to authenticated;

create or replace function public.chat_search_users(search_text text default '')
returns table(user_id uuid, username text, role text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.username, p.role
  from public.profiles p
  where auth.uid() is not null
    and p.username is not null
    and trim(search_text) <> ''
    and lower(p.username) like lower(trim(search_text)) || '%'
  order by lower(p.username)
  limit 8;
$$;

create or replace function public.send_chat_message(
  chat_room text,
  message_body text,
  reply_message_id uuid default null
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
  reply_room text;
  mention_rec record;
  mentioned_id uuid;
  role_token text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if chat_room not in ('public','admin') then raise exception 'invalid chat room'; end if;
  if char_length(clean_body) < 1 or char_length(clean_body) > 2000 then raise exception 'message must be 1-2000 characters'; end if;

  actor_level := public.role_level(public.current_profile_role());
  if chat_room = 'admin' and actor_level < 1 then raise exception 'admin chat is restricted'; end if;
  if public.user_is_banned(uid) then raise exception 'you are banned'; end if;
  if public.user_is_chat_muted(uid) then raise exception 'you are muted or timed out'; end if;

  if reply_message_id is not null then
    select room into reply_room from public.chat_messages where id = reply_message_id;
    if reply_room is null then raise exception 'reply target not found'; end if;
    if reply_room <> chat_room then raise exception 'reply target is in another room'; end if;
  end if;

  insert into public.chat_messages(room, user_id, body, reply_to_id)
  values(chat_room, uid, clean_body, reply_message_id)
  returning * into result;

  -- Direct @username mentions and administrative role mentions are resolved server-side.
  for mention_rec in
    select distinct lower((m)[1]) as token
    from regexp_matches(clean_body, '@([A-Za-z0-9_]{3,20})', 'g') m
  loop
    role_token := mention_rec.token;
    if role_token in ('owner','admin','co_admin','administrateur','moderateur') then
      for mentioned_id in
        select p.id
        from public.profiles p
        where lower(coalesce(p.role,'')) = role_token
          and p.id <> uid
      loop
        insert into public.chat_message_mentions(message_id, mentioned_user_id)
        values(result.id, mentioned_id)
        on conflict do nothing;

        insert into public.chat_notifications(recipient_user_id, actor_user_id, type, message_id, payload)
        values(mentioned_id, uid, 'mention', result.id,
          jsonb_build_object('room', chat_room, 'kind', 'role', 'role', role_token, 'body', clean_body))
        on conflict do nothing;
      end loop;
    else
      select p.id into mentioned_id
      from public.profiles p
      where lower(p.username) = role_token
      limit 1;

      if mentioned_id is not null and mentioned_id <> uid then
        insert into public.chat_message_mentions(message_id, mentioned_user_id)
        values(result.id, mentioned_id)
        on conflict do nothing;

        insert into public.chat_notifications(recipient_user_id, actor_user_id, type, message_id, payload)
        values(mentioned_id, uid, 'mention', result.id,
          jsonb_build_object('room', chat_room, 'kind', 'user', 'username', role_token, 'body', clean_body))
        on conflict do nothing;
      end if;
    end if;
  end loop;

  if reply_message_id is not null then
    select m.user_id into mentioned_id from public.chat_messages m where m.id = reply_message_id;
    if mentioned_id is not null and mentioned_id <> uid then
      insert into public.chat_notifications(recipient_user_id, actor_user_id, type, message_id, payload)
      values(mentioned_id, uid, 'reply', result.id,
        jsonb_build_object('room', chat_room, 'reply_to_id', reply_message_id, 'body', clean_body))
      on conflict do nothing;
    end if;
  end if;

  return result;
end;
$$;

create or replace function public.get_chat_messages(
  chat_room text,
  message_limit integer default 100
)
returns table (
  id uuid, room text, user_id uuid, username text, role text, body text, created_at timestamptz,
  reply_to_id uuid, reply_to_username text, reply_to_body text, edited_at timestamptz, deleted_at timestamptz,
  can_edit boolean, can_delete boolean
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
  select m.id, m.room, m.user_id, p.username, p.role, m.body, m.created_at,
         m.reply_to_id, rp.username, case when m.reply_to_id is null then null else rpmsg.body end,
         m.edited_at, m.deleted_at,
         (m.user_id = auth.uid() and m.deleted_at is null) as can_edit,
         (m.user_id = auth.uid() or (actor_level > public.role_level(public.role_level_for_user(m.user_id)::text))) as can_delete
  from public.chat_messages m
  left join public.profiles p on p.id = m.user_id
  left join public.chat_messages rpmsg on rpmsg.id = m.reply_to_id
  left join public.profiles rp on rp.id = rpmsg.user_id
  where m.room = chat_room
  order by m.created_at desc
  limit lim;
end;
$$;

create or replace function public.edit_chat_message(message_id uuid, new_body text)
returns public.chat_messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare result public.chat_messages; clean_body text := trim(coalesce(new_body,''));
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if char_length(clean_body) < 1 or char_length(clean_body) > 2000 then raise exception 'message must be 1-2000 characters'; end if;
  update public.chat_messages set body=clean_body, edited_at=now()
  where id=message_id and user_id=auth.uid() and deleted_at is null
  returning * into result;
  if result.id is null then raise exception 'message cannot be edited'; end if;
  return result;
end;
$$;

create or replace function public.delete_chat_message(message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare actor_level integer := public.role_level(public.current_profile_role()); target_id uuid; target_level integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select user_id into target_id from public.chat_messages where id=message_id and deleted_at is null;
  if target_id is null then return false; end if;
  if target_id <> auth.uid() then
    if actor_level < 1 then raise exception 'not authorized'; end if;
    target_level := public.role_level((select role from public.profiles where id=target_id));
    if target_level >= actor_level then raise exception 'you can only delete lower roles messages'; end if;
  end if;
  update public.chat_messages set deleted_at=now(), deleted_by=auth.uid() where id=message_id and deleted_at is null;
  return found;
end;
$$;

create or replace function public.get_chat_notifications(notification_limit integer default 30)
returns table(id uuid, type text, actor_username text, message_id uuid, payload jsonb, created_at timestamptz, read_at timestamptz)
language sql stable security definer set search_path=public,pg_temp
as $$
  select n.id,n.type,p.username,n.message_id,n.payload,n.created_at,n.read_at
  from public.chat_notifications n
  left join public.profiles p on p.id=n.actor_user_id
  where n.recipient_user_id=auth.uid()
  order by n.created_at desc
  limit greatest(1,least(coalesce(notification_limit,30),100));
$$;

create or replace function public.mark_chat_notification_read(notification_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.chat_notifications set read_at=coalesce(read_at,now()) where id=notification_id and recipient_user_id=auth.uid();
  return found;
end; $$;

revoke all on function public.chat_search_users(text) from public, anon;
revoke all on function public.send_chat_message(text,text,uuid) from public, anon;
revoke all on function public.get_chat_messages(text,integer) from public, anon;
revoke all on function public.edit_chat_message(uuid,text) from public, anon;
revoke all on function public.delete_chat_message(uuid) from public, anon;
revoke all on function public.get_chat_notifications(integer) from public, anon;
revoke all on function public.mark_chat_notification_read(uuid) from public, anon;
grant execute on function public.chat_search_users(text) to authenticated;
grant execute on function public.send_chat_message(text,text,uuid) to authenticated;
grant execute on function public.get_chat_messages(text,integer) to authenticated;
grant execute on function public.edit_chat_message(uuid,text) to authenticated;
grant execute on function public.delete_chat_message(uuid) to authenticated;
grant execute on function public.get_chat_notifications(integer) to authenticated;
grant execute on function public.mark_chat_notification_read(uuid) to authenticated;

commit;
