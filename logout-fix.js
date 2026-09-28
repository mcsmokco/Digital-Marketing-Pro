(() => {
  function forceCloseLogoutUI() {
    const modal = document.getElementById('authModal');
    if (modal) {
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
      modal.style.setProperty('display', 'none', 'important');
      modal.style.setProperty('visibility', 'hidden', 'important');
      modal.style.setProperty('opacity', '0', 'important');
      modal.style.setProperty('pointer-events', 'none', 'important');
    }
    document.body.classList.remove('auth-open');
    const area = document.getElementById('accountArea');
    if (area) area.innerHTML = '<button class="account-btn" id="accountBtn" type="button">👤 حسابي</button>';
  }

  function handleLogout(event) {
    const button = event.target?.closest?.('#logoutBtn');
    if (!button) return;
    forceCloseLogoutUI();
    event.preventDefault();
    event.stopImmediatePropagation();
    const logout = window.DMP_logout;
    if (typeof logout === 'function') setTimeout(() => { try { logout(); } catch (_) {} }, 0);
  }

  document.addEventListener('pointerdown', handleLogout, true);
  document.addEventListener('touchstart', handleLogout, true);
  document.addEventListener('click', handleLogout, true);
  window.DMP_forceLogoutUI = forceCloseLogoutUI;
})();
