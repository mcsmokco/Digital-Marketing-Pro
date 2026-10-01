(() => {
  const $ = id => document.getElementById(id);
  let allRows = [];
  let initialized = false;
  const roleLabels = { owner: 'owner', co_admin: 'co_admin', admin: 'admin', administrateur: 'administrateur', moderateur: 'moderateur', user: 'user' };
  const roleLevel = { owner: 5, admin: 4, co_admin: 3, administrateur: 2, moderateur: 1, user: 0 };

  function normalize(value) { return String(value || '').trim().toLowerCase(); }
  function normalizeFilterRole(value) { return value === 'moderator' ? 'moderateur' : value; }
  function getRole(row) {
    const select = row.querySelector('.role-select');
    const raw = select ? select.value : (row.dataset.currentRole || 'user');
    return roleLabels[raw] ? raw : 'user';
  }
  function matches(row) {
    const email = normalize(row.querySelector('td:nth-child(2)')?.textContent);
    const username = normalize(row.dataset.username || row.querySelector('td strong')?.textContent);
    const search = normalize($('usersSearch')?.value);
    const role = normalizeFilterRole($('usersRoleFilter')?.value || 'all');
    const premium = $('usersPremiumFilter')?.value || 'all';
    const checkbox = row.querySelector('.premium-check');
    const isPremium = !!checkbox?.checked;
    return (!search || email.includes(search) || username.includes(search)) &&
      (role === 'all' || getRole(row) === role) &&
      (premium === 'all' || (premium === 'premium' ? isPremium : !isPremium));
  }
  function sortRows(rows) {
    const sort = $('usersSort')?.value || 'newest';
    return [...rows].sort((a, b) => {
      if (sort === 'email') return normalize(a.querySelector('td:nth-child(2)')?.textContent).localeCompare(normalize(b.querySelector('td:nth-child(2)')?.textContent));
      if (sort === 'role') return (roleLevel[getRole(b)] ?? -1) - (roleLevel[getRole(a)] ?? -1);
      const ta = new Date(a.dataset.createdAt || 0).getTime(), tb = new Date(b.dataset.createdAt || 0).getTime();
      return sort === 'oldest' ? ta - tb : tb - ta;
    });
  }
  function updateSummary(rows, visible) {
    const total = rows.length;
    const premium = rows.filter(r => r.querySelector('.premium-check')?.checked).length;
    const managers = rows.filter(r => (roleLevel[getRole(r)] ?? 0) > 0).length;
    const regular = total - managers;
    if ($('usersTotalMini')) $('usersTotalMini').textContent = total;
    if ($('usersAdminMini')) $('usersAdminMini').textContent = managers;
    if ($('usersPremiumMini')) $('usersPremiumMini').textContent = premium;
    if ($('usersRegularMini')) $('usersRegularMini').textContent = regular;
    if ($('usersVisibleCount')) $('usersVisibleCount').textContent = visible.length === total ? total : `${visible.length}/${total}`;
  }
  function render() {
    const tbody = $('usersList'); if (!tbody) return;
    const rows = allRows.filter(matches);
    sortRows(rows).forEach(row => tbody.appendChild(row));
    allRows.forEach(row => { row.hidden = !matches(row); });
    const empty = tbody.querySelector('.users-filter-empty');
    if (!rows.length && allRows.length) {
      if (!empty) {
        const tr = document.createElement('tr');
        tr.className = 'users-filter-empty';
        tr.innerHTML = '<td colspan="7" class="empty-state">🔎 ما لقيناش مستخدمين بهاد الفلتر.</td>';
        tbody.appendChild(tr);
      }
    } else if (empty) empty.remove();
    updateSummary(allRows, rows);
  }
  function captureRows() {
    const tbody = $('usersList'); if (!tbody) return;
    const rows = [...tbody.querySelectorAll('tr[data-user-id]')];
    if (!rows.length) return;
    allRows = rows;
    allRows.forEach(row => { if (!row.dataset.createdAt) row.dataset.createdAt = String(Date.now()); });
    render();
  }
  function init() {
    if (initialized) return;
    initialized = true;
    ['usersSearch', 'usersRoleFilter', 'usersPremiumFilter', 'usersSort'].forEach(id => {
      $(id)?.addEventListener('input', render);
      $(id)?.addEventListener('change', render);
    });
    const tbody = $('usersList'); if (!tbody) return;
    const observer = new MutationObserver(() => setTimeout(captureRows, 0));
    observer.observe(tbody, { childList: true });
    captureRows();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
