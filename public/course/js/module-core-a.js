/**
 * DATABASE SCHEMA COMPATIBILITY LAYER (POLYFILL INTERCEPTOR)
 * Intercepts legacy queries for 'subscription_plan' from all 59 modules 
 * and maps them automatically to 'course_type' to prevent massive file edits.
 */
(function patchSupabaseSchemaBridge() {
    if (!window.supabaseClient) {
        setTimeout(patchSupabaseSchemaBridge, 30); // Loop safely until client triggers
        return;
    }

    const originalFrom = window.supabaseClient.from;
    window.supabaseClient.from = function(table) {
        if (table === 'profiles') {
            const builder = originalFrom.apply(this, arguments);
            const originalSelect = builder.select;

            // Intercept the selection query modifier
            builder.select = function(columns) {
                let isLegacyQuery = false;
                if (columns && columns.includes('subscription_plan')) {
                    columns = columns.replace('subscription_plan', 'course_type');
                    isLegacyQuery = true;
                }

                const postSelectBuilder = originalSelect.apply(this, [columns]);

                if (isLegacyQuery) {
                    // Intercept .maybeSingle() execution responses
                    const originalMaybeSingle = postSelectBuilder.maybeSingle;
                    postSelectBuilder.maybeSingle = async function() {
                        const response = await originalMaybeSingle.apply(this, arguments);
                        if (response.data) {
                            response.data.subscription_plan = response.data.course_type;
                        }
                        return response;
                    };

                    // Intercept .single() execution responses
                    const originalSingle = postSelectBuilder.single;
                    postSelectBuilder.single = async function() {
                        const response = await originalSingle.apply(this, arguments);
                        if (response.data) {
                            response.data.subscription_plan = response.data.course_type;
                        }
                        return response;
                    };
                }
                return postSelectBuilder;
            };
            return builder;
        }
        return originalFrom.apply(this, arguments);
    };
    console.log("Cognis Core Bridge: Supabase schema query mapping proxy is live.");
})();

/**
 * GOOGLE ANALYTICS 4 INTEGRATION
 */
(function initializeAnalytics() {
    const GA_ID = 'G-YK13FYQ1CJ';
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', GA_ID);
    window.gtag = gtag; 
})();

/**
 * SMART LOADER: Fetches the consolidated registry
 */
async function ensureRegistry() {
    if (typeof COGNIS_MODULES !== 'undefined') return true;

    return new Promise((resolve) => {
        const script = document.createElement('script');
        const isInMembers = window.location.pathname.includes('/members/');
        script.src = isInMembers ? '../js/registry-a.js' : 'js/registry-a.js'; 
        
        script.onload = () => resolve(true);
        script.onerror = () => {
            console.error("Core-A: registry-a.js not found at " + script.src);
            resolve(false);
        };
        document.head.appendChild(script);
    });
}

/**
 * MAIN INITIALIZATION
 */
async function initModule(moduleId) {
    const isSampleFile = window.location.pathname.includes('-sample.html');

    // 1. ANALYTICS
    if (window.gtag) {
        window.gtag('event', 'module_view', {
            'module_id': moduleId,
            'view_mode': isSampleFile ? 'sample' : 'member'
        });
    }

    // 2. BYPASS AUTH FOR SAMPLES
    if (isSampleFile) {
        injectModuleUI("Guest Explorer", moduleId, true);
        return; 
    }

    // 3. MEMBER FLOW
    await checkCompletionStatus(moduleId);
    await ensureRegistry();

    if (!window.supabaseClient) {
        let attempts = 0;
        while (!window.supabaseClient && attempts < 20) {
            await new Promise(res => setTimeout(res, 100));
            attempts++;
        }
    }

    const { data: { user }, error: authError } = await window.supabaseClient.auth.getUser();
    if (authError || !user) {
        window.location.href = "/login";
        return;
    }

    const { data: profile } = await window.supabaseClient
        .from('profiles')
        .select('course_type, course_subscription')
        .eq('id', user.id)
        .maybeSingle();

    if (!profile || !profile.course_type) {
        window.location.href = "/profile";
        return;
    }

    const isMasteryPage = window.location.pathname.includes('-mastery');
    if (isMasteryPage && profile.course_subscription !== true) {
        alert("This advanced Mastery sub-module requires an active voluntary subscription layer.");
        window.location.href = "/profile";
        return;
    }

    injectModuleUI(user.email, moduleId, false);
}

