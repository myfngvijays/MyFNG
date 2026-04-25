import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { fetchDeepcallRecordingUrl } from '@/lib/sarv/deepcall';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WEBHOOK_SECRET = process.env.SARV_WEBHOOK_SECRET || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe';

// Cost control: auto-transcription on every webhook ek din me $273 kha gaya.
// Default OFF rakha hai. Re-enable karne ke liye env me set karo:
//   SARV_AUTO_TRANSCRIBE_ENABLED=true
// (Pehle prompt size, retry guard, per-day limit fix karna zaroori hai.)
const AUTO_TRANSCRIBE_ENABLED =
  String(process.env.SARV_AUTO_TRANSCRIBE_ENABLED || '').toLowerCase() === 'true';

// Naye Sarv panel me recording field "/mp3/<userid>/.../file.mp3" jaisa
// relative path aata hai (no host). Old panel "https://s-ct3.sarv.com/..."
// pura URL bhejta tha. Frontend me play karne ke liye host prepend karna hota
// hai. Default Sarv ke standard CDN pe rakha hai; agar Sarv ne migration ke
// baad host badla ho to env me override kar dena.
const SARV_RECORDING_BASE_URL = (
  process.env.SARV_RECORDING_BASE_URL || 'https://s-ct3.sarv.com/v2/recording/direct'
).replace(/\/+$/, '');

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

