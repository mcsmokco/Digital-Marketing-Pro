-- Digital Marketing Pro — enforce Owner privacy at RLS level
-- Run once in the Supabase SQL Editor after 20261001_owner_privacy.sql.

-- Managers may read profiles, but never the Owner row.
-- Owner keeps access through the self-read policy and the secure admin RPC.
drop policy if exists "Managers can read profiles" on public.profiles;
create policy "Managers can read non-owner profiles"
on public.profiles for select to authenticated
using (
  public.current_profile_role() in ('moderateur','administrateur','co_admin','admin','owner')
  and role <> 'owner'
);
