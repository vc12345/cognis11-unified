// js/auth-guard.js
(async function() {
    console.log("Auth Guard: Checking credentials...");

    // 1. Wait until the config has initialized the client
    if (!window.supabaseClient) {
        // If it's not ready yet, wait 100ms and try once more
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!window.supabaseClient) {
        console.error("Auth Guard Error: Connection not found.");
        return;
    }

    // 2. Use the window-pinned client
    const { data: { user } } = await window.supabaseClient.auth.getUser();

    if (!user) {
        console.warn("Auth Guard: No user, redirecting to login.");
        window.location.href = "/cognis11/login.html";
    } else {
        console.log("Auth Guard: Access Granted for", user.email);
    }
})();