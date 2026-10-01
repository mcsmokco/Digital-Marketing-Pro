(() => {
  const url = window.DMP_SUPABASE_URL;
  const key = window.DMP_SUPABASE_ANON_KEY;
  if (!url || !key || !window.supabase) return;

  const client = window.supabase.createClient(url, key);
  const SENT_KEY = 'dmp-ip-audit-session';

  async function recordCurrentSession() {
    try {
      if (sessionStorage.getItem(SENT_KEY) === '1') return;
      const { data } = await client.auth.getSession();
      const session = data?.session;
      if (!session?.access_token) return;

      const functionUrl = `${url.replace(/\/$/, '')}/functions/v1/record-login-ip`;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: key,
          'Content-Type': 'application/json'
        },
        body: '{}'
      });

      if (response.ok) sessionStorage.setItem(SENT_KEY, '1');
    } catch (_) {}
  }

  // auth-v7 owns authentication; this listener only audits an already-created session.
  recordCurrentSession();
  setTimeout(recordCurrentSession, 1500);
})();
