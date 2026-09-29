// Digital Marketing Pro — Admin role helper
// This helper is intentionally small. The browser can read app_metadata,
// while actual database access must still be protected by Supabase RLS.
window.DMP_HAS_ADMIN_ROLE = function (user) {
  const role = user?.app_metadata?.role;
  return role === 'admin' || role === 'super_admin';
};
