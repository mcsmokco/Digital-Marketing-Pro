(() => {
  const url = window.DMP_SUPABASE_URL;
  const key = window.DMP_SUPABASE_ANON_KEY;
  const enabled = Boolean(url && key && window.supabase);
  const client = enabled ? window.supabase.createClient(url, key) : null;
  let currentUser = null;
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
    modal.innerHTML = `<div class="auth-box" role="dialog" aria-modal="true"><button class="auth-close" id="authClose" type="button">×</button><span class="eyebrow">DIGITAL MARKETING PRO</span><h2>حساب المتعلم</h2><p class="auth-note" id="authNote">سجّل الدخول لحفظ تقدمك على أي جهاز.</p><label>البريد الإلكتروني<input id="authEmail" type="email"></label><label>كلمة المرور<input id="authPassword" type="password"></label><div class="auth-actions" id="authActions"><button class="btn primary" id="loginBtn" type="button">تسجيل الدخول</button><button class="btn ghost" id="signupBtn" type="button">إنشاء حساب</button></div><button class="auth-link" id="resetBtn" type="button">نسيت كلمة المرور؟</button><p class="auth-status" id="authStatus"></p></div>`;
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
    loggingOut = true; ++authOperation; currentUser = null; markLoggedOut(); clearAuthStorage(); closeAuth(); resetAccountButton();
    try { window.dispatchEvent(new CustomEvent('dmp-logged-out')); } catch (e) {}
    // Deliberately reload immediately after the click. This is the reliable fix for the stale account UI.
    window.location.reload();
  }
  window.DMP_logout = logoutNow; window.DMP_closeAuth = closeAuth; window.DMP_openAuth = openAuth; window.DMP_cloudEnabled = enabled;
  function showAccount() {
    if (!currentUser || loggingOut || forcedLoggedOut()) return;
    const note = $('authNote'), actions = $('authActions'), reset = $('resetBtn'), email = $('authEmail'), pass = $('authPassword'); if (!note || !actions || !reset || !email || !pass) return;
    note.textContent = `مسجل الدخول: ${currentUser.email}`; email.style.display = 'none'; pass.style.display = 'none'; reset.style.display = 'none';
    actions.innerHTML = '<button class="btn primary" id="syncNow" type="button">مزامنة التقدم ☁️</button><button class="btn ghost" id="logoutBtn" type="button">تسجيل الخروج</button>';
    $('syncNow').onclick = async e => { e.preventDefault(); e.stopPropagation(); if (loggingOut) return; await saveProgress(JSON.parse(localStorage.getItem('dmp-state') || '{}')); if (!loggingOut) setStatus('تمت مزامنة التقدم بنجاح ✅', true); };
    const logoutBtn = $('logoutBtn'); if (logoutBtn) logoutBtn.onclick = e => { e.preventDefault(); e.stopPropagation(); logoutNow(); return false; };
  }
  async function signIn() {
    if (loggingOut || !enabled) return; clearLoggedOut(); const op = ++authOperation; const e = $('authEmail')?.value.trim(), p = $('authPassword')?.value || '';
    if (!e || !p) return setStatus('دخل البريد الإلكتروني وكلمة المرور.'); setStatus('جاري تسجيل الدخول...');
    try { const result = await Promise.race([client.auth.signInWithPassword({ email: e, password: p }), new Promise(resolve => setTimeout(() => resolve({ timeout: true }), 15000))]); if (op !== authOperation || loggingOut) return; if (result?.timeout) return setStatus('تعذر الاتصال بخدمة تسجيل الدخول. حاول مرة أخرى.'); const { data, error } = result; if (error) return setStatus(error.message); currentUser = data?.user || data?.session?.user || null; if (!currentUser) return setStatus('تم تسجيل الدخول لكن لم يتم استلام جلسة الحساب. أعد المحاولة.'); showAccount(); closeAuth(); loadProgress(currentUser).catch(() => {}); } catch (err) { if (op !== authOperation || loggingOut) return; setStatus(err?.message || 'وقع خطأ أثناء تسجيل الدخول. حاول مرة أخرى.'); }
  }
  async function signUp() {
    if (loggingOut || !enabled) return; clearLoggedOut(); const op = ++authOperation, e = $('authEmail')?.value.trim(), p = $('authPassword')?.value || '';
    if (!e || p.length < 6) return setStatus('استعمل بريد صحيح وكلمة مرور من 6 أحرف على الأقل.'); setStatus('جاري إنشاء الحساب...');
    try { const { data, error } = await client.auth.signUp({ email: e, password: p, options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` } }); if (op !== authOperation || loggingOut) return; if (error) return setStatus(error.message); if (!data.session) return setStatus('تم إنشاء الحساب. راجع بريدك لتأكيد الحساب ثم ارجع للموقع لتسجيل الدخول.', true); currentUser = data.user || data.session.user; showAccount(); closeAuth(); } catch (err) { if (op !== authOperation || loggingOut) return; setStatus(err?.message || 'وقع خطأ أثناء إنشاء الحساب. حاول مرة أخرى.'); }
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
    ensureUi(); if (!enabled) return; if (forcedLoggedOut()) { currentUser = null; clearAuthStorage(); resetAccountButton(); closeAuth(); return; }
    const { data } = await client.auth.getSession(); if (loggingOut || forcedLoggedOut()) return; currentUser = data.session?.user || null; if (currentUser) { showAccount(); loadProgress(currentUser).catch(() => {}); }
    client.auth.onAuthStateChange((_event, session) => { if (loggingOut || forcedLoggedOut()) { currentUser = null; closeAuth(); resetAccountButton(); return; } currentUser = session?.user || null; if (currentUser) showAccount(); else { closeAuth(); resetAccountButton(); } });
  });
})();
