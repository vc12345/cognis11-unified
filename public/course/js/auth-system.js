// js/auth-system.js

/**
 * 1. LOGIN LOGIC
 */
async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('error-msg');

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        errorDiv.innerText = error.message;
        errorDiv.style.display = 'block';
    } else {
        window.location.href = "/members/dashboard.html";
    }
}

/**
 * 2. STANDARD SIGNUP (Manual/Free)
 */
async function handleSignUp() {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const errorDiv = document.getElementById('error-msg');

    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
    });

    if (error) {
        errorDiv.innerText = error.message;
        errorDiv.style.display = 'block';
    } else {
        alert("Success! Please check your email for a verification link.");
        window.location.href = "/login.html";
    }
}

/**
 * 3. SUBSCRIPTION SIGNUP (Foundational vs Supplemental)
 */
async function handleSubscriptionSignup() {
    const email = document.getElementById('sub-email').value;
    const password = document.getElementById('sub-password').value;
    const plan = document.getElementById('selected-plan').value; // Captured from subscribe.html modal
    const btn = document.getElementById('modal-btn');
    const errorDiv = document.getElementById('error-msg');

    btn.innerText = "Creating Account...";
    btn.disabled = true;

    // Use metadata to tell your Stripe Webhook which plan the user intends to buy
    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
            data: { intended_plan: plan }
        }
    });

    if (error) {
        errorDiv.innerText = error.message;
        errorDiv.style.display = 'block';
        btn.innerText = "Proceed to Payment";
        btn.disabled = false;
    } else {
        // Stripe Links for each path
        const STRIPE_LINKS = {
            'foundational': 'https://buy.stripe.com/test_5kQ14p80D2OmcbG0W6gUM01', 
            'supplemental': 'https://buy.stripe.com/test_6oU8wRdkX3SqdfKcEOgUM02'
        };

        const stripeLink = STRIPE_LINKS[plan];
        const userId = data.user.id;
        
        // Pass user ID to Stripe Webhook
        window.location.href = `${stripeLink}?client_reference_id=${userId}&prefilled_email=${encodeURIComponent(email)}`;
    }
}