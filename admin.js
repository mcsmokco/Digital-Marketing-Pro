(() => {
  const url = window.DMP_SUPABASE_URL;
  const key = window.DMP_SUPABASE_ANON_KEY;
  const enabled = Boolean(url && key && window.supabase);
  const client = enabled ? window.supabase.createClient(url, key) : null;
  const $ = id => document.getElementById(id);

  // IMPORTANT: This is only a first protection layer. The real admin role must be enforced with Supabase RLS/role data before exposing private data.
  const ADMIN_EMAILS = [];

  async function init() {
    if (!enabled) return deny('Supabase غير مفعّل.');
    const { data, error } = await client.auth.getSession();
    if (error || !data.session?.user) return deny('خاصك تسجل الدخول أولاً.');
    const user = data.session.user;
    $('adminEmail').textContent = user.email || 'Admin';
    if (!ADMIN_EMAILS.includes((user.email || '').toLowerCase())) return deny('هذا الحساب ما عندوش صلاحية Admin حالياً.');
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
    // Do not query auth.users from the browser. Supabase Auth users should be exposed through a secure server-side/RLS-safe table later.
    $('usersCount').textContent = '—';
    $('premiumCount').textContent = '—';
  }

  $('logoutAdmin').addEventListener('click', async () => {
    if (client) await client.auth.signOut({ scope: 'local' }).catch(() => {});
    location.href = 'index.html';
  });

  document.addEventListener('DOMContentLoaded', init);
})();
