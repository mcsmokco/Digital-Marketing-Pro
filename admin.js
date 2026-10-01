(() => {
  const url = window.DMP_SUPABASE_URL;
  const key = window.DMP_SUPABASE_ANON_KEY;
  const enabled = Boolean(url && key && window.supabase);
  const client = enabled ? window.supabase.createClient(url, key) : null;
  const $ = id => document.getElementById(id);

  function roleOf(profile) { return typeof window.DMP_GET_ROLE === 'function' ? window.DMP_GET_ROLE(profile) : 'user'; }
  function levelOf(role) { return typeof window.DMP_ROLE_LEVEL === 'function' ? window.DMP_ROLE_LEVEL(role) : 0; }
  function labelOf(role) { return `${window.DMP_ROLE_ICONS?.[role] || '👤'} ${window.DMP_ROLE_LABELS?.[role] || role}`; }
  const can = (actor, minimum) => levelOf(actor) >= minimum;

  async function getCurrentProfile(user) {
    const { data, error } = await client.from('profiles').select('id,email,role,premium').eq('id', user.id).maybeSingle();
    if (error) throw error;
    return data || { id: user.id, email: user.email, role: 'user', premium: false };
  }

  async function syncMissingProfiles() {
    const { error } = await client.rpc('admin_sync_missing_profiles');
    return error;
  }

  async function init() {
    if (!enabled) return deny('Supabase غير مفعّل.');
    const { data, error } = await client.auth.getSession();
    if (error || !data.session?.user) return deny('خاصك تسجل الدخول أولاً.');
    let profile;
    try { profile = await getCurrentProfile(data.session.user); } catch (e) { return deny('تعذر التحقق من صلاحيات الحساب.'); }
    const actorRole = roleOf(profile);
    $('adminEmail').textContent = `${labelOf(actorRole)} · ${profile.email || data.session.user.email || ''}`;
    if (!can(actorRole, 1)) return deny('هذه اللوحة مخصصة للرتب الإدارية من Modérateur فما فوق.');
    $('adminContent').hidden = false;
    applyRoleUi(actorRole);
    const syncError = await syncMissingProfiles();
    if (syncError && $('usersMessage')) $('usersMessage').textContent = `⚠️ مزامنة الحسابات: ${syncError.message}`;
    await loadStats(actorRole);
    await loadUsers(actorRole);
  }

  function deny(message) {
    $('adminEmail').textContent = '';
    $('adminContent').hidden = true;
    $('accessDenied').hidden = false;
    const p = $('accessDenied').querySelector('p'); if (p) p.textContent = message;
  }

  function applyRoleUi(actorRole) {
    const moderator = can(actorRole, 1), admin = can(actorRole, 4), coAdmin = can(actorRole, 3), owner = levelOf(actorRole) >= 5;
    document.querySelectorAll('[data-min-role]').forEach(el => { el.hidden = levelOf(actorRole) < Number(el.dataset.minRole); });
    document.querySelectorAll('[data-owner-only]').forEach(el => { el.hidden = !owner; });
    const courses = $('courses'), certificates = $('certificates');
    if (courses) courses.querySelectorAll('button').forEach(b => { b.disabled = !can(actorRole, 2); });
    if (certificates) certificates.hidden = false;
    const msg = $('usersMessage');
    if (msg) msg.textContent = owner ? '👑 Owner: جميع الصلاحيات.' : admin ? '🛡️ Admin: إدارة المستخدمين والرتب الأدنى.' : coAdmin ? '💎 Coadmin: إدارة الرتب الأدنى فقط.' : moderator ? '🔧 Moderateur: صلاحيات إشراف محدودة، بدون تغيير الرتب.' : '';
  }

  async function loadStats(actorRole) {
    const { count, error } = await client.from('profiles').select('*', { count: 'exact', head: true });
    if (!error) $('usersCount').textContent = String(count ?? 0);
    const { count: premiumCount, error: premiumError } = await client.from('profiles').select('*', { count: 'exact', head: true }).eq('premium', true);
    if (!premiumError) $('premiumCount').textContent = String(premiumCount ?? 0);
    if (!can(actorRole, 4)) {
      const premiumPanel = $('premium');
      if (premiumPanel) premiumPanel.querySelectorAll('button').forEach(b => b.disabled = true);
    }
  }

  function roleOptions(actorRole, currentRole) {
    const actorLevel = levelOf(actorRole), currentLevel = levelOf(currentRole);
    const canManage = actorLevel >= 2 && currentLevel < actorLevel && currentRole !== 'owner';
    if (!canManage) return `<span class="role-badge">${labelOf(currentRole)}</span>`;
    const roles = typeof window.DMP_ASSIGNABLE_ROLES === 'function' ? window.DMP_ASSIGNABLE_ROLES(actorRole) : [];
    return `<select class="role-select" aria-label="دور المستخدم">${roles.map(role => `<option value="${role}" ${role === currentRole ? 'selected' : ''}>${labelOf(role)}</option>`).join('')}</select>`;
  }

  async function loadUsers(actorRole) {
    const tbody = $('usersList'), message = $('usersMessage'); if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">جاري تحميل المستخدمين...</td></tr>';
    const { data, error } = await client.from('profiles').select('id,email,role,premium,created_at').order('created_at', { ascending: false });
    if (error) { tbody.innerHTML = '<tr><td colspan="4" class="empty-state">تعذر تحميل المستخدمين.</td></tr>'; if (message) message.textContent = error.message; return; }
    if (!data?.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty-state">ما كاين حتى مستخدم.</td></tr>'; return; }
    tbody.innerHTML = data.map(user => {
      const currentRole = user.role || 'user';
      const currentLevel = levelOf(currentRole);
      const actorLevel = levelOf(actorRole);
      const locked = currentRole === 'owner' || currentLevel >= actorLevel;
      const premiumEditable = actorLevel >= 2 && !locked;
      const removable = ['owner','admin','co_admin'].includes(actorRole) && currentRole !== 'owner' && currentLevel < actorLevel;
      return `<tr data-user-id="${escapeHtml(user.id)}" data-current-role="${escapeHtml(currentRole)}"><td>${escapeHtml(user.email || '—')}</td><td>${roleOptions(actorRole, currentRole)}</td><td><label class="premium-toggle"><input class="premium-check" type="checkbox" ${user.premium ? 'checked' : ''} ${premiumEditable ? '' : 'disabled'}><span>Premium</span></label></td><td><div class="user-actions"><button class="save-user small-btn" type="button" ${locked || actorLevel < 2 ? 'disabled' : ''}>حفظ</button>${removable ? '<button class="remove-user danger-btn" type="button">🗑️ إزالة</button>' : ''}</div></td></tr>`;
    }).join('');
    tbody.querySelectorAll('.save-user').forEach(btn => btn.addEventListener('click', () => saveUser(btn.closest('tr'), actorRole)));
    tbody.querySelectorAll('.remove-user').forEach(btn => btn.addEventListener('click', () => removeUser(btn.closest('tr'), actorRole)));
  }

  async function saveUser(row, actorRole) {
    if (!row) return;
    const id = row.dataset.userId, currentRole = row.dataset.currentRole || 'user';
    const roleSelect = row.querySelector('.role-select'), role = roleSelect ? roleSelect.value : currentRole;
    const premiumInput = row.querySelector('.premium-check'), premium = premiumInput ? premiumInput.checked : false;
    if (levelOf(actorRole) < 2 || currentRole === 'owner' || levelOf(currentRole) >= levelOf(actorRole)) return;
    const btn = row.querySelector('.save-user'); btn.disabled = true; btn.textContent = '...';
    const { error } = await client.rpc('admin_update_user', { target_user_id: id, new_role: role, new_premium: premium });
    btn.disabled = false; btn.textContent = 'حفظ';
    if (error) { if ($('usersMessage')) $('usersMessage').textContent = `❌ ${error.message}`; return; }
    if ($('usersMessage')) $('usersMessage').textContent = '✅ تم تحديث المستخدم بنجاح.';
    await loadStats(actorRole); await loadUsers(actorRole);
  }

  async function removeUser(row, actorRole) {
    if (!row || !['owner','admin','co_admin'].includes(actorRole)) return;
    const id = row.dataset.userId;
    const email = row.querySelector('td')?.textContent?.trim() || 'هذا المستخدم';
    const currentRole = row.dataset.currentRole || 'user';
    if (currentRole === 'owner' || levelOf(currentRole) >= levelOf(actorRole)) return;
    const confirmed = window.confirm(`⚠️ تأكيد إزالة العضو\n\n${email}\n\nسيتم حذف الحساب نهائياً ولا يمكن التراجع عن العملية.`);
    if (!confirmed) return;
    const btn = row.querySelector('.remove-user');
    if (btn) { btn.disabled = true; btn.textContent = 'جاري الإزالة...'; }
    const { error } = await client.rpc('admin_remove_user', { target_user_id: id });
    if (error) {
      if ($('usersMessage')) $('usersMessage').textContent = `❌ ${error.message}`;
      if (btn) { btn.disabled = false; btn.textContent = '🗑️ إزالة'; }
      return;
    }
    if ($('usersMessage')) $('usersMessage').textContent = `✅ تمت إزالة ${email} نهائياً.`;
    await loadStats(actorRole);
    await loadUsers(actorRole);
  }

  function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }

  $('logoutAdmin').addEventListener('click', async () => { if (client) await client.auth.signOut({ scope: 'local' }).catch(() => {}); location.href = 'index.html'; });
  document.addEventListener('DOMContentLoaded', () => {
    $('refreshUsers')?.addEventListener('click', async () => { const { data } = await client.auth.getSession(); if (data.session?.user) { try { const profile = await getCurrentProfile(data.session.user); const role = roleOf(profile); if (levelOf(role) < 1) return deny('هذه اللوحة مخصصة للرتب الإدارية من Modérateur فما فوق.'); applyRoleUi(role); await loadUsers(role); } catch (e) { deny('تعذر التحقق من صلاحيات الحساب.'); } } });
    init();
  });
})();