/**
 * Deep Learning voice layer: Whisper transcript → emotion/intent → embeddings.
 * Used on every usable recording (not only Call IQ Deep button).
 */

import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { transcribeCallRecording } from '@/lib/telecaller/callIqTranscript';
import { mapDlRow, type CallDlInsight, type SimilarBookedLead } from '@/lib/telecaller/leadMlTypes';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL =
  process.env.OPENAI_CALL_INTEL_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

export const CRM_DL_MIN_DURATION_SEC = 20;

export function crmDlAutoEnabled() {
  const raw = String(process.env.CRM_DL_AUTO_TRANSCRIBE || '1').trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'off') return false;
  return Boolean(OPENAI_API_KEY);
}

function cosine(a: number[], b: number[]) {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function asVector(raw: unknown): number[] {
  if (Array.isArray(raw)) return raw.map((n) => Number(n) || 0);
  return [];
}

export async function embedText(text: string): Promise<number[] | null> {
  const input = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 6000);
  if (!input || !OPENAI_API_KEY) return null;
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: OPENAI_EMBEDDING_MODEL, input }),
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => ({}));
  const vec = json?.data?.[0]?.embedding;
  return Array.isArray(vec) ? vec.map((n: number) => Number(n) || 0) : null;
}

type EmotionResult = {
  emotion: string;
  emotion_score: number;
  voice_intent: string;
  voice_intent_score: number;
  tags: string[];
};

async function analyzeVoiceFromTranscript(transcript: string): Promise<EmotionResult | null> {
  const text = String(transcript || '').replace(/\s+/g, ' ').trim();
  if (text.length < 12 || !OPENAI_API_KEY) return null;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You tag Indian car-service sales calls. Return JSON only: ' +
            '{"emotion":"calm|hesitant|frustrated|angry|excited|disappointed|unknown",' +
            '"emotion_score":0-100,"voice_intent":"interested|price_shop|not_now|booked|ghost|unknown",' +
            '"voice_intent_score":0-100,"tags":["short","snake_case"]}',
        },
        { role: 'user', content: text.slice(0, 6000) },
      ],
    }),
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => ({}));
  const raw = String(json?.choices?.[0]?.message?.content || '').trim();
  try {
    const parsed = JSON.parse(raw);
    const tags = Array.isArray(parsed.tags) ? parsed.tags.map((t: any) => String(t).slice(0, 32)) : [];
    return {
      emotion: String(parsed.emotion || 'unknown').toLowerCase().slice(0, 32),
      emotion_score: Math.max(0, Math.min(100, Number(parsed.emotion_score) || 0)),
      voice_intent: String(parsed.voice_intent || 'unknown').toLowerCase().slice(0, 32),
      voice_intent_score: Math.max(0, Math.min(100, Number(parsed.voice_intent_score) || 0)),
      tags: tags.slice(0, 8),
    };
  } catch {
    return null;
  }
}

function leadOutcome(status?: string | null) {
  const s = String(status || '').toUpperCase();
  if (s.includes('LOST') || s === 'REJECTED') return 'lost';
  if (s.includes('BOOKING') || s.includes('SERVICE DONE') || s === 'COMPLETED' || s === 'IN SERVICE') {
    return 'booked';
  }
  return 'open';
}

async function persistLeadEmbedding(
  db: any,
  lead: any,
  extraText: string,
  embedding: number[] | null,
) {
  if (!lead?.id) return;
  const profile = [
    lead.city,
    lead.vehicle_make,
    lead.vehicle_model,
    lead.service_type,
    lead.problem_description,
    extraText,
  ]
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .join(' | ')
    .slice(0, 2000);
  await db.from('telecaller_lead_embeddings').upsert(
    {
      lead_id: lead.id,
      profile_text: profile,
      embedding: embedding,
      outcome: leadOutcome(lead.status),
      engine: OPENAI_EMBEDDING_MODEL,
      embedded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'lead_id' },
  );
}

