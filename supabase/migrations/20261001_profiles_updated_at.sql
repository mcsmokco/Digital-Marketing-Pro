-- Digital Marketing Pro
-- Add the timestamp column required by the RBAC/security migration.
-- Safe for existing databases and existing profile data.

alter table public.profiles
  add column if not exists updated_at timestamptz default now();

update public.profiles
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;
