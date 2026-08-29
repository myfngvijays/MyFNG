/**
 * Tabular ML conversion scorer (logistic weights + 90-day hour priors).
 * Not a neural net — city/status/calls/voice tags as features.
 */

import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  formatBestCallHour,
  mapScoreRow,
  temperatureFromScore,
  type LeadMlScore,
} from '@/lib/telecaller/leadMlTypes';

const ENGINE = 'tabular_ml_v1';
const PRIORS_TTL_MS = 20 * 60 * 1000;

type HourPrior = { booked: number; total: number };

let priorsCache: { at: number; hours: Record<number, HourPrior> } | null = null;

const BOOKED = new Set([
  'BOOKING CONFIRMED',
  'VALIDATED',
  'IN SERVICE',
  'IN_PROGRESS',
  'SERVICE DONE',
  'COMPLETED',
]);

function normStatus(raw?: string | null) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function statusBucket(status?: string | null) {
  const s = normStatus(status);
  if (BOOKED.has(s) || s.includes('BOOKING') || s.includes('SERVICE DONE')) return 'booked';
  if (s.includes('LOST') || s === 'REJECTED') return 'lost';
  if (s.includes('WILL VISIT')) return 'will_visit';
  if (s.includes('INTERESTED')) return 'interested';
  if (s.includes('FOLLOW')) return 'followup';
  if (s.includes('RINGING') || s.includes('NO ANSWER')) return 'ringing';
  if (s.includes('FRESH') || s === 'NEW' || s === 'INCOMPLETE') return 'fresh';
  return 'other';
}

export function istHour(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === 'hour')?.value);
  return Number.isFinite(h) ? h : null;
}

function sigmoid(z: number) {
  if (z > 12) return 1;
  if (z < -12) return 0;
  return 1 / (1 + Math.exp(-z));
}

function daysBetween(iso?: string | null) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (Date.now() - t) / 86_400_000);
}

async function loadHourPriors(db: any): Promise<Record<number, HourPrior>> {
  if (priorsCache && Date.now() - priorsCache.at < PRIORS_TTL_MS) return priorsCache.hours;
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const { data, error } = await db
    .from('service_leads')
    .select('status, last_call_at')
    .not('last_call_at', 'is', null)
    .gte('last_call_at', since)
    .is('deleted_at', null)
    .limit(4000);
  const hours: Record<number, HourPrior> = {};
  if (!error) {
    for (const row of data || []) {
      const hr = istHour(row.last_call_at);
      if (hr == null) continue;
      if (!hours[hr]) hours[hr] = { booked: 0, total: 0 };
      hours[hr].total += 1;
      if (statusBucket(row.status) === 'booked') hours[hr].booked += 1;
    }
  }
  priorsCache = { at: Date.now(), hours };
  return hours;
}

function pickBestHour(
  priors: Record<number, HourPrior>,
  ownAnsweredHours: number[],
): { hour: number; label: string } {
  let bestHr = 11;
  let bestRate = -1;
  for (let h = 9; h <= 20; h += 1) {
    const p = priors[h];
    if (!p || p.total < 8) continue;
    const rate = p.booked / p.total;
    if (rate > bestRate) {
      bestRate = rate;
      bestHr = h;
    }
  }
  if (ownAnsweredHours.length) {
    const counts = new Map<number, number>();
    for (const h of ownAnsweredHours) counts.set(h, (counts.get(h) || 0) + 1);
    let ownBest = ownAnsweredHours[0];
    let ownN = 0;
    for (const [h, n] of counts) {
      if (n > ownN) {
        ownN = n;
        ownBest = h;
      }
    }
    if (ownN >= 2) bestHr = ownBest;
  }
  return { hour: bestHr, label: formatBestCallHour(bestHr) || `${bestHr}:00 IST` };
}

export type ScoreLeadInput = {
  id: string;
  status?: string | null;
  city?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_number?: string | null;
  problem_description?: string | null;
  lead_priority?: string | null;
  next_follow_up_at?: string | null;
  last_call_at?: string | null;
  total_calls?: number | null;
  created_at?: string | null;
  coupon_meta?: any;
  is_incomplete?: boolean | null;
};

