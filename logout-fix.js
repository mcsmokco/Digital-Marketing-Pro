/* Root logout fix: immediate, mobile-safe, no refresh required. */
(() => {
  let handled = false;

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

  function logout(event) {
    const target = event.target;
    const button = target && target.closest ? target.closest('#logoutBtn') : null;
    if (!button || handled) return;

    handled = true;
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();

    // 1) Close the modal immediately — never wait for network/Supabase.
    closeNow();

    // 2) Complete the Supabase local sign-out in the background.
    if (typeof window.DMP_logout === 'function') {
      Promise.resolve(window.DMP_logout()).catch(() => {});
    }

    // Allow a future login/logout cycle to work normally.
    setTimeout(() => { handled = false; }, 300);
  }

  window.DMP_closeAuthImmediately = closeNow;
  window.DMP_logoutImmediately = () => {
    closeNow();
    if (typeof window.DMP_logout === 'function') Promise.resolve(window.DMP_logout()).catch(() => {});
  };

  // Capture phase catches dynamically-created #logoutBtn on Android/Chrome.
  document.addEventListener('pointerdown', logout, true);
  document.addEventListener('click', logout, true);
})();
