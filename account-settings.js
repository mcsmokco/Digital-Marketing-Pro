// Account settings UI — safe client-side wrapper around server-side profile RPCs.
(() => {
  const esc = (v) => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

  async function initAccountSettings() {
    if (!window.supabase || !document.body) return;
    const client = window.supabase.createClient(window.DMP_SUPABASE_URL, window.DMP_SUPABASE_ANON_KEY);
    const { data: { user } } = await client.auth.getUser();
    if (!user) return;

    const { data: profile } = await client.from('profiles')
      .select('username,date_of_birth,preferred_language,email')
      .eq('id', user.id).maybeSingle();

    const root = document.querySelector('[data-account-settings]');
    if (!root) return;

    root.innerHTML = `
      <div class="account-settings-card">
        <h2>⚙️ إعدادات الحساب</h2>
        <label>🌍 اللغة<select id="accountLanguage"><option value="ar">العربية</option><option value="fr">Français</option><option value="en">English</option></select></label>
        <label>👤 اسم المستخدم<input id="accountUsername" maxlength="40" value="${esc(profile?.username || '')}"></label>
        <label>🎂 تاريخ الازدياد<input id="accountDob" type="date" value="${esc(profile?.date_of_birth || '')}"></label>
        <label>📧 البريد الإلكتروني<input value="${esc(user.email || '')}" disabled></label>
        <button id="saveAccountSettings" type="button">حفظ التغييرات</button>
        <button id="changeAccountPassword" type="button">🔑 تغيير كلمة السر</button>
        <p id="accountSettingsMessage" class="muted"></p>
      </div>`;

    document.getElementById('accountLanguage').value = profile?.preferred_language || 'ar';

    document.getElementById('saveAccountSettings').onclick = async () => {
      const msg = document.getElementById('accountSettingsMessage');
      msg.textContent = 'جاري الحفظ...';
      const { error } = await client.rpc('update_my_account_settings', {
        new_username: document.getElementById('accountUsername').value,
        new_date_of_birth: document.getElementById('accountDob').value || null,
        new_language: document.getElementById('accountLanguage').value
      });
      msg.textContent = error ? `❌ ${error.message}` : '✅ تم حفظ الإعدادات';
    };

    document.getElementById('changeAccountPassword').onclick = async () => {
      const msg = document.getElementById('accountSettingsMessage');
      msg.textContent = 'سيتم إرسال رابط آمن لتغيير كلمة السر إلى بريدك الإلكتروني.';
      const { error } = await client.auth.resetPasswordForEmail(user.email);
      if (error) msg.textContent = `❌ ${error.message}`;
    };
  }

  document.addEventListener('DOMContentLoaded', initAccountSettings);
})();
