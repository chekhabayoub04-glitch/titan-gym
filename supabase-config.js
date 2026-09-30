(() => {
  // Use a publishable/anon key here. Never place an sb_secret key in browser code.
  const SUPABASE_URL = 'https://ggiidrwftqrrxfosmoqu.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_QlZvGxmXaTiR72olx-fAwQ_8WDPQ7-l';

  const supabaseConfigured = !SUPABASE_KEY.includes('PASTE_YOUR_');
  const supabaseClient = window.supabase && supabaseConfigured
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

  window.supabaseClient = supabaseClient;
  window.titanSupabase = supabaseClient;
  window.titanSupabaseConfigured = Boolean(supabaseClient);

  if (!window.supabase) {
    console.error('Supabase CDN failed to load. Check the network connection.');
  } else if (!supabaseConfigured) {
    console.warn('Set SUPABASE_KEY to your Supabase publishable key in supabase-config.js before using cloud storage.');
  }
})();