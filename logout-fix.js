(() => {
  // Last-resort UI logout: this listener is independent from Supabase.
  document.addEventListener('click', (event) => {
    const button = event.target && event.target.closest ? event.target.closest('#logoutBtn') : null;
    if (!button) return;

    const modal = document.getElementById('authModal');
    if (modal) {
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
      modal.style.setProperty('display', 'none', 'important');
      modal.style.setProperty('visibility', 'hidden', 'important');
      modal.style.setProperty('pointer-events', 'none', 'important');
    }

    // Do not wait for network/auth callbacks. Reset the account UI immediately.
    const area = document.getElementById('accountArea');
    if (area) {
      area.innerHTML = '<button class="account-btn" id="accountBtn" type="button">👤 حسابي</button>';
    }
    document.body.classList.remove('auth-open');

    // Stop any older click handler from preventing the visible UI change.
    event.preventDefault();
    event.stopImmediatePropagation();

    // Complete the actual Supabase logout asynchronously, if available.
    try {
      const logout = window.DMP_logout;
      if (typeof logout === 'function') {
        Promise.resolve().then(() => logout()).catch(() => {});
      }
    } catch (_) {}

    // Re-bind the account button after replacing its HTML.
    const accountBtn = document.getElementById('accountBtn');
    if (accountBtn && typeof window.DMP_openAuth === 'function') {
      accountBtn.onclick = window.DMP_openAuth;
    }
  }, true);
})();
