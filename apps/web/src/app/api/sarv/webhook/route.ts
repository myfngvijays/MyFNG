import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WEBHOOK_SECRET = process.env.SARV_WEBHOOK_SECRET || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe';

type SarvPayload = Record<string, any>;

function parseJsonSafe<T = any>(input: unknown, fallback: T): T {
  if (input == null) return fallback;
  if (typeof input === 'object') return input as T;
  const raw = String(input).trim();
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function digits10(input: unknown) {
  const raw = String(input ?? '');
  const d = raw.replace(/\D/g, '');
  return d.length <= 10 ? d : d.slice(-10);
}

function pickRecordingUrl(payload: SarvPayload) {
  const ahDetail = parseJsonSafe<any[]>(payload?.aHDetail ?? payload?.ahdetail, []);
  const answered = ahDetail.find((item) => String(item?.status || '').toLowerCase() === 'answered');
  const candidate = answered?.recordingUrl || answered?.recording || '';
  if (candidate) return String(candidate);

  const recordings = parseJsonSafe<any[]>(payload?.recordings, []);
  const rec = recordings[0]?.file;
  return rec ? String(rec) : '';
}

function parseAansh(payload: SarvPayload) {
  const raw = parseJsonSafe<any[]>(payload?.aAnsH ?? payload?.aansh ?? payload?.aH, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value)) as number[];
}

function toTimestamp(value: unknown) {
  const raw = String(value ?? '').trim();
  return raw ? raw : null;
}

function getValue(payload: SarvPayload, keys: string[]) {
  for (const key of keys) {
    if (payload?.[key] != null && String(payload[key]).length > 0) return payload[key];
  }
  return null;
}

function isTimeInWindow(timeValue: string, from: string | null, to: string | null) {
  if (!from || !to) return true;
  if (from <= to) {
    return timeValue >= from && timeValue <= to;
  }
  // Overnight window (e.g. 22:00 to 02:00)
  return timeValue >= from || timeValue <= to;
}

function parseSarvTimestamp(input: string | null) {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const hasTz = raw.endsWith('Z') || /[+\-]\d{2}:?\d{2}$/.test(raw);
  const hasT = raw.includes('T');

  if (hasTz) {
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return null;
    const iso = dt.toISOString();
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(dt);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
    const weekday = get('weekday');
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const day = dayMap[weekday] ?? 0;
    const timeValue = `${get('hour')}:${get('minute')}:${get('second')}`;
    return { iso, day, timeValue };
  }

  // Assume SARV timestamps are local IST if no timezone provided.
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, y, mo, d, hh, mm, ss = '00'] = match;
  const utcMs = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(hh) - 5,
    Number(mm) - 30,
    Number(ss)
  );
  const dt = new Date(utcMs);
  const iso = dt.toISOString();
  const day = dt.getUTCDay();
  const timeValue = `${hh}:${mm}:${ss}`;
  return { iso, day, timeValue };
}

async function resolveAssignee(db: any, aanshIds: number[], custAnswerSTime: string | null) {
  if (!aanshIds.length || !custAnswerSTime) return null;
  const stamp = parseSarvTimestamp(custAnswerSTime);
  if (!stamp) return null;
  const { day, timeValue, iso } = stamp;

  for (const aanshId of aanshIds) {
    const { data: mapping } = await db
      .from('sarv_aansh_mappings')
      .select('assignee_id, assignee_role, telecaller_id, effective_from, effective_to, day_of_week, time_from, time_to')
      .eq('aansh_id', aanshId)
      .lte('effective_from', iso)
      .or(`effective_to.is.null,effective_to.gte.${iso}`)
      .order('effective_from', { ascending: false })
      .limit(10);

    const rows = Array.isArray(mapping) ? mapping : mapping ? [mapping] : [];
    for (const row of rows) {
      const days = Array.isArray(row.day_of_week) ? row.day_of_week : null;
      const dayMatch = !days || days.length === 0 || days.includes(day);
      if (!dayMatch) continue;

      const from = row.time_from ? String(row.time_from).slice(0, 8) : null;
      const to = row.time_to ? String(row.time_to).slice(0, 8) : null;
      if (!isTimeInWindow(timeValue, from, to)) continue;

      if (row?.assignee_id && row?.assignee_role) {
        return { id: row.assignee_id, role: row.assignee_role };
      }
      if (row?.telecaller_id) {
        return { id: row.telecaller_id, role: 'TELECALLER' };
      }
    }
  }

  return null;
}

async function linkToRsaLead(db: any, sarvCallId: string, phone10: string) {
  if (!phone10) return;
  const { data: leads } = await db
    .from('rsa_leads')
    .select('id, contact_number, lead_registered_at')
    .ilike('contact_number', `%${phone10}`)
    .order('lead_registered_at', { ascending: false })
    .limit(5);

  const match = (leads || []).find((l: any) => digits10(l?.contact_number) === phone10);
  if (!match?.id) return;

  await db
    .from('sarv_call_rsa_links')
    .upsert(
      {
        sarv_call_id: sarvCallId,
        rsa_lead_id: match.id,
        matched_phone: phone10,
      },
      { onConflict: 'sarv_call_id,rsa_lead_id' }
    );
}

