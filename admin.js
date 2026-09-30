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
    await loadUsers();
  }

  function deny(message) {
    $('adminEmail').textContent = '';
    $('adminContent').hidden = true;
    $('accessDenied').hidden = false;
    const p = $('accessDenied').querySelector('p');
    if (p) p.textContent = message;
  }

  async function loadStats() {
    const { count, error } = await client.from('profiles').select('*', { count: 'exact', head: true });
    if (!error) $('usersCount').textContent = String(count ?? 0);
    const { count: premiumCount, error: premiumError } = await client.from('profiles').select('*', { count: 'exact', head: true }).eq('premium', true);
    if (!premiumError) $('premiumCount').textContent = String(premiumCount ?? 0);
  }

  async function loadUsers() {
    const tbody = $('usersList');
    const message = $('usersMessage');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">جاري تحميل المستخدمين...</td></tr>';
    const { data, error } = await client.from('profiles').select('id,email,role,premium,created_at').order('created_at', { ascending: false });
    if (error) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">خاصك تشغل supabase/admin_users.sql مرة واحدة في SQL Editor.</td></tr>';
      if (message) message.textContent = error.message;
      return;
    }
    if (!data?.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">ما كاين حتى مستخدم.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(user => `
      <tr data-user-id="${escapeHtml(user.id)}">
        <td>${escapeHtml(user.email || '—')}</td>
        <td><select class="role-select" aria-label="دور المستخدم"><option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option><option value="super_admin" ${user.role === 'super_admin' ? 'selected' : ''}>Super Admin</option></select></td>
        <td><label class="premium-toggle"><input class="premium-check" type="checkbox" ${user.premium ? 'checked' : ''}><span>Premium</span></label></td>
        <td><button class="save-user small-btn" type="button">حفظ</button></td>
      </tr>`).join('');
    tbody.querySelectorAll('.save-user').forEach(btn => btn.addEventListener('click', () => saveUser(btn.closest('tr'))));
  }

  async function saveUser(row) {
    if (!row) return;
    const id = row.dataset.userId;
    const role = row.querySelector('.role-select').value;
    const premium = row.querySelector('.premium-check').checked;
    const btn = row.querySelector('.save-user');
    btn.disabled = true;
    btn.textContent = '...';
    const { error } = await client.rpc('admin_update_user', { target_user_id: id, new_role: role, new_premium: premium });
    btn.disabled = false;
    btn.textContent = 'حفظ';
    if (error) {
      if ($('usersMessage')) $('usersMessage').textContent = error.message;
      return;
    }
    if ($('usersMessage')) $('usersMessage').textContent = '✅ تم تحديث المستخدم بنجاح.';
    await loadStats();
    await loadUsers();
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  $('logoutAdmin').addEventListener('click', async () => {
    if (client) await client.auth.signOut({ scope: 'local' }).catch(() => {});
    location.href = 'index.html';
  });

  document.addEventListener('DOMContentLoaded', () => {
    $('refreshUsers')?.addEventListener('click', loadUsers);
    init();
  });
})();
