(() => {
  const url = window.DMP_SUPABASE_URL;
  const key = window.DMP_SUPABASE_ANON_KEY;
  const enabled = Boolean(url && key && window.supabase);
  const client = enabled ? window.supabase.createClient(url, key) : null;
  const $ = id => document.getElementById(id);
  let syncTimer = null;
  let syncing = false;
  let lastSyncAt = 0;

  function roleOf(profile) { return typeof window.DMP_GET_ROLE === 'function' ? window.DMP_GET_ROLE(profile) : 'user'; }
  function levelOf(role) { return typeof window.DMP_ROLE_LEVEL === 'function' ? window.DMP_ROLE_LEVEL(role) : 0; }
  function labelOf(role) { return `${window.DMP_ROLE_ICONS?.[role] || '👤'} ${window.DMP_ROLE_LABELS?.[role] || role}`; }
  const can = (actor, minimum) => levelOf(actor) >= minimum;
  const ownerOnly = role => levelOf(role) >= 5;

  async function getCurrentProfile(user) {
    const { data, error } = await client.from('profiles').select('id,email,username,date_of_birth,role,premium,device_info,last_login_at,created_at').eq('id', user.id).maybeSingle();
    if (error) {
      const fallback = await client.from('profiles').select('id,email,role,premium,created_at').eq('id', user.id).maybeSingle();
      if (fallback.error) throw error;
      return { ...(fallback.data || {}), username: null, date_of_birth: null, device_info: null, last_login_at: null };
    }
    return data || { id: user.id, email: user.email, role: 'user', premium: false };
  }

  function setSyncStatus(message, tone = 'muted') { const el = $('usersSyncStatus'); if (!el) return; el.textContent = message; el.dataset.tone = tone; }
  function setLastSyncStatus() { lastSyncAt = Date.now(); const time = new Intl.DateTimeFormat('ar-MA', { hour: '2-digit', minute: '2-digit' }).format(new Date(lastSyncAt)); setSyncStatus(`🟢 مزامنة تلقائية · آخر تحديث ${time}`, 'ok'); }
  function setMessage(message, tone = '') { const el = $('usersMessage'); if (!el) return; el.textContent = message; el.dataset.tone = tone; }

  async function syncProfiles(actorRole, silent = false) {
    if (!client || syncing || !can(actorRole, 1)) return;
    syncing = true;
    if (!silent) setSyncStatus('⏳ جاري تحديث المستخدمين...', 'loading');
    try { await loadStats(actorRole); await loadUsers(actorRole); setLastSyncStatus(); }
    catch (error) { setSyncStatus(`🔴 تعذر تحديث المستخدمين: ${error.message || 'خطأ غير معروف'}`, 'error'); }
    finally { syncing = false; }
  }
  function startAutoSync(actorRole) { if (syncTimer) clearInterval(syncTimer); syncTimer = setInterval(() => { if (document.visibilityState === 'visible') syncProfiles(actorRole, true); }, 30000); }

  async function init() {
    if (!enabled) return deny('Supabase غير مفعّل.');
    const { data, error } = await client.auth.getSession();
    if (error || !data.session?.user) return deny('خاصك تسجل الدخول أولاً.');
    let profile;
    try { profile = await getCurrentProfile(data.session.user); } catch (e) { return deny('تعذر التحقق من صلاحيات الحساب.'); }
    const actorRole = roleOf(profile);
    $('adminEmail').textContent = `${labelOf(actorRole)} · ${profile.username ? profile.username + ' · ' : ''}${profile.email || data.session.user.email || ''}`;
    if (!can(actorRole, 1)) return deny('هذه اللوحة مخصصة للرتب الإدارية من Modérateur فما فوق.');
    $('adminContent').hidden = false;
    applyRoleUi(actorRole);
    await syncProfiles(actorRole);
    startAutoSync(actorRole);
  }

  function deny(message) { if (syncTimer) clearInterval(syncTimer); $('adminEmail').textContent = ''; $('adminContent').hidden = true; $('accessDenied').hidden = false; const p = $('accessDenied').querySelector('p'); if (p) p.textContent = message; }
  function applyRoleUi(actorRole) {
    const moderator = can(actorRole, 1), admin = can(actorRole, 4), coAdmin = can(actorRole, 3), owner = ownerOnly(actorRole);
    document.querySelectorAll('[data-min-role]').forEach(el => { el.hidden = levelOf(actorRole) < Number(el.dataset.minRole); });
    document.querySelectorAll('[data-owner-only]').forEach(el => { el.hidden = !owner; });
    const courses = $('courses');
    if (courses) courses.querySelectorAll('button').forEach(b => { b.disabled = !can(actorRole, 2); });
    const msg = $('usersMessage');
    if (msg) msg.textContent = owner ? '👑 Owner: جميع الصلاحيات، بما فيها بيانات الأجهزة والمتصفحات والبيانات الحساسة.' : admin ? '🛡️ Admin: إدارة المستخدمين والرتب الأدنى. بيانات Owner الحساسة مخفية.' : coAdmin ? '💎 Co Admin: إدارة الرتب الأدنى فقط. بيانات Owner الحساسة مخفية.' : moderator ? '🔧 Moderateur: صلاحيات إشراف محدودة، بدون تغيير الرتب. بيانات Owner الحساسة مخفية.' : '';
    setUsersPrivacyUi(owner);
  }

  function setUsersPrivacyUi(isOwner) {
    const table = document.querySelector('.users-table');
    if (!table) return;
    const headers = table.querySelectorAll('thead th');
    if (headers[0]) headers[0].textContent = 'المستخدم';
    if (headers[1]) headers[1].textContent = 'البريد';
    if (headers[2]) headers[2].textContent = 'تاريخ الازدياد';
    if (headers[3]) headers[3].textContent = isOwner ? 'الجهاز / المتصفح / آخر دخول' : 'الجهاز / المتصفح';
  }

  async function loadStats(actorRole) {
    const { count, error } = await client.from('profiles').select('*', { count: 'exact', head: true });
    if (!error) $('usersCount').textContent = String(count ?? 0);
    const { count: premiumCount, error: premiumError } = await client.from('profiles').select('*', { count: 'exact', head: true }).eq('premium', true);
    if (!premiumError) $('premiumCount').textContent = String(premiumCount ?? 0);
    if (!can(actorRole, 4)) { const premiumPanel = $('premium'); if (premiumPanel) premiumPanel.querySelectorAll('button').forEach(b => b.disabled = true); }
  }

  function roleOptions(actorRole, currentRole) {
    const actorLevel = levelOf(actorRole), currentLevel = levelOf(currentRole);
    const canManage = actorLevel >= 2 && currentLevel < actorLevel && currentRole !== 'owner';
    if (!canManage) return `<span class="role-badge">${labelOf(currentRole)}</span>`;
    const roles = typeof window.DMP_ASSIGNABLE_ROLES === 'function' ? window.DMP_ASSIGNABLE_ROLES(actorRole) : [];
    return `<select class="role-select" aria-label="دور المستخدم">${roles.map(role => `<option value="${role}" ${role === currentRole ? 'selected' : ''}>${labelOf(role)}</option>`).join('')}</select>`;
  }

  function formatDate(value, hidden = false) { if (hidden) return '🔒 مخفي'; if (!value) return '—'; try { return new Intl.DateTimeFormat('ar-MA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)); } catch (e) { return '—'; } }
  function formatLastLogin(value, device, hidden = false) { if (hidden) return '🔒 معلومات Owner مخفية'; if (!value && !device) return 'لم يسجل بعد'; const date = value ? new Intl.DateTimeFormat('ar-MA', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'; return `${escapeHtml(device || 'جهاز غير معروف')}<br><small>${escapeHtml(date)}</small>`; }

  async function loadUsers(actorRole) {
    const tbody = $('usersList'); if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">جاري تحميل المستخدمين...</td></tr>';
    let { data, error } = await client.rpc('admin_list_profiles');
    if (error) {
      // Fallback: older projects may not yet have admin_list_profiles. RLS already permits managers to read profiles.
      try {
        await client.rpc('admin_sync_missing_profiles');
        const fallback = await client.from('profiles').select('id,email,username,date_of_birth,role,premium,device_info,last_login_at,created_at').order('created_at', { ascending: false });
        if (!fallback.error) { data = fallback.data || []; error = null; }
      } catch (_) {}
    }
    if (error) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">تعذر تحميل المستخدمين.</td></tr>';
      setMessage(`❌ ${error.message || 'فشل تحميل المستخدمين'}`, 'error');
      return;
    }
    if (!data?.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-state">ما كاين حتى مستخدم.</td></tr>'; return; }
    const isOwner = ownerOnly(actorRole);
    setUsersPrivacyUi(isOwner);
    tbody.innerHTML = data.map(user => {
      const currentRole = user.role || 'user';
      const currentLevel = levelOf(currentRole);
      const actorLevel = levelOf(actorRole);
      const locked = currentRole === 'owner' || currentLevel >= actorLevel;
      const premiumEditable = actorLevel >= 2 && !locked;
      const removable = ['owner','admin','co_admin'].includes(actorRole) && currentRole !== 'owner' && currentLevel < actorLevel;
      const ownerHidden = currentRole === 'owner' && !isOwner;
      const displayName = user.username || (ownerHidden ? 'Owner / Founder' : 'غير محدد بعد');
      const email = user.email || (ownerHidden ? '🔒 مخفي' : '—');
      return `<tr data-user-id="${escapeHtml(user.id)}" data-current-role="${escapeHtml(currentRole)}" data-username="${escapeHtml(user.username || '')}" data-created-at="${escapeHtml(user.created_at || '')}"><td><strong>👤 ${escapeHtml(displayName)}</strong></td><td>${escapeHtml(email)}</td><td>${formatDate(user.date_of_birth, ownerHidden)}</td><td>${formatLastLogin(user.last_login_at, user.device_info, ownerHidden)}</td><td>${roleOptions(actorRole, currentRole)}</td><td><label class="premium-toggle"><input class="premium-check" type="checkbox" ${user.premium ? 'checked' : ''} ${premiumEditable ? '' : 'disabled'}><span>Premium</span></label></td><td><div class="user-actions"><button class="save-user small-btn" type="button" ${locked || actorLevel < 2 ? 'disabled' : ''}>حفظ</button>${removable ? '<button class="remove-user danger-btn" type="button">🗑️ إزالة</button>' : ''}</div></td></tr>`;
    }).join('');

    if (!tbody.dataset.actionsBound) {
      tbody.dataset.actionsBound = '1';
      tbody.addEventListener('click', event => {
        const save = event.target.closest('.save-user');
        if (save && !save.disabled) saveUser(save.closest('tr'), actorRole);
        const remove = event.target.closest('.remove-user');
        if (remove && !remove.disabled) removeUser(remove.closest('tr'), actorRole);
      });
    }
  }

  async function saveUser(row, actorRole) {
    if (!row || !client) return;
    const id = row.dataset.userId;
    const currentRole = window.DMP_NORMALIZE_ROLE ? window.DMP_NORMALIZE_ROLE(row.dataset.currentRole || 'user') : (row.dataset.currentRole || 'user');
    const roleSelect = row.querySelector('.role-select');
    const role = window.DMP_NORMALIZE_ROLE ? window.DMP_NORMALIZE_ROLE(roleSelect?.value || currentRole) : (roleSelect?.value || currentRole);
    const premiumInput = row.querySelector('.premium-check');
    const premium = premiumInput ? premiumInput.checked : false;
    if (!id || levelOf(actorRole) < 2 || currentRole === 'owner' || levelOf(currentRole) >= levelOf(actorRole)) return;
    if (!window.DMP_CAN_MANAGE_ROLE?.(actorRole, currentRole)) { setMessage('❌ هذه الرتبة خارج نطاق إدارتك.', 'error'); return; }
    if (levelOf(role) >= levelOf(actorRole) || role === 'owner') { setMessage('❌ لا يمكنك تعيين رتبة مساوية أو أعلى من رتبتك.', 'error'); return; }
    const btn = row.querySelector('.save-user');
    if (!btn) return;
    btn.disabled = true; btn.textContent = '⏳';
    setMessage('⏳ جاري حفظ التغييرات...', 'loading');
    try {
      const result = await client.rpc('admin_update_user', { target_user_id: id, new_role: role, new_premium: premium });
      if (result.error) throw result.error;
      setMessage(`✅ تم تحديث المستخدم إلى ${labelOf(role)} بنجاح.`, 'ok');
      await loadStats(actorRole);
      await loadUsers(actorRole);
    } catch (error) {
      setMessage(`❌ ${error?.message || 'تعذر تحديث المستخدم.'}`, 'error');
    } finally {
      if (document.contains(btn)) { btn.disabled = false; btn.textContent = 'حفظ'; }
    }
  }

  async function removeUser(row, actorRole) {
    if (!row || !client || !['owner','admin','co_admin'].includes(actorRole)) return;
    const id = row.dataset.userId;
    const email = row.querySelector('td:nth-child(2)')?.textContent?.trim() || 'هذا المستخدم';
    const currentRole = row.dataset.currentRole || 'user';
    if (!id || currentRole === 'owner' || levelOf(currentRole) >= levelOf(actorRole)) return;
    if (!window.confirm(`⚠️ تأكيد إزالة العضو\n\n${email}\n\nسيتم حذف الحساب نهائياً ولا يمكن التراجع عن العملية.`)) return;
    const btn = row.querySelector('.remove-user'); if (btn) { btn.disabled = true; btn.textContent = 'جاري الإزالة...'; }
    try {
      const { error } = await client.rpc('admin_remove_user', { target_user_id: id });
      if (error) throw error;
      setMessage(`✅ تمت إزالة ${email} نهائياً.`, 'ok');
      await loadStats(actorRole); await loadUsers(actorRole);
    } catch (error) {
      setMessage(`❌ ${error?.message || 'تعذر إزالة المستخدم.'}`, 'error');
      if (btn && document.contains(btn)) { btn.disabled = false; btn.textContent = '🗑️ إزالة'; }
    }
  }

  function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }

  document.addEventListener('DOMContentLoaded', () => {
    $('logoutAdmin')?.addEventListener('click', async () => { if (syncTimer) clearInterval(syncTimer); if (client) await client.auth.signOut({ scope: 'local' }).catch(() => {}); location.href = 'index.html'; });
    $('refreshUsers')?.addEventListener('click', async () => {
      if (!client) return;
      const { data } = await client.auth.getSession();
      if (data.session?.user) { try { const profile = await getCurrentProfile(data.session.user); const role = roleOf(profile); if (levelOf(role) < 1) return deny('هذه اللوحة مخصصة للرتب الإدارية من Modérateur فما فوق.'); applyRoleUi(role); await syncProfiles(role); } catch (e) { deny('تعذر التحقق من صلاحيات الحساب.'); } }
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - lastSyncAt > 30000) { client?.auth.getSession().then(({ data }) => { if (!data.session?.user) return; getCurrentProfile(data.session.user).then(profile => syncProfiles(roleOf(profile), true)).catch(() => {}); }); } });
    init();
  });
})();