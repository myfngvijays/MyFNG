import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe';

async function assertSuperAdmin(supabase: any) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized', user: null };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (roleError || !userData) {
    return { ok: false, status: 403, error: 'Forbidden - Role check failed', user };
  }

  const roleCode = String((userData as any).roles?.role_code || '');
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden - Not super admin', user };
  }

  return { ok: true, status: 200, error: null, user };
}

async function generateTranscriptionAndSummary(recordingUrl: string) {
  if (!OPENAI_API_KEY) return { transcription: null, summary: null };

  const audioRes = await fetch(recordingUrl);
  if (!audioRes.ok) throw new Error(`Recording fetch failed: ${audioRes.status}`);
  const audioBuffer = await audioRes.arrayBuffer();
  const contentType = audioRes.headers.get('content-type') || 'audio/mpeg';
  const audioBlob = new Blob([audioBuffer], { type: contentType });

  const extFromType = (() => {
    const t = String(contentType).toLowerCase();
    if (t.includes('wav')) return 'wav';
    if (t.includes('mp4') || t.includes('m4a') || t.includes('aac')) return 'm4a';
    if (t.includes('ogg') || t.includes('opus')) return 'ogg';
    if (t.includes('webm')) return 'webm';
    return 'mp3';
  })();

  const prompt = [
    'This is a MyFNG Roadside Assistance (RSA) phone call in Hinglish/Hindi and English.',
    'Two speakers: Customer and MyFNG employee/agent.',
    'Common words: RSA, roadside assistance, towing, battery, puncture, tyre, jump start, fuel delivery, mechanic, location, landmark, pincode, vehicle number, model, ETA, charges, payment.',
    'Transcribe accurately with punctuation. Keep proper nouns and numbers (vehicle no, phone, pincode) if spoken.',
  ].join(' ');

  const candidateModels = Array.from(
    new Set([OPENAI_TRANSCRIBE_MODEL, 'gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'whisper-1'].filter(Boolean))
  );

  let transcription: string | null = null;
  let lastErr: string | null = null;
  for (const model of candidateModels) {
    try {
      const formData = new FormData();
      formData.append('model', model);
      // Leave language detection automatic (calls may be Hinglish/Hindi/English).
      formData.append('temperature', '0');
      formData.append('prompt', prompt);
      formData.append('file', audioBlob, `call.${extFromType}`);

      const transcribeRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: formData,
      });
      if (!transcribeRes.ok) {
        const errText = await transcribeRes.text().catch(() => '');
        lastErr = `Transcription failed (${model}): ${transcribeRes.status} ${errText}`;
        continue;
      }
      const transcribeJson = await transcribeRes.json();
      const text = String(transcribeJson?.text || '').trim();
      if (text) {
        transcription = text;
        break;
      }
      lastErr = `Transcription returned empty text (${model})`;
    } catch (e: any) {
      lastErr = `Transcription error (${model}): ${e?.message || 'unknown error'}`;
    }
  }

  if (!transcription) {
    throw new Error(lastErr || 'Transcription failed');
  }
  if (!transcription) return { transcription: null, summary: null };
  if (transcription.replace(/\s+/g, ' ').length < 40) return { transcription, summary: null };

  const summaryRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: [
            'You are a Roadside Assistance Call Analysis Assistant.',
            '',
            'Context:',
            'This is a recorded phone call between a customer and a Roadside Assistance support employee.',
            'The call may include details about vehicle issues, location, urgency, pricing discussion, confirmation, or follow-up steps.',
            '',
            'Your tasks are strictly in this order:',
            '',
            'Transcription',
            '',
            'Accurately transcribe the full call.',
            '',
            'Clearly separate speakers as:',
            '',
            'Customer',
            '',
            'Employee',
            '',
            'Do not add or assume anything that is not spoken.',
            '',
            'Customer Summary',
            'Create a concise, structured summary from the customer’s point of view covering:',
            '',
            'Problem reported (breakdown / issue)',
            '',
            'Vehicle details (if mentioned)',
            '',
            'Location / landmark / pin code (if mentioned)',
            '',
            'Urgency level (low / medium / high)',
            '',
            'Expectations from service',
            '',
            'Any concern, hesitation, or objection raised',
            '',
            'Employee Summary',
            'Create a clear summary from the employee’s point of view covering:',
            '',
            'How the issue was understood',
            '',
            'Questions asked to the customer',
            '',
            'Solution or service promised',
            '',
            'Pricing / ETA / mechanic assignment (if discussed)',
            '',
            'Next action committed by the employee',
            '',
            'Actionable Outcome',
            '',
            'Final call status: (Booked / Follow-up Required / Cancelled / No Confirmation)',
            '',
            'Any missing information that must be collected',
            '',
            'Immediate next step for operations team',
            '',
            'Output Format (strictly follow):',
            '',
            'Full Transcription',
            'Customer:',
            'Employee:',
            '',
            'Customer Summary',
            '',
            '…',
            '',
            'Employee Summary',
            '',
            '…',
            '',
            'Actionable Outcome',
            '',
            'Call Status:',
            '',
            'Call Rating (1-5):',
            '',
            'Missing Info:',
            '',
            'Next Step:',
            '',
            'Rules:',
            '',
            'Be factual, neutral, and operational.',
            '',
            'No assumptions.',
            '',
            'No extra explanations.',
            '',
            'This output will be stored in a CRM and used by ops & service teams.',
            '',
            'Additional Guidance (still follow the exact Output Format headings above):',
            '- In "Customer Summary" and "Employee Summary", use short bullet points with labels for clarity (e.g., "Problem:", "Vehicle:", "Location:", "Urgency:", "Expectation:", "Objections:").',
            '- Add "Operational Insights:" inside the Employee Summary with bullets like:',
            '  - Service category (towing/battery/tyre/fuel/jump start/other) if inferable from spoken words',
            '  - Pricing mentioned? (yes/no + amount if spoken)',
            '  - ETA mentioned? (yes/no + time if spoken)',
            '  - Confirmation obtained? (yes/no/unclear)',
            '  - Risks/Flags (e.g., wrong number, incomplete location, customer hesitant, urgent safety risk) based only on transcript',
            '- Add "Confidence:" (High/Medium/Low) in Employee Summary based on transcript completeness.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            'Here is the raw ASR transcript text (may not be diarized).',
            'Convert it to the required output format. Do not invent details.',
            'For Call Rating (1-5): rate the overall call outcome & customer experience from the transcript only (1=very poor, 3=neutral/unclear, 5=excellent). Output an integer.',
            '',
            transcription,
          ].join('\n'),
        },
      ],
    }),
  });
  if (!summaryRes.ok) {
    const errText = await summaryRes.text().catch(() => '');
    throw new Error(`Summary failed: ${summaryRes.status} ${errText}`);
  }
  const summaryJson = await summaryRes.json();
  const summary = String(summaryJson?.choices?.[0]?.message?.content || '').trim() || null;
  return { transcription, summary };
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = await assertSuperAdmin(supabase);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }
    const db = supabaseAdmin as any;

    const { id } = await context.params;
    const callId = String(id || '').trim();
    if (!callId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { data: callRow, error: callErr } = await db
      .from('sarv_calls')
      .select('id, recording_url')
      .eq('id', callId)
      .single();
    if (callErr || !callRow?.id) return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    if (!callRow.recording_url) return NextResponse.json({ error: 'No recording_url on this call' }, { status: 400 });

    const now = new Date().toISOString();
    const { transcription, summary } = await generateTranscriptionAndSummary(String(callRow.recording_url));

    await db
      .from('sarv_calls')
      .update({ transcription, summary, updated_at: now })
      .eq('id', callRow.id);

    return NextResponse.json({ success: true, id: callRow.id, transcription, summary });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

