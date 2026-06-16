import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-05-27.dahlia',
});

export async function POST(req: Request) {
  try {
    // 1. Parse data safely from the incoming JSON body
    const body = await req.json();
    const { intent, plan, amount, userId, email } = body;

    if (!intent || !plan || !amount || !userId) {
      return NextResponse.json({ error: 'Missing parameter blocks' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // 2. Build the appropriate Stripe configurations
    const isSubscription = intent === 'course' && plan === 'voluntary';
    
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      customer_email: email || undefined, // Optionally prefill email if you have it
      metadata: { userId, intent, plan },
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: intent === 'course' 
                ? 'Cognis11+ Master Curriculum Support' 
                : `Cognis11+ Diagnostic - ${plan === 'one-off' ? '1 Token' : '5 Tokens'}`,
              description: intent === 'course'
                ? 'Voluntary monthly server contribution'
                : 'Adaptive audio analysis tokens with 6-month longitudinal metrics storage',
            },
            unit_amount: Math.round(Number(amount) * 100), // Stripe expects pence
            recurring: isSubscription ? { interval: 'month' } : undefined,
          },
          quantity: 1,
        },
      ],
      mode: isSubscription ? 'subscription' : 'payment',
      success_url: intent === 'course' 
        ? `${baseUrl}/course/members/dashboard.html` 
        : `${baseUrl}/profile`,
      cancel_url: `${baseUrl}/profile`,
    };

    const session = await stripe.checkout.sessions.create(sessionConfig);
    return NextResponse.json({ url: session.url });

  } catch (err: any) {
    console.error('Stripe Session Generation Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}