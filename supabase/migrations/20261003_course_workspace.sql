-- Digital Marketing Pro — admin course workspace RPCs
-- Additive only. Existing learning content and learner RLS remain unchanged.

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

create or replace function public.admin_list_course_lessons(p_course_id uuid)
returns setof public.learning_lessons
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
  if not exists (select 1 from public.learning_courses where id = p_course_id) then
    raise exception 'course not found';
  end if;
  return query
    select l.*
    from public.learning_lessons l
    where l.course_id = p_course_id
    order by l.position asc;
end;
$$;

revoke all on function public.admin_list_courses() from public;
revoke all on function public.admin_list_course_lessons(uuid) from public;

grant execute on function public.admin_list_courses() to authenticated;
grant execute on function public.admin_list_course_lessons(uuid) to authenticated;
