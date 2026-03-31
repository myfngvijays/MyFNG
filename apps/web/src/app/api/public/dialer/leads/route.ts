import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RECORDING_BUCKET = 'dialer-recordings';

const TEXT_FIELDS = [
  'phone_no',
  'name',
  'address',
  'regdate',
  'car_number',
  'make',
  'model',
  'disposition',
  'remark',
  'dialer_id',
] as const;

function fieldValue(form: FormData, key: string): string | null {
  const raw = form.get(key);
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  return trimmed || null;
}

async function uploadRecording(
  supabaseAdmin: any,
  file: File,
  phoneNo: string
): Promise<string> {
  const mimeType = file.type || 'audio/mpeg';
  const ext = (file.name || '').split('.').pop() || 'mp3';
  const filePath = `${Date.now()}_${phoneNo.replace(/\D/g, '')}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from(RECORDING_BUCKET)
    .upload(filePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Recording upload failed: ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabaseAdmin.storage
    .from(RECORDING_BUCKET)
    .getPublicUrl(filePath);

  const publicUrl = publicUrlData?.publicUrl;
  if (!publicUrl) {
    throw new Error('Could not generate public URL for uploaded recording');
  }

  return publicUrl;
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Content-Type must be multipart/form-data' },
        { status: 400 }
      );
    }

    const form = await request.formData();

    const phoneNo = fieldValue(form, 'phone_no');
    if (!phoneNo) {
      return NextResponse.json(
        { error: 'phone_no is required' },
        { status: 400 }
      );
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: adminError || 'Admin client not configured' },
        { status: 500 }
      );
    }

    let recordingUrl: string | null = null;
    const recordingFile = form.get('recording');
    if (recordingFile instanceof File && recordingFile.size > 0) {
      recordingUrl = await uploadRecording(supabaseAdmin, recordingFile, phoneNo);
    }

    const insertPayload: Record<string, any> = { recording_url: recordingUrl };
    for (const key of TEXT_FIELDS) {
      insertPayload[key] = fieldValue(form, key);
    }

    const { data: row, error: insertError } = await supabaseAdmin
      .from('dialer_leads')
      .insert([insertPayload])
      .select('id')
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, id: row?.id },
      { status: 200 }
    );
  } catch (e: any) {
    console.error('[dialer-leads] Error:', e?.message || e);
    return NextResponse.json(
      { error: 'Internal server error', details: e?.message },
      { status: 500 }
    );
  }
}
