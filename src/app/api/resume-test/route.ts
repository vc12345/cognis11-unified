import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OSA_BLUEPRINT = [
  'A1L1', 'A2L1', 'A1L2', 'A2L1',
  'A2L1', 'A3L1', 'A3L1', 'A4L1', 'A4L1', 
  'A2L2', 'A2L3', 'A2L3', 'A2L2',
  'A3L2', 'A3L3', 'A4L2', 'A4L3',
  'A1L1', 'A2L1'
];

interface OutboundVariant {
  id: string;
  skeleton_id: string;
  al_classification: string;
  generated_question: string;
  generated_options: any;
  skeletons: {
    approved: boolean;
    failure_profile: Record<string, any> | null;
  };
}

function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  return function() {
    h = Math.imul(h ^ h >>> 16, 2246822507);
    h = Math.imul(h ^ h >>> 13, 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) return NextResponse.json({ error: 'Missing session ID.' }, { status: 400 });

    const cookieStore = await cookies();
    const authSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return cookieStore.get(name)?.value; }, set() {}, remove() {} } }
    );

    const { data: { user }, error: authError } = await authSupabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized Session' }, { status: 401 });

    const { data: completedAttempts } = await supabaseService
      .from('user_attempts')
      .select('variant_id')
      .eq('session_id', sessionId)
      .eq('user_id', user.id);

    const answeredCount = completedAttempts?.length || 0;
    const rand = seededRandom(sessionId);

    const { data: historicalAttempts } = await supabaseService
      .from('user_attempts')
      .select('skeleton_id')
      .eq('user_id', user.id)
      .not('session_id', 'eq', sessionId);

    const historicalUsedSkeletons = new Set<string>(
      historicalAttempts?.map(a => a.skeleton_id).filter(Boolean) || []
    );

    const { data: rawVariantBank, error: dbError } = await supabaseService
      .from('variants')
      .select(`id, skeleton_id, al_classification, generated_question, generated_options, skeletons!inner (approved, failure_profile)`)
      .eq('qc_passed', true)
      .eq('skeletons.approved', true);

    if (dbError || !rawVariantBank) throw dbError;

    const variantBank = rawVariantBank as unknown as OutboundVariant[];
    const sessionUsedSkeletons = new Set<string>();
    const sessionUsedFailureProfiles = new Set<string>();
    const payload: any[] = [];

    // The identical deterministic loop reconstruction
    for (let i = 0; i < OSA_BLUEPRINT.length; i++) {
      const targetAL = OSA_BLUEPRINT[i];
      const matchingVariants = variantBank.filter(v => v.al_classification === targetAL);
      
      if (matchingVariants.length === 0) continue;

      const pool = [...matchingVariants].sort(() => rand() - 0.5);
      let selectedVariant: OutboundVariant | null = null;

      for (const variant of pool) {
        const profileStr = variant.skeletons.failure_profile ? JSON.stringify(variant.skeletons.failure_profile) : '{}';
        if (!historicalUsedSkeletons.has(variant.skeleton_id) && !sessionUsedSkeletons.has(variant.skeleton_id) && !sessionUsedFailureProfiles.has(profileStr)) {
          selectedVariant = variant;
          break;
        }
      }

      if (!selectedVariant) {
        for (const variant of pool) {
          const profileStr = variant.skeletons.failure_profile ? JSON.stringify(variant.skeletons.failure_profile) : '{}';
          if (!sessionUsedSkeletons.has(variant.skeleton_id) && !sessionUsedFailureProfiles.has(profileStr)) {
            selectedVariant = variant;
            break;
          }
        }
      }

      if (!selectedVariant) {
        for (const variant of pool) {
          if (!sessionUsedSkeletons.has(variant.skeleton_id)) {
            selectedVariant = variant;
            break;
          }
        }
      }

      if (!selectedVariant && pool.length > 0) selectedVariant = pool[0];

      if (selectedVariant) {
        payload.push({
          variant_id: selectedVariant.id,
          al_classification: selectedVariant.al_classification,
          question: selectedVariant.generated_question,
          options: selectedVariant.generated_options
        });
        sessionUsedSkeletons.add(selectedVariant.skeleton_id);
        if (selectedVariant.skeletons.failure_profile) {
          sessionUsedFailureProfiles.add(JSON.stringify(selectedVariant.skeletons.failure_profile));
        }
      }
    }

    return NextResponse.json({
      session_id: sessionId,
      payload: payload,
      resume_index: answeredCount 
    });

  } catch (err) {
    console.error('Resume test exception:', err);
    return NextResponse.json({ error: 'Failed to reconstruct session state.' }, { status: 500 });
  }
}