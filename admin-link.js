// Adds the Admin shortcut only for profiles with an administrative role.
(() => {
  const url = window.DMP_SUPABASE_URL, key = window.DMP_SUPABASE_ANON_KEY;
  if (!url || !key || !window.supabase) return;
  const client = window.supabase.createClient(url, key);

  // Profile setup fix: auth-v7 previously tried a direct profiles UPDATE.
  // With the production RLS policy, that write can be rejected. Use the
  // SECURITY DEFINER RPC created by 20261001_profile_identity.sql instead.
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

    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      setStatus('اسم المستخدم خاصو يكون بين 3 و20 حرف، باستعمال الحروف الإنجليزية والأرقام و _ فقط.');
      return;
    }
    if (!dateOfBirth) {
      setStatus('اختار تاريخ الازدياد من فضلك.');
      return;
    }
    const dob = new Date(`${dateOfBirth}T00:00:00`);
    if (Number.isNaN(dob.getTime()) || dob > new Date()) {
      setStatus('تاريخ الازدياد غير صالح.');
      return;
    }

    button.disabled = true;
    setStatus('جاري حفظ معلومات الحساب...');
    try {
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData?.user) {
        setStatus('الجلسة ديالك منتهية. عاود سجل الدخول.');
        button.disabled = false;
        return;
      }

      const { data, error } = await client.rpc('update_my_profile', {
        p_username: username,
        p_date_of_birth: dateOfBirth,
        p_device_info: getDeviceInfoForProfile(),
        p_last_login_at: new Date().toISOString()
      });

      if (error) {
        const message = String(error.message || '');
        if (/already taken|duplicate|unique/i.test(message)) {
          setStatus('اسم المستخدم مستعمل من قبل. اختار اسم آخر.');
        } else if (/Profile not found/i.test(message)) {
          setStatus('ما لقيتش ملف الحساب. خاصنا نصلحو profile ديال الحساب.');
        } else {
          setStatus(message || 'تعذر حفظ المعلومات. حاول مرة أخرى.');
        }
        button.disabled = false;
        return;
      }

      setStatus('تم إعداد الحساب بنجاح ✅', true);
      button.disabled = true;
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

  // Capture phase guarantees this runs before auth-v7's old direct UPDATE handler.
  document.addEventListener('click', saveProfileThroughRpc, true);

  async function sync() {
    const nav = document.querySelector('.nav nav');
    if (!nav) return;
    nav.querySelector('[data-admin-link]')?.remove();
    const { data } = await client.auth.getSession();
    if (!data.session?.user) return;
    let role = null;
    try {
      const result = await client.from('profiles').select('role').eq('id', data.session.user.id).maybeSingle();
      role = result.data?.role || null;
    } catch (e) {}
    // Secure RPC fallback: works even when profile SELECT is restricted by RLS.
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
