import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
  const raw = form.get(key) ?? form.get(key + ' ') ?? form.get(' ' + key);
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  return trimmed || null;
}

async function uploadRecording(
  supabaseAdmin: any,
  buffer: Buffer,
  mimeType: string,
  fileName: string,
  phoneNo: string
): Promise<string> {
  const ext = fileName.split('.').pop() || 'mp3';
  const filePath = `${Date.now()}_${phoneNo.replace(/\D/g, '')}.${ext}`;

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
    const contentLength = request.headers.get('content-length') || '0';

    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return NextResponse.json(
        {
          error: 'Content-Type must be multipart/form-data',
          received_content_type: contentType || '(empty)',
        },
        { status: 400 }
      );
    }

    // undici (Next.js) ko parsing ke liye boundary parameter chahiye.
    // Agar dialer client ne sirf "multipart/form-data" bheja boundary ke bina,
    // toh request.formData() generic "Failed to parse body as FormData" throw karta hai.
    if (!/boundary=/i.test(contentType)) {
      return NextResponse.json(
        {
          error:
            'multipart/form-data Content-Type missing boundary parameter. ' +
            'Client ko full header bhejna hai, e.g. ' +
            '"multipart/form-data; boundary=----MyDialerBoundary123".',
          received_content_type: contentType,
          content_length: contentLength,
        },
        { status: 400 }
      );
    }

    if (contentLength === '0') {
      return NextResponse.json(
        {
          error: 'Empty request body. Multipart fields/file missing.',
          received_content_type: contentType,
        },
        { status: 400 }
      );
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch (parseErr: any) {
      console.error('[dialer/leads] formData parse failed', {
        contentType,
        contentLength,
        message: parseErr?.message,
      });
      return NextResponse.json(
        {
          error: 'Failed to parse multipart body',
          details: parseErr?.message || 'unknown parse error',
          received_content_type: contentType,
          content_length: contentLength,
          hint:
            'Verify ki client multipart body theek se generate kar raha hai: ' +
            'sahi boundary, sahi CRLF (\\r\\n) line endings, ' +
            'aur Content-Length actual body ke barabar ho.',
        },
        { status: 400 }
      );
    }

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
    let recordingBlob: Blob | null = null;

    for (const [key, value] of form.entries()) {
      if (key.trim() === 'recording' && typeof value !== 'string') {
        recordingBlob = value as Blob;
        break;
      }
    }

    if (recordingBlob && recordingBlob.size > 0) {
      const bytes = await recordingBlob.arrayBuffer();
      const mimeType = recordingBlob.type || 'audio/mpeg';
      const name = (recordingBlob as any).name || 'recording.mp3';
      recordingUrl = await uploadRecording(
        supabaseAdmin,
        Buffer.from(bytes),
        mimeType,
        name,
        phoneNo
      );
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
      { success: true, id: row?.id, recording_url: recordingUrl },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: e?.message },
      { status: 500 }
    );
  }
}
