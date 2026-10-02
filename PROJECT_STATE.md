# Digital Marketing Pro — Project State

> **Purpose:** Durable project checkpoint. Read this before making changes. GitHub code + this file are the project continuity source of truth across ChatGPT conversations.
>
> **Last audit:** 2026-10-02
> **Default branch:** `main`
> **Repository:** `mcsmokco/Digital-Marketing-Pro`
> **Current HEAD:** `f67a3f63e0f63ff8e4a8e6c111ec9c9b1bd763e2`
>
---

## 1. Mission
Digital Marketing Pro is an Arabic-first digital marketing learning platform with structured lessons, exercises, tests/projects, progress tracking, accounts, Supabase sync, certificates, community chat, and a future Premium offering.

## 2. Current verified surface
- `index.html`: public learning/landing site, 12 units, lesson UI, progress hooks, auth/account UI, notifications, chat drawer and Premium presentation.
- `admin.html`: separate protected/no-index admin dashboard with statistics, users management and placeholder sections for Courses, Premium and Certificates.
- `chat.html/js/css`: community chat subsystem; recently stabilized for mobile. Do not rewrite casually.
- `auth-v7.js`: Supabase auth/session, signup/login/reset, profile setup, login metadata and admin entry.
- `admin-role.js`: role hierarchy and UI convenience helpers.
- `admin.js`: user listing, role/Premium actions, removal, privacy masking and periodic sync.

## 3. RBAC hierarchy
`user (0) < moderateur (1) < administrateur (2) < co_admin (3) < admin (4) < owner (5)`.

Browser helpers are convenience checks only. Privileged authorization must remain in Supabase RLS/RPC.

Important current distinction: the admin dashboard is visible from Modérateur (level 1), while role/Premium management requires level 2+. This must be runtime-tested before changing it.

## 4. Canonical Supabase security source
The canonical migration is:
`supabase/migrations/20261001_rbac_security_consolidation.sql`

It defines/updates:
- `role_level()`
- `current_profile_role()`
- canonical profile RLS policies
- one profile creation trigger
- `update_my_profile()`
- `record_my_login_metadata()`
- `admin_update_user()`
- `admin_remove_user()`
- `admin_list_profiles()`
- `admin_sync_missing_profiles()`

Security rules currently encoded:
- managers only read/manage strictly lower roles;
- Owner is protected;
- self role/Premium changes are blocked;
- self-removal is blocked;
- removal requires level >= 3;
- `admin_list_profiles()` masks Owner personal metadata for non-Owner actors;
- profile creation is synchronized by one trigger;
- no browser `service_role` key.

`supabase-schema.sql` is only the original progress/certificate setup and is **not** a complete live database dump.

## 5. Authentication/security decisions to preserve
- Never store passwords in localStorage/sessionStorage/cookies/profile tables.
- Remember Me persists email only.
- Never put `service_role` or secret keys in frontend/GitHub Pages code.
- Do not replace RLS/RPC with frontend-only authorization.
- Do not execute legacy SQL files randomly; `ADMIN-SETUP.md` identifies them as historical.

## 6. Product areas
### Learning
12 units / lessons / exercises / tests / projects are represented in the current product UI.

### Progress/certificates
Initial schema provides `course_progress` and `certificates` with RLS. Completion flow exists in product architecture, but full production/runtime verification is still required.

### Premium
Premium UI and access helpers exist. Current UI shows 49 MAD. **Payment is not live/verified.**

### Chat
Chat, mobile layout, composer and emoji picker have received multiple stabilization commits. Treat as a protected subsystem and change narrowly with mobile regression testing.

## 7. Known incomplete work
1. Live end-to-end RBAC test matrix against Supabase.
2. Reconcile live Supabase function/policy/schema inventory with Git.
3. Finish Admin Course Management.
4. Finish Admin Premium Management.
5. Finish Admin Certificate Management.
6. Implement and verify Premium payment.
7. Final mobile/desktop production QA.
8. Verify unwanted redirects/navigation without weakening security boundaries.

## 8. Current audit result
A comprehensive static repository audit was performed on 2026-10-02. The detailed report is:
`AUDIT-REPORT-2026-10-02.md`

The audit found no justification for a broad rewrite. Continue incrementally from the current architecture.

## 9. RBAC runtime test matrix — NOT YET EXECUTED
### Owner
- [ ] Login/dashboard
- [ ] See lower roles
- [ ] Owner-only metadata behavior
- [ ] Assign User / Modérateur / Administrateur / Co Admin / Admin
- [ ] Cannot assign Owner through normal UI
- [ ] Cannot remove self or Owner

### Admin
- [ ] Dashboard
- [ ] See only lower roles
- [ ] Owner metadata hidden
- [ ] Manage lower roles only
- [ ] Cannot manage/assign/remove Admin or Owner
- [ ] Cannot modify self

### Co Admin
- [ ] Dashboard
- [ ] See only User/Modérateur/Administrateur
- [ ] Cannot manage/assign/remove equal or higher roles

### Administrateur
- [ ] Dashboard
- [ ] See only User/Modérateur
- [ ] Cannot manage/assign equal or higher roles

### Modérateur
- [ ] Dashboard visibility
- [ ] No role/Premium changes
- [ ] No removal
- [ ] Only lower-ranked users visible through canonical listing

### User
- [ ] Cannot use admin dashboard as authorized manager
- [ ] Cannot read other profiles
- [ ] Cannot modify own role/Premium
- [ ] Cannot call privileged RPCs successfully

Also test refresh, logout/login, direct `admin.html` access and RPC enforcement.

## 10. Things not to redo without evidence
- Main public learning structure.
- Existing auth/session behavior.
- Remember-Me email-only behavior.
- Existing role hierarchy.
- Existing admin users UI.
- Existing responsive admin work.
- Existing chat/mobile stabilization.
- Existing Owner-sensitive masking.
- Existing RLS/RPC security approach.

## 11. Safe development protocol
1. Read this file first.
2. Inspect exact target files.
3. Make one focused change.
4. Preserve database authorization in RLS/RPC.
5. Never store passwords/secrets client-side.
6. Commit descriptively.
7. Update this file with tests/results/next action.
8. Only then continue.

## 12. Current next action
**Run the live RBAC end-to-end test matrix before another architectural change.** Fix only confirmed failures, then update this file with exact results.

## 13. Audit limitations
GitHub inspection proves repository code/history, not live browser behavior or the current live Supabase database state. Runtime testing is required for those claims.

The three supplied ChatGPT share links were not treated as complete source material because their full message bodies were not reliably available through the integration. Verified repository code and history therefore take precedence over guesses.

## Change log
### 2026-10-02 — Durable checkpoint + audit
- Audited repository metadata, tree, README, public app, admin app, auth, role helpers, admin logic and Supabase SQL/migrations.
- Reviewed recent commits around RBAC, user management, Remember Me and mobile chat.
- Created `PROJECT_STATE.md`.
- Created `AUDIT-REPORT-2026-10-02.md`.
- Current next action is live RBAC runtime testing.
