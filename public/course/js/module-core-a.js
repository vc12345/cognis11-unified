// js/module-core-a.js

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
        window.location.href = "/login.html";
        return;
    }

    const { data: profile } = await window.supabaseClient
        .from('profiles')
        .select('subscription_status, subscription_plan')
        .eq('id', user.id)
        .maybeSingle();

    if (!profile || profile.subscription_status !== 'active') {
        alert("This module requires an active subscription.");
        window.location.href = "/members/dashboard-a.html";
        return;
    }

    injectModuleUI(user.email, moduleId, false);
}

async function checkCompletionStatus(moduleId) {
    if (!window.supabaseClient) return;
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) return;

    const { data } = await window.supabaseClient
        .from('module_progress')
        .select('id')
        .eq('user_id', user.id)
        .eq('module_id', moduleId)
        .maybeSingle();

    if (data) {
        disableCompleteButton();
    }
}

function disableCompleteButton() {
    const btn = document.querySelector('.btn-complete');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "Module Completed ✓";
        btn.classList.add('is-finished');
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
            <a href="/members/dashboard-a.html">← Dashboard</a>
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
    const btn = document.querySelector('.btn-complete');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "Saving Progress...";
    }

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) throw new Error("No user logged in");

        const { error } = await window.supabaseClient
            .from('module_progress')
            .upsert({ 
                user_id: user.id, 
                module_id: moduleId,
                completed_at: new Date().toISOString()
            }, { onConflict: 'user_id, module_id' });

        if (error) throw error;
        disableCompleteButton();
    } catch (err) {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Complete Module & Update Lattice";
        }
    }
}