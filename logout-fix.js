/* Root logout fix: close the modal immediately and sign out without a refresh. */
(() => {
  function closeNow() {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
    modal.style.visibility = 'hidden';
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    document.body.classList.remove('auth-open');
  }

  function logout() {
    // UI must never wait for Supabase/network.
    closeNow();
    if (typeof window.DMP_logout === 'function') {
      Promise.resolve(window.DMP_logout()).catch(() => {});
    }
  }

  window.DMP_closeAuthImmediately = closeNow;
  window.DMP_logoutImmediately = logout;

  // The logout button is recreated after login, so delegate from document.
  // pointerup is important on mobile; click remains as a fallback.
  function handle(event) {
    const target = event.target;
    const btn = target && target.closest ? target.closest('#logoutBtn') : null;
    if (!btn) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    logout();
  }

  document.addEventListener('pointerup', handle, true);
  document.addEventListener('click', handle, true);
})();
