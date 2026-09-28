/* Make logout behave exactly like the X close button. */
(() => {
  function closeImmediately() {
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

  window.DMP_closeAuthImmediately = closeImmediately;

  function bind() {
    const btn = document.getElementById('logoutBtn');
    if (!btn || btn.dataset.logoutDirect === '1') return;
    btn.dataset.logoutDirect = '1';
    btn.onclick = function (event) {
      event.preventDefault();
      event.stopPropagation();
      closeImmediately();
      if (typeof window.DMP_logout === 'function') window.DMP_logout();
      return false;
    };
  }

  document.addEventListener('DOMContentLoaded', bind);
  new MutationObserver(bind).observe(document.body, { childList: true, subtree: true });
})();
