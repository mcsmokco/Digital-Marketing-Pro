(() => {
  const started = Date.now();
  let lastRecordedUserId = null;
  let inFlight = false;

  function getClient() {
    if (!window.supabase || !window.DMP_SUPABASE_URL || !window.DMP_SUPABASE_ANON_KEY) return null;
    if (!window.__DMP_SUPABASE_CLIENT__) {
      window.__DMP_SUPABASE_CLIENT__ = window.supabase.createClient(
        window.DMP_SUPABASE_URL,
        window.DMP_SUPABASE_ANON_KEY
      );
    }
    return window.__DMP_SUPABASE_CLIENT__;
  }

  async function recordLoginIp(sessionUser) {
    if (!sessionUser || inFlight || lastRecordedUserId === sessionUser.id) return;
    inFlight = true;
    try {
      const client = getClient();
      if (!client) return;

      const { data: sessionData } = await client.auth.getSession();
      const session = sessionData?.session;
      if (!session?.user?.id || session.user.id !== sessionUser.id) return;

      const { error } = await client.functions.invoke('record-login-ip', {
        body: { source: 'web-login', client_started_at: started }
      });

      if (!error) lastRecordedUserId = sessionUser.id;
    } catch (e) {
      // IP auditing must never block or break login.
    } finally {
      inFlight = false;
    }
  }

  async function handleSession(session) {
    if (session?.user) await recordLoginIp(session.user);
  }

  function start() {
    const client = getClient();
    if (!client) return;

    client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        // Defer the Edge Function call so auth state handling stays non-blocking.
        setTimeout(() => handleSession(session), 0);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
