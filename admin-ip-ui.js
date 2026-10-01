(() => {
  const $ = id => document.getElementById(id);
  let timer = null;
  let loading = false;

  async function loadIps() {
    if (loading || !window.supabase || !window.DMP_SUPABASE_URL || !window.DMP_SUPABASE_ANON_KEY) return;
    const tbody = $('usersList');
    if (!tbody) return;
    loading = true;
    try {
      const client = window.supabase.createClient(window.DMP_SUPABASE_URL, window.DMP_SUPABASE_ANON_KEY);
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData?.session?.user) return;

      const { data, error } = await client.rpc('admin_latest_login_ips');
      if (error || !Array.isArray(data)) return;

      const byUser = new Map(data.map(row => [String(row.user_id), row]));
      tbody.querySelectorAll('tr[data-user-id]').forEach(row => {
        const cell = row.querySelector('.user-ip-cell');
        if (!cell) return;
        const item = byUser.get(String(row.dataset.userId));
        if (!item?.ip_address) {
          cell.textContent = '—';
          cell.title = 'لا توجد عملية دخول مسجلة بعد';
          return;
        }
        cell.textContent = String(item.ip_address);
        cell.title = item.logged_at ? `آخر IP مسجل: ${new Date(item.logged_at).toLocaleString('ar-MA')}` : 'آخر IP مسجل';
      });
    } catch (e) {
      // IP is optional UI data; never break the admin panel if the audit RPC is unavailable.
    } finally {
      loading = false;
    }
  }

  function start() {
    if (timer) clearInterval(timer);
    loadIps();
    timer = setInterval(loadIps, 30000);
    const tbody = $('usersList');
    if (tbody && !tbody.dataset.ipObserverBound) {
      tbody.dataset.ipObserverBound = '1';
      new MutationObserver(() => loadIps()).observe(tbody, { childList: true });
    }
  }

  document.addEventListener('DOMContentLoaded', start);
})();
