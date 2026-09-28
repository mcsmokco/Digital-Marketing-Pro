-- Digital Marketing Pro — Supabase setup
-- Run this SQL in Supabase SQL Editor.

create table if not exists public.course_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{"done":[],"scores":{}}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.course_progress enable row level security;

drop policy if exists "Users can read own progress" on public.course_progress;
create policy "Users can read own progress"
on public.course_progress for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own progress" on public.course_progress;
create policy "Users can insert own progress"
on public.course_progress for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own progress" on public.course_progress;
create policy "Users can update own progress"
on public.course_progress for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  certificate_code text unique not null,
  issued_at timestamptz not null default now(),
  course_name text not null default 'Digital Marketing Pro'
);

alter table public.certificates enable row level security;

drop policy if exists "Users can read own certificates" on public.certificates;
create policy "Users can read own certificates"
on public.certificates for select
using (auth.uid() = user_id);
