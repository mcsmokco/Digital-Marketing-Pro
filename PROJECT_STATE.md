# Digital Marketing Pro — Project State

> **Purpose:** Durable project checkpoint. GitHub code + this file are the project continuity source of truth across ChatGPT conversations.
>
> **Last checkpoint:** 2026-10-03
> **Default branch:** `main`
> **Repository:** `mcsmokco/Digital-Marketing-Pro`

---

## 1. Mission
Digital Marketing Pro is an Arabic-first digital marketing learning platform with structured lessons, exercises, tests/projects, progress tracking, accounts, Supabase sync, certificates, community chat, and a Premium offering.

## 2. Current product surface
- `index.html`: public learning/landing site with 12 units, lesson UI, progress hooks, auth/account UI, notifications, chat drawer and Premium presentation.
- `lessons.js`: current native/static lesson catalog. **Do not replace it casually.**
- `admin.html`: protected/no-index admin dashboard with users plus Course/Premium/Certificate sections.
- `admin-courses.js` + `admin-courses.css`: native course-management layer. It is additive and does not replace the existing 36-lesson catalog.
- `admin-course-workspace.js` + `admin-course-workspace.css`: native Course Workspace with lesson listing, draft lesson creation and professional preview.
- `chat.html/js/css`: community chat subsystem; stabilized for mobile. Do not rewrite casually.
- `auth-v7.js`: Supabase auth/session, signup/login/reset, profile setup, login metadata and admin entry.
- `admin-role.js`: role hierarchy and UI convenience helpers.
- `admin.js`: user listing, role/Premium actions, removal, privacy masking and periodic sync.

## 3. RBAC hierarchy
`user (0) < moderateur (1) < administrateur (2) < co_admin (3) < admin (4) < owner (5)`.

Browser helpers are convenience checks only. Privileged authorization must remain in Supabase RLS/RPC.

Important current distinction: admin dashboard visibility starts at Modérateur (level 1), while role/Premium management requires level 2+.

## 4. Canonical Supabase security source
The canonical RBAC migration is:
`supabase/migrations/20261001_rbac_security_consolidation.sql`

It defines/updates role levels, profile RLS, profile trigger, `update_my_profile()`, `record_my_login_metadata()`, `admin_update_user()`, `admin_remove_user()`, `admin_list_profiles()`, and `admin_sync_missing_profiles()`.

Security rules to preserve:
- managers only read/manage strictly lower roles;
- Owner is protected;
- self role/Premium changes are blocked;
- self-removal is blocked;
- removal requires level >= 3;
- Owner personal metadata is masked for non-Owner actors;
- no browser `service_role` key.

`supabase-schema.sql` is only the original progress/certificate setup and is not a complete live database dump.

## 5. Authentication/security decisions to preserve
- Never store passwords in localStorage/sessionStorage/cookies/profile tables.
- Remember Me persists email only.
- Never put `service_role` or secret keys in frontend/GitHub Pages code.
- Do not replace RLS/RPC with frontend-only authorization.
- Do not execute legacy SQL files randomly.

## 6. Learning content architecture
### Existing content
The public product currently represents 12 training units and 36 lessons. These remain the stable baseline and are stored in `lessons.js`.

### New native content store — ADDED 2026-10-03
Migration:
`supabase/migrations/20261003_learning_content.sql`

New tables:
- `public.learning_courses`
- `public.learning_lessons`

Course fields include slug, title, description, category, level, draft/published/archived status, Premium flag, content source and creator.

Lesson fields include course, position, title, HTML body, quiz JSON, project and status.

Learners can only SELECT published courses/lessons. Administrative writes are RPC-only and require role level >= 2.

New admin RPCs:
- `admin_create_course()`
- `admin_publish_course()`
- `admin_archive_course()`
- `admin_add_lesson()`
- `admin_publish_lesson()`
- `admin_list_courses()`
- `admin_list_course_lessons()`

### Deployment status — UPDATED 2026-10-03
**The migration `20261003_learning_content.sql` was successfully executed in the live Supabase SQL Editor.**

Verified live after execution:
- `public.learning_courses` exists.
- `public.learning_lessons` exists.
- RLS is enabled on both tables (`rowsecurity = true`).
- `public.admin_list_course_lessons(uuid)` was created live and verified after an initial missing-function check.

The existing 12-module / 36-lesson catalog remains preserved.

### Admin UI status
The Courses panel has native-course management and the Course Workspace opens from `فتح الكورس`. The Workspace supports lesson listing, draft creation and preview without publishing.

### Verified test course
- Course: `Digital Marketing Fundamentals`
- Slug: `digital-marketing-fundamentals`
- Level: Beginner
- Status: Draft
- Premium: Free
- First lesson created as Draft:
  `ما هو التسويق الرقمي؟ ولماذا أصبح ضرورياً؟`
- Lesson position: 1
- Preview: **VERIFIED SUCCESSFULLY (100/100)**.
- Preview was confirmed to display the course and lesson content correctly.

## 7. Content-generation direction
User requirement: new digital-marketing courses/lessons should be **native content inside Digital Marketing Pro**, not external source links.

Target flow:
`Generated/Draft → Review → Published → Learner`

Do not auto-publish unreviewed AI content. The automatic generation engine is intentionally **not claimed complete yet**; it should be added as a separate, tested layer after the native content store is verified.

## 8. Known incomplete work
1. Verify native Course Management RPC authorization with Owner/Admin/Co Admin and lower roles.
2. Add professional lesson editor/lesson management to the native store.
3. Build the automatic original-content generation pipeline without external learner redirects.
4. Decide and implement a free/low-cost generation strategy; do not introduce an unapproved paid API.
5. Live end-to-end RBAC test matrix.
6. Reconcile live Supabase function/policy/schema inventory with Git.
7. Finish Admin Premium Management and payment.
8. Finish Admin Certificate Management.
9. Final mobile/desktop production QA.
10. Verify unwanted redirects/navigation without weakening security boundaries.

## 9. RBAC runtime test matrix — NOT YET EXECUTED
Test Owner, Admin, Co Admin, Administrateur, Modérateur and User for visibility, management limits, Owner protection, self-protection, RPC enforcement, refresh, logout/login and direct `admin.html` access.

## 10. Things not to redo without evidence
- Main public learning structure.
- Existing `lessons.js` catalog.
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
**Build the professional Lesson Editor/Lesson Management layer.** It should allow editing the lesson title, position, HTML content, project and quiz data, while preserving Draft/Published/Archived workflow and Supabase RPC/RLS authorization. Do not start the automatic generation engine until native lesson management is solid.

## 13. Verification status
- Static repository changes: committed.
- Live Supabase migration: **APPLIED AND VERIFIED**.
- Live tables: `learning_courses` and `learning_lessons` confirmed present.
- Live RLS: enabled on both native learning tables.
- Live `admin_list_course_lessons(uuid)`: **CREATED AND VERIFIED**.
- Course Workspace browser runtime: **VERIFIED**.
- First native test lesson creation: **VERIFIED**.
- Course Preview: **VERIFIED SUCCESSFULLY (100/100)**.
- Existing RBAC implementation: preserved; no rewrite performed.
- Existing 36-lesson catalog: preserved.
- Full RBAC runtime matrix: pending.

## Change log
### 2026-10-03 — Course Workspace + Preview runtime verification
- Opened the existing draft course through the native Course Workspace.
- Verified the live `admin_list_course_lessons(uuid)` RPC after creating it in Supabase.
- Created the first native lesson as Draft.
- Verified the professional Course Preview displays the lesson correctly.
- Confirmed Preview is read-only and does not publish/mutate the course.
- Runtime result: **SUCCESS / 100/100**.
- Next checkpoint: professional Lesson Editor/Lesson Management.

### 2026-10-03 — Course Workspace foundation
- Added secure admin RPCs for listing courses and course lessons, using the existing role-level 2+ authorization model.
- Added a dedicated Course Workspace UI with course metadata, lesson list, lesson draft creation and publish actions.
- Added responsive Workspace styling and wired the Workspace into `admin.html`.
- Added a `فتح الكورس` action to native course cards.
- Existing learning tables, learner RLS, original lesson catalog and role hierarchy were left untouched.

### 2026-10-03 — Live native learning schema verification
- Executed `20261003_learning_content.sql` in the live Supabase SQL Editor successfully.
- Verified `learning_courses` and `learning_lessons` exist.
- Verified RLS is enabled on both tables.
- Next checkpoint was live Admin Courses runtime/RPC verification.

### 2026-10-03 — Native Courses foundation
- Added additive native learning-content schema and RLS/RPC controls.
- Added Admin Courses management shell with create/list/publish/archive actions.
- Added responsive course-admin styling.
- Exposed a shared Supabase anon client without introducing a service-role key.
- Updated this checkpoint to make the live deployment/test boundary explicit.

### 2026-10-02 — Durable checkpoint + audit
- Audited repository metadata, public app, admin app, auth, role helpers, admin logic and Supabase SQL/migrations.
- Created durable `PROJECT_STATE.md` and `AUDIT-REPORT-2026-10-02.md`.