export async function processCallDl(
  callLogId: string,
  opts?: { force?: boolean },
): Promise<{ insight: CallDlInsight | null; warning?: string; skipped?: string }> {
  const id = String(callLogId || '').trim();
  if (!id) return { insight: null, skipped: 'no_id' };
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { insight: null, warning: 'No database' };
  const db = supabaseAdmin;

  const { data: log, error } = await db
    .from('telecaller_call_logs')
    .select(
      `
      id, lead_id, call_duration, call_recording_url, call_status,
      lead:service_leads!lead_id(id, status, city, vehicle_make, vehicle_model, service_type, problem_description)
    `,
    )
    .eq('id', id)
    .maybeSingle();
  if (error || !log) return { insight: null, skipped: 'log_missing' };

  const duration = Number(log.call_duration) || 0;
  const recording = String(log.call_recording_url || '').trim();
  if (!recording) return { insight: null, skipped: 'no_recording' };
  if (duration > 0 && duration < CRM_DL_MIN_DURATION_SEC && !opts?.force) {
    return { insight: null, skipped: `duration_${duration}` };
  }

  const { data: existing } = await db
    .from('telecaller_call_dl')
    .select('*')
    .eq('call_log_id', id)
    .maybeSingle();
  if (!opts?.force && existing) {
    if (existing.transcript && String(existing.transcript).length >= 12) {
      return { insight: mapDlRow(existing), skipped: 'already' };
    }
    const processedAt = new Date(existing.processed_at || 0).getTime();
    if (Number.isFinite(processedAt) && Date.now() - processedAt < 6 * 60 * 60 * 1000) {
      return { insight: mapDlRow(existing), skipped: 'recent_fail' };
    }
  }

  let transcript = String(existing?.transcript || '').trim();
  let warning: string | undefined;
  if (transcript.length < 12) {
    const { data: analysis } = await db
      .from('telecaller_call_analyses')
      .select('sop_audit')
      .eq('call_log_id', id)
      .maybeSingle();
    transcript = String(analysis?.sop_audit?.call_transcript || '').trim();
  }
  if (transcript.length < 12) {
    const result = await transcribeCallRecording(recording);
    if (result.text) transcript = result.text;
    else warning = result.warning || 'Transcription failed';
  }

  let emotion: EmotionResult | null = null;
  if (transcript.length >= 12) {
    emotion = await analyzeVoiceFromTranscript(transcript);
  }

  const embedSource = transcript.length >= 20
    ? transcript
    : [log.lead?.problem_description, log.lead?.city, log.lead?.vehicle_make].filter(Boolean).join(' ');
  const embedding = embedSource ? await embedText(embedSource) : null;

  const payload = {
    call_log_id: id,
    lead_id: log.lead_id || null,
    transcript: transcript || null,
    transcript_chars: transcript ? transcript.length : 0,
    emotion: emotion?.emotion || existing?.emotion || null,
    emotion_score: emotion?.emotion_score ?? existing?.emotion_score ?? null,
    voice_intent: emotion?.voice_intent || existing?.voice_intent || null,
    voice_intent_score: emotion?.voice_intent_score ?? existing?.voice_intent_score ?? null,
    tags: emotion?.tags || existing?.tags || [],
    embedding: embedding || existing?.embedding || null,
    engine: transcript
      ? `dl_whisper_${emotion ? 'emotion' : 'transcript'}`
      : existing?.engine || 'dl_pending',
    warning: warning || null,
    processed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: saved, error: saveErr } = await db
    .from('telecaller_call_dl')
    .upsert(payload, { onConflict: 'call_log_id' })
    .select('*')
    .maybeSingle();
  if (saveErr) {
    if (/does not exist|schema cache|PGRST205|42P01/i.test(saveErr.message || '')) {
      return { insight: null, warning: 'Run database/354_crm_ml_dl_insights.sql' };
    }
    return { insight: null, warning: saveErr.message };
  }

  const lead = Array.isArray(log.lead) ? log.lead[0] : log.lead;
  if (lead?.id && embedding) {
    await persistLeadEmbedding(
      db,
      lead,
      [emotion?.emotion, emotion?.voice_intent, transcript.slice(0, 400)].filter(Boolean).join(' '),
      embedding,
    ).catch(() => undefined);
  }

  return { insight: saved ? mapDlRow(saved) : mapDlRow(payload), warning };
}

export function enqueueCrmDlOnRecordingCompleted(callLogId: string) {
  if (!crmDlAutoEnabled()) return;
  void processCallDl(callLogId).catch((e) => {
    console.warn('[crmDl]', e?.message || e);
  });
}