function normalizeRecordingUrl(input: unknown) {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  // Already absolute URL.
  if (/^https?:\/\//i.test(raw)) return raw;
  // Relative path se bhi double-slash banane se bachao.
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return `${SARV_RECORDING_BASE_URL}${path}`;
}

function pickRecordingUrl(payload: SarvPayload) {
  const direct =
    payload?.recording_url ||
    payload?.recordingUrl ||
    payload?.recordingURL ||
    payload?.recording ||
    '';
  if (direct) return normalizeRecordingUrl(direct);

  const ahDetail = parseJsonSafe<any[]>(payload?.aHDetail ?? payload?.ahdetail, []);
  const answered = ahDetail.find((item) => String(item?.status || '').toLowerCase() === 'answered');
  const candidate = answered?.recordingUrl || answered?.recording || '';
  if (candidate) return normalizeRecordingUrl(candidate);

  const recordings = parseJsonSafe<any[]>(payload?.recordings, []);
  const rec = recordings[0]?.file;
  return rec ? normalizeRecordingUrl(rec) : '';
}

/**
 * Naye Sarv panel me `aAnsH` empty array (`[]`) bhejta hai aur agent IDs
 * aHDetail / aH me hi milte hain. Old panel `aAnsH: [34843]` jaisa fill karta
 * tha. Hum priority deni chahiye:
 *   1) aHDetail me jo agents `status === "answered"` hue (actual telecaller jisne
 *      call uthayi) — yeh sabse accurate signal hai
 *   2) `aAnsH` (agar non-empty) — old panel ka behavior
 *   3) `aH` ya `masterAgent` — fallback ke roop me
 *
 * Empty array ko skip karna zaroori hai warna `??` chain `aH` tak nahi pahunchti.
 */
function parseAansh(payload: SarvPayload) {
  const out: number[] = [];
  const seen = new Set<number>();
  const push = (value: unknown) => {
    const n = Number(value);
    if (Number.isFinite(n) && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  };

  const ahDetail = parseJsonSafe<any[]>(payload?.aHDetail ?? payload?.ahdetail, []);
  if (Array.isArray(ahDetail)) {
    for (const item of ahDetail) {
      if (String(item?.status || '').toLowerCase() === 'answered') push(item?.agentId);
    }
  }

  const aAnsH = parseJsonSafe<any[]>(payload?.aAnsH ?? payload?.aansh, []);
  if (Array.isArray(aAnsH)) for (const value of aAnsH) push(value);

  const aH = parseJsonSafe<any[]>(payload?.aH, []);
  if (Array.isArray(aH)) for (const value of aH) push(value);

  if (payload?.masterAgent != null) push(payload.masterAgent);
  if (payload?.masteragent != null) push(payload.masteragent);

  return out;
}

function toTimestamp(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  // Naya Sarv panel kuch timestamp fields ke liye "0" / "0000-00-00 00:00:00"
  // bhejta hai. Postgres timestamp column me ye invalid hai
  // ("date/time field value out of range: '0'"), isliye null treat karte hain.
  if (raw === '0' || raw === '0000-00-00' || raw.startsWith('0000-00-00')) return null;
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) return null;
  return raw;
}

function toInt(value: unknown) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null;
  const raw = String(value).trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function getValue(payload: SarvPayload, keys: string[]) {
  for (const key of keys) {
    if (payload?.[key] != null && String(payload[key]).length > 0) return payload[key];
  }
  return null;
}

/** Resolve assignee from active session-based locks (sarv_aansh_sessions). */
async function resolveAssignee(db: any, aanshIds: number[]) {
  if (!aanshIds.length) return null;
  const now = new Date().toISOString();

  for (const aanshId of aanshIds) {
    const { data: row } = await db
      .from('sarv_aansh_sessions')
      .select('user_id, assignee_role')
      .eq('aansh_id', aanshId)
      .is('released_at', null)
      .gt('expires_at', now)
      .limit(1)
      .maybeSingle();

    if (row?.user_id && row?.assignee_role) {
      return { id: row.user_id, role: row.assignee_role };
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
      const assignee = await resolveAssignee(db, aanshIds);

      const recordingUrl = pickRecordingUrl(payload);
      const phone10 = digits10(getValue(payload, ['cNumber10', 'cnumber10', 'cNumber', 'cnumber']));

      const { data: existingCall } = await db
        .from('sarv_calls')
        .select('id, assigned_user_id, assigned_role, telecaller_id, recording_url')
        .eq('callid', callid)
        .maybeSingle();

      const effectiveAssignedUserId = assignee?.id ?? existingCall?.assigned_user_id ?? null;
      const effectiveAssignedRole = assignee?.role ?? existingCall?.assigned_role ?? null;
      const effectiveRecordingUrl = recordingUrl || existingCall?.recording_url || null;
      const effectiveTelecallerId =
        effectiveAssignedRole === 'TELECALLER'
          ? effectiveAssignedUserId
          : existingCall?.telecaller_id || null;

      const upsertPayload: Record<string, any> = {
        callid,
        userid: getValue(payload, ['userId', 'userid']),
        masteragent: toInt(getValue(payload, ['masterAgent', 'masteragent'])),
        masteragentnumber: getValue(payload, ['masterAgentNumber', 'masteragentnumber']),
        telecaller_id: effectiveTelecallerId,
        assigned_user_id: effectiveAssignedUserId,
        assigned_role: effectiveAssignedRole,
        cnumber: getValue(payload, ['cNumber', 'cnumber']),
        did: getValue(payload, ['did']),
        ctype: getValue(payload, ['cType', 'ctype']),
        callstatus: toInt(getValue(payload, ['callStatus', 'callstatus'])),
        ivrstime: toTimestamp(getValue(payload, ['ivrSTime', 'ivrstime'])),
        ivretime: toTimestamp(getValue(payload, ['ivrETime', 'ivretime'])),
        ivrduration: toInt(getValue(payload, ['ivrDuration', 'ivrduration'])),
        talkduration: toInt(getValue(payload, ['talkDuration', 'talkduration'])),
        agentoncallduration: toInt(getValue(payload, ['agentOnCallDuration', 'agentoncallduration'])),
        custanswerstime: custAnswerSTime,
        custansweretime: toTimestamp(getValue(payload, ['custAnswerETime', 'custansweretime'])),
        custanswerduration: toInt(getValue(payload, ['custAnswerDuration', 'custanswerduration'])),
        recording_url: effectiveRecordingUrl,
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

      // Naye DeepCall panel me webhook me sirf relative path aata hai jo
      // browser me play nahi hota — har file ke liye DeepCall API se
      // per-call signed URL chahiye. Yahan upsert ke turant baad refresh
      // kar lete hain taaki UI me direct play ho. Failure pe webhook fail
      // nahi karte (raw_payload + relative URL DB me reh hi jaata hai aur
      // baad me admin refresh endpoint se backfill ho sakta hai).
      try {
        const { url: signedUrl, error: deepcallError } = await fetchDeepcallRecordingUrl(callid);
        if (signedUrl && signedUrl !== callRow.recording_url) {
          const { error: updateErr } = await db
            .from('sarv_calls')
            .update({ recording_url: signedUrl, updated_at: now })
            .eq('id', callRow.id);
          if (updateErr) {
            console.error('[sarv-webhook] recording_url update failed:', updateErr.message);
          } else {
            callRow.recording_url = signedUrl;
          }
        } else if (!signedUrl && deepcallError) {
          console.warn(
            `[sarv-webhook] DeepCall signed URL fetch failed for ${callid}:`,
            deepcallError
          );
        }
      } catch (e: any) {
        console.error('[sarv-webhook] DeepCall integration error:', e?.message || e);
      }

      // Insert one telecrm_api row PER call. We do NOT dedupe here because
      // TeleCRM's autoupdatelead endpoint treats every push for the same phone
      // as an update on the existing lead (no duplicates created in TeleCRM).
      // RSA lead details (name/city/vehicle/etc.) flow in later via the DB
      // trigger on rsa_leads insert/update — they'll be filled into all rows
      // for the same mobile before the 12hr cron picks them up.
      // The 12hr cron (`/api/cron/telecrm-push`) is the ONLY thing that pushes
      // to TeleCRM, so the row has time to gather enriched details first.
      try {
        const mobile = phone10 || digits10(getValue(payload, ['cNumber', 'cnumber']));
        const { error: insertErr } = await db
          .from('telecrm_api')
          .insert({
            mobile: mobile || null,
            disposition: upsertPayload.disposition || null,
            disposition_category: upsertPayload.disposition_category || null,
            disposition_note: upsertPayload.disposition_note || null,
            recording_url: callRow.recording_url || null,
            updated_at: now,
          });

        if (insertErr) {
          console.error('[sarv-webhook] telecrm_api insert failed:', insertErr.message);
        }
      } catch (telecrmErr: any) {
        console.error('[sarv-webhook] telecrm_api insert failed:', telecrmErr?.message || telecrmErr);
      }

      // Auto transcription/summary disabled by default to control OpenAI cost.
      // Set SARV_AUTO_TRANSCRIBE_ENABLED=true to re-enable (after adding
      // per-day limit + retry guard + smaller prompt).
      if (
        AUTO_TRANSCRIBE_ENABLED &&
        callRow.recording_url &&
        !callRow.transcription &&
        OPENAI_API_KEY
      ) {
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
