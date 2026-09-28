/* Root logout guard: close the account modal synchronously on the user's first tap. */
(() => {
  const FLAG = 'dmp-force-logged-out';
  let handled = false;

  function closeModalNow() {
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
    area.innerHTML = '<button class="account-btn" id="accountBtn" type="button">👤 حسابي</button>';
    const btn = document.getElementById('accountBtn');
    if (btn && typeof window.DMP_openAuth === 'function') btn.onclick = window.DMP_openAuth;
  }

  function handleLogout(e) {
    const target = e?.target?.closest?.('#logoutBtn');
    if (!target || handled) return;

    handled = true;
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

    try { sessionStorage.setItem(FLAG, '1'); } catch (_) {}

    // First: make logout visible immediately.
    closeModalNow();
    resetAccount();

    // Then: complete Supabase local sign-out without blocking the UI.
    try {
      if (typeof window.DMP_logout === 'function') window.DMP_logout();
    } catch (_) {}

    // Fallback requested: refresh automatically after logout.
    // Auth storage has already been cleared by the logout flow, so the reload
    // guarantees the whole page is rebuilt in the logged-out state.
    window.setTimeout(() => {
      try { location.reload(); } catch (_) { window.location.href = window.location.href; }
    }, 1000);

    window.setTimeout(() => { handled = false; }, 1500);
  }

  document.addEventListener('pointerdown', handleLogout, true);
  document.addEventListener('click', handleLogout, true);
})();
