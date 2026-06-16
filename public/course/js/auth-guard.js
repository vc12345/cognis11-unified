(async function () {
    // 1. Ensure the Supabase client has loaded safely
    const client = window.supabaseClient || window.supabase;
    if (!client) {
        // If it hasn't caught up yet, give it a split second and retry
        setTimeout(arguments.callee, 50);
        return;
    }

    try {
        // 2. Fetch the current active user session
        const { data: { user } } = await client.auth.getUser();
        
        // If they aren't logged in at all, push them immediately to the Next.js gateway
        if (!user) {
            window.location.href = "/login";
            return;
        }

        // 3. Fetch their synchronized control profile
        const { data: profile, error } = await client
            .from('profiles')
            .select('course_type, course_subscription')
            .eq('id', user.id)
            .maybeSingle();

        if (error || !profile || !profile.course_type) {
            // Unenrolled or broken account path -> send to the profile control switchboard
            window.location.href = "/profile";
            return;
        }

        // 4. Smart Access Check
        // The 59 core modules are 100% free. Anyone enrolled can view them.
        // We only enforce a subscription lock if the page explicitly flags itself as premium mastery.
        const isMasteryPage = window.location.pathname.includes('-mastery') || document.body.dataset.requiresPremium === "true";
        
        if (isMasteryPage && profile.course_subscription !== true) {
            alert("This advanced Mastery sub-module requires an active voluntary subscription layer.");
            window.location.href = "/profile";
            return;
        }

        // Success! The script does nothing and lets the page load normally.
        console.log(`Auth Guard Verified: Enrolled in ${profile.course_type.toUpperCase()}`);

    } catch (err) {
        console.error("Critical Security Guard Failure:", err);
        window.location.href = "/profile";
    }
})();