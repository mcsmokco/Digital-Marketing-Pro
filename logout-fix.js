/* FINAL logout fix: only intercept the actual logout button. */
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

  window.DMP_closeAuthImmediately = closeNow;

  // #logoutBtn is recreated dynamically, so use one delegated listener.
  // It only intercepts the real logout button; every other button is untouched.
  document.addEventListener('click', function (event) {
    const target = event.target;
    const btn = target && target.closest ? target.closest('#logoutBtn') : null;
    if (!btn) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    // Close immediately, before waiting for Supabase.
    closeNow();

    // Sign out in the background.
    if (typeof window.DMP_logout === 'function') {
      window.DMP_logout();
    }
  }, true);
})();
