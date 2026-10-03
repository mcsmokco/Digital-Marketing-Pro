-- Digital Marketing Pro — chat send signature compatibility fix
-- Frontend currently sends reply_message_id with send_chat_message().
-- Keep the existing secure 2-argument implementation and add a 3-argument
-- compatibility overload so message sending works without weakening security.

create or replace function public.send_chat_message(
  chat_room text,
  message_body text,
  reply_message_id uuid
)
returns public.chat_messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- reply_message_id is accepted for frontend compatibility.
  -- The current chat schema does not persist reply linkage yet.
  return public.send_chat_message(chat_room, message_body);
end;
$$;

revoke all on function public.send_chat_message(text,text,uuid) from public, anon;
grant execute on function public.send_chat_message(text,text,uuid) to authenticated;
