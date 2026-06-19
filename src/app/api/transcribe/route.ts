import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GROQ_API_KEY) {
      console.error('CRITICAL: GROQ_API_KEY is missing from environment variables.');
      return NextResponse.json({ error: 'Server audio configuration missing.' }, { status: 500 });
    }

    const formData = await req.formData();
    const audioFile = formData.get('file') as Blob;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // 1. Prepare the data for Groq
    const groqFormData = new FormData();
    // CRITICAL FIX: Browsers record in webm or ogg. Mislabeling this as .m4a causes Whisper API to reject it in production.
    groqFormData.append('file', audioFile, 'audio.webm'); 
    groqFormData.append('model', 'whisper-large-v3-turbo');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: groqFormData,
    });

    if (!response.ok) {
      const errData = await response.text();
      console.error('Groq API Error:', errData);
      throw new Error('Groq transcription rejected the payload.');
    }

    const data = await response.json();
    return NextResponse.json({ text: data.text });

  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json({ error: 'Failed to transcribe audio' }, { status: 500 });
  }
}