-- Digital Marketing Pro — enforce hierarchical profile visibility at RLS level
-- Run once in the Supabase SQL Editor after the profile visibility migration.
-- A manager can read only profiles strictly below their own role.
-- Users can still read their own profile through the existing self-read policy.

drop policy if exists "Managers can read profiles" on public.profiles;
drop policy if exists "Managers can read non-owner profiles" on public.profiles;

create policy "Managers can read lower role profiles"
on public.profiles
for select
to authenticated
using (
  public.role_level((select public.current_profile_role())) >= 1
  and public.role_level(role) < public.role_level((select public.current_profile_role()))
);
