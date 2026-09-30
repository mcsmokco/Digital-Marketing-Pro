(() => {
  const url = window.DMP_SUPABASE_URL;
  const key = window.DMP_SUPABASE_ANON_KEY;
  const enabled = Boolean(url && key && window.supabase);
  const client = enabled ? window.supabase.createClient(url, key) : null;
  const $ = id => document.getElementById(id);

  function roleOf(profile) {
    return typeof window.DMP_GET_ROLE === 'function' ? window.DMP_GET_ROLE(profile) : 'user';
  }
  function levelOf(role) {
    return typeof window.DMP_ROLE_LEVEL === 'function' ? window.DMP_ROLE_LEVEL(role) : 0;
  }
  function labelOf(role) {
    return `${window.DMP_ROLE_ICONS?.[role] || '👤'} ${window.DMP_ROLE_LABELS?.[role] || role}`;
  }

  async function getCurrentProfile(user) {
    const { data, error } = await client.from('profiles').select('id,email,role,premium').eq('id', user.id).maybeSingle();
    if (error) throw error;
    return data || { id: user.id, email: user.email, role: 'user', premium: false };
  }

  async function init() {
    if (!enabled) return deny('Supabase غير مفعّل.');
    const { data, error } = await client.auth.getSession();
    if (error || !data.session?.user) return deny('خاصك تسجل الدخول أولاً.');

    let profile;
    try { profile = await getCurrentProfile(data.session.user); }
    catch (e) { return deny('تعذر التحقق من صلاحيات الحساب.'); }

    const actorRole = roleOf(profile);
    $('adminEmail').textContent = `${labelOf(actorRole)} · ${profile.email || data.session.user.email || ''}`;
    if (levelOf(actorRole) < 2) return deny('هذه اللوحة مخصصة لـ Administrateur وما فوق.');
    $('adminContent').hidden = false;
    await loadStats();
    await loadUsers(actorRole);
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

  function roleOptions(actorRole, currentRole) {
    const actorLevel = levelOf(actorRole);
    const currentLevel = levelOf(currentRole);
    const canManage = actorLevel >= 2 && currentLevel < actorLevel && currentRole !== 'owner';
    if (!canManage) return `<span class="role-badge">${labelOf(currentRole)}</span>`;
    const roles = typeof window.DMP_ASSIGNABLE_ROLES === 'function' ? window.DMP_ASSIGNABLE_ROLES(actorRole) : [];
    return `<select class="role-select" aria-label="دور المستخدم">${roles.map(role => `<option value="${role}" ${role === currentRole ? 'selected' : ''}>${labelOf(role)}</option>`).join('')}</select>`;
  }

  async function loadUsers(actorRole) {
    const tbody = $('usersList');
    const message = $('usersMessage');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">جاري تحميل المستخدمين...</td></tr>';
    const { data, error } = await client.from('profiles').select('id,email,role,premium,created_at').order('created_at', { ascending: false });
    if (error) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">تعذر تحميل المستخدمين.</td></tr>';
      if (message) message.textContent = error.message;
      return;
    }
    if (!data?.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">ما كاين حتى مستخدم.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(user => `
      <tr data-user-id="${escapeHtml(user.id)}" data-current-role="${escapeHtml(user.role || 'user')}">
        <td>${escapeHtml(user.email || '—')}</td>
        <td>${roleOptions(actorRole, user.role || 'user')}</td>
        <td><label class="premium-toggle"><input class="premium-check" type="checkbox" ${user.premium ? 'checked' : ''}><span>Premium</span></label></td>
        <td><button class="save-user small-btn" type="button" ${levelOf(user.role || 'user') >= levelOf(actorRole) || user.role === 'owner' ? 'disabled' : ''}>حفظ</button></td>
      </tr>`).join('');
    tbody.querySelectorAll('.save-user').forEach(btn => btn.addEventListener('click', () => saveUser(btn.closest('tr'), actorRole)));
  }

  async function saveUser(row, actorRole) {
    if (!row) return;
    const id = row.dataset.userId;
    const currentRole = row.dataset.currentRole || 'user';
    const roleSelect = row.querySelector('.role-select');
    const role = roleSelect ? roleSelect.value : currentRole;
    const premium = row.querySelector('.premium-check').checked;
    if (levelOf(actorRole) < 2 || currentRole === 'owner' || levelOf(currentRole) >= levelOf(actorRole)) return;

    const btn = row.querySelector('.save-user');
    btn.disabled = true;
    btn.textContent = '...';
    const { error } = await client.rpc('admin_update_user', { target_user_id: id, new_role: role, new_premium: premium });
    btn.disabled = false;
    btn.textContent = 'حفظ';
    if (error) {
      if ($('usersMessage')) $('usersMessage').textContent = `❌ ${error.message}`;
      return;
    }
    if ($('usersMessage')) $('usersMessage').textContent = '✅ تم تحديث المستخدم بنجاح.';
    await loadStats();
    await loadUsers(actorRole);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  $('logoutAdmin').addEventListener('click', async () => {
    if (client) await client.auth.signOut({ scope: 'local' }).catch(() => {});
    location.href = 'index.html';
  });

  document.addEventListener('DOMContentLoaded', () => {
    $('refreshUsers')?.addEventListener('click', async () => {
      const { data } = await client.auth.getSession();
      if (data.session?.user) {
        try {
          const profile = await getCurrentProfile(data.session.user);
          await loadUsers(roleOf(profile));
        } catch (e) { deny('تعذر التحقق من صلاحيات الحساب.'); }
      }
    });
    init();
  });
})();
