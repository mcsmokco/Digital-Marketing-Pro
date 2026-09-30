// Adds the Admin shortcut only for profiles with an administrative role.
(() => {
  const url = window.DMP_SUPABASE_URL, key = window.DMP_SUPABASE_ANON_KEY;
  if (!url || !key || !window.supabase) return;
  const client = window.supabase.createClient(url, key);
  async function sync() {
    const nav = document.querySelector('.nav nav');
    if (!nav) return;
    nav.querySelector('[data-admin-link]')?.remove();
    const { data } = await client.auth.getSession();
    if (!data.session?.user) return;
    let role = null;
    try {
      const result = await client.from('profiles').select('role').eq('id', data.session.user.id).maybeSingle();
      role = result.data?.role || null;
    } catch (e) {}
    // Secure RPC fallback: works even when profile SELECT is restricted by RLS.
    if (!role) {
      try {
        const result = await client.rpc('current_profile_role');
        role = result.data || null;
      } catch (e) {}
    }
    const level = typeof window.DMP_ROLE_LEVEL === 'function' ? window.DMP_ROLE_LEVEL(role) : 0;
    if (level < 1) return;
    const link = document.createElement('a');
    link.href = 'admin.html';
    link.dataset.adminLink = '1';
    link.textContent = '🛡️ الإدارة';
    nav.appendChild(link);
  }
  document.addEventListener('DOMContentLoaded', () => {
    sync();
    client.auth.onAuthStateChange(() => setTimeout(sync, 0));
  });
})();
