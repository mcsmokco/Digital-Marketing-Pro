(() => {
  const $ = id => document.getElementById(id);
  let initialized = false;
  const roleLevel = Object.freeze({ owner:5, admin:4, co_admin:3, administrateur:2, moderateur:1, user:0 });
  const normalize = value => String(value || '').trim().toLowerCase();

  function getRole(row) {
    const select = row.querySelector('.role-select');
    const raw = select ? select.value : (row.dataset.currentRole || 'user');
    return roleLevel[raw] !== undefined ? raw : 'user';
  }

  function matches(row) {
    const email = normalize(row.querySelector('td:nth-child(2)')?.textContent);
    const username = normalize(row.dataset.username || row.querySelector('td strong')?.textContent);
    const search = normalize($('usersSearch')?.value);
    const role = $('usersRoleFilter')?.value || 'all';
    const premium = $('usersPremiumFilter')?.value || 'all';
    const checked = !!row.querySelector('.premium-check')?.checked;
    return (!search || email.includes(search) || username.includes(search))
      && (role === 'all' || getRole(row) === role)
      && (premium === 'all' || (premium === 'premium' ? checked : !checked));
  }

  function updateSummary(rows, visible) {
    const total = rows.length;
    const premium = rows.filter(r => r.querySelector('.premium-check')?.checked).length;
    const managers = rows.filter(r => (roleLevel[getRole(r)] ?? 0) > 0).length;
    if ($('usersTotalMini')) $('usersTotalMini').textContent = total;
    if ($('usersAdminMini')) $('usersAdminMini').textContent = managers;
    if ($('usersPremiumMini')) $('usersPremiumMini').textContent = premium;
    if ($('usersRegularMini')) $('usersRegularMini').textContent = total - managers;
    if ($('usersVisibleCount')) $('usersVisibleCount').textContent = visible.length === total ? total : `${visible.length}/${total}`;
  }

  function render() {
    const tbody = $('usersList'); if (!tbody) return;
    const rows = [...tbody.querySelectorAll('tr[data-user-id]')];
    const visible = rows.filter(matches);
    rows.forEach(row => { row.hidden = !visible.includes(row); });
    let empty = tbody.querySelector('.users-filter-empty');
    if (!visible.length && rows.length) {
      if (!empty) {
        empty = document.createElement('tr');
        empty.className = 'users-filter-empty';
        empty.innerHTML = '<td colspan="8" class="empty-state">🔎 ما لقيناش مستخدمين بهاد الفلتر.</td>';
        tbody.appendChild(empty);
      }
    } else if (empty) empty.remove();
    updateSummary(rows, visible);
  }

  function addIpColumn() {
    const table = document.querySelector('.users-table');
    if (!table) return;
    const head = table.querySelector('thead tr');
    if (head && !head.querySelector('.user-ip-head')) {
      const th = document.createElement('th');
      th.className = 'user-ip-head';
      th.textContent = 'IP / آخر دخول';
      head.insertBefore(th, head.lastElementChild);
    }
    table.querySelectorAll('tbody tr[data-user-id]').forEach(row => {
      if (row.querySelector('.user-ip-cell')) return;
      const td = document.createElement('td');
      td.className = 'user-ip-cell';
      td.textContent = '⏳';
      const action = row.querySelector('.user-actions')?.closest('td');
      if (action) row.insertBefore(td, action); else row.appendChild(td);
    });
  }

  function makeActionsAccessible() {
    const table = document.querySelector('.users-table');
    if (!table) return;
    const head = table.querySelector('thead tr');
    const actionHead = head?.lastElementChild;
    if (actionHead) {
      actionHead.style.position = 'sticky';
      actionHead.style.left = '0';
      actionHead.style.zIndex = '3';
      actionHead.style.background = 'var(--bg)';
    }
    table.querySelectorAll('tbody tr[data-user-id]').forEach(row => {
      const cell = row.querySelector('.user-actions')?.closest('td');
      if (cell) {
        cell.style.position = 'sticky';
        cell.style.left = '0';
        cell.style.zIndex = '2';
        cell.style.background = 'var(--card)';
      }
    });
  }

  async function loadIps() {
    const tbody = $('usersList'); if (!tbody || !window.supabase) return;
    const rows = [...tbody.querySelectorAll('tr[data-user-id]')];
    if (!rows.length) return;
    const url = window.DMP_SUPABASE_URL, key = window.DMP_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const client = window.supabase.createClient(url, key);
    const { data, error } = await client.rpc('admin_latest_login_ips');
    const byUser = new Map((data || []).map(item => [item.user_id, item]));
    rows.forEach(row => {
      const cell = row.querySelector('.user-ip-cell'); if (!cell) return;
      if (error) { cell.textContent = 'غير متاح'; return; }
      const item = byUser.get(row.dataset.userId);
      if (!item?.ip_address) { cell.textContent = '—'; return; }
      const date = item.logged_at ? new Intl.DateTimeFormat('ar-MA', {dateStyle:'short', timeStyle:'short'}).format(new Date(item.logged_at)) : '';
      cell.innerHTML = `${escapeHtml(item.ip_address)}<br><small>${escapeHtml(date)}</small>`;
    });
  }

  async function recordCurrentAdminIp() {
    if (!window.supabase || !window.DMP_SUPABASE_URL || !window.DMP_SUPABASE_ANON_KEY) return;
    try {
      const client = window.supabase.createClient(window.DMP_SUPABASE_URL, window.DMP_SUPABASE_ANON_KEY);
      const { data } = await client.auth.getSession();
      if (data.session?.user) await client.functions.invoke('record-login-ip', { body: {} });
    } catch (e) {}
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  }

  function init() {
    if (initialized) return;
    initialized = true;
    ['usersSearch','usersRoleFilter','usersPremiumFilter','usersSort'].forEach(id => {
      $(id)?.addEventListener('input', render);
      $(id)?.addEventListener('change', render);
    });
    addIpColumn();
    makeActionsAccessible();
    render();
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      addIpColumn();
      makeActionsAccessible();
      if (document.querySelectorAll('#usersList tr[data-user-id]').length) {
        await loadIps();
        clearInterval(timer);
      } else if (tries >= 20) clearInterval(timer);
    }, 500);
    recordCurrentAdminIp();
    setTimeout(loadIps, 1800);
  }

  window.DMP_REFRESH_USERS_UI = () => { addIpColumn(); makeActionsAccessible(); render(); loadIps(); };
  document.addEventListener('DOMContentLoaded', init);
})();
