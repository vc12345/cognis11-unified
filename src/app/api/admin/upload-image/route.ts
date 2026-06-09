import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use Service Role for admin bypass
)

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const shellId = formData.get('shellId') as string;

    if (!file || !shellId) throw new Error("Missing file or Shell ID");

    // 1. Upload to Storage
    const fileName = `shell_${shellId}_${Date.now()}.png`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('question-images')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    // 2. Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('question-images')
      .getPublicUrl(fileName);

    // 3. Link to Shell
    const { error: updateError } = await supabase
      .from('conceptual_shells')
      .update({ image_url: publicUrl })
      .eq('id', shellId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}