// Account settings — integrated with the existing auth-v7 account modal.
(() => {
  const $ = (id) => document.getElementById(id);
  const client = () => window.supabase?.createClient(window.DMP_SUPABASE_URL, window.DMP_SUPABASE_ANON_KEY);

  function status(text, ok = false) {
    const el = $('accountSettingsStatus');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('ok', ok);
  }

  function close() {
    const root = $('accountSettingsPanel');
    if (!root) return;
    root.classList.remove('show');
    root.setAttribute('aria-hidden', 'true');
  }

  async function open() {
    const supabase = client();
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('username,date_of_birth,preferred_language,email')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      status(`❌ ${error.message}`);
      return;
    }

    $('accountSettingsEmail').textContent = user.email || '';
    $('accountSettingsUsername').value = profile?.username || '';
    $('accountSettingsDob').value = profile?.date_of_birth || '';
    $('accountSettingsLanguage').value = profile?.preferred_language || 'ar';

    const root = $('accountSettingsPanel');
    root.classList.add('show');
    root.setAttribute('aria-hidden', 'false');
    status('');
    $('accountSettingsUsername').focus();
  }

  async function save() {
    const supabase = client();
    if (!supabase) return;
    const username = $('accountSettingsUsername').value.trim();
    const dob = $('accountSettingsDob').value || null;
    const language = $('accountSettingsLanguage').value;

    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      status('❌ اسم المستخدم خاصو يكون بين 3 و20 حرف، باستعمال A-Z و0-9 و _.');
      return;
    }
    if (!['ar', 'fr', 'en'].includes(language)) {
      status('❌ اللغة غير صالحة.');
      return;
    }
    if (dob && new Date(`${dob}T00:00:00`) > new Date()) {
      status('❌ تاريخ الازدياد غير صالح.');
      return;
    }

    status('جاري حفظ التغييرات...');
    const { error } = await supabase.rpc('update_my_account_settings', {
      new_username: username,
      new_date_of_birth: dob,
      new_language: language
    });

    if (error) {
      status(`❌ ${error.message}`);
      return;
    }

    try { localStorage.setItem('dmp-language', language); } catch (e) {}
    status('✅ تم حفظ إعدادات الحساب بنجاح.', true);
  }

  async function changePassword() {
    const supabase = client();
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return status('❌ البريد الإلكتروني غير متوفر.');

    status('جاري إرسال رابط تغيير كلمة السر...');
    const { error } = await supabase.auth.resetPasswordForEmail(user.email);
    if (error) return status(`❌ ${error.message}`);
    status('✅ تم إرسال رابط آمن إلى بريدك الإلكتروني.', true);
  }

  function injectButton() {
    const actions = $('authActions');
    if (!actions || $('accountSettingsBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'accountSettingsBtn';
    btn.type = 'button';
    btn.className = 'btn ghost';
    btn.textContent = '⚙️ إعدادات الحساب';
    btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); open(); });
    actions.insertBefore(btn, actions.firstChild);
  }

  function init() {
    $('accountSettingsClose')?.addEventListener('click', close);
    $('accountSettingsPanel')?.addEventListener('click', (e) => {
      if (e.target === $('accountSettingsPanel')) close();
    });
    $('accountSettingsSave')?.addEventListener('click', save);
    $('accountSettingsPassword')?.addEventListener('click', changePassword);

    // auth-v7 builds the account actions dynamically, so watch for them.
    const observer = new MutationObserver(() => injectButton());
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(injectButton, 800);
  }

  window.DMP_openAccountSettings = open;
  window.DMP_closeAccountSettings = close;
  document.addEventListener('DOMContentLoaded', init);
})();
