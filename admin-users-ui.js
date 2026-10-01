(() => {
  const $ = id => document.getElementById(id);
  let allRows = [];

  const roleLabels = {
    owner: 'owner',
    co_admin: 'co_admin',
    admin: 'admin',
    moderator: 'moderator',
    user: 'user'
  };
  const roleLevel = { owner: 5, co_admin: 4, admin: 3, moderator: 2, user: 1 };

  function normalize(value) { return String(value || '').trim().toLowerCase(); }

  function getRole(row) {
    const select = row.querySelector('.role-select');
    if (select) return select.value;
    const raw = row.dataset.currentRole || 'user';
    return roleLabels[raw] ? raw : 'user';
  }

  function matches(row) {
    const email = normalize(row.querySelector('td')?.textContent);
    const search = normalize($('usersSearch')?.value);
    const role = $('usersRoleFilter')?.value || 'all';
    const premium = $('usersPremiumFilter')?.value || 'all';
    const checkbox = row.querySelector('.premium-check');
    const isPremium = !!checkbox?.checked;
    return (!search || email.includes(search)) &&
      (role === 'all' || getRole(row) === role) &&
      (premium === 'all' || (premium === 'premium' ? isPremium : !isPremium));
  }

  function sortRows(rows) {
    const sort = $('usersSort')?.value || 'newest';
    return [...rows].sort((a, b) => {
      if (sort === 'email') return normalize(a.querySelector('td')?.textContent).localeCompare(normalize(b.querySelector('td')?.textContent));
      if (sort === 'role') return (roleLevel[getRole(b)] || 0) - (roleLevel[getRole(a)] || 0);
      const ta = Number(a.dataset.createdAt || 0), tb = Number(b.dataset.createdAt || 0);
      return sort === 'oldest' ? ta - tb : tb - ta;
    });
  }

  function updateSummary(rows, visible) {
    const total = rows.length;
    const premium = rows.filter(r => r.querySelector('.premium-check')?.checked).length;
    const admins = rows.filter(r => (roleLevel[getRole(r)] || 1) > 1).length;
    const regular = total - admins;
    if ($('usersTotalMini')) $('usersTotalMini').textContent = total;
    if ($('usersAdminMini')) $('usersAdminMini').textContent = admins;
    if ($('usersPremiumMini')) $('usersPremiumMini').textContent = premium;
    if ($('usersRegularMini')) $('usersRegularMini').textContent = regular;
    if ($('usersVisibleCount')) $('usersVisibleCount').textContent = visible.length === total ? total : `${visible.length}/${total}`;
  }

  function render() {
    const tbody = $('usersList');
    if (!tbody) return;
    const rows = allRows.filter(matches);
    sortRows(rows).forEach(row => tbody.appendChild(row));
    allRows.forEach(row => { row.hidden = !matches(row); });
    const empty = tbody.querySelector('.users-filter-empty');
    if (!rows.length && allRows.length) {
      if (!empty) {
        const tr = document.createElement('tr');
        tr.className = 'users-filter-empty';
        tr.innerHTML = '<td colspan="4" class="empty-state">🔎 ما لقيناش مستخدمين بهاد الفلتر.</td>';
        tbody.appendChild(tr);
      }
    } else if (empty) empty.remove();
    updateSummary(allRows, rows);
  }

  function captureRows() {
    const tbody = $('usersList');
    if (!tbody) return;
    const rows = [...tbody.querySelectorAll('tr[data-user-id]')];
    if (!rows.length) return;
    allRows = rows;
    allRows.forEach(row => {
      if (!row.dataset.createdAt) row.dataset.createdAt = String(Date.now());
      row.addEventListener('change', render, { passive: true });
    });
    render();
  }

  function init() {
    ['usersSearch', 'usersRoleFilter', 'usersPremiumFilter', 'usersSort'].forEach(id => {
      $(id)?.addEventListener('input', render);
      $(id)?.addEventListener('change', render);
    });
    const tbody = $('usersList');
    if (!tbody) return;
    const observer = new MutationObserver(() => setTimeout(captureRows, 0));
    observer.observe(tbody, { childList: true });
    setTimeout(captureRows, 500);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
