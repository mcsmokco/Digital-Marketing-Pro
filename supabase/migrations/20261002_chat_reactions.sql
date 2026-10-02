-- Digital Marketing Pro — chat reactions
-- Additive migration: no chat/user data is deleted.
begin;

create table if not exists public.chat_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('👍','❤️','😂','😮','😢','🔥','👏','🎉','👑','💯')),
  created_at timestamptz not null default now(),
  unique(message_id,user_id,emoji)
);

create index if not exists chat_reactions_message_idx
  on public.chat_message_reactions(message_id,created_at desc);

alter table public.chat_message_reactions enable row level security;
drop policy if exists "chat_reactions_read" on public.chat_message_reactions;
create policy "chat_reactions_read" on public.chat_message_reactions
for select to authenticated
using (
  exists (
    select 1 from public.chat_messages m
    where m.id=message_id
      and (m.room='public' or public.role_level(public.current_profile_role())>=1)
  )
);

revoke all on public.chat_message_reactions from anon,authenticated;
grant select on public.chat_message_reactions to authenticated;

drop function if exists public.toggle_chat_reaction(uuid,text);
create or replace function public.toggle_chat_reaction(
  target_message_id uuid,
  reaction_emoji text
) returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  uid uuid:=auth.uid();
  target_room text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if reaction_emoji not in ('👍','❤️','😂','😮','😢','🔥','👏','🎉','👑','💯') then
    raise exception 'invalid reaction';
  end if;
  select room into target_room from public.chat_messages where id=target_message_id;
  if target_room is null then raise exception 'message not found'; end if;
  if target_room='admin' and public.role_level(public.current_profile_role())<1 then
    raise exception 'admin chat is restricted';
  end if;

  if exists(select 1 from public.chat_message_reactions where message_id=target_message_id and user_id=uid and emoji=reaction_emoji) then
    delete from public.chat_message_reactions where message_id=target_message_id and user_id=uid and emoji=reaction_emoji;
    return false;
  end if;

  insert into public.chat_message_reactions(message_id,user_id,emoji)
  values(target_message_id,uid,reaction_emoji);
  return true;
end;
$$;

drop function if exists public.get_chat_reactions(uuid[]);
create or replace function public.get_chat_reactions(
  message_ids uuid[]
) returns table(
  message_id uuid,
  emoji text,
  reaction_count bigint,
  reacted boolean
)
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select r.message_id,r.emoji,count(*)::bigint,
         bool_or(r.user_id=auth.uid())
  from public.chat_message_reactions r
  join public.chat_messages m on m.id=r.message_id
  where r.message_id=any(coalesce(message_ids,'{}'::uuid[]))
    and (m.room='public' or public.role_level(public.current_profile_role())>=1)
  group by r.message_id,r.emoji
  order by r.message_id,r.emoji;
$$;

revoke all on function public.toggle_chat_reaction(uuid,text) from public,anon;
revoke all on function public.get_chat_reactions(uuid[]) from public,anon;
grant execute on function public.toggle_chat_reaction(uuid,text) to authenticated;
grant execute on function public.get_chat_reactions(uuid[]) to authenticated;

do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.chat_message_reactions;
    exception when duplicate_object then null;
    end;
  end if;
exception when undefined_table then null;
end $$;

commit;
