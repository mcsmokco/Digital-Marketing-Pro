-- Digital Marketing Pro — chat send signature compatibility fix
-- Frontend sends reply_message_id with send_chat_message().
-- The base chat function is the secure 2-argument implementation.
-- Recreate the 3-argument compatibility overload explicitly so any
-- pre-existing default parameters cannot conflict with this signature.

begin;

drop function if exists public.send_chat_message(text, text, uuid);

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
begin
  -- reply_message_id is accepted for frontend compatibility.
  -- The current chat schema does not persist reply linkage yet.
  return public.send_chat_message(chat_room, message_body);
end;
$$;

revoke all on function public.send_chat_message(text,text,uuid) from public, anon;
grant execute on function public.send_chat_message(text,text,uuid) to authenticated;

commit;
