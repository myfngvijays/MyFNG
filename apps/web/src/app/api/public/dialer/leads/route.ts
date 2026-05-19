import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const RECORDING_BUCKET = 'dialer-recordings';

// Supabase bucket sirf canonical MIME types accept karta hai.
// Dialer clients (Postman, .NET, etc.) `.wav` ke liye non-standard
// values bhej dete hain (audio/wave, audio/x-wav, audio/vnd.wave, etc.).
// Yahaan client-supplied MIME ko canonical form me normalize karte hain,
// aur agar fir bhi unknown ho toh file extension se infer karte hain.
const MIME_ALIASES: Record<string, string> = {
  'audio/wave': 'audio/wav',
  'audio/x-wav': 'audio/wav',
  'audio/vnd.wave': 'audio/wav',
  'audio/wav': 'audio/wav',
  'audio/mp3': 'audio/mpeg',
  'audio/mpeg3': 'audio/mpeg',
  'audio/x-mpeg-3': 'audio/mpeg',
  'audio/mpeg': 'audio/mpeg',
  'audio/m4a': 'audio/x-m4a',
  'audio/x-m4a': 'audio/x-m4a',
  'audio/aac': 'audio/aac',
  'audio/ogg': 'audio/ogg',
  'audio/webm': 'audio/webm',
  'audio/amr': 'audio/amr',
  'audio/mp4': 'audio/mp4',
};

const EXT_TO_MIME: Record<string, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  m4a: 'audio/x-m4a',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  webm: 'audio/webm',
  amr: 'audio/amr',
  mp4: 'audio/mp4',
  '3gp': 'video/3gpp',
  '3gpp': 'video/3gpp',
};

function normalizeRecordingMime(clientMime: string, fileName: string): string {
  const lower = (clientMime || '').toLowerCase().trim();
  if (lower && MIME_ALIASES[lower]) return MIME_ALIASES[lower];

  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (ext && EXT_TO_MIME[ext]) return EXT_TO_MIME[ext];

  // Last resort: agar client ne kuch valid-looking bheja hai, use it,
  // warna safe default mpeg.
  return lower || 'audio/mpeg';
}

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
  'intrested_customer_date',
] as const;

function fieldValue(form: FormData, key: string): string | null {
  const raw = form.get(key) ?? form.get(key + ' ') ?? form.get(' ' + key);
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  return trimmed || null;
}

/**
 * Parse multipart/form-data body with a fallback for clients that wrap the
 * boundary parameter in double quotes (RFC 2046 allows it, but undici's
 * built-in FormData parser rejects it). Notable offender: C# / .NET
 * `MultipartFormDataContent` which auto-generates `boundary="<guid>"`.
 *
 * Strategy: if the boundary is quoted, rebuild the request with an unquoted
 * boundary and parse again. Otherwise use the request's native formData().
 */
async function parseMultipartBody(
  request: NextRequest,
  contentType: string
): Promise<FormData> {
  const quotedMatch = contentType.match(/boundary\s*=\s*"([^"]+)"/i);
  if (!quotedMatch) {
    return request.formData();
  }

  const boundary = quotedMatch[1];
  const sanitizedContentType = contentType.replace(
    /boundary\s*=\s*"[^"]+"/i,
    `boundary=${boundary}`
  );

  const body = await request.arrayBuffer();
  const rebuilt = new Request('http://internal.local/_dialer-leads', {
    method: 'POST',
    headers: { 'content-type': sanitizedContentType },
    body,
  });
  return rebuilt.formData();
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
      form = await parseMultipartBody(request, contentType);
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

    let recordingBlob: Blob | null = null;
    let recordingBuffer: Buffer | null = null;
    let recordingMime = '';
    let recordingName = '';

    for (const [key, value] of form.entries()) {
      if (key.trim() === 'recording' && typeof value !== 'string') {
        recordingBlob = value as Blob;
        break;
      }
    }

    if (recordingBlob && recordingBlob.size > 0) {
      const bytes = await recordingBlob.arrayBuffer();
      recordingBuffer = Buffer.from(bytes);
      recordingMime = normalizeRecordingMime(recordingBlob.type || '', (recordingBlob as any).name || 'recording.mp3');
      recordingName = (recordingBlob as any).name || 'recording.mp3';
    }

    // Upload recording BEFORE insert so recording_url is part of the initial
    // INSERT — this ensures only a single trigger fire and a single TeleCRM call.
    let recordingUrl: string | null = null;
    if (recordingBuffer) {
      try {
        recordingUrl = await uploadRecording(
          supabaseAdmin,
          recordingBuffer,
          recordingMime,
          recordingName,
          phoneNo
        );
      } catch (err: any) {
        console.error(`[dialer/leads] Recording upload failed, inserting lead without it:`, err?.message);
      }
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

    const leadId = row?.id;

    return NextResponse.json(
      { success: true, id: leadId, recording_status: recordingUrl ? 'uploaded' : 'none' },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: e?.message },
      { status: 500 }
    );
  }
}