function computeScore(opts: {
  lead: ScoreLeadInput;
  calls: Array<{
    call_status?: string | null;
    call_duration?: number | null;
    created_at?: string | null;
    outcome?: string | null;
  }>;
  lastSopScore?: number | null;
  lastBuying?: string | null;
  lastEmotion?: string | null;
  lastVoiceIntent?: string | null;
  priors: Record<number, HourPrior>;
}): LeadMlScore {
  const { lead, calls, priors } = opts;
  const bucket = statusBucket(lead.status);
  const daysOld = daysBetween(lead.created_at) ?? 0;
  const daysSinceCall = daysBetween(lead.last_call_at);
  const answered = calls.filter((c) => {
    const s = String(c.call_status || c.outcome || '').toUpperCase();
    return s.includes('ANSWER') || s.includes('COMPLETE') || (Number(c.call_duration) || 0) >= 20;
  });
  const noAnswer = calls.filter((c) => {
    const s = String(c.call_status || c.outcome || '').toUpperCase();
    return s.includes('NO ANSWER') || s.includes('RINGING') || s.includes('MISSED') || s.includes('BUSY');
  });
  const lastDur = Number(answered[0]?.call_duration || calls[0]?.call_duration || 0) || 0;
  const answerRate = calls.length ? answered.length / calls.length : 0;
  const ownHours = answered.map((c) => istHour(c.created_at)).filter((h): h is number => h != null);
  const best = pickBestHour(priors, ownHours);
  const prior = priors[best.hour];
  const hourLift = prior && prior.total >= 8 ? prior.booked / prior.total - 0.18 : 0;

  const hasVehicle = Boolean(
    String(lead.vehicle_number || '').trim() ||
      String(lead.vehicle_make || '').trim() ||
      String(lead.vehicle_model || '').trim(),
  );
  const hasCity = Boolean(String(lead.city || '').trim());
  const hasProblem = Boolean(String(lead.problem_description || '').trim());
  const hasFollowup = Boolean(lead.next_follow_up_at);
  const inbound = Boolean(
    String(lead.coupon_meta?.last_inbound_message || lead.coupon_meta?.first_message || '').trim(),
  );
  const priority = String(lead.lead_priority || '').toUpperCase();
  const buying = String(opts.lastBuying || '').toUpperCase();
  const emotion = String(opts.lastEmotion || '').toLowerCase();
  const intent = String(opts.lastVoiceIntent || '').toLowerCase();
  const sop = opts.lastSopScore == null ? null : Number(opts.lastSopScore);

  let z = -0.35;
  const reasons: string[] = [];

  const statusW: Record<string, number> = {
    booked: 2.4,
    will_visit: 1.35,
    interested: 1.05,
    followup: 0.35,
    fresh: 0.05,
    other: 0,
    ringing: -0.55,
    lost: -2.1,
  };
  z += statusW[bucket] ?? 0;
  if (bucket === 'will_visit') reasons.push('Will-visit status — high close chance');
  if (bucket === 'interested') reasons.push('Marked interested');
  if (bucket === 'ringing') reasons.push('Mostly ringing / no answer');
  if (bucket === 'lost') reasons.push('Already lost — score kept low');

  if (hasVehicle) z += 0.22;
  else reasons.push('Vehicle missing');
  if (hasCity) z += 0.12;
  if (hasProblem) z += 0.18;
  if (hasFollowup) {
    z += 0.32;
    reasons.push('Follow-up set');
  }
  if (inbound) z += 0.18;
  if (lead.is_incomplete) z -= 0.25;
  if (priority === 'HIGH' || priority === 'HOT') z += 0.22;

  z += 0.75 * answerRate;
  z += 0.45 * Math.min(lastDur / 180, 1);
  z -= 0.035 * Math.min(daysOld, 30);
  if (daysSinceCall == null) {
    if (daysOld >= 1) z -= 0.4;
  } else {
    z -= 0.07 * Math.min(daysSinceCall, 21);
    if (daysSinceCall >= 3) reasons.push(`No call in ${Math.round(daysSinceCall)} days`);
  }
  if (calls.length >= 5 && bucket !== 'booked' && bucket !== 'will_visit') {
    z -= 0.12 * Math.min(calls.length - 4, 6);
    reasons.push('Many calls, still open');
  }
  if (noAnswer.length >= 2 && answered.length === 0) {
    z -= 0.85;
    reasons.push('Ghost risk — never answered');
  }
  if (buying.includes('HIGH')) {
    z += 0.65;
    reasons.push('Last call buying intent high');
  } else if (buying.includes('LOW') || buying.includes('NONE')) {
    z -= 0.25;
  }
  if (sop != null && Number.isFinite(sop)) z += 0.55 * (sop / 100);
  if (emotion === 'excited') {
    z += 0.4;
    reasons.push('Voice: excited');
  } else if (emotion === 'angry' || emotion === 'frustrated') {
    z -= 0.45;
    reasons.push(`Voice: ${emotion}`);
  } else if (emotion === 'hesitant') {
    z -= 0.15;
  }
  if (intent === 'interested' || intent === 'booked') {
    z += 0.65;
    reasons.push('Voice intent positive');
  } else if (intent === 'ghost' || intent === 'not_now') {
    z -= 0.55;
    reasons.push('Voice: not ready / ghost');
  } else if (intent === 'price_shop') {
    z += 0.1;
    reasons.push('Price shopping — close with offer');
  }
  z += 0.35 * Math.max(-0.2, Math.min(0.35, hourLift));

  const conversion = Math.round(sigmoid(z) * 100);
  let ghost = 8;
  if (noAnswer.length >= 2 && answered.length === 0) ghost += 45;
  if (answerRate < 0.25 && calls.length >= 3) ghost += 20;
  if (daysSinceCall != null && daysSinceCall >= 5) ghost += 15;
  if (bucket === 'ringing') ghost += 20;
  if (intent === 'ghost') ghost += 25;
  ghost = Math.max(0, Math.min(100, ghost));

  if (conversion >= 70) reasons.unshift('Hot — call now');
  else if (conversion < 40) reasons.unshift('Cold — short attempt, then WhatsApp');

  return {
    lead_id: lead.id,
    conversion_score: conversion,
    temperature: temperatureFromScore(conversion),
    ghost_risk: ghost,
    best_call_hour: best.hour,
    best_call_label: best.label,
    reasons: reasons.slice(0, 6),
    features: {
      status_bucket: bucket,
      days_old: Math.round(daysOld * 10) / 10,
      days_since_call: daysSinceCall == null ? null : Math.round(daysSinceCall * 10) / 10,
      total_calls: calls.length,
      answer_rate: Math.round(answerRate * 100),
      last_duration_sec: lastDur,
      has_vehicle: hasVehicle,
      last_emotion: emotion || null,
      last_voice_intent: intent || null,
      last_sop_score: sop,
      hour_lift: Math.round(hourLift * 100),
    },
    engine: ENGINE,
    scored_at: new Date().toISOString(),
  };
}

