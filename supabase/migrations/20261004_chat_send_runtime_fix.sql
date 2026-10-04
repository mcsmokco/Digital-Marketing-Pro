-- Digital Marketing Pro — chat send runtime fix
-- Fixes the broken 3-argument send_chat_message compatibility function.
-- The previous compatibility overload called a removed 2-argument overload,
-- so authenticated message sends could fail at runtime.
-- This migration restores a real 2-argument implementation and keeps the
-- 3-argument frontend-compatible function with reply/mention handling.

begin;

drop function if exists public.send_chat_message(text,text,uuid);
drop function if exists public.send_chat_message(text,text);

create function public.send_chat_message(
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
  if char_length(clean_body) < 1 or char_length(clean_body) > 2000 then
    raise exception 'message must be 1-2000 characters';
  end if;

  actor_level := public.role_level(public.current_profile_role());

  if chat_room = 'admin' and actor_level < 1 then
    raise exception 'admin chat is restricted';
  end if;

  if public.user_is_banned(uid) then
    raise exception 'you are banned';
  end if;

  if public.user_is_chat_muted(uid) then
    raise exception 'you are muted or timed out';
  end if;

  insert into public.chat_messages(room, user_id, body)
  values(chat_room, uid, clean_body)
  returning * into result;

  return result;
end;
$$;

create function public.send_chat_message(
  chat_room text,
  message_body text,
  reply_message_id uuid
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
  if char_length(clean_body) < 1 or char_length(clean_body) > 2000 then
    raise exception 'message must be 1-2000 characters';
  end if;

  actor_level := public.role_level(public.current_profile_role());

  if chat_room = 'admin' and actor_level < 1 then
    raise exception 'admin chat is restricted';
  end if;

  if public.user_is_banned(uid) then
    raise exception 'you are banned';
  end if;

  if public.user_is_chat_muted(uid) then
    raise exception 'you are muted or timed out';
  end if;

  if reply_message_id is not null then
    select room into reply_room
    from public.chat_messages
    where id = reply_message_id and deleted_at is null;

    if reply_room is null then raise exception 'reply target not found'; end if;
    if reply_room <> chat_room then raise exception 'reply target is in another room'; end if;
  end if;

  insert into public.chat_messages(room, user_id, body, reply_to_id)
  values(chat_room, uid, clean_body, reply_message_id)
  returning * into result;

  for mention_rec in
    select distinct lower((m)[1]) as token
    from regexp_matches(clean_body, '@([A-Za-z0-9_]{3,20})', 'g') m
  loop
    role_token := mention_rec.token;

    if role_token in ('owner','admin','co_admin','administrateur','moderateur') then
      for mentioned_id in
        select p.id from public.profiles p
        where lower(coalesce(p.role,'')) = role_token and p.id <> uid
      loop
        insert into public.chat_message_mentions(message_id, mentioned_user_id)
        values(result.id, mentioned_id) on conflict do nothing;

        insert into public.chat_notifications(
          recipient_user_id, actor_user_id, type, message_id, payload
        ) values(
          mentioned_id, uid, 'mention', result.id,
          jsonb_build_object('room', chat_room, 'kind', 'role', 'role', role_token, 'body', clean_body)
        ) on conflict do nothing;
      end loop;
    else
      select p.id into mentioned_id
      from public.profiles p
      where lower(p.username) = role_token
      limit 1;

      if mentioned_id is not null and mentioned_id <> uid then
        insert into public.chat_message_mentions(message_id, mentioned_user_id)
        values(result.id, mentioned_id) on conflict do nothing;

        insert into public.chat_notifications(
          recipient_user_id, actor_user_id, type, message_id, payload
        ) values(
          mentioned_id, uid, 'mention', result.id,
          jsonb_build_object('room', chat_room, 'kind', 'user', 'username', role_token, 'body', clean_body)
        ) on conflict do nothing;
      end if;
    end if;
  end loop;

  if reply_message_id is not null then
    select m.user_id into mentioned_id
    from public.chat_messages m
    where m.id = reply_message_id;

    if mentioned_id is not null and mentioned_id <> uid then
      insert into public.chat_notifications(
        recipient_user_id, actor_user_id, type, message_id, payload
      ) values(
        mentioned_id, uid, 'reply', result.id,
        jsonb_build_object('room', chat_room, 'reply_to_id', reply_message_id, 'body', clean_body)
      ) on conflict do nothing;
    end if;
  end if;

  return result;
end;
$$;

revoke all on function public.send_chat_message(text,text) from public, anon;
revoke all on function public.send_chat_message(text,text,uuid) from public, anon;
grant execute on function public.send_chat_message(text,text) to authenticated;
grant execute on function public.send_chat_message(text,text,uuid) to authenticated;

commit;
