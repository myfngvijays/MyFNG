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

async function resolveAssignee(db: any, aanshIds: number[], custAnswerSTime: string | null) {
  if (!aanshIds.length || !custAnswerSTime) return null;
  const time = new Date(custAnswerSTime);
  if (Number.isNaN(time.getTime())) return null;
  const day = time.getDay(); // 0=Sun..6=Sat
  const timeValue = time.toISOString().slice(11, 19); // HH:MM:SS

  for (const aanshId of aanshIds) {
    const { data: mapping } = await db
      .from('sarv_aansh_mappings')
      .select('assignee_id, assignee_role, telecaller_id, effective_from, effective_to, day_of_week, time_from, time_to')
      .eq('aansh_id', aanshId)
      .lte('effective_from', time.toISOString())
      .or(`effective_to.is.null,effective_to.gte.${time.toISOString()}`)
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
  const audioBlob = new Blob([audioBuffer], { type: audioRes.headers.get('content-type') || 'audio/mpeg' });

  const formData = new FormData();
  formData.append('model', OPENAI_TRANSCRIBE_MODEL);
  formData.append('file', audioBlob, 'call.mp3');

  const transcribeRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: formData,
  });

  if (!transcribeRes.ok) {
    const errText = await transcribeRes.text().catch(() => '');
    throw new Error(`Transcription failed: ${transcribeRes.status} ${errText}`);
  }

  const transcribeJson = await transcribeRes.json();
  const transcription = String(transcribeJson?.text || '').trim() || null;

  if (!transcription) {
    return { transcription: null, summary: null };
  }

  const summaryRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are a call quality assistant. Summarize the call in short structured bullet points with Customer Issue, Resolution, Sentiment, and Action Items.',
        },
        { role: 'user', content: transcription },
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
