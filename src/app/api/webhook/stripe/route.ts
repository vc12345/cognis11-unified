import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// 1. Initialize Server-Side Clients
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-05-27.dahlia',
});

// We use the Service Role Key to bypass RLS since this is an automated server action
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

export async function POST(req: Request) {
  const body = await req.text(); // Stripe requires the raw body to verify the signature
  const sig = req.headers.get('stripe-signature') as string;

  let event: Stripe.Event;

  // 2. Verify the cryptographic signature (Ensures the request actually came from Stripe)
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  // 3. Process Successful Payments
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // Extract the custom data we attached when we created the checkout session
    const { userId, intent, plan } = session.metadata || {};

    if (!userId) {
      return NextResponse.json({ error: 'No userId attached to session metadata' }, { status: 400 });
    }

    const now = new Date().toISOString();

    try {
      // ==========================================
      // PATH A: THE PRE-PREP COURSE (Subscription)
      // ==========================================
      if (intent === 'course') {
        await supabaseAdmin.from('profiles').update({
          course_type: plan,
          course_subscription: true,
          course_subscription_start_date: now,
          course_subscription_cancel_date: null,
        }).eq('id', userId);
      } 
      
      // ==========================================
      // PATH B: THE DIAGNOSTIC (One-off / 6-Month)
      // ==========================================
      else if (intent === 'diagnostic') {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('test_credits, diagnostic_type, diagnostic_subscription_end_date')
          .eq('id', userId)
          .single();
          
        const currentCredits = profile?.test_credits || 0;
        const currentType = profile?.diagnostic_type;
        const currentEndDate = profile?.diagnostic_subscription_end_date;

        if (plan === 'one-off') {
          await supabaseAdmin.from('profiles').update({
            test_credits: currentCredits + 1,
            diagnostic_type: 'one-off',
          }).eq('id', userId);
        } 
        else if (plan === '6-month') {
          let newEndDate = new Date();
          let renewalDate = null;
          let updatePayload: any = {
            test_credits: currentCredits + 5,
            diagnostic_type: '6-month'
          };

          if (currentType === '6-month') {
            // SCENARIO: RENEWAL
            renewalDate = now;
            updatePayload.diagnostic_subscription_renewal_date = renewalDate;
            
            // If they still have active time, tack 6 months onto their existing end date
            if (currentEndDate && new Date(currentEndDate) > new Date()) {
              newEndDate = new Date(currentEndDate);
            }
            newEndDate.setMonth(newEndDate.getMonth() + 6);
            updatePayload.diagnostic_subscription_end_date = newEndDate.toISOString();
            
          } else {
            // SCENARIO: FIRST TIME PURCHASE
            newEndDate.setMonth(newEndDate.getMonth() + 6);
            
            updatePayload.diagnostic_subscription_start_date = now;
            updatePayload.diagnostic_subscription_end_date = newEndDate.toISOString();
            updatePayload.diagnostic_subscription_renewal_date = null;
          }

          await supabaseAdmin.from('profiles').update(updatePayload).eq('id', userId);
        }
      }
    } catch (dbError) {
      console.error('Database Update Failed:', dbError);
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }
  }

  // 4. Return a 200 OK so Stripe knows we received it successfully
  return NextResponse.json({ received: true });
}