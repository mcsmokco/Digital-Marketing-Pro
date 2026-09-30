// Premium access — live authorization from Supabase public.profiles.
// The frontend is only the UX gate; real protection must also be enforced by RLS/RPC.
(() => {
  const url = window.DMP_SUPABASE_URL;
  const key = window.DMP_SUPABASE_ANON_KEY;
  if (!url || !key || !window.supabase) return;

  const client = window.supabase.createClient(url, key);
  let profile = null;
  let sessionUser = null;

  const premiumModules = () => Array.from(document.querySelectorAll('#modules .module')).slice(3);
  const isPremium = () => profile?.premium === true;

  function scrollToPricing() {
    document.querySelector('#pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function updatePremiumButton() {
    document.querySelectorAll('#premiumBtn').forEach(btn => {
      if (isPremium()) {
        btn.textContent = 'Premium مفعّل ✓';
        btn.disabled = true;
        btn.setAttribute('aria-label', 'اشتراك Premium مفعّل');
      } else if (sessionUser) {
        btn.textContent = 'فتح Premium 👑';
        btn.disabled = false;
        btn.setAttribute('aria-label', 'فتح Premium');
      } else {
        btn.textContent = 'سجّل الدخول أولاً 🔐';
        btn.disabled = false;
        btn.setAttribute('aria-label', 'تسجيل الدخول لفتح Premium');
      }
    });
  }

  function applyGate() {
    const hasPremium = isPremium();
    premiumModules().forEach(card => {
      card.classList.toggle('premium-locked', !hasPremium);
      const button = card.querySelector('.openLesson');
      if (!button) return;
      if (!hasPremium) {
        button.textContent = '🔒 Premium';
        button.dataset.premiumLocked = '1';
        button.setAttribute('aria-label', 'هذه الوحدة متاحة لمشتركي Premium');
      } else {
        button.textContent = 'فتح الوحدة';
        delete button.dataset.premiumLocked;
        button.removeAttribute('aria-label');
      }
    });

    window.DMP_profile = profile;
    window.DMP_isPremium = hasPremium;
    window.DMP_currentUser = sessionUser;
    updatePremiumButton();
    window.dispatchEvent(new CustomEvent('dmp-profile-ready', {
      detail: { user: sessionUser, profile, premium: hasPremium }
    }));
  }

  async function loadProfile(user) {
    sessionUser = user || null;
    profile = null;

    if (!sessionUser) {
      applyGate();
      return;
    }

    const { data, error } = await client
      .from('profiles')
      .select('id,email,role,premium')
      .eq('id', sessionUser.id)
      .maybeSingle();

    if (error) {
      console.error('Premium profile error:', error);
      profile = {
        id: sessionUser.id,
        email: sessionUser.email,
        role: 'user',
        premium: false
      };
    } else {
      profile = data || {
        id: sessionUser.id,
        email: sessionUser.email,
        role: 'user',
        premium: false
      };
    }

    applyGate();
  }

  async function refreshSession() {
    const { data, error } = await client.auth.getSession();
    if (error) console.error('Supabase session error:', error);
    await loadProfile(data?.session?.user || null);
  }

  function installPremiumButton() {
    const btn = document.querySelector('#premiumBtn');
    if (!btn || btn.dataset.supabaseBound === '1') return;
    btn.dataset.supabaseBound = '1';
    btn.addEventListener('click', async event => {
      event.preventDefault();
      event.stopPropagation();

      if (isPremium()) return;

      if (!sessionUser) {
        if (typeof window.DMP_openAuth === 'function') {
          window.DMP_openAuth();
        } else {
          document.querySelector('#accountBtn')?.click();
        }
        return;
      }

      scrollToPricing();
    });
  }

  function installClickGuard() {
    document.querySelector('#modules')?.addEventListener('click', event => {
      const button = event.target.closest('.openLesson');
      if (!button || button.dataset.premiumLocked !== '1') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();
      scrollToPricing();
    }, true);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    installClickGuard();
    installPremiumButton();
    await refreshSession();

    client.auth.onAuthStateChange((_event, session) => {
      // Defer the profile query so the auth event can finish cleanly.
      setTimeout(() => loadProfile(session?.user || null), 0);
    });

    const observer = new MutationObserver(() => {
      applyGate();
      installPremiumButton();
    });
    const box = document.querySelector('#modules');
    if (box) observer.observe(box, { childList: true });
  });
})();
