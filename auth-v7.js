(() => {
  const url = window.DMP_SUPABASE_URL;
  const key = window.DMP_SUPABASE_ANON_KEY;
  const enabled = Boolean(url && key && window.supabase);
  const client = enabled ? window.supabase.createClient(url, key) : null;
  let currentUser = null;
  let currentProfile = null;
  let loggingOut = false;
  let authOperation = 0;
  const LOGGED_OUT = 'dmp-force-logged-out';
  const $ = id => document.getElementById(id);
  const forcedLoggedOut = () => { try { return sessionStorage.getItem(LOGGED_OUT) === '1'; } catch (e) { return false; } };
  const markLoggedOut = () => { try { sessionStorage.setItem(LOGGED_OUT, '1'); } catch (e) {} };
  const clearLoggedOut = () => { try { sessionStorage.removeItem(LOGGED_OUT); } catch (e) {} };

  function closeAuth() {
    const modal = $('authModal');
    if (!modal) return;
    modal.classList.remove('show'); modal.setAttribute('aria-hidden', 'true'); modal.hidden = true;
    modal.style.display = 'none'; modal.style.visibility = 'hidden'; modal.style.opacity = '0'; modal.style.pointerEvents = 'none';
    document.body.classList.remove('auth-open');
  }
  function resetAccountButton() {
    const area = $('accountArea'); if (!area) return;
    area.innerHTML = '<button class="account-btn" id="accountBtn" type="button">👤 حسابي</button>';
    const btn = $('accountBtn'); if (btn) btn.onclick = openAuth;
  }
  function setStatus(text, ok = false) { const el = $('authStatus'); if (el) { el.textContent = text; el.classList.toggle('ok', ok); } }
  function clearAuthStorage() {
    try {
      for (const store of [localStorage, sessionStorage]) {
        const keys = [];
        for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k && (/^sb-.*-auth-token$/i.test(k) || /supabase.*auth.*token/i.test(k))) keys.push(k); }
        keys.forEach(k => store.removeItem(k));
      }
    } catch (e) {}
  }
  function ensureUi() {
    if ($('accountArea')) return;
    const nav = document.querySelector('.nav'); if (!nav) return;
    const area = document.createElement('div'); area.id = 'accountArea'; area.className = 'account-area'; area.innerHTML = '<button class="account-btn" id="accountBtn" type="button">👤 حسابي</button>'; nav.insertBefore(area, $('themeBtn'));
    const modal = document.createElement('div'); modal.id = 'authModal'; modal.className = 'auth-modal'; modal.setAttribute('aria-hidden', 'true'); modal.hidden = true;
    modal.innerHTML = `<div class="auth-box" role="dialog" aria-modal="true"><button class="auth-close" id="authClose" type="button">×</button><span class="eyebrow">DIGITAL MARKETING PRO</span><h2 id="accountTitle">حسابي</h2><p class="auth-note" id="authNote">سجّل الدخول لحفظ تقدمك على أي جهاز.</p><div id="authFields"><label id="emailField">البريد الإلكتروني<input id="authEmail" type="email" autocomplete="email"></label><label id="passwordField">كلمة المرور<input id="authPassword" type="password" autocomplete="current-password"></label></div><div class="auth-actions" id="authActions"><button class="btn primary" id="loginBtn" type="button">تسجيل الدخول</button><button class="btn ghost" id="signupBtn" type="button">إنشاء حساب</button></div><button class="auth-link" id="resetBtn" type="button">نسيت كلمة المرور؟</button><p class="auth-status" id="authStatus"></p></div>`;
    document.body.appendChild(modal);
    $('accountBtn').onclick = openAuth; $('authClose').onclick = closeAuth; $('loginBtn').onclick = signIn; $('signupBtn').onclick = signUp; $('resetBtn').onclick = resetPassword;
    modal.addEventListener('click', e => { if (e.target === modal) closeAuth(); });
  }
  function openAuth() {
    ensureUi(); const m = $('authModal'); if (!m) return;
    m.hidden = false; m.style.display = 'grid'; m.style.visibility = 'visible'; m.style.opacity = '1'; m.style.pointerEvents = 'auto'; m.classList.add('show'); m.setAttribute('aria-hidden', 'false');
    if (!enabled) return setStatus('الحسابات السحابية غير مفعلة بعد.');
    if (currentUser && !loggingOut && !forcedLoggedOut()) showAccount(); else $('authEmail')?.focus();
  }
  function logoutNow() {
    if (loggingOut) return;
    loggingOut = true; ++authOperation; currentUser = null; currentProfile = null; markLoggedOut(); clearAuthStorage(); closeAuth(); resetAccountButton();
    try { window.dispatchEvent(new CustomEvent('dmp-logged-out')); } catch (e) {}
    window.location.reload();
  }
  window.DMP_logout = logoutNow; window.DMP_closeAuth = closeAuth; window.DMP_openAuth = openAuth; window.DMP_cloudEnabled = enabled;
  function getRole(user) {
    if (currentProfile && (!user || currentProfile.id === user.id)) return typeof window.DMP_GET_ROLE === 'function' ? window.DMP_GET_ROLE(currentProfile) : (currentProfile.role || 'user');
    return typeof window.DMP_GET_ROLE === 'function' ? window.DMP_GET_ROLE(user) : 'user';
  }
  function roleLevel(role) { return typeof window.DMP_ROLE_LEVEL === 'function' ? window.DMP_ROLE_LEVEL(role) : 0; }

  function validateUsername(value) {
    const username = String(value || '').trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return 'اسم المستخدم خاصو يكون بين 3 و20 حرف، باستعمال الحروف الإنجليزية والأرقام و _ فقط.';
    return '';
  }
  function getDeviceInfo() {
    const ua = navigator.userAgent || '';
    const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac OS X/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'جهاز غير معروف';
    const browser = /Edg\//i.test(ua) ? 'Edge' : /OPR\//i.test(ua) ? 'Opera' : /Chrome\//i.test(ua) ? 'Chrome' : /Firefox\//i.test(ua) ? 'Firefox' : /Safari\//i.test(ua) && !/Chrome\//i.test(ua) ? 'Safari' : 'Browser';
    return `${os} · ${browser}`;
  }
  async function recordLoginMetadata(user) {
    if (!enabled || !user) return;
    try {
      await client.from('profiles').update({ device_info: getDeviceInfo(), last_login_at: new Date().toISOString() }).eq('id', user.id);
    } catch (e) {}
  }
  async function loadCurrentProfile(user) {
    currentProfile = null;
    if (!enabled || !user) return null;
    try {
      const { data, error } = await client.from('profiles').select('id,email,username,date_of_birth,role,premium,device_info,last_login_at,created_at').eq('id', user.id).maybeSingle();
      if (!error && data) currentProfile = data;
    } catch (e) {}
    if (!currentProfile) {
      try { const { data: role, error: roleError } = await client.rpc('current_profile_role'); if (!roleError) currentProfile = { id: user.id, email: user.email, username: null, date_of_birth: null, role: role || 'user', premium: false }; } catch (e) {}
    }
    return currentProfile;
  }

  function showProfileSetup() {
    if (!currentUser || loggingOut || forcedLoggedOut()) return;
    ensureUi();
    const note = $('authNote'), actions = $('authActions'), title = $('accountTitle'), fields = $('authFields'), reset = $('resetBtn');
    if (!note || !actions || !title || !fields || !reset) return;
    title.textContent = '👤 كمّل حسابك';
    note.textContent = 'اختار اسم المستخدم ديالك وسجّل تاريخ الازدياد باش نكملو إعداد الحساب.';
    reset.style.display = 'none';
    fields.innerHTML = `<label>اسم المستخدم<input id="profileUsername" type="text" maxlength="20" autocomplete="username" placeholder="مثال: McSmOk_pro"></label><small style="display:block;margin:-4px 0 10px;opacity:.75">3–20 حرف: A-Z / a-z / 0-9 / _</small><label>تاريخ الازدياد<input id="profileDob" type="date" autocomplete="bday"></label>`;
    actions.innerHTML = '<button class="btn primary" id="saveProfileBtn" type="button">حفظ والمتابعة ✓</button>';
    $('profileUsername').value = currentProfile?.username || '';
    $('profileDob').value = currentProfile?.date_of_birth || '';
    $('saveProfileBtn').onclick = saveProfileSetup;
    $('profileUsername').focus();
  }
  async function saveProfileSetup() {
    if (!enabled || !currentUser || loggingOut) return;
    const username = $('profileUsername')?.value.trim() || '';
    const dateOfBirth = $('profileDob')?.value || '';
    const usernameError = validateUsername(username);
    if (usernameError) return setStatus(usernameError);
    if (!dateOfBirth) return setStatus('اختار تاريخ الازدياد من فضلك.');
    const date = new Date(`${dateOfBirth}T00:00:00`);
    if (Number.isNaN(date.getTime()) || date > new Date()) return setStatus('تاريخ الازدياد غير صالح.');
    setStatus('جاري حفظ معلومات الحساب...');
    try {
      const { data: taken, error: takenError } = await client.from('profiles').select('id').ilike('username', username).neq('id', currentUser.id).maybeSingle();
      if (takenError && takenError.code !== 'PGRST116') return setStatus('تعذر التحقق من توفر اسم المستخدم. حاول مرة أخرى.');
      if (taken) return setStatus('اسم المستخدم مستعمل من قبل. اختار اسم آخر.');
      const { data, error } = await client.from('profiles').update({ username, date_of_birth: dateOfBirth, device_info: getDeviceInfo(), last_login_at: new Date().toISOString() }).eq('id', currentUser.id).select('id,email,username,date_of_birth,role,premium,device_info,last_login_at,created_at').single();
      if (error) {
        if (error.code === '23505') return setStatus('اسم المستخدم مستعمل من قبل. اختار اسم آخر.');
        return setStatus(error.message || 'تعذر حفظ المعلومات.');
      }
      currentProfile = data;
      setStatus('تم إعداد الحساب بنجاح ✅', true);
      setTimeout(() => { if (!loggingOut) { closeAuth(); showAccount(); } }, 700);
    } catch (err) { setStatus(err?.message || 'وقع خطأ أثناء حفظ المعلومات.'); }
  }

  function showAccount() {
    if (!currentUser || loggingOut || forcedLoggedOut()) return;
    if (!currentProfile?.username || !currentProfile?.date_of_birth) return showProfileSetup();
    const note = $('authNote'), actions = $('authActions'), reset = $('resetBtn'), fields = $('authFields'), title = $('accountTitle');
    if (!note || !actions || !reset || !fields || !title) return;
    setStatus('');
    const username = currentProfile.username;
    note.textContent = `مرحباً ${username} 👋`;
    fields.innerHTML = `<div style="padding:10px 0"><strong>👤 ${username}</strong><br><small style="opacity:.75">${currentProfile.email || currentUser.email || ''}</small></div>`;
    reset.style.display = 'none';
    const role = getRole(currentUser);
    const level = roleLevel(role);
    const roleLabel = window.DMP_ROLE_LABELS?.[role] || role;
    const roleIcon = window.DMP_ROLE_ICONS?.[role] || '👤';
    title.textContent = level >= 1 ? `${roleIcon} ${username}` : username;
    const isManager = level >= 1;
    actions.innerHTML = `${isManager ? `<button class="btn primary" id="adminBtn" type="button">${roleIcon} لوحة الإدارة · ${roleLabel}</button>` : ''}<button class="btn primary" id="syncNow" type="button">مزامنة التقدم ☁️</button><button class="btn ghost" id="logoutBtn" type="button">تسجيل الخروج</button>`;
    $('adminBtn')?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); window.location.href = 'admin.html'; });
    $('syncNow').onclick = async e => { e.preventDefault(); e.stopPropagation(); if (loggingOut) return; await saveProgress(JSON.parse(localStorage.getItem('dmp-state') || '{}')); if (!loggingOut) setStatus('تمت مزامنة التقدم بنجاح ✅', true); };
    const logoutBtn = $('logoutBtn'); if (logoutBtn) logoutBtn.onclick = e => { e.preventDefault(); e.stopPropagation(); logoutNow(); return false; };
  }

  function showPasswordRecovery() {
    if (!enabled || loggingOut) return;
    ensureUi(); const m = $('authModal'), note = $('authNote'), actions = $('authActions'), reset = $('resetBtn'), fields = $('authFields');
    if (!m || !note || !actions || !reset || !fields) return;
    m.hidden = false; m.style.display = 'grid'; m.style.visibility = 'visible'; m.style.opacity = '1'; m.style.pointerEvents = 'auto'; m.classList.add('show'); m.setAttribute('aria-hidden', 'false');
    note.textContent = 'اختار كلمة مرور جديدة لحسابك 🔐'; fields.innerHTML = '<label>كلمة المرور الجديدة<input id="authPassword" type="password" autocomplete="new-password"></label>'; reset.style.display = 'none';
    actions.innerHTML = '<label style="display:block;margin-bottom:10px">تأكيد كلمة المرور<input id="authPasswordConfirm" type="password" autocomplete="new-password"></label><button class="btn primary" id="updatePasswordBtn" type="button">حفظ كلمة المرور الجديدة</button>';
    $('updatePasswordBtn').onclick = updatePassword; $('authPassword')?.focus();
  }
  async function updatePassword() {
    if (!enabled || loggingOut) return;
    const pass = $('authPassword')?.value || '', confirm = $('authPasswordConfirm')?.value || '';
    if (pass.length < 6) return setStatus('كلمة المرور خاصها تكون 6 أحرف على الأقل.');
    if (pass !== confirm) return setStatus('كلمتا المرور غير متطابقتين.');
    setStatus('جاري تحديث كلمة المرور...');
    try { const { error } = await client.auth.updateUser({ password: pass }); if (error) return setStatus(error.message); setStatus('تم تغيير كلمة المرور بنجاح ✅', true); setTimeout(() => { if (!loggingOut) { loadCurrentProfile(currentUser).then(showAccount); } }, 900); } catch (err) { setStatus(err?.message || 'تعذر تغيير كلمة المرور. حاول مرة أخرى.'); }
  }
  async function signIn() {
    if (loggingOut || !enabled) return; clearLoggedOut(); const op = ++authOperation, e = $('authEmail')?.value.trim(), p = $('authPassword')?.value || '';
    if (!e || !p) return setStatus('دخل البريد الإلكتروني وكلمة المرور.'); setStatus('جاري تسجيل الدخول...');
    try { const result = await Promise.race([client.auth.signInWithPassword({ email: e, password: p }), new Promise(resolve => setTimeout(() => resolve({ timeout: true }), 15000))]); if (op !== authOperation || loggingOut) return; if (result?.timeout) return setStatus('تعذر الاتصال بخدمة تسجيل الدخول. حاول مرة أخرى.'); const { data, error } = result; if (error) return setStatus(error.message); currentUser = data?.user || data?.session?.user || null; if (!currentUser) return setStatus('تم تسجيل الدخول لكن لم يتم استلام جلسة الحساب. أعد المحاولة.'); await loadCurrentProfile(currentUser); await recordLoginMetadata(currentUser); closeAuth(); loadProgress(currentUser).catch(() => {}); setTimeout(() => { if (!loggingOut) { ensureUi(); showAccount(); $('authModal')?.setAttribute('aria-hidden', 'false'); $('authModal').hidden = false; $('authModal').style.display = 'grid'; $('authModal').style.visibility = 'visible'; $('authModal').style.opacity = '1'; $('authModal').style.pointerEvents = 'auto'; $('authModal').classList.add('show'); } }, 0); } catch (err) { if (op !== authOperation || loggingOut) return; setStatus(err?.message || 'وقع خطأ أثناء تسجيل الدخول. حاول مرة أخرى.'); }
  }
  async function signUp() {
    if (loggingOut || !enabled) return; clearLoggedOut(); const op = ++authOperation, e = $('authEmail')?.value.trim(), p = $('authPassword')?.value || '';
    if (!e || p.length < 6) return setStatus('استعمل بريد صحيح وكلمة مرور من 6 أحرف على الأقل.'); setStatus('جاري إنشاء الحساب...');
    try { const { data, error } = await client.auth.signUp({ email: e, password: p, options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` } }); if (op !== authOperation || loggingOut) return; if (error) return setStatus(error.message); if (!data.session) return setStatus('تم إنشاء الحساب. راجع بريدك لتأكيد الحساب ثم ارجع للموقع لتسجيل الدخول.', true); currentUser = data.user || data.session.user; await loadCurrentProfile(currentUser); await recordLoginMetadata(currentUser); showProfileSetup(); } catch (err) { if (op !== authOperation || loggingOut) return; setStatus(err?.message || 'وقع خطأ أثناء إنشاء الحساب. حاول مرة أخرى.'); }
  }
  async function resetPassword() {
    if (loggingOut || !enabled) return; const e = $('authEmail')?.value.trim(); if (!e) return setStatus('دخل البريد الإلكتروني أولاً.'); setStatus('جاري إرسال الرابط...'); const { error } = await client.auth.resetPasswordForEmail(e, { redirectTo: location.origin + location.pathname }); if (!loggingOut) setStatus(error ? error.message : 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك.', !error);
  }
  async function loadProgress(user) {
    if (!enabled || !user || forcedLoggedOut()) return; const { data, error } = await client.from('course_progress').select('state').eq('user_id', user.id).maybeSingle(); if (error || loggingOut || !currentUser || forcedLoggedOut()) return;
    if (data?.state) { localStorage.setItem('dmp-state', JSON.stringify(data.state)); window.dispatchEvent(new CustomEvent('dmp-cloud-state', { detail: { state: data.state } })); } else await saveProgress(JSON.parse(localStorage.getItem('dmp-state') || '{}'));
  }
  async function saveProgress(state) { if (!enabled || !currentUser || loggingOut || forcedLoggedOut()) return; await client.from('course_progress').upsert({ user_id: currentUser.id, state, updated_at: new Date().toISOString() }); }
  document.addEventListener('DOMContentLoaded', async () => {
    ensureUi(); if (!enabled) return; if (forcedLoggedOut()) { currentUser = null; currentProfile = null; clearAuthStorage(); resetAccountButton(); closeAuth(); return; }
    const { data } = await client.auth.getSession(); if (loggingOut || forcedLoggedOut()) return; currentUser = data.session?.user || null; if (currentUser) { await loadCurrentProfile(currentUser); await recordLoginMetadata(currentUser); showAccount(); loadProgress(currentUser).catch(() => {}); }
    client.auth.onAuthStateChange((event, session) => {
      if (loggingOut || forcedLoggedOut()) { currentUser = null; currentProfile = null; closeAuth(); resetAccountButton(); return; }
      if (event === 'PASSWORD_RECOVERY') {
        currentUser = session?.user || currentUser;
        setTimeout(async () => { if (loggingOut || forcedLoggedOut()) return; await loadCurrentProfile(currentUser); showPasswordRecovery(); }, 0);
        return;
      }
      currentUser = session?.user || null;
      if (currentUser) {
        setTimeout(async () => { if (loggingOut || forcedLoggedOut() || !currentUser) return; await loadCurrentProfile(currentUser); await recordLoginMetadata(currentUser); showAccount(); loadProgress(currentUser).catch(() => {}); }, 0);
      } else { currentProfile = null; closeAuth(); resetAccountButton(); }
    });
  });
})();
