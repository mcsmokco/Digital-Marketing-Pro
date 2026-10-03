// Digital Marketing Pro — Supabase configuration
// Replace these two values with your Supabase project's public URL and anon key.
// IMPORTANT: use only the public anon key here. Never put a service_role key in this file.
window.DMP_SUPABASE_URL = 'https://cehqazcdwcadkjwcxspb.supabase.co';
window.DMP_SUPABASE_ANON_KEY = 'sb_publishable_rXlR-6VTFEcxmOwLsqyKWQ_lxqmrryY';
// Additive shared client for modules that load after this config and the Supabase CDN.
if (window.supabase && window.supabase.createClient) {
  window.supabaseClient = window.supabase.createClient(window.DMP_SUPABASE_URL, window.DMP_SUPABASE_ANON_KEY);
}
