// js/supabase-config.js
(function() {
    const _url = 'https://cyfjoevfxfqkgokriarz.supabase.co';
    const _key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5ZmpvZXZmeGZxa2dva3JpYXJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4Nzk5NjYsImV4cCI6MjA4OTQ1NTk2Nn0.PLGiu7waa2ac1xw0AhGWEFrwDL8ySKrHj29gvevXH2Q'; // Ensure this is the ANON key, not service_role

    // 1. Create the client
    window.supabaseClient = supabase.createClient(_url, _key);

    // 2. Explicitly expose the keys so other scripts (like account.html) can find them
    window.supabaseConfig = {
        supabaseUrl: _url,
        supabaseAnonKey: _key
    };
    
    console.log("Cognis Config: Connection and keys pinned to window.");
})();