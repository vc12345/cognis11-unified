// js/supabase-config.js
(function() {
    const _url = "https://mlqkuismvonmfmafmwtn.supabase.co";
    const _key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1scWt1aXNtdm9ubWZtYWZtd3RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NzYxODYsImV4cCI6MjA5MzU1MjE4Nn0.ZlROR5zU0x0DGXKWYEK2Tzok-EAt7BcuU_csxiCP9qQ";

    // 1. Create the client
    window.supabaseClient = supabase.createClient(_url, _key);

    // 2. Explicitly expose the keys so other scripts (like account.html) can find them
    window.supabaseConfig = {
        supabaseUrl: _url,
        supabaseAnonKey: _key
    };
    
    console.log("Cognis Config: Connection and keys pinned to window.");
})();

