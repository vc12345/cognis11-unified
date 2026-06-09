import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || '00000000-0000-0000-0000-000000000000';
    const horizon = searchParams.get('horizon') || '30';

    let query = supabase.from('user_attempts').select('*').eq('user_id', userId);
    if (horizon !== 'all') {
      const daysAgo = parseInt(horizon, 10);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
      query = query.gte('created_at', cutoffDate.toISOString());
    }

    const { data: attempts, error } = await query.order('created_at', { ascending: true });
    if (error) throw error;
    if (!attempts || attempts.length === 0) return NextResponse.json({ hasData: false });

    const n = attempts.length;
    let correctCount = 0;
    
    // 1. A#L# Matrix Initialization (Application 1-5, Linguistic 1-5)
    const alMatrix: Record<string, { a: number, l: number, attempts: number, correct: number }> = {};
    for (let a = 1; a <= 5; a++) {
      for (let l = 1; l <= 5; l++) {
        alMatrix[`A${a}L${l}`] = { a, l, attempts: 0, correct: 0 };
      }
    }

    // 2. Histogram Bins
    const timeBins = { '0-15s': 0, '16-30s': 0, '31-45s': 0, '46-60s': 0, '60s+': 0 };
    
    // 3. W-Category Diagnostics
    const wTally = { W1: 0, W2: 0, W3: 0, W4: 0, W5: 0, W6: 0, W7: 0, W8: 0 };
    
    const scatterData: any[] = [];
    const trendData: any[] = [];
    const failureSpotlights: any[] = [];

    attempts.forEach((attempt: any, index: number) => {
      const isCorrect = attempt.is_correct;
      const solveTime = attempt.solve_time || 0;
      const compTime = attempt.comprehension_time || 0;
      const analysis = attempt.analysis || {};
      const wMap = analysis.w_category_breakdown || {};
      
      const appLvl = analysis.complexity_assessment?.application_level || 3;
      const lingLvl = analysis.complexity_assessment?.linguistic_level || 3;
      const alKey = `A${Math.min(Math.max(appLvl, 1), 5)}L${Math.min(Math.max(lingLvl, 1), 5)}`;

      if (isCorrect) {
        correctCount++;
        alMatrix[alKey].correct++;
      }
      alMatrix[alKey].attempts++;

      // Populate Time Histogram
      if (solveTime <= 15) timeBins['0-15s']++;
      else if (solveTime <= 30) timeBins['16-30s']++;
      else if (solveTime <= 45) timeBins['31-45s']++;
      else if (solveTime <= 60) timeBins['46-60s']++;
      else timeBins['60s+']++;

      // Tally W-Categories
      Object.keys(wTally).forEach(k => { if (wMap[k] === 1) wTally[k as keyof typeof wTally]++; });

      // Scatter Plot Data
      scatterData.push({
        attempt: index + 1,
        time: solveTime,
        correct: isCorrect,
        complexity: (appLvl + lingLvl) / 2,
        label: alKey
      });

      // Rolling Trend (n=5 moving average)
      if (index >= 4) {
        const window = attempts.slice(index - 4, index + 1);
        const windowCorrect = window.filter((w: any) => w.is_correct).length;
        trendData.push({
          x: index + 1,
          y: Math.round((windowCorrect / 5) * 100)
        });
      }

      // Isolate Anomaly Spotlights
      if (!isCorrect && failureSpotlights.length < 4) {
        failureSpotlights.push({
          date: new Date(attempt.created_at).toLocaleDateString('en-GB'),
          alCode: alKey,
          compTime,
          solveTime,
          breakdown: analysis.analysis?.thought_process_breakdown || "Diagnostic trace unavailable.",
          triggers: Object.keys(wMap).filter(k => wMap[k] === 1)
        });
      }
    });

    const accuracy = Math.round((correctCount / n) * 100);

    return NextResponse.json({
      hasData: true,
      kpi: { n, accuracy },
      alMatrix: Object.values(alMatrix),
      timeHistogram: Object.entries(timeBins).map(([label, count]) => ({ label, count })),
      wTally: Object.entries(wTally).map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count),
      scatterData,
      trendData,
      failureSpotlights
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}