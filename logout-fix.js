/* Digital Marketing Pro - logout UI guard */
(() => {
  function hideAuthModalImmediately() {
    const modal = document.getElementById('authModal');
    if (modal) {
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
      modal.style.display = 'none';
      modal.style.visibility = 'hidden';
      modal.style.pointerEvents = 'none';
    }
    document.body.classList.remove('auth-open');
  }

  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('#logoutBtn');
    if (!button) return;

    // Close the visible window before doing any network operation.
    hideAuthModalImmediately();
    button.disabled = true;

    // Keep the real Supabase logout in the background.
    try {
      if (typeof window.DMP_logout === 'function') window.DMP_logout(event);
    } catch (error) {
      console.error('Logout UI guard:', error);
    }
  }, true);
})();
