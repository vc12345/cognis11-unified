import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { inferences } = await req.json();

    if (!inferences || inferences.length === 0) {
      return NextResponse.json({ summary: "Insufficient data to generate a comprehensive profile yet. Continue the diagnostic to reveal deeper cognitive patterns." });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are a Lead Educational Consultant for 11+ entrance exams. Your job is to look at a student's recent work and explain their "thinking style" to their parents.

            THE PLAIN ENGLISH MANIFESTO:
            - DO NOT use words like: Heuristics, Parsing, Metacognition, Linguistic Density, or Modelling.
            - DO NOT be flowery or pompous (No "Indeed," "Splendid," or "Alas").
            - DO use clear, everyday language that a busy parent can understand in 30 seconds.
            
            YOUR ANALYSIS FOCUS:
            1. THE INTAKE: How do they handle wordy stories? Do they get lost in the words, or can they see the math hidden inside?
            2. THE THINKING: Do they rush to a solution? Do they pick the smart way to solve it, or the "long way" that leads to mistakes?
            3. THE DOING: Are they making "silly slips" in calculation even when they know the logic?
            4. THE CHECKING: Do they stop to ask "Does this answer actually make sense?" before moving on?

            STRUCTURE:
            - Paragraph 1: How they read and understand the "story" of the questions.
            - Paragraph 2: How they choose their math strategy and handle the actual calculations.
            - Paragraph 3: Their habit of checking their work and a 3-month plan to improve their "thinking system."

            TONE: 
            Professional, direct, and observational. Speak like a helpful expert sitting across the kitchen table from a parent.`
        },
          {
            role: "user",
            content: `Here are the observations from the student's recent session: ${inferences.join(' | ')}`
          }
        ]
      }),
    });

    const data = await response.json();
    return NextResponse.json({ summary: data.choices[0].message.content });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}