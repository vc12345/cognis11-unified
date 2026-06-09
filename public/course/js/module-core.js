// js/module-core.js

/**
 * GOOGLE ANALYTICS 4 INTEGRATION
 * Automatically initializes tracking for every module
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
    window.gtag = gtag; // Make gtag globally accessible
})();

const SAMPLE_IDS = ["11_sample", "47_sample", "53_sample"]; // Modules enabled for the /sample.html trial

/**
 * SMART LOADER: Automatically fetches the registry if missing.
 */
async function ensureRegistry() {
    if (typeof COGNIS_MODULES !== 'undefined') return true;

    return new Promise((resolve) => {
        const script = document.createElement('script');
        const isInMembers = window.location.pathname.includes('/members/');
        script.src = isInMembers ? '../js/registry.js' : 'js/registry.js'; 
        
        script.onload = () => resolve(true);
        script.onerror = () => {
            console.error("Core: Registry.js not found at " + script.src);
            resolve(false);
        };
        document.head.appendChild(script);
    });
}

/**
 * MAIN INITIALIZATION
 */
async function initModule(moduleId) {
    const isSample = SAMPLE_IDS.includes(String(moduleId));
    
    // Track Module View in Analytics
    if (window.gtag) {
        window.gtag('event', 'module_view', {
            'module_id': moduleId,
            'view_mode': isSample ? 'sample' : 'member',
            'page_path': window.location.pathname
        });
    }

    // 1. Ensure Registry is available
    await ensureRegistry();

    // 2. IF SAMPLE: Bypass all security and inject Guest UI
    if (isSample) {
        injectModuleUI("Guest Explorer", moduleId, true);
        return; 
    }

    // 3. GATEKEEPER: Ensure Supabase is loaded
    if (!window.supabaseClient) {
        let attempts = 0;
        while (!window.supabaseClient && attempts < 20) {
            await new Promise(res => setTimeout(res, 100));
            attempts++;
        }
    }

    // 4. AUTH CHECK
    const { data: { user }, error: authError } = await window.supabaseClient.auth.getUser();
    if (authError || !user) {
        window.location.href = "/login.html";
        return;
    }

    // 5. SUBSCRIPTION CHECK
    const { data: profile } = await window.supabaseClient
        .from('profiles')
        .select('subscription_status, subscription_plan')
        .eq('id', user.id)
        .maybeSingle();

    if (!profile || profile.subscription_status !== 'active') {
        alert("This module requires an active subscription.");
        window.location.href = "/members/dashboard.html";
        return;
    }

    // 6. SEQUENTIAL LOCKDOWN (For Foundational Plan)
    const currentModuleId = Number(moduleId);
    const userPlan = profile.subscription_plan || 'none';

    if (userPlan === 'foundational' && currentModuleId > 1) {
        const { data: completedData } = await window.supabaseClient
            .from('module_progress')
            .select('module_id')
            .eq('user_id', user.id);

        const completedIds = completedData ? completedData.map(item => Number(item.module_id)) : [];
        const maxCompleted = completedIds.length > 0 ? Math.max(...completedIds) : 0;
        const nextAllowed = maxCompleted + 1;

        if (currentModuleId > nextAllowed) {
            alert("This module is currently locked. Please complete the previous modules in order.");
            window.location.href = "/members/dashboard.html";
            return;
        }
    }

    // 7. INJECT FULL UI
    injectModuleUI(user.email, currentModuleId, false);
}

/**
 * UI INJECTION: Handles CSS Overrides, Nav, and Footer
 */
function injectModuleUI(email, currentId, isSample) {
    let prevMod = null;
    let nextMod = null;

    if (typeof COGNIS_MODULES !== 'undefined') {
        const currentIndex = COGNIS_MODULES.findIndex(m => Number(m.id) === Number(currentId));
        if (currentIndex !== -1) {
            prevMod = COGNIS_MODULES[currentIndex - 1];
            nextMod = COGNIS_MODULES[currentIndex + 1];
        }
    }

    const uiHTML = `
        <style>
            /* 1. MASTER BRANDING OVERRIDES */
            body { 
                background-color: #FAFAF6 !important; 
                color: #1B3A5C !important;
                font-family: 'DM Sans', sans-serif !important;
                margin: 0;
                padding-bottom: 80px; 
            }
            .module-card { 
                max-width: 920px !important; 
                border: 1px solid #E5E3DD !important; 
                box-shadow: 0 10px 40px rgba(0,0,0,0.03) !important;
                background: white !important;
                margin: 20px auto !important;
            }

            /* 2. TOP NAVIGATION BAR */
            .cognis-m-nav {
                background: #ffffff !important;
                border-bottom: 1px solid #E5E3DD;
                padding: 12px 30px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                position: sticky;
                top: 0;
                z-index: 1000;
            }
            .cognis-m-nav a {
                color: #1B3A5C !important;
                text-decoration: none;
                font-size: 0.85rem;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .cognis-m-nav .user-tag { font-size: 0.75rem; color: ${isSample ? 'var(--gold)' : '#888'}; font-weight: 700; }

            /* 3. THE ENGINE (Dark Logic Center) */
            .simulation-area, .engine-container { 
                background: #1B3A5C !important; 
                color: white !important;
                border-radius: 12px !important;
                padding: 30px !important;
            }
            .trace-log, [id*="trace"], [id*="logic"] { 
                background: rgba(0,0,0,0.25) !important; 
                border-left: 4px solid #c5a059 !important;
                color: #48bb78 !important;
                font-family: 'Consolas', monospace !important;
                font-size: 0.85rem !important;
                line-height: 1.6 !important;
                padding: 15px !important;
            }

            /* 4. THE SABOTEUR (Phase 4 Face-Off) */
            .saboteur-grid { 
                display: grid !important; 
                grid-template-columns: 1fr 1fr !important; 
                gap: 20px !important; 
                margin-top: 20px !important; 
            }
            .saboteur-panel.trap, .trap-box { 
                background: #FFF5F5 !important; 
                border: 2px solid #d9534f !important; 
                border-radius: 12px !important;
                padding: 25px !important;
            }
            .saboteur-panel.fix { 
                background: #F0FFF4 !important; 
                border: 2px solid #48bb78 !important; 
                border-radius: 12px !important;
                padding: 25px !important;
            }
            .saboteur-panel h3 {
                margin: 0 0 10px 0 !important;
                font-size: 0.75rem !important;
                text-transform: uppercase !important;
                letter-spacing: 0.1em !important;
                font-weight: 800 !important;
            }

            /* 5. FOOTER NAVIGATION */
            .module-footer-nav {
                max-width: 920px;
                margin: 40px auto 80px;
                display: ${(!prevMod && !nextMod || isSample) ? 'none !important' : 'flex'};
                justify-content: space-between;
                gap: 20px;
                padding: 0 20px;
            }
            .nav-cta {
                flex: 1;
                text-decoration: none;
                padding: 20px 25px;
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            }
            .nav-cta .cta-label { font-size: 0.65rem; text-transform: uppercase; font-weight: 800; margin-bottom: 6px; opacity: 0.7; }
            .nav-cta .cta-title { font-size: 0.95rem; font-weight: 700; }
            .nav-prev { background: white; color: #1B3A5C; border: 2px solid #E5E3DD; text-align: left; }
            .nav-prev:hover { border-color: #1B3A5C; transform: translateX(-5px); }
            .nav-next { background: #1B3A5C; color: white; border: 2px solid #1B3A5C; text-align: right; }
            .nav-next:hover { background: #c5a059; border-color: #c5a059; transform: translateX(5px); }

            /* 6. COMPLETE BUTTON */
            button[onclick*="markComplete"] {
                display: ${isSample ? 'none !important' : 'block'};
                background: #1B3A5C !important;
                border-radius: 6px !important;
                color: white !important;
                padding: 18px 40px !important;
                font-weight: 700 !important;
                cursor: pointer;
                margin: 40px auto;
                border: none;
            }

            @media (max-width: 600px) {
                .saboteur-grid { grid-template-columns: 1fr !important; }
                .module-footer-nav { flex-direction: column; }
            }
        </style>

        <nav class="cognis-m-nav">
            ${isSample ? 
                `<a href="../subscribe.html" style="color:var(--gold) !important; font-weight:800;">Unlock All 59 Modules →</a>` : 
                `<a href="/members/dashboard.html"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Dashboard</a>`
            }
            <div class="user-tag">${email}</div> 
        </nav>
    `;

    document.body.insertAdjacentHTML('afterbegin', uiHTML);

    if (!isSample && (prevMod || nextMod)) {
        const footerHTML = `
            <div class="module-footer-nav">
                ${prevMod ? `<a href="${prevMod.path}" class="nav-cta nav-prev"><span class="cta-label">← Previous</span><span class="cta-title">${prevMod.title}</span></a>` : '<div style="flex:1"></div>'}
                ${nextMod ? `<a href="${nextMod.path}" class="nav-cta nav-next"><span class="cta-label">Next →</span><span class="cta-title">${nextMod.title}</span></a>` : '<div style="flex:1"></div>'}
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', footerHTML);
    }
}

/**
 * COMPLETION LOGIC
 */
async function markComplete(moduleId) {
    const isSample = SAMPLE_IDS.includes(String(moduleId));
    if (isSample) return;

    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) return;

    // Track Module Completion Event
    if (window.gtag) {
        window.gtag('event', 'module_complete', {
            'module_id': moduleId
        });
    }

    const { error } = await window.supabaseClient
        .from('module_progress')
        .upsert([{ user_id: user.id, module_id: moduleId }], { onConflict: 'user_id, module_id' });

    if (error) {
        alert("Error saving progress.");
    } else {
        alert("Progress Saved! ✅");
        window.location.href = "/members/dashboard.html";
    }
}