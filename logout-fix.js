/* Hard logout fix for mobile browsers and cached auth state. */
(() => {
  let busy = false;
  const FLAG = 'dmp-force-logged-out';

  function clearSupabaseAuthStorage() {
    try {
      for (const store of [localStorage, sessionStorage]) {
        const remove = [];
        for (let i = 0; i < store.length; i++) {
          const key = store.key(i);
          if (key && (/^sb-.*-auth-token$/i.test(key) || /supabase.*auth.*token/i.test(key))) remove.push(key);
        }
        remove.forEach(key => store.removeItem(key));
      }
    } catch (_) {}
  }

  function closeModal() {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    modal.hidden = true;
    modal.style.setProperty('display', 'none', 'important');
    modal.style.visibility = 'hidden';
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    document.body.classList.remove('auth-open');
  }

  function resetAccount() {
    const area = document.getElementById('accountArea');
    if (!area) return;
    area.innerHTML = '<button class="account-btn" id="accountBtn" type="button">👤 تسجيل الدخول</button>';
    const btn = document.getElementById('accountBtn');
    if (btn && typeof window.DMP_openAuth === 'function') btn.onclick = window.DMP_openAuth;
  }

  function markLoggedOut() {
    try { sessionStorage.setItem(FLAG, '1'); } catch (_) {}
    clearSupabaseAuthStorage();
    try { window.dispatchEvent(new CustomEvent('dmp-logged-out')); } catch (_) {}
  }

  function hardLogout(event) {
    const target = event && event.target;
    const button = target && target.closest ? target.closest('#logoutBtn') : null;
    if (!button || busy) return;

    busy = true;
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();

    // 1) Mark logged out and clear the persisted token synchronously.
    markLoggedOut();

    // 2) Change the UI synchronously. Nothing waits for Supabase/network.
    button.disabled = true;
    closeModal();
    resetAccount();

    // 3) Tell Supabase to revoke the session in the background.
    try {
      const url = window.DMP_SUPABASE_URL;
      const key = window.DMP_SUPABASE_ANON_KEY;
      if (url && key && window.supabase) {
        const client = window.supabase.createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
        });
        client.auth.signOut({ scope: 'global' }).catch(() => {}).finally(() => {
          clearSupabaseAuthStorage();
        });
      }
    } catch (_) {}

    // Also use the existing app logout, but never wait for it.
    try {
      if (typeof window.DMP_logout === 'function') Promise.resolve(window.DMP_logout()).catch(() => {});
    } catch (_) {}

    setTimeout(() => { busy = false; }, 700);
  }

  window.DMP_closeAuthImmediately = closeModal;
  window.DMP_logoutImmediately = () => {
    markLoggedOut();
    closeModal();
    resetAccount();
    try {
      if (typeof window.DMP_logout === 'function') Promise.resolve(window.DMP_logout()).catch(() => {});
    } catch (_) {}
  };

  // Capture phase catches dynamically-created logout buttons on Android Chrome.
  document.addEventListener('pointerdown', hardLogout, true);
  document.addEventListener('touchstart', hardLogout, true);
  document.addEventListener('click', hardLogout, true);
})();
