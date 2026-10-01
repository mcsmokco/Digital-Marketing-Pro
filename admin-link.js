// Adds the Admin shortcut only for profiles with an administrative role.
// Also mounts Account Settings without replacing the existing auth system.
(() => {
  const url = window.DMP_SUPABASE_URL, key = window.DMP_SUPABASE_ANON_KEY;
  if (!url || !key || !window.supabase) return;
  const client = window.supabase.createClient(url, key);

  function mountAccountSettings() {
    if (!document.body || document.querySelector('[data-account-settings]')) return;
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = 'account-settings.css?v=20261001-1';
    document.head.appendChild(style);

    const root = document.createElement('section');
    root.setAttribute('data-account-settings', '1');
    root.className = 'section';
    root.id = 'account-settings';
    root.innerHTML = '<div class="container"><div class="account-settings-mount"></div></div>';
    document.body.appendChild(root);

    if (!document.querySelector('script[data-account-settings-script]')) {
      const script = document.createElement('script');
      script.src = 'account-settings.js?v=20261001-1';
      script.dataset.accountSettingsScript = '1';
      document.body.appendChild(script);
    }
  }

  async function saveProfileThroughRpc(event) {
    const button = event.target?.closest?.('#saveProfileBtn');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const status = document.getElementById('authStatus');
    const username = document.getElementById('profileUsername')?.value.trim() || '';
    const dateOfBirth = document.getElementById('profileDob')?.value || '';
    const setStatus = (text, ok = false) => {
      if (!status) return;
      status.textContent = text;
      status.classList.toggle('ok', ok);
    };

    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return setStatus('اسم المستخدم خاصو يكون بين 3 و20 حرف، باستعمال الحروف الإنجليزية والأرقام و _ فقط.');
    if (!dateOfBirth) return setStatus('اختار تاريخ الازدياد من فضلك.');
    const dob = new Date(`${dateOfBirth}T00:00:00`);
    if (Number.isNaN(dob.getTime()) || dob > new Date()) return setStatus('تاريخ الازدياد غير صالح.');

    button.disabled = true;
    setStatus('جاري حفظ معلومات الحساب...');
    try {
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData?.user) return setStatus('الجلسة ديالك منتهية. عاود سجل الدخول.');
      const { error } = await client.rpc('update_my_profile', {
        p_username: username,
        p_date_of_birth: dateOfBirth,
        p_device_info: getDeviceInfoForProfile(),
        p_last_login_at: new Date().toISOString()
      });
      if (error) {
        const message = String(error.message || '');
        setStatus(/already taken|duplicate|unique/i.test(message) ? 'اسم المستخدم مستعمل من قبل. اختار اسم آخر.' : message || 'تعذر حفظ المعلومات. حاول مرة أخرى.');
        button.disabled = false;
        return;
      }
      setStatus('تم إعداد الحساب بنجاح ✅', true);
      setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setStatus(error?.message || 'وقع خطأ أثناء حفظ المعلومات. حاول مرة أخرى.');
      button.disabled = false;
    }
  }

  function getDeviceInfoForProfile() {
    const ua = navigator.userAgent || '';
    const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac OS X/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'جهاز غير معروف';
    const browser = /Edg\//i.test(ua) ? 'Edge' : /OPR\//i.test(ua) ? 'Opera' : /Chrome\//i.test(ua) ? 'Chrome' : /Firefox\//i.test(ua) ? 'Firefox' : /Safari\//i.test(ua) && !/Chrome\//i.test(ua) ? 'Safari' : 'Browser';
    return `${os} · ${browser}`;
  }

  document.addEventListener('click', saveProfileThroughRpc, true);

  async function sync() {
    const nav = document.querySelector('.nav nav');
    if (!nav) return;
    nav.querySelector('[data-admin-link]')?.remove();
    const { data } = await client.auth.getSession();
    if (!data.session?.user) return;
    mountAccountSettings();

    let role = null;
    try {
      const result = await client.from('profiles').select('role').eq('id', data.session.user.id).maybeSingle();
      role = result.data?.role || null;
    } catch (e) {}
    if (!role) {
      try {
        const result = await client.rpc('current_profile_role');
        role = result.data || null;
      } catch (e) {}
    }
    const level = typeof window.DMP_ROLE_LEVEL === 'function' ? window.DMP_ROLE_LEVEL(role) : 0;
    if (level < 1) return;
    const link = document.createElement('a');
    link.href = 'admin.html';
    link.dataset.adminLink = '1';
    link.textContent = '🛡️ الإدارة';
    nav.appendChild(link);
  }

  document.addEventListener('DOMContentLoaded', () => {
    sync();
    client.auth.onAuthStateChange(() => setTimeout(sync, 0));
  });
})();
