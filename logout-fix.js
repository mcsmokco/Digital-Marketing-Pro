/* Digital Marketing Pro - immediate logout UI guard */
(() => {
  const hide = () => {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
    modal.style.visibility = 'hidden';
    modal.style.pointerEvents = 'none';
    document.body.classList.remove('auth-open');
  };

  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('#logoutBtn');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation?.();
    hide();
    try {
      if (typeof window.DMP_logout === 'function') window.DMP_logout(event);
    } catch (error) {
      console.error('Logout guard error:', error);
    }
  }, true);
})();