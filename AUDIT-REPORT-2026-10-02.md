# Digital Marketing Pro — Audit Report

Date: 2026-10-02
Branch: `main`
HEAD: `6a8d61600db7fa5d7a59f22fab415c0ed2268246`

## Executive summary

The repository is active and the current architecture is coherent enough to continue development without a rewrite. The most important security work is concentrated in `supabase/migrations/20261001_rbac_security_consolidation.sql`, which is documented as the canonical RBAC/RLS source of truth.

The next development priority is not a redesign. It is runtime verification of the RBAC matrix against the live Supabase project, followed by completion of the unfinished Admin sections and Premium/payment flow.

## Verified architecture

### Public application
- `index.html` is the main learning/landing surface.
- The application has 12 learning units, lesson UI, progress hooks, account/auth UI, notifications and chat.
- Premium is presented in the UI but is not verified as a live payment product.

### Authentication
- Supabase session-based authentication is implemented in `auth-v7.js`.
- Password recovery/update flows exist.
- Login metadata is recorded through protected profile functions.
- Remember Me must persist email only; passwords must never be stored client-side.

### RBAC hierarchy

`user (0) < moderateur (1) < administrateur (2) < co_admin (3) < admin (4) < owner (5)`

The browser helpers in `admin-role.js` are convenience checks only. Sensitive authorization is intended to be enforced by Supabase RLS/RPC.

### Canonical database authorization

`supabase/migrations/20261001_rbac_security_consolidation.sql` defines:
- `role_level()`
- `current_profile_role()`
- canonical profile RLS policies
- one profile-creation trigger
- `update_my_profile()`
- `record_my_login_metadata()`
- `admin_update_user()`
- `admin_remove_user()`
- `admin_list_profiles()`
- `admin_sync_missing_profiles()`

The migration explicitly prevents management of equal/higher roles and protects Owner.

## Important findings

### 1. Current repository HEAD is the state checkpoint commit
The latest commit is `6a8d616...`, which adds the durable project state/audit report. The previous functional commit is `95bace1...` (`Harden RBAC user visibility and sensitive field masking`).

### 2. `supabase-schema.sql` is not the complete live schema
It contains the initial progress/certificate setup only. The canonical RBAC migration lives under `supabase/migrations/` and must be treated separately.

### 3. Legacy SQL files must not be executed casually
`ADMIN-SETUP.md` explicitly marks older profile/RBAC SQL files as historical. Do not rerun them merely because a function or policy is needed; doing so risks duplicate triggers, functions or conflicting RLS policies.

### 4. Admin access has a deliberate distinction
`admin.js` allows dashboard visibility from Modérateur (level 1), while actual role/Premium management requires level 2+. The canonical `admin_update_user()` RPC independently enforces level >= 2. This distinction should be runtime-tested before changing it.

### 5. Profile visibility is deliberately lower-ranked
`admin_list_profiles()` returns only profiles strictly below the actor's role. Owner personal metadata is additionally masked for non-Owner actors at the database function boundary.

### 6. Removal is stricter than role editing
The canonical migration requires level >= 3 for account removal, meaning Co Admin/Admin/Owner can remove lower roles. It blocks self-removal, Owner removal and equal/higher-role removal.

### 7. Admin UI has a fallback path
`admin.js` tries `admin_list_profiles()` first and can fall back to `admin_sync_missing_profiles()` plus a direct `profiles` query. The fallback is only safe if the live RLS policies remain correct; it should not be used as a replacement for the canonical RPC.

## Unfinished work

1. Runtime RBAC test matrix against the live Supabase project.
2. Reconcile live Supabase schema/function/policy inventory with the repository migration.
3. Complete Admin Course Management.
4. Complete Admin Premium Management.
5. Complete Admin Certificate Management.
6. Implement and verify Premium payment.
7. Finish production QA across mobile and desktop.
8. Verify public/admin navigation behavior and remove only unwanted redirects without weakening security boundaries.

## RBAC test matrix

### Owner
- [ ] Login and dashboard access
- [ ] See lower-ranked users
- [ ] See Owner-only metadata for own account/allowed data
- [ ] Assign User
- [ ] Assign Modérateur
- [ ] Assign Administrateur
- [ ] Assign Co Admin
- [ ] Assign Admin
- [ ] Cannot assign Owner through normal UI
- [ ] Cannot remove self
- [ ] Cannot remove another Owner

### Admin
- [ ] Dashboard access
- [ ] See only lower-ranked users
- [ ] Cannot see Owner sensitive metadata
- [ ] Can manage User/Modérateur/Administrateur/Co Admin
- [ ] Cannot manage Admin or Owner
- [ ] Cannot assign Admin or Owner
- [ ] Cannot remove Admin or Owner
- [ ] Cannot modify self

### Co Admin
- [ ] Dashboard access
- [ ] See only User/Modérateur/Administrateur
- [ ] Cannot manage Co Admin/Admin/Owner
- [ ] Cannot assign Co Admin/Admin/Owner
- [ ] Can remove only lower roles

### Administrateur
- [ ] Dashboard access
- [ ] See only User/Modérateur
- [ ] Can manage lower roles only
- [ ] Cannot assign Administrateur or higher
- [ ] Cannot remove equal/higher roles

### Modérateur
- [ ] Dashboard visibility
- [ ] Cannot change roles
- [ ] Cannot change Premium
- [ ] Cannot remove users
- [ ] Only lower-ranked users are visible through canonical listing

### User
- [ ] Cannot access the admin dashboard as an authorized management user
- [ ] Cannot read other profiles through RLS
- [ ] Cannot change own role
- [ ] Cannot change own Premium
- [ ] Cannot call privileged management RPCs successfully

## Security rules to preserve

- Never put `service_role` or secret keys in frontend code.
- Never store passwords in localStorage, sessionStorage, cookies or profile records.
- Never replace Supabase RLS/RPC enforcement with frontend checks.
- Never rerun legacy SQL blindly.
- Never rewrite the chat subsystem without reproducing a concrete bug.
- Never modify Owner-protection logic without testing all lower roles.
- Prefer one focused change and one commit at a time.

## Development decision

No broad refactor is justified by this audit. Continue from the current architecture. The immediate next task is the live RBAC test matrix; after the tests, fix only confirmed failures and update `PROJECT_STATE.md` with the exact results.