async function generateTranscriptionAndSummary(recordingUrl: string) {
  if (!OPENAI_API_KEY) return { transcription: null, summary: null };

  const audioRes = await fetch(recordingUrl);
  if (!audioRes.ok) {
    throw new Error(`Recording fetch failed: ${audioRes.status}`);
  }
  const audioBuffer = await audioRes.arrayBuffer();
  const contentType = audioRes.headers.get('content-type') || 'audio/mpeg';
  const audioBlob = new Blob([audioBuffer], { type: contentType });

  // Pick a reasonable filename/extension for better decoder hints.
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
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
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

  if (!transcription) {
    return { transcription: null, summary: null };
  }

  // If transcription is suspiciously short, don't generate a misleading summary.
  if (transcription.replace(/\s+/g, ' ').length < 40) {
    return { transcription, summary: null };
  }

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

export async function POST(request: NextRequest) {
  try {
    if (WEBHOOK_SECRET) {
      const provided =
        request.headers.get('x-sarv-webhook-secret') ||
        request.headers.get('x-sarv-secret') ||
        request.headers.get('authorization') ||
        '';
      if (String(provided).trim() !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const text = await request.text();
    const parsed = text ? JSON.parse(text) : null;
    const payloads = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];

    if (payloads.length === 0) {
      return NextResponse.json({ error: 'No payload received' }, { status: 400 });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }
    const db = supabaseAdmin as any;

    const now = new Date().toISOString();
    const results: { callid: string; status: 'ok' | 'error'; error?: string }[] = [];

    for (const payload of payloads) {
      const callid = String(getValue(payload, ['callid', 'callId']) || '').trim();
      if (!callid) {
        results.push({ callid: '', status: 'error', error: 'Missing callid' });
        continue;
      }

      const custAnswerSTime = toTimestamp(getValue(payload, ['custAnswerSTime', 'custanswerstime']));
      const aanshIds = parseAansh(payload);
      const assignee = await resolveAssignee(db, aanshIds, custAnswerSTime);

      const recordingUrl = pickRecordingUrl(payload);
      const phone10 = digits10(getValue(payload, ['cNumber10', 'cnumber10', 'cNumber', 'cnumber']));

      const upsertPayload: Record<string, any> = {
        callid,
        userid: getValue(payload, ['userId', 'userid']),
        masteragent: getValue(payload, ['masterAgent', 'masteragent']),
        masteragentnumber: getValue(payload, ['masterAgentNumber', 'masteragentnumber']),
        telecaller_id: assignee?.role === 'TELECALLER' ? assignee.id : null,
        assigned_user_id: assignee?.id ?? null,
        assigned_role: assignee?.role ?? null,
        cnumber: getValue(payload, ['cNumber', 'cnumber']),
        did: getValue(payload, ['did']),
        ctype: getValue(payload, ['cType', 'ctype']),
        callstatus: getValue(payload, ['callStatus', 'callstatus']),
        ivrstime: toTimestamp(getValue(payload, ['ivrSTime', 'ivrstime'])),
        ivretime: toTimestamp(getValue(payload, ['ivrETime', 'ivretime'])),
        ivrduration: getValue(payload, ['ivrDuration', 'ivrduration']),
        talkduration: getValue(payload, ['talkDuration', 'talkduration']),
        agentoncallduration: getValue(payload, ['agentOnCallDuration', 'agentoncallduration']),
        custanswerstime: custAnswerSTime,
        custansweretime: toTimestamp(getValue(payload, ['custAnswerETime', 'custansweretime'])),
        custanswerduration: getValue(payload, ['custAnswerDuration', 'custanswerduration']),
        recording_url: recordingUrl || null,
        disposition: getValue(payload, ['disposition']),
        disposition_category: getValue(payload, ['disposition_category']),
        disposition_note: getValue(payload, ['disposition_note', 'notes_detail']),
        disposition_updated_at: toTimestamp(getValue(payload, ['disposition_updated_at'])),
        sarv_created_at: toTimestamp(getValue(payload, ['createdat', 'createdAt'])),
        raw_payload: payload ?? null,
        updated_at: now,
      };

      const { data: callRow, error: upsertError } = await db
        .from('sarv_calls')
        .upsert(upsertPayload, { onConflict: 'callid' })
        .select('id, callid, transcription, summary, recording_url')
        .single();

      if (upsertError || !callRow?.id) {
        results.push({ callid, status: 'error', error: upsertError?.message || 'Upsert failed' });
        continue;
      }

      try {
        await linkToRsaLead(db, callRow.id, phone10);
      } catch (e: any) {
        results.push({ callid, status: 'error', error: e?.message || 'Lead link failed' });
        continue;
      }

      if (callRow.recording_url && !callRow.transcription && OPENAI_API_KEY) {
        try {
          const { transcription, summary } = await generateTranscriptionAndSummary(callRow.recording_url);
          await db
            .from('sarv_calls')
            .update({ transcription, summary, updated_at: now })
            .eq('id', callRow.id);
        } catch (e: any) {
          results.push({ callid, status: 'error', error: e?.message || 'GPT generation failed' });
          continue;
        }
      }

      results.push({ callid, status: 'ok' });
    }

    return NextResponse.json({ success: true, results }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
