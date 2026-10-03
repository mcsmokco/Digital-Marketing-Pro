-- Digital Marketing Pro — secure admin course listing
-- Allows Admin UI to see draft/published/archived native courses without weakening learner RLS.

create or replace function public.admin_list_courses()
returns setof public.learning_courses
language plpgsql
security definer
set search_path = public
as $$
declare v_level integer;
begin
  v_level := public.role_level(public.current_profile_role());
  if v_level < 2 then
    raise exception 'admin course management requires role level 2+';
  end if;

  return query
    select c.*
    from public.learning_courses c
    order by c.created_at desc;
end;
$$;

revoke all on function public.admin_list_courses() from public;
grant execute on function public.admin_list_courses() to authenticated;