export async function persistLeadScore(db: any, score: LeadMlScore) {
  const payload = {
    lead_id: score.lead_id,
    conversion_score: score.conversion_score,
    temperature: score.temperature,
    ghost_risk: score.ghost_risk,
    best_call_hour: score.best_call_hour,
    best_call_label: score.best_call_label,
    reasons: score.reasons,
    features: score.features,
    engine: score.engine,
    scored_at: score.scored_at,
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from('telecaller_lead_scores').upsert(payload, { onConflict: 'lead_id' });
  if (error && /does not exist|schema cache|PGRST205|42P01/i.test(error.message || '')) {
    return { persisted: false, warning: 'Run database/354_crm_ml_dl_insights.sql' };
  }
  if (error) return { persisted: false, warning: error.message };
  return { persisted: true };
}

export async function scoreLeadById(leadId: string, db?: any): Promise<{
  score: LeadMlScore | null;
  warning?: string;
}> {
  const client = db || getSupabaseAdmin().supabaseAdmin;
  if (!client) return { score: null, warning: 'No database' };

  const { data: lead, error: leadErr } = await client
    .from('service_leads')
    .select(
      `id, status, city, vehicle_make, vehicle_model, vehicle_number, problem_description,
       lead_priority, next_follow_up_at, last_call_at, total_calls, created_at, coupon_meta, is_incomplete`,
    )
    .eq('id', leadId)
    .maybeSingle();
  if (leadErr || !lead) return { score: null, warning: leadErr?.message || 'Lead not found' };

  const { data: callRows } = await client
    .from('telecaller_call_logs')
    .select('id, call_status, call_duration, created_at, outcome')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(20);
  const calls = Array.isArray(callRows) ? callRows : [];
  const recentIds = calls.slice(0, 5).map((r: any) => r.id).filter(Boolean);

  const { data: analysis } = recentIds.length
    ? await client
        .from('telecaller_call_analyses')
        .select('buying_intent, sop_audit, call_log_id, analyzed_at')
        .in('call_log_id', recentIds)
        .order('analyzed_at', { ascending: false })
        .limit(1)
    : { data: [] as any[] };

  const { data: dl } = await client
    .from('telecaller_call_dl')
    .select('emotion, voice_intent')
    .eq('lead_id', leadId)
    .order('processed_at', { ascending: false })
    .limit(1);

  const lastA = Array.isArray(analysis) ? analysis[0] : analysis;
  const lastDl = Array.isArray(dl) ? dl[0] : dl;
  const priors = await loadHourPriors(client);
  const score = computeScore({
    lead,
    calls,
    lastSopScore: lastA?.sop_audit?.overall_score ?? null,
    lastBuying: lastA?.buying_intent ?? null,
    lastEmotion: lastDl?.emotion ?? null,
    lastVoiceIntent: lastDl?.voice_intent ?? null,
    priors,
  });
  const saved = await persistLeadScore(client, score);
  return { score, warning: saved.warning };
}

export async function scoreOpenLeads(limit = 40): Promise<{ scored: number; warning?: string }> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { scored: 0, warning: 'No database' };
  const staleBefore = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  const { data: leads, error } = await supabaseAdmin
    .from('service_leads')
    .select(
      `id, status, city, vehicle_make, vehicle_model, vehicle_number, problem_description,
       lead_priority, next_follow_up_at, last_call_at, total_calls, created_at, coupon_meta, is_incomplete`,
    )
    .is('deleted_at', null)
    .not('status', 'ilike', '%LOST%')
    .not('status', 'ilike', '%SERVICE DONE%')
    .order('updated_at', { ascending: false })
    .limit(Math.min(120, Math.max(limit * 2, 20)));
  if (error) {
    if (/does not exist|schema cache|PGRST205|42P01/i.test(error.message || '')) {
      return { scored: 0, warning: 'Run database/354_crm_ml_dl_insights.sql' };
    }
    return { scored: 0, warning: error.message };
  }

  const ids = (leads || []).map((l: any) => l.id);
  const { data: existing } = ids.length
    ? await supabaseAdmin
        .from('telecaller_lead_scores')
        .select('lead_id, scored_at')
        .in('lead_id', ids)
    : { data: [] as any[] };
  const fresh = new Set(
    (existing || [])
      .filter((r: any) => String(r.scored_at || '') > staleBefore)
      .map((r: any) => String(r.lead_id)),
  );

  let scored = 0;
  for (const lead of leads || []) {
    if (scored >= limit) break;
    if (fresh.has(String(lead.id))) continue;
    const result = await scoreLeadById(String(lead.id), supabaseAdmin);
    if (result.score) scored += 1;
    else if (result.warning?.includes('354_')) return { scored, warning: result.warning };
  }
  return { scored };
}

export function mapScoreRowSafe(r: any): LeadMlScore {
  return mapScoreRow(r);
}
