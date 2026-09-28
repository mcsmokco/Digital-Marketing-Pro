/* Final logout guard: close the account modal synchronously on every mobile pointer/touch/click path. */
(() => {
  let busy = false;
  const FLAG = 'dmp-force-logged-out';

  function closeModal() {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    modal.hidden = true;
    modal.style.setProperty('display', 'none', 'important');
    modal.style.visibility = 'hidden';
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    document.body.classList.remove('auth-open');
  }

  function resetAccount() {
    const area = document.getElementById('accountArea');
    if (!area) return;
    area.innerHTML = '<button class="account-btn" id="accountBtn" type="button">👤 حسابي</button>';
    const btn = document.getElementById('accountBtn');
    if (btn && typeof window.DMP_openAuth === 'function') btn.onclick = window.DMP_openAuth;
  }

  function runLogout(event) {
    const target = event && event.target;
    const button = target && target.closest ? target.closest('#logoutBtn') : null;
    if (!button || busy) return;

    busy = true;
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }

    // This flag is set synchronously so the auth listener can NEVER reopen the modal.
    try { sessionStorage.setItem(FLAG, '1'); } catch (e) {}

    // UI changes happen synchronously, before any Supabase/network work.
    button.disabled = true;
    closeModal();
    resetAccount();

    // Finish Supabase sign-out in the background. The UI never waits for it.
    try {
      if (typeof window.DMP_logout === 'function') {
        Promise.resolve(window.DMP_logout()).catch(() => {});
      }
    } catch (e) {}

    setTimeout(() => { busy = false; }, 500);
  }

  window.DMP_closeAuthImmediately = closeModal;
  window.DMP_logoutImmediately = () => {
    try { sessionStorage.setItem(FLAG, '1'); } catch (e) {}
    closeModal();
    resetAccount();
    if (typeof window.DMP_logout === 'function') Promise.resolve(window.DMP_logout()).catch(() => {});
  };

  // Capture phase + touch/pointer/click covers Android Chrome and dynamically-created buttons.
  document.addEventListener('pointerdown', runLogout, true);
  document.addEventListener('touchstart', runLogout, true);
  document.addEventListener('click', runLogout, true);
})();
