// Premium access gate — reads authorization from public.profiles through RLS.
// Never trust a hidden button as security; sensitive data/actions must also be protected by RLS/RPC.
(() => {
  const url = window.DMP_SUPABASE_URL;
  const key = window.DMP_SUPABASE_ANON_KEY;
  if (!url || !key || !window.supabase) return;
  const client = window.supabase.createClient(url, key);
  let profile = null;

  const premiumModules = () => Array.from(document.querySelectorAll('#modules .module')).slice(3);

  function applyGate() {
    const cards = premiumModules();
    const hasPremium = Boolean(profile?.premium) || (typeof window.DMP_ROLE_LEVEL === 'function' && window.DMP_ROLE_LEVEL(profile?.role) >= 1);
    cards.forEach((card) => {
      card.classList.toggle('premium-locked', !hasPremium);
      const button = card.querySelector('.openLesson');
      if (!button) return;
      if (!hasPremium) {
        button.textContent = '🔒 Premium';
        button.dataset.premiumLocked = '1';
      } else {
        button.textContent = 'فتح الوحدة';
        delete button.dataset.premiumLocked;
      }
    });
    window.DMP_profile = profile;
    window.DMP_isPremium = hasPremium;
    document.querySelectorAll('#premiumBtn').forEach(btn => {
      btn.textContent = hasPremium ? 'Premium مفعل ✓' : 'فتح Premium';
      btn.disabled = hasPremium;
    });
  }

  async function loadProfile() {
    const { data } = await client.auth.getSession();
    if (!data.session?.user) { profile = null; applyGate(); return; }
    const { data: row } = await client.from('profiles').select('id,email,role,premium').eq('id', data.session.user.id).maybeSingle();
    profile = row || { id: data.session.user.id, email: data.session.user.email, role: 'user', premium: false };
    applyGate();
  }

  const originalOpenModule = window.openModule;
  const installClickGuard = () => {
    document.querySelector('#modules')?.addEventListener('click', (e) => {
      const button = e.target.closest('.openLesson');
      if (!button || button.dataset.premiumLocked !== '1') return;
      e.preventDefault();
      e.stopPropagation();
      document.querySelector('#premium')?.scrollIntoView({ behavior: 'smooth' });
    }, true);
  };

  document.addEventListener('DOMContentLoaded', () => {
    installClickGuard();
    loadProfile();
    client.auth.onAuthStateChange(() => setTimeout(loadProfile, 0));
    const observer = new MutationObserver(() => applyGate());
    const box = document.querySelector('#modules');
    if (box) observer.observe(box, { childList: true });
  });
})();
