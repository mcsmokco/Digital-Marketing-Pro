# Admin setup — Digital Marketing Pro

## Secure role assignment

The Admin dashboard authorizes users from Supabase `app_metadata.role` (`admin` or `super_admin`).

Do **not** put the Supabase `service_role` key in GitHub Pages or browser JavaScript.

To grant Admin to your own account, use a trusted server-side Supabase mechanism/dashboard to set:

```json
{"role":"admin"}
```

Then sign out and sign back in so the new JWT contains the updated `app_metadata`.

## Test

1. Sign in with the Admin account.
2. Open `/admin.html`.
3. Confirm the dashboard is visible.
4. Sign in with a normal user and open `/admin.html`; access must be denied.
