(() => {
  const url = window.DMP_SUPABASE_URL;
  const key = window.DMP_SUPABASE_ANON_KEY;
  const enabled = Boolean(url && key && window.supabase);
  const client = enabled ? window.supabase.createClient(url, key) : null;
  let currentUser = null;
  let loggingOut = false;
  let authOperation = 0;
  const $ = id => document.getElementById(id);
  const emit = (type, detail = {}) => window.dispatchEvent(new CustomEvent(type, { detail }));

  function closeAuth() {
    const modal = $('authModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
    modal.style.visibility = 'hidden';
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    document.body.classList.remove('auth-open');
  }

  function resetAccountButton() {
    const area = $('accountArea');
    if (!area) return;
    area.innerHTML = '<button class="account-btn" id="accountBtn" type="button">👤 حسابي</button>';
    $('accountBtn').onclick = openAuth;
  }

  function setStatus(text, ok = false) {
    const el = $('authStatus');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('ok', ok);
  }

  function ensureUi() {
    if ($('accountArea')) return;
    const nav = document.querySelector('.nav');
    if (!nav) return;
    const area = document.createElement('div');
    area.id = 'accountArea';
    area.className = 'account-area';
    area.innerHTML = '<button class="account-btn" id="accountBtn" type="button">👤 حسابي</button>';
    nav.insertBefore(area, $('themeBtn'));

    const modal = document.createElement('div');
    modal.id = 'authModal';
    modal.className = 'auth-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `<div class="auth-box" role="dialog" aria-modal="true">
      <button class="auth-close" id="authClose" type="button">×</button>
      <span class="eyebrow">DIGITAL MARKETING PRO</span>
      <h2>حساب المتعلم</h2>
      <p class="auth-note" id="authNote">سجّل الدخول لحفظ تقدمك على أي جهاز.</p>
      <label>البريد الإلكتروني<input id="authEmail" type="email" autocomplete="email"></label>
      <label>كلمة المرور<input id="authPassword" type="password" autocomplete="current-password"></label>
      <div class="auth-actions" id="authActions"><button class="btn primary" id="loginBtn" type="button">تسجيل الدخول</button><button class="btn ghost" id="signupBtn" type="button">إنشاء حساب</button></div>
      <button class="auth-link" id="resetBtn" type="button">نسيت كلمة المرور؟</button>
      <p class="auth-status" id="authStatus"></p>
    </div>`;
    document.body.appendChild(modal);

    $('accountBtn').onclick = openAuth;
    $('authClose').onclick = closeAuth;
    $('loginBtn').onclick = signIn;
    $('signupBtn').onclick = signUp;
    $('resetBtn').onclick = resetPassword;
    modal.addEventListener('click', e => { if (e.target === modal) closeAuth(); });
  }

  function openAuth() {
    ensureUi();
    const modal = $('authModal');
    if (!modal) return;
    modal.style.display = 'grid';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto';
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    if (!enabled) return setStatus('الحسابات السحابية غير مفعلة بعد.');
    if (currentUser && !loggingOut) showAccount();
    else $('authEmail')?.focus();
  }

  // Logout deliberately uses the exact same UI close path as the × button.
  // The cloud sign-out runs only after the modal is already closed.
  function logoutNow() {
    if (loggingOut) return;
    loggingOut = true;
    ++authOperation;
    currentUser = null;

    // Immediate local UI result — this happens before any Supabase promise.
    closeAuth();
    resetAccountButton();
    emit('dmp-logged-out');

    // Background cleanup only. It can never reopen the modal or show login status.
    if (enabled && client) {
      client.auth.signOut({ scope: 'local' })
        .catch(err => console.error('Logout error:', err))
        .finally(() => { loggingOut = false; });
    } else {
      loggingOut = false;
    }
  }

  function showAccount() {
    if (!currentUser || loggingOut) return;
    const note = $('authNote');
    const actions = $('authActions');
    const reset = $('resetBtn');
    const email = $('authEmail');
    const pass = $('authPassword');
    if (!note || !actions || !reset || !email || !pass) return;

    note.textContent = `مسجل الدخول: ${currentUser.email}`;
    email.style.display = 'none';
    pass.style.display = 'none';
    reset.style.display = 'none';
    actions.innerHTML = '<button class="btn primary" id="syncNow" type="button">مزامنة التقدم ☁️</button><button class="btn ghost" id="logoutBtn" type="button">تسجيل الخروج</button>';

    const sync = $('syncNow');
    if (sync) sync.onclick = async function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (loggingOut) return;
      await saveProgress(JSON.parse(localStorage.getItem('dmp-state') || '{}'));
      if (!loggingOut) setStatus('تمت مزامنة التقدم بنجاح ✅', true);
    };

    const logout = $('logoutBtn');
    if (logout) {
      // One and only one handler. No event delegation or capture handler.
      logout.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        logoutNow();
        return false;
      };
    }
  }

  window.DMP_logout = logoutNow;
  window.DMP_closeAuth = closeAuth;
  window.DMP_openAuth = openAuth;
  window.DMP_saveState = saveProgress;
  window.DMP_cloudEnabled = enabled;

  async function signIn() {
    if (loggingOut || !enabled) return;
    const op = ++authOperation;
    const email = $('authEmail')?.value.trim();
    const password = $('authPassword')?.value || '';
    if (!email || !password) return setStatus('دخل البريد الإلكتروني وكلمة المرور.');
    setStatus('جاري تسجيل الدخول...');
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (op !== authOperation || loggingOut) return;
    if (error) return setStatus(error.message);
    closeAuth();
  }

  async function signUp() {
    if (loggingOut || !enabled) return;
    const op = ++authOperation;
    const email = $('authEmail')?.value.trim();
    const password = $('authPassword')?.value || '';
    if (!email || password.length < 6) return setStatus('استعمل بريد صحيح وكلمة مرور من 6 أحرف على الأقل.');
    setStatus('جاري إنشاء الحساب...');
    const { data, error } = await client.auth.signUp({ email, password });
    if (op !== authOperation || loggingOut) return;
    if (error) return setStatus(error.message);
    if (!data.session) return setStatus('تم إنشاء الحساب. راجع بريدك لتأكيد الحساب ثم سجل الدخول.', true);
    closeAuth();
  }

  async function resetPassword() {
    if (loggingOut || !enabled) return;
    const email = $('authEmail')?.value.trim();
    if (!email) return setStatus('دخل البريد الإلكتروني أولاً.');
    setStatus('جاري إرسال الرابط...');
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (!loggingOut) setStatus(error ? error.message : 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك.', !error);
  }

  async function loadProgress(user) {
    if (!enabled || !user) return;
    const { data, error } = await client.from('course_progress').select('state').eq('user_id', user.id).maybeSingle();
    if (error || loggingOut || !currentUser) return;
    if (data?.state) {
      localStorage.setItem('dmp-state', JSON.stringify(data.state));
      emit('dmp-cloud-state', { state: data.state });
    } else {
      await saveProgress(JSON.parse(localStorage.getItem('dmp-state') || '{}'));
    }
  }

  async function saveProgress(state) {
    if (!enabled || !currentUser || loggingOut) return;
    await client.from('course_progress').upsert({ user_id: currentUser.id, state, updated_at: new Date().toISOString() });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    ensureUi();
    if (!enabled) return;
    const { data } = await client.auth.getSession();
    if (loggingOut) return;
    currentUser = data.session?.user || null;
    if (currentUser) {
      showAccount();
      loadProgress(currentUser).catch(() => {});
    }
    client.auth.onAuthStateChange((_event, session) => {
      if (loggingOut) return;
      currentUser = session?.user || null;
      if (currentUser) showAccount();
      else {
        closeAuth();
        resetAccountButton();
      }
    });
  });
})();
