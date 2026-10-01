# Digital Marketing Pro — Security & Architecture Audit

## Canonical security model

The canonical RBAC/security implementation is:

`supabase/migrations/20261001_rbac_security_consolidation.sql`

Role hierarchy:

`user < moderateur < administrateur < co_admin < admin < owner`

Rules:

- A user can read their own profile.
- A management role can read only strictly lower roles.
- A role cannot manage or assign an equal/higher role.
- Owner is protected from role changes and deletion.
- Browser users cannot promote themselves or change their own Premium state.
- Profile deletion is not granted directly through RLS.
- Administrative changes use security-definer RPCs.
- Owner personal metadata is masked server-side for non-owner management users.

## Profile creation

There must be exactly one `auth.users` -> `profiles` creation trigger:

`on_auth_user_created_profile`

It calls `handle_new_user_profile()`.

The old `on_auth_user_created` / `handle_new_user()` pair is deprecated to avoid duplicate trigger logic.

## Sensitive fields

`role`, `premium`, `device_info`, and `last_login_at` must never be trusted from arbitrary client input.

`role` and `premium` are controlled by the management RPC and protected by the profile update trigger.

Raw IP collection is intentionally not performed by browser JavaScript. If IP auditing is needed, it must be implemented server-side with restricted access.

## Known product gaps after the RBAC consolidation

These are product features, not reasons to weaken the security model:

1. Real payment provider and webhook verification for Premium.
2. Server-authorized Premium content instead of frontend-only locking.
3. Certificate issuance/verification workflow.
4. Database-backed course/lesson/quiz CMS.
5. Automated tests for RBAC/RLS.
6. Separate public deployment artifact from development/documentation files.
7. SEO assets such as sitemap/robots/manifest where appropriate.

## Deployment rule

GitHub Pages may contain only the public anon Supabase configuration. Never publish a Supabase service-role key or other secret in JavaScript.

## Operational rule

Do not run legacy SQL files that redefine `handle_new_user_profile`, `handle_new_user`, `admin_update_user`, `admin_remove_user`, `current_profile_role`, or the profile SELECT policies. Use migrations instead.