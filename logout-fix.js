/* Simple logout UI helper. No capture listeners, no pointer/touch interception. */
(() => {
  window.DMP_closeAuthImmediately = function () {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
    modal.style.visibility = 'hidden';
    modal.style.pointerEvents = 'none';
    document.body.classList.remove('auth-open');
  };
})();
