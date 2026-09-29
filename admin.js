(() => {
  const url = window.DMP_SUPABASE_URL;
  const key = window.DMP_SUPABASE_ANON_KEY;
  const enabled = Boolean(url && key && window.supabase);
  const client = enabled ? window.supabase.createClient(url, key) : null;
  const $ = id => document.getElementById(id);

  function hasAdminRole(user) {
    return typeof window.DMP_HAS_ADMIN_ROLE === 'function'
      ? window.DMP_HAS_ADMIN_ROLE(user)
      : false;
  }

  async function init() {
    if (!enabled) return deny('Supabase غير مفعّل.');
    const { data, error } = await client.auth.getSession();
    if (error || !data.session?.user) return deny('خاصك تسجل الدخول أولاً.');
    const user = data.session.user;
    $('adminEmail').textContent = user.email || 'Admin';
    if (!hasAdminRole(user)) return deny('هذا الحساب ما عندوش صلاحية Admin. خاص role = admin في Supabase.');
    $('adminContent').hidden = false;
    await loadStats();
  }

  function deny(message) {
    $('adminEmail').textContent = '';
    $('adminContent').hidden = true;
    $('accessDenied').hidden = false;
    const p = $('accessDenied').querySelector('p');
    if (p) p.textContent = message;
  }

  async function loadStats() {
    // Keep statistics disabled until dedicated admin-safe tables/RLS are configured.
    // Never query auth.users directly from the browser client.
    $('usersCount').textContent = '—';
    $('premiumCount').textContent = '—';
  }

  $('logoutAdmin').addEventListener('click', async () => {
    if (client) await client.auth.signOut({ scope: 'local' }).catch(() => {});
    location.href = 'index.html';
  });

  document.addEventListener('DOMContentLoaded', init);
})();
