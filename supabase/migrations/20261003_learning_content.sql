-- Digital Marketing Pro — native learning content model
-- Safe additive migration: does not alter or replace the existing 12-module lesson system.

create table if not exists public.learning_courses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text not null default '',
  category text not null default 'digital-marketing',
  level text not null default 'beginner' check (level in ('beginner','intermediate','advanced')),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  is_premium boolean not null default false,
  content_source text not null default 'native' check (content_source in ('native','generated')),
  created_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.learning_courses(id) on delete cascade,
  position integer not null check (position > 0),
  title text not null,
  body_html text not null default '',
  quiz jsonb not null default '[]'::jsonb,
  project text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(course_id, position)
);

create index if not exists learning_courses_status_idx on public.learning_courses(status);
create index if not exists learning_courses_category_idx on public.learning_courses(category);
create index if not exists learning_lessons_course_idx on public.learning_lessons(course_id, position);

alter table public.learning_courses enable row level security;
alter table public.learning_lessons enable row level security;

-- Public learners only see published content.
drop policy if exists "Published courses are readable" on public.learning_courses;
create policy "Published courses are readable"
on public.learning_courses for select
using (status = 'published');

drop policy if exists "Published lessons are readable" on public.learning_lessons;
create policy "Published lessons are readable"
on public.learning_lessons for select
using (
  status = 'published'
  and exists (
    select 1 from public.learning_courses c
    where c.id = course_id and c.status = 'published'
  )
);

-- Admin mutations are intentionally RPC-only. No frontend service_role key is required.
create or replace function public.admin_create_course(
  p_slug text,
  p_title text,
  p_description text default '',
  p_category text default 'digital-marketing',
  p_level text default 'beginner',
  p_is_premium boolean default false,
  p_content_source text default 'generated'
)
returns public.learning_courses
language plpgsql
security definer
set search_path = public
as $$
declare v_level integer; v_course public.learning_courses;
begin
  v_level := public.role_level(public.current_profile_role());
  if v_level < 2 then raise exception 'admin course management requires role level 2+'; end if;
  insert into public.learning_courses(slug,title,description,category,level,is_premium,content_source,created_by)
  values(lower(trim(p_slug)),trim(p_title),coalesce(p_description,''),coalesce(p_category,'digital-marketing'),coalesce(p_level,'beginner'),coalesce(p_is_premium,false),coalesce(p_content_source,'generated'),auth.uid())
  returning * into v_course;
  return v_course;
end;
$$;

create or replace function public.admin_publish_course(p_course_id uuid)
returns public.learning_courses
language plpgsql
security definer
set search_path = public
as $$
declare v_level integer; v_course public.learning_courses;
begin
  v_level := public.role_level(public.current_profile_role());
  if v_level < 2 then raise exception 'admin course management requires role level 2+'; end if;
  update public.learning_courses
     set status='published', published_at=coalesce(published_at,now()), updated_at=now()
   where id=p_course_id returning * into v_course;
  if v_course.id is null then raise exception 'course not found'; end if;
  return v_course;
end;
$$;

create or replace function public.admin_archive_course(p_course_id uuid)
returns public.learning_courses
language plpgsql
security definer
set search_path = public
as $$
declare v_level integer; v_course public.learning_courses;
begin
  v_level := public.role_level(public.current_profile_role());
  if v_level < 2 then raise exception 'admin course management requires role level 2+'; end if;
  update public.learning_courses set status='archived', updated_at=now() where id=p_course_id returning * into v_course;
  if v_course.id is null then raise exception 'course not found'; end if;
  return v_course;
end;
$$;

create or replace function public.admin_add_lesson(
  p_course_id uuid,
  p_position integer,
  p_title text,
  p_body_html text,
  p_quiz jsonb default '[]'::jsonb,
  p_project text default null
)
returns public.learning_lessons
language plpgsql
security definer
set search_path = public
as $$
declare v_level integer; v_lesson public.learning_lessons;
begin
  v_level := public.role_level(public.current_profile_role());
  if v_level < 2 then raise exception 'admin course management requires role level 2+'; end if;
  if not exists(select 1 from public.learning_courses where id=p_course_id) then raise exception 'course not found'; end if;
  insert into public.learning_lessons(course_id,position,title,body_html,quiz,project)
  values(p_course_id,p_position,trim(p_title),coalesce(p_body_html,''),coalesce(p_quiz,'[]'::jsonb),p_project)
  returning * into v_lesson;
  return v_lesson;
end;
$$;

create or replace function public.admin_publish_lesson(p_lesson_id uuid)
returns public.learning_lessons
language plpgsql
security definer
set search_path = public
as $$
declare v_level integer; v_lesson public.learning_lessons;
begin
  v_level := public.role_level(public.current_profile_role());
  if v_level < 2 then raise exception 'admin course management requires role level 2+'; end if;
  update public.learning_lessons set status='published', updated_at=now() where id=p_lesson_id returning * into v_lesson;
  if v_lesson.id is null then raise exception 'lesson not found'; end if;
  return v_lesson;
end;
$$;

revoke all on function public.admin_create_course(text,text,text,text,text,boolean,text) from public;
revoke all on function public.admin_publish_course(uuid) from public;
revoke all on function public.admin_archive_course(uuid) from public;
revoke all on function public.admin_add_lesson(uuid,integer,text,text,jsonb,text) from public;
revoke all on function public.admin_publish_lesson(uuid) from public;

grant execute on function public.admin_create_course(text,text,text,text,text,boolean,text) to authenticated;
grant execute on function public.admin_publish_course(uuid) to authenticated;
grant execute on function public.admin_archive_course(uuid) to authenticated;
grant execute on function public.admin_add_lesson(uuid,integer,text,text,jsonb,text) to authenticated;
grant execute on function public.admin_publish_lesson(uuid) to authenticated;
