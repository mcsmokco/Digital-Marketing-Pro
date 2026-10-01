(() => {
  const $ = id => document.getElementById(id);
  let timer = null;
  let loading = false;
  let auditTriggered = false;

  function getClient() {
    if (!window.supabase || !window.DMP_SUPABASE_URL || !window.DMP_SUPABASE_ANON_KEY) return null;
    return window.supabase.createClient(window.DMP_SUPABASE_URL, window.DMP_SUPABASE_ANON_KEY);
  }

  async function triggerCurrentLoginAudit(client) {
    if (auditTriggered) return;
    auditTriggered = true;
    try {
      const { data } = await client.auth.getSession();
      if (!data?.session?.user) return;
      await client.functions.invoke('record-login-ip', { body: { source: 'admin-dashboard' } });
    } catch (e) {
      // IP auditing must never block the admin dashboard.
    }
  }

  async function loadIps() {
    if (loading) return;
    const tbody = $('usersList');
    if (!tbody) return;
    const client = getClient();
    if (!client) return;
    loading = true;
    try {
      await triggerCurrentLoginAudit(client);
      const { data, error } = await client.rpc('admin_latest_login_ips');
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('invalid_ip_result');

      const byUser = new Map(data.map(row => [String(row.user_id), row]));
      tbody.querySelectorAll('tr[data-user-id]').forEach(row => {
        const cell = row.querySelector('.user-ip-cell');
        if (!cell) return;
        const item = byUser.get(String(row.dataset.userId));
        if (!item?.ip_address) {
          cell.textContent = 'لا يوجد سجل';
          cell.title = 'لا يوجد IP مسجل لهذا المستخدم بعد';
          cell.dataset.ipState = 'empty';
          return;
        }
        cell.textContent = String(item.ip_address);
        cell.title = item.logged_at ? `آخر IP مسجل: ${new Date(item.logged_at).toLocaleString('ar-MA')}` : 'آخر IP مسجل';
        cell.dataset.ipState = 'ok';
      });
    } catch (e) {
      tbody.querySelectorAll('.user-ip-cell').forEach(cell => {
        if (!cell.textContent || cell.textContent === '—') {
          cell.textContent = 'غير متاح';
          cell.title = 'تعذر جلب سجل IP حالياً';
          cell.dataset.ipState = 'error';
        }
      });
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
