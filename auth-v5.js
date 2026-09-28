(() => {
  const url = window.DMP_SUPABASE_URL;
  const key = window.DMP_SUPABASE_ANON_KEY;
  const enabled = Boolean(url && key && window.supabase);
  const client = enabled ? window.supabase.createClient(url, key) : null;
  let currentUser = null;
  let loggingOut = false;

  const emit = (type, detail = {}) => window.dispatchEvent(new CustomEvent(type, { detail }));
  const configMessage = !enabled ? 'الحسابات السحابية غير مفعلة بعد. ضع Supabase URL و anon key في supabase-config.js.' : '';

  function closeAuth() {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
    modal.style.visibility = 'hidden';
    modal.style.pointerEvents = 'none';
    document.body.classList.remove('auth-open');
  }

  function showLoggedOut() {
    currentUser = null;
    closeAuth();
    const area = document.getElementById('accountArea');
    if (area) {
      area.innerHTML = '<button class="account-btn" id="accountBtn" type="button">👤 حسابي</button>';
      const btn = document.getElementById('accountBtn');
      if (btn) btn.onclick = openAuth;
    }
  }

  function ensureUi() {
    if (document.getElementById('accountArea')) return;
    const nav = document.querySelector('.nav');
    if (!nav) return;

    const area = document.createElement('div');
    area.id = 'accountArea';
    area.className = 'account-area';
    area.innerHTML = '<button class="account-btn" id="accountBtn" type="button">👤 حسابي</button>';
    nav.insertBefore(area, document.getElementById('themeBtn'));

    const modal = document.createElement('div');
    modal.id = 'authModal';
    modal.className = 'auth-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `<div class="auth-box" role="dialog" aria-modal="true" aria-labelledby="authTitle">
      <button class="auth-close" id="authClose" aria-label="إغلاق" type="button">×</button>
      <span class="eyebrow">DIGITAL MARKETING PRO</span><h2 id="authTitle">حساب المتعلم</h2>
      <p class="auth-note" id="authNote">سجّل الدخول لحفظ تقدمك على أي جهاز.</p>
      <label>البريد الإلكتروني<input id="authEmail" type="email" autocomplete="email" placeholder="name@example.com"></label>
      <label>كلمة المرور<input id="authPassword" type="password" autocomplete="current-password" placeholder="••••••••"></label>
      <div class="auth-actions"><button class="btn primary" id="loginBtn" type="button">تسجيل الدخول</button><button class="btn ghost" id="signupBtn" type="button">إنشاء حساب</button></div>
      <button class="auth-link" id="resetBtn" type="button">نسيت كلمة المرور؟</button><p class="auth-status" id="authStatus"></p>
    </div>`;
    document.body.appendChild(modal);

    document.getElementById('accountBtn').onclick = openAuth;
    document.getElementById('authClose').onclick = closeAuth;
    modal.addEventListener('click', e => { if (e.target === modal) closeAuth(); });
    document.getElementById('loginBtn').onclick = signIn;
    document.getElementById('signupBtn').onclick = signUp;
    document.getElementById('resetBtn').onclick = resetPassword;
  }

  function setStatus(text, ok = false) {
    const el = document.getElementById('authStatus');
    if (el) { el.textContent = text; el.classList.toggle('ok', ok); }
  }

  function openAuth() {
    ensureUi();
    const modal = document.getElementById('authModal');
    if (!modal) return;
    modal.style.visibility = 'visible';
    modal.style.pointerEvents = 'auto';
    modal.style.display = 'grid';
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    if (!enabled) return setStatus(configMessage);
    if (currentUser && !loggingOut) showAccount();
    else document.getElementById('authEmail')?.focus();
  }

  function showAccount() {
    if (loggingOut) return;
    const note = document.getElementById('authNote');
    const actions = document.querySelector('.auth-actions');
    const reset = document.getElementById('resetBtn');
    const email = document.getElementById('authEmail');
    const pass = document.getElementById('authPassword');
    if (!currentUser || !note || !actions || !email || !pass || !reset) return;
    note.textContent = `مسجل الدخول: ${currentUser.email}`;
    email.style.display = 'none';
    pass.style.display = 'none';
    reset.style.display = 'none';
    actions.innerHTML = '<button class="btn primary" id="syncNow" type="button">مزامنة التقدم ☁️</button><button class="btn ghost" id="logoutBtn" type="button">تسجيل الخروج</button>';
    document.getElementById('syncNow').onclick = async () => {
      await saveProgress(JSON.parse(localStorage.getItem('dmp-state') || '{}'));
      setStatus('تمت مزامنة التقدم بنجاح ✅', true);
    };
    document.getElementById('logoutBtn').onclick = (event) => signOut(event);
  }

  function signOut(event) {
    if (event) {
      event.preventDefault();
      event.stopImmediatePropagation?.();
      event.stopPropagation();
    }
    if (loggingOut) return;
    loggingOut = true;

    // HARD UI FIRST: close the modal synchronously, before Supabase or any promise.
    closeAuth();
    currentUser = null;
    const area = document.getElementById('accountArea');
    if (area) {
      area.innerHTML = '<button class="account-btn" id="accountBtn" type="button">👤 حسابي</button>';
      document.getElementById('accountBtn').onclick = openAuth;
    }
    emit('dmp-logged-out');

    // Never block the UI on the network operation.
    if (enabled && client) {
      Promise.resolve().then(() => client.auth.signOut({ scope: 'local' })).catch(err => console.error('Logout error:', err)).finally(() => {
        loggingOut = false;
      });
    } else {
      loggingOut = false;
    }
  }

  // Capture phase handles both the current button and any stale DOM handler.
  document.addEventListener('click', event => {
    const button = event.target?.closest?.('#logoutBtn');
    if (!button) return;
    signOut(event);
  }, true);

  window.DMP_logout = signOut;
  window.DMP_closeAuth = closeAuth;

  async function signIn() {
    if (!enabled) return setStatus(configMessage);
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    if (!email || !password) return setStatus('دخل البريد الإلكتروني وكلمة المرور.');
    setStatus('جاري تسجيل الدخول...');
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return setStatus(error.message);
    setStatus('تم تسجيل الدخول ✅', true);
    closeAuth();
  }

  async function signUp() {
    if (!enabled) return setStatus(configMessage);
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    if (!email || password.length < 6) return setStatus('استعمل بريد صحيح وكلمة مرور من 6 أحرف على الأقل.');
    setStatus('جاري إنشاء الحساب...');
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) return setStatus(error.message);
    if (!data.session) return setStatus('تم إنشاء الحساب. راجع بريدك لتأكيد الحساب ثم سجل الدخول.', true);
    setStatus('تم إنشاء الحساب وتسجيل الدخول ✅', true);
    closeAuth();
  }

  async function resetPassword() {
    if (!enabled) return setStatus(configMessage);
    const email = document.getElementById('authEmail').value.trim();
    if (!email) return setStatus('دخل البريد الإلكتروني أولاً.');
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    setStatus(error ? error.message : 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك.', !error);
  }

  async function loadProgress(user) {
    if (!enabled || !user) return;
    const { data, error } = await client.from('course_progress').select('state').eq('user_id', user.id).maybeSingle();
    if (error) return;
    if (data?.state) {
      localStorage.setItem('dmp-state', JSON.stringify(data.state));
      emit('dmp-cloud-state', { state: data.state });
    } else {
      await saveProgress(JSON.parse(localStorage.getItem('dmp-state') || '{}'));
    }
  }

  async function saveProgress(state) {
    if (!enabled || !currentUser) return;
    await client.from('course_progress').upsert({ user_id: currentUser.id, state, updated_at: new Date().toISOString() });
  }

  window.DMP_saveState = saveProgress;
  window.DMP_cloudEnabled = enabled;

  document.addEventListener('DOMContentLoaded', async () => {
    ensureUi();
    if (!enabled) return;
    const { data } = await client.auth.getSession();
    currentUser = data.session?.user || null;
    if (currentUser) {
      showAccount();
      await loadProgress(currentUser);
    }
    client.auth.onAuthStateChange((_event, session) => {
      if (loggingOut) return;
      currentUser = session?.user || null;
      if (currentUser) {
        ensureUi();
        showAccount();
        loadProgress(currentUser).catch(() => {});
      } else {
        showLoggedOut();
      }
    });
  });
})();