export async function sweepCrmDl(limit = 3): Promise<{ scanned: number; ran: number; skipped: number; warning?: string }> {
  if (!crmDlAutoEnabled()) return { scanned: 0, ran: 0, skipped: 0, warning: 'auto_off' };
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { scanned: 0, ran: 0, skipped: 0 };

  const { data: logs, error } = await supabaseAdmin
    .from('telecaller_call_logs')
    .select('id, call_duration, call_recording_url, lead_id')
    .not('call_recording_url', 'is', null)
    .neq('call_recording_url', '')
    .gte('call_duration', CRM_DL_MIN_DURATION_SEC)
    .not('lead_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) return { scanned: 0, ran: 0, skipped: 0, warning: error.message };

  const rows = Array.isArray(logs) ? logs : [];
  const ids = rows.map((r) => r.id);
  const done = new Set<string>();
  if (ids.length) {
    const { data: existing } = await supabaseAdmin
      .from('telecaller_call_dl')
      .select('call_log_id, transcript')
      .in('call_log_id', ids);
    for (const r of existing || []) {
      if (String(r.transcript || '').length >= 12) done.add(String(r.call_log_id));
    }
  }

  let ran = 0;
  let skipped = 0;
  for (const row of rows) {
    if (ran >= limit) break;
    if (done.has(String(row.id))) {
      skipped += 1;
      continue;
    }
    const result = await processCallDl(String(row.id));
    if (result.warning?.includes('354_')) return { scanned: rows.length, ran, skipped, warning: result.warning };
    if (result.insight && !result.skipped) ran += 1;
    else skipped += 1;
  }
  return { scanned: rows.length, ran, skipped };
}

export async function findSimilarBookedLeads(
  leadId: string,
  limit = 4,
): Promise<{ similar: SimilarBookedLead[]; warning?: string }> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { similar: [] };

  let { data: mine } = await supabaseAdmin
    .from('telecaller_lead_embeddings')
    .select('lead_id, embedding, profile_text')
    .eq('lead_id', leadId)
    .maybeSingle();

  if (!mine?.embedding) {
    const { data: lead } = await supabaseAdmin
      .from('service_leads')
      .select('id, status, city, vehicle_make, vehicle_model, service_type, problem_description')
      .eq('id', leadId)
      .maybeSingle();
    if (lead) {
      const text = [lead.city, lead.vehicle_make, lead.vehicle_model, lead.service_type, lead.problem_description]
        .filter(Boolean)
        .join(' | ');
      const embedding = text ? await embedText(text) : null;
      if (embedding) {
        await persistLeadEmbedding(supabaseAdmin, lead, '', embedding);
        mine = { lead_id: leadId, embedding, profile_text: text };
      }
    }
  }

  const queryVec = asVector(mine?.embedding);
  if (!queryVec.length) return { similar: [] };

  const { data: booked, error } = await supabaseAdmin
    .from('telecaller_lead_embeddings')
    .select('lead_id, embedding, outcome')
    .eq('outcome', 'booked')
    .neq('lead_id', leadId)
    .not('embedding', 'is', null)
    .limit(220);
  if (error) {
    if (/does not exist|schema cache|PGRST205|42P01/i.test(error.message || '')) {
      return { similar: [], warning: 'Run database/354_crm_ml_dl_insights.sql' };
    }
    return { similar: [], warning: error.message };
  }

  const ranked = (booked || [])
    .map((row: any) => ({
      lead_id: String(row.lead_id),
      similarity: cosine(queryVec, asVector(row.embedding)),
    }))
    .filter((r) => r.similarity > 0.35)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  if (!ranked.length) return { similar: [] };

  const { data: leads } = await supabaseAdmin
    .from('service_leads')
    .select('id, customer_name, city, vehicle_make, vehicle_model, status')
    .in(
      'id',
      ranked.map((r) => r.lead_id),
    );

  const byId = new Map((leads || []).map((l: any) => [String(l.id), l]));
  return {
    similar: ranked.map((r) => {
      const l = byId.get(r.lead_id);
      const vehicle = [l?.vehicle_make, l?.vehicle_model].filter(Boolean).join(' ').trim() || null;
      return {
        lead_id: r.lead_id,
        customer_name: l?.customer_name || null,
        city: l?.city || null,
        vehicle,
        status: l?.status || null,
        similarity: Math.round(r.similarity * 100) / 100,
      };
    }),
  };
}

export function mapCallDlRow(r: any): CallDlInsight {
  return mapDlRow(r);
}
