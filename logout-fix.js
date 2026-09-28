/* Compatibility bridge for older cached index.html versions. */
(() => {
  let busy = false;
  const run = (e) => {
    const btn = e?.target?.closest?.('#logoutBtn');
    if (!btn || busy) return;
    busy = true;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation?.();
    try {
      if (typeof window.DMP_logout === 'function') {
        window.DMP_logout();
      } else {
        const modal = document.getElementById('authModal');
        if (modal) {
          modal.classList.remove('show');
          modal.setAttribute('aria-hidden', 'true');
          modal.hidden = true;
          modal.style.display = 'none';
          modal.style.pointerEvents = 'none';
        }
      }
    } finally {
      setTimeout(() => { busy = false; }, 500);
    }
  };
  document.addEventListener('click', run, true);
})();
