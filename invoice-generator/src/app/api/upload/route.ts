import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '../../../lib/supabaseServer';

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file field is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();

    // Generate a safe object name
    const timestamp = Date.now();
    const sanitized = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const objectPath = `${timestamp}-${sanitized}`;

    const { data, error } = await supabase.storage
      .from('gate_pass')
      .upload(objectPath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: publicData } = supabase.storage
      .from('gate_pass')
      .getPublicUrl(data?.path ?? objectPath);

    // Do not insert here; return URL for the extract step to store in the single insert
    return NextResponse.json({ path: data?.path ?? objectPath, fileUrl: publicData.publicUrl });
  } catch (err) {
    console.error('Upload route error', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
