# Digital Marketing Pro — Project State

> **Purpose:** This file is the durable project checkpoint. It is the first document to read before making changes. It prevents repeated work across ChatGPT conversations and reduces the risk of breaking working features.
>
> **Last audit:** 2026-10-02
> **Default branch:** `main`
> **Repository:** `mcsmokco/Digital-Marketing-Pro`
> **Current HEAD:** `95bace1ea7bf53879fb8d6e54d63a2ead944cb79`
>
---

## 1. Project mission

Digital Marketing Pro is an Arabic-first digital marketing learning platform, intended to take a learner from beginner to professional through structured lessons, exercises, quizzes, projects, progress tracking, certificates, accounts, cloud sync, community chat, and a future Premium offering.

The README currently describes 12 training modules, lessons/exercises/tests, local progress persistence, optional Supabase account/cloud sync, completion certificates, and GitHub Pages deployment.

## 2. Repository / deployment baseline

- GitHub repository is public and active.
- Default branch: `main`.
- GitHub Pages is enabled according to repository metadata.
- Repository size is small enough for direct GitHub-based maintenance.
- There are currently no open GitHub issues.
- The most recent commit is an RBAC/security-hardening commit.
- **Do not rewrite history or force-push.**
- Prefer small, isolated commits and verify the affected feature after each change.

## 3. Current product surface verified in code

### Public learning site
`index.html` is the main landing/learning page. It currently contains:
- Hero section and learning CTA.
- 12-unit learning path container.
- Premium section marked `COMING SOON`.
- Roadmap.
- Marketing toolkit/resources.
- About/final CTA.
- Community chat drawer.
- Notifications entry.
- Account/auth modal.
- Account settings panel.
- Lesson modal.
- Local/cloud progress integration hooks.

The page loads Supabase JS, Supabase configuration, role helpers, authentication, login metadata, admin-link logic, lessons, main script, Premium access, account settings, and chat.

### Admin dashboard
`admin.html` exists and is explicitly no-index/no-follow. It contains:
- Dashboard statistics.
- Users management.
- Course management section placeholder.
- Premium section placeholder.
- Certificates section placeholder.
- Responsive admin UI assets.
- User search/filter/sort controls.
- Role filter including Owner, Co Admin, Administrator, Modérateur and User.
- Premium filter.
- User action area.
- Mobile user-detail hint.
- Admin authentication/authorization checks.

### Community chat
The recent commit history shows active work on:
- Chat page layout/mobile readability.
- Homepage chat drawer restoration.
- Mobile chat layout and composer stabilization.
- Emoji picker/mobile composer fixes.
- Chat cache-busting.
- Notifications entry.

**Do not casually rewrite chat CSS/JS.** It has had multiple stabilization passes and should be changed in isolation with mobile regression testing.

## 4. Authentication / account system

`auth-v7.js` currently implements:
- Supabase session detection.
- Login/signup/reset-password UI.
- Account modal created dynamically when needed.
- Explicit logout handling.
- Auth-token cleanup on logout.
- Profile loading.
- Username/date-of-birth profile setup.
- Username validation and uniqueness check.
- Device/browser metadata collection.
- Last-login timestamp recording.
- Password recovery/update flow.
- Progress sync entry point.
- Role-aware account UI.
- Admin dashboard entry for management roles.

Important existing decision:
- **Remember Me must not store a password.** Recent commit history explicitly records a fix to persist email only.
- Do not introduce client-side password storage.

## 5. RBAC model — verified

`admin-role.js` defines a hierarchical role model:

| Level | Role | Meaning |
|---:|---|---|
| 0 | `user` | Normal user |
| 1 | `moderateur` | Moderator |
| 2 | `administrateur` | Administrator |
| 3 | `co_admin` | Co Admin |
| 4 | `admin` | Admin |
| 5 | `owner` | Owner / Founder |

Legacy role aliases are normalized:
- `administrator` -> `administrateur`
- `moderator` -> `moderateur`
- `super_admin` -> `owner`

Important helper rules currently implemented:
- Management/admin visibility is level >= 2 in the role helper.
- Premium-access helper also grants access to moderator+ roles or users with Premium.
- A manager may manage only targets below their own level.
- An actor cannot assign a role equal to or above their own level.
- Owner cannot be managed through the normal role UI.

**Important discrepancy to keep in mind:** `admin.html`/`admin.js` currently allow access from Modérateur (level 1), while the actual management functions require level >= 2. This appears intentional as a supervision/dashboard distinction, but it should be tested and documented before changing it.

## 6. Admin user-management security

`admin.js` currently:
- Gets the current session.
- Loads the current profile.
- Normalizes role and computes level.
- Allows dashboard access from moderator level and above.
- Loads user profiles through `admin_list_profiles` RPC.
- Has a compatibility fallback for older projects using `admin_sync_missing_profiles` plus direct `profiles` selection.
- Uses `admin_update_user` RPC to update role/Premium.
- Uses `admin_remove_user` RPC to remove users.
- Prevents the UI from changing/removing Owner.
- Prevents an actor from modifying a target at the same or higher level.
- Hides Owner-sensitive fields from non-Owner roles.
- Shows device/browser/last-login information with Owner-specific privacy behavior.
- Automatically syncs the user list every 30 seconds while the page is visible.

Recent commit history confirms a security-hardening pass titled:
`Harden RBAC user visibility and sensitive field masking`.

Recent related commits also confirm:
- Co Admin user-list/RLS fallback fix.
- Admin cache refresh after users/roles fixes.
- User-rank display beside username.
- Responsive admin layout/mobile optimization.

## 7. Supabase / database baseline

The repository contains `supabase-schema.sql` with the original course persistence schema:

### `course_progress`
- `user_id` primary key referencing `auth.users`.
- JSONB state.
- `updated_at` timestamp.
- RLS enabled.
- Policies allow each user to select/insert/update only their own progress.

### `certificates`
- UUID id.
- `user_id` referencing `auth.users`.
- Unique certificate code.
- Issued timestamp.
- Course name defaulting to Digital Marketing Pro.
- RLS enabled.
- Policy allows users to read their own certificates.

The live Supabase project has evolved beyond the original `supabase-schema.sql`; the ChatGPT work history indicates additional `profiles`, RBAC policies/RPC functions, login metadata, chat, and administrative functions exist in the live project. Therefore:

> **Do not treat `supabase-schema.sql` as a complete dump of the live database.** It is an initial setup file. Before changing live RBAC/database logic, inspect the actual current SQL/migrations and Supabase state supplied in the active task.

## 8. Supabase configuration / security

`supabase-config.js` contains:
- Project URL.
- A publishable/anon client key.

The file explicitly warns never to put `service_role` in the browser.

The current key is a public client key and is expected to be exposed in a frontend application; security must come from Supabase RLS/RPC rather than hiding the anon/publishable key.

**Never commit:** service-role keys, private API keys, passwords, database passwords, or other secrets.

## 9. Progress / learning architecture

README says:
- 12 modules.
- Lessons, exercises and tests.
- Local progress persistence.
- Optional cloud synchronization through Supabase.
- Completion certificate after all modules.
- GitHub Pages deployment.

`index.html` confirms 12 units / 36 lessons / 12 projects are represented in the product copy/UI.

## 10. Premium architecture

Premium UI is already present but payment is not yet connected.

Current state:
- Premium section exists.
- Premium price is shown as 49 MAD in the current UI copy.
- Button is present.
- UI says payment will be connected in a later stage.
- Premium access logic exists in the client role helpers and `premium-access.js`.

**Do not claim payment is live.** It is not verified as live from the repository audit.

## 11. Chat / notifications

Chat and notifications are active product areas and have recently received multiple mobile fixes.

Recent commits indicate:
- Chat page polish.
- Mobile readability work.
- Homepage chat drawer restoration.
- Mobile overflow prevention.
- Composer and emoji-picker stabilization.
- Cache-busting updates.

Treat chat as a protected working subsystem. Any future change must be narrowly scoped.

## 12. Known unfinished / incomplete areas

1. **Live end-to-end RBAC test matrix is still required.**
   - Owner -> all lower roles.
   - Admin -> lower roles only.
   - Co Admin -> lower roles only.
   - Administrator -> lower roles only.
   - Moderator -> dashboard visibility but no role management.
   - User -> no admin access.
   - Confirm direct URL access, refresh, logout/login and RPC enforcement.

2. **Actual live Supabase schema/RPC inventory should be reconciled with Git.**
   The repository's original schema file is not a full live dump.

3. **Admin sections for Courses, Premium and Certificates are currently UI shells/placeholders.**

4. **Premium payment is not implemented/verified live.**

5. **The requirement to avoid unnecessary page-to-page redirects should be handled carefully.**
   The current site uses normal anchors/hash navigation on the public page, while the admin dashboard is a separate `admin.html` page. Do not convert this architecture blindly; first identify which transitions are actually causing unwanted redirects and preserve security boundaries.

6. **Cross-conversation continuity:** this file is now the durable checkpoint. Update it after every significant project milestone.

## 13. Things that are considered working / do not redo without evidence

- Main public landing/learning structure.
- Existing 12-module product structure.
- Authentication UI and Supabase session handling.
- Logout token cleanup behavior.
- Remember-Me approach that stores email only, not passwords.
- Existing role normalization hierarchy.
- Existing admin user-list UI.
- Existing responsive admin work.
- Existing chat/mobile stabilization.
- Existing Owner-sensitive-field masking.
- Existing Supabase RLS/RPC-based security approach.

Before changing any of these, reproduce the bug or identify a concrete requirement.

## 14. Safe development protocol

1. Read this file first.
2. Inspect the exact target file(s) before editing.
3. Do not rewrite unrelated files.
4. Do not replace security with frontend-only checks.
5. Keep RBAC enforcement in Supabase RLS/RPC.
6. Never store passwords in localStorage, sessionStorage, cookies, or profile tables.
7. Make one focused change at a time.
8. Commit with a descriptive message.
9. Update this file with the new state, tests and next step.
10. Only then move to the next feature.

## 15. Current next action

**Next task: complete the RBAC end-to-end test matrix against the live Supabase project before making another architectural change.**

Priority order:
1. Verify Owner login and dashboard.
2. Verify user list and sensitive-field visibility.
3. Test Owner -> Co Admin.
4. Test Owner -> Admin.
5. Test Admin/Co Admin cannot modify Owner.
6. Test lower roles cannot escalate themselves.
7. Test removal restrictions.
8. Test direct `admin.html` access for User.
9. Test logout/login/refresh.
10. Record results here.

## 16. Audit limitations

This audit is based on the current GitHub `main` branch and the repository files accessible through the GitHub integration. It does **not** by itself prove the current live Supabase database state, browser behavior, GitHub Pages runtime behavior, or every file's correctness. Those require runtime testing.

The three ChatGPT shared-conversation URLs supplied for historical context could not be treated as a complete source of truth for their full message contents, so this state deliberately prioritizes verified repository code and commit history over guesses from conversation titles.

---

## Change log for this checkpoint

### 2026-10-02 — Initial durable state created
- Audited repository metadata and current `main` HEAD.
- Reviewed README, main public page, admin page, authentication, role helpers, admin logic and Supabase baseline schema/config.
- Reviewed recent commit history around RBAC, users, Remember Me, chat and responsive admin work.
- Created this `PROJECT_STATE.md` as the durable project source-of-truth/checkpoint.