async function checkCompletionStatus(baseModuleId) {
    if (!window.supabaseClient) return;
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) return;

    // Find all completion buttons on the page
    const buttons = document.querySelectorAll('.btn-complete');
    
    for (const btn of buttons) {
        // Read the exact module ID this button triggers (e.g. '1-p' or '1')
        const match = btn.getAttribute('onclick')?.match(/markComplete\(['"]?([^'"]+)['"]?\)/);
        
        if (match && match[1]) {
            const exactModuleId = match[1];

            const { data } = await window.supabaseClient
                .from('module_progress')
                .select('id')
                .eq('user_id', user.id)
                .eq('module_id', exactModuleId)
                .maybeSingle();

            // ONLY disable this exact button if its specific module is in the database
            if (data) {
                disableCompleteButton(btn);
            }
        }
    }
}

function disableCompleteButton(specificBtn) {
    if (specificBtn) {
        specificBtn.disabled = true;
        specificBtn.innerText = "Module Completed ✓";
        specificBtn.classList.add('is-finished');
        specificBtn.style.backgroundColor = "#276245"; 
        specificBtn.style.opacity = "1";
        specificBtn.style.cursor = "not-allowed";
    }
}

function injectModuleUI(email, currentId, isSample) {
    let prevMod = null;
    let nextMod = null;

    if (typeof COGNIS_MODULES !== 'undefined') {
        const currentIndex = COGNIS_MODULES.findIndex(m => String(m.id) === String(currentId));
        if (currentIndex !== -1) {
            prevMod = COGNIS_MODULES[currentIndex - 1];
            nextMod = COGNIS_MODULES[currentIndex + 1];
        }
    }

    const navHTML = `
        <nav class="cognis-m-nav">
            <a href="/course/members/dashboard.html">← Dashboard</a>
            <div class="user-identity-tag">${email}</div>
        </nav>
    `;

    document.body.insertAdjacentHTML('afterbegin', navHTML);

    if (!isSample) {
        const footerHTML = `
            <div class="module-footer-nav">
                ${prevMod ? `<a href="${prevMod.path}" class="nav-cta nav-prev"><span class="cta-label">Previous</span><span>${prevMod.title}</span></a>` : '<div></div>'}
                ${nextMod ? `<a href="${nextMod.path}" class="nav-cta nav-next"><span class="cta-label">Next</span><span>${nextMod.title}</span></a>` : '<div></div>'}
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', footerHTML);
    }
}

async function markComplete(moduleId) {
    // Accurately find the specific button that was clicked by matching the onclick attribute
    const buttons = document.querySelectorAll('.btn-complete');
    let clickedBtn = null;
    for (const b of buttons) {
        if (b.getAttribute('onclick').includes(`markComplete('${moduleId}')`) || 
            b.getAttribute('onclick').includes(`markComplete(${moduleId})`)) {
            clickedBtn = b;
            break;
        }
    }

    const originalText = clickedBtn ? clickedBtn.innerText : "Complete Module";

    if (clickedBtn) {
        clickedBtn.disabled = true;
        clickedBtn.innerText = "Saving Progress...";
        clickedBtn.style.opacity = "0.7";
    }

    try {
        const { data: { user }, error: authError } = await window.supabaseClient.auth.getUser();
        if (authError || !user) throw new Error("No user logged in");

        // Force string casting so the DB doesn't crash on "1-p"
        const targetModuleId = String(moduleId);

        const { error } = await window.supabaseClient
            .from('module_progress')
            .upsert({ 
                user_id: user.id, 
                module_id: targetModuleId,
                completed_at: new Date().toISOString()
            }, { onConflict: 'user_id, module_id' });

        if (error) throw error;
        
        // Pass the specific button to successfully update it visually
        disableCompleteButton(clickedBtn);

    } catch (err) {
        console.error("Supabase Save Error:", err);
        // This alert will catch and display any silent database rejections
        alert("Could not save progress: " + (err.message || JSON.stringify(err)));

        // Reset the button if the database rejects the save so the user isn't stuck
        if (clickedBtn) {
            clickedBtn.disabled = false;
            clickedBtn.innerText = originalText;
            clickedBtn.style.opacity = "1";
            clickedBtn.style.cursor = "pointer";
        }
    }
}