/**
 * TeleCRM-style Call IQ flowchart:
 * On call recording completed → Check If Lead (status) → duration >= 90s → Call Audit SOP
 */

import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { analyzeCallWithQueryResolution } from '@/lib/telecaller/callIntelligenceDeep';
import { analyzeSopFree, analyzeSopWithOpenAI, attachSopToAnalysis } from '@/lib/telecaller/callIqSop';
import { attachTranscriptToSopInput } from '@/lib/telecaller/callIqTranscript';
import { loadSalesPlaybook } from '@/lib/telecaller/loadSalesPlaybook';
import {
  mergeCallIqWorkflow,
  type SalesPlaybook,
  type CallIqWorkflowConfig,
} from '@/lib/telecaller/salesPlaybookDefaults';
import type { CallAnalysisResult } from '@/lib/telecaller/callIntelligence';

export { mergeCallIqWorkflow, defaultCallIqWorkflow, DEFAULT_CALL_IQ_LEAD_STATUSES } from '@/lib/telecaller/salesPlaybookDefaults';
export type { CallIqWorkflowConfig } from '@/lib/telecaller/salesPlaybookDefaults';

function normStatus(s?: string | null) {
  return String(s || '')
    .toUpperCase()
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STATUS_ALIASES: Record<string, string[]> = {
  FRESH: ['FRESH', 'NEW', 'INCOMPLETE'],
  INTERESTED: ['INTERESTED'],
  'HE WILL VISIT': ['HE WILL VISIT', 'WILL VISIT', 'WILL_VISIT'],
  'FOLLOW-UP': ['FOLLOW-UP', 'FOLLOW UP', 'CALLBACK'],
  'BOOKING CONFIRMED': ['BOOKING CONFIRMED', 'VALIDATED'],
  'IN SERVICE': ['IN SERVICE', 'IN_PROGRESS'],
  'SERVICE DONE': ['SERVICE DONE', 'COMPLETED'],
  LOST: ['LOST', 'REJECTED'],
  RINGING: ['RINGING', 'RINGING / NO ANSWER', 'NO ANSWER'],
};

function expandAllowed(statuses: string[]) {
  const out = new Set<string>();
  for (const raw of statuses) {
    const n = normStatus(raw);
    out.add(n);
    for (const [key, aliases] of Object.entries(STATUS_ALIASES)) {
      if (n === key || aliases.includes(n) || n.includes(key) || key.includes(n)) {
        aliases.forEach((a) => out.add(a));
        out.add(key);
      }
    }
  }
  return out;
}

function leadMatchesWorkflow(lead: any, cfg: CallIqWorkflowConfig): boolean {
  if (!cfg.lead_statuses.length) return true;
  const allowed = expandAllowed(cfg.lead_statuses);
  const candidates = [
    lead?.status,
    lead?.coupon_meta?.last_call_result,
    lead?.coupon_meta?.last_call_label,
  ].map(normStatus).filter(Boolean);
  if (!candidates.length) return allowed.has('FRESH') || allowed.has('NEW');
  return candidates.some((c) => {
    if (allowed.has(c)) return true;
    for (const a of allowed) {
      if (c.includes(a) || a.includes(c)) return true;
    }
    return false;
  });
}

async function persistAnalysis(db: any, analysis: CallAnalysisResult, trigger: string) {
  const payload = {
    call_log_id: analysis.call_log_id,
    sentiment: analysis.sentiment,
    sentiment_score: analysis.sentiment_score,
    conversation_tags: analysis.conversation_tags,
    quality_score: analysis.quality_score,
    quality_grade: analysis.quality_grade,
    quality_flags: analysis.quality_flags,
    speech_insights: analysis.speech_insights,
    summary: analysis.summary,
    buying_intent: analysis.buying_intent,
    customer_problem: analysis.customer_problem,
    customer_problem_categories: analysis.customer_problem_categories,
    agent_solution: analysis.agent_solution,
    solution_adequacy: analysis.solution_adequacy,
    solution_score: analysis.solution_score,
    coaching_tips: analysis.coaching_tips,
    query_resolutions: analysis.query_resolutions || [],
    overall_resolution: analysis.overall_resolution || null,
    queries_total: analysis.queries_total ?? null,
    queries_resolved: analysis.queries_resolved ?? null,
    queries_partial: analysis.queries_partial ?? null,
    queries_unresolved: analysis.queries_unresolved ?? null,
    resolution_score: analysis.resolution_score ?? analysis.solution_score,
    unresolved_gaps: analysis.unresolved_gaps || [],
    sop_audit: analysis.sop_audit || null,
    engine: analysis.engine,
    analyzed_at: analysis.analyzed_at,
    workflow_run_at: new Date().toISOString(),
    workflow_trigger: trigger,
    updated_at: new Date().toISOString(),
  };
  let { error } = await db.from('telecaller_call_analyses').upsert(payload, { onConflict: 'call_log_id' });
  if (error && /workflow_run_at|workflow_trigger/i.test(error.message || '')) {
    const { workflow_run_at, workflow_trigger, ...rest } = payload;
    const retry = await db.from('telecaller_call_analyses').upsert(rest, { onConflict: 'call_log_id' });
    error = retry.error;
  }
  if (error && /sop_audit/i.test(error.message || '')) {
    const { sop_audit, ...rest } = payload;
    await db.from('telecaller_call_analyses').upsert(rest, { onConflict: 'call_log_id' });
  }
}

export type CallIqWorkflowResult = {
  ran: boolean;
  skipped?: string;
  deep?: boolean;
  call_log_id: string;
  score?: number;
};

export async function runCallIqOnRecordingCompleted(
  callLogId: string,
  opts?: { allowDeep?: boolean; playbook?: SalesPlaybook | null },
): Promise<CallIqWorkflowResult> {
  const id = String(callLogId || '').trim();
  if (!id) return { ran: false, skipped: 'no_id', call_log_id: '' };

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { ran: false, skipped: 'no_db', call_log_id: id };
  const db = supabaseAdmin;

  const playbook = opts?.playbook || (await loadSalesPlaybook(db));
  const cfg = mergeCallIqWorkflow((playbook as any).call_iq_workflow);
  if (!playbook.call_iq_enabled || !cfg.enabled) {
    return { ran: false, skipped: 'disabled', call_log_id: id };
  }

  const { data: log, error } = await db
    .from('telecaller_call_logs')
    .select(
      `
      id, telecaller_id, lead_id, call_status, call_duration, outcome, notes,
      customer_response, phone_number, call_recording_url, created_at,
      lead:service_leads!lead_id(
        id, status, problem_description, service_type, lead_source,
        vehicle_number, vehicle_make, vehicle_model, city, coupon_meta
      )
    `,
    )
    .eq('id', id)
    .maybeSingle();
  if (error || !log) return { ran: false, skipped: 'log_missing', call_log_id: id };

  const recording = String(log.call_recording_url || '').trim();
  if (!recording) return { ran: false, skipped: 'no_recording', call_log_id: id };

  const duration = Number(log.call_duration) || 0;
  if (duration < cfg.min_duration_sec) {
    return { ran: false, skipped: `duration_${duration}_lt_${cfg.min_duration_sec}`, call_log_id: id };
  }

  const lead = Array.isArray(log.lead) ? log.lead[0] : log.lead;
  if (!lead?.id) return { ran: false, skipped: 'not_a_lead', call_log_id: id };
  if (!leadMatchesWorkflow(lead, cfg)) {
    return { ran: false, skipped: 'lead_status_filtered', call_log_id: id };
  }

  let existingTranscript: string | null = null;
  const { data: existing } = await db
    .from('telecaller_call_analyses')
    .select('id, sop_audit, engine')
    .eq('call_log_id', id)
    .maybeSingle();
  existingTranscript = String(existing?.sop_audit?.call_transcript || '').trim() || null;
  if (cfg.skip_if_sop_exists) {
    const engine = String(existing?.engine || existing?.sop_audit?.engine || '');
    if (engine.includes('openai_sop') || engine.includes('openai_deep')) {
      return { ran: false, skipped: 'already_audited', call_log_id: id };
    }
  }

  const input = {
    id: String(log.id),
    call_status: log.call_status,
    call_duration: log.call_duration,
    outcome: log.outcome,
    notes: log.notes,
    customer_response: log.customer_response,
    lead_id: log.lead_id,
    call_recording_url: log.call_recording_url,
    phone_number: log.phone_number,
    created_at: log.created_at,
    lead_status: lead?.status || null,
    problem_description: lead?.problem_description || null,
    service_type: lead?.service_type || null,
    lead_source: lead?.lead_source || null,
    vehicle_number: lead?.vehicle_number || null,
    vehicle_make: lead?.vehicle_make || null,
    vehicle_model: lead?.vehicle_model || null,
    city: lead?.city || null,
  };

  const allowDeep = opts?.allowDeep !== false && cfg.use_deep_ai && Boolean(recording);
  let hydrated = input;
  if (allowDeep) {
    const attached = await attachTranscriptToSopInput(input, recording, existingTranscript);
    hydrated = attached.input;
  }
  let analysis = attachSopToAnalysis(analyzeCallWithQueryResolution(hydrated), analyzeSopFree(hydrated));
  let deep = false;
  if (allowDeep) {
    const sop = await analyzeSopWithOpenAI(hydrated, playbook);
    analysis = attachSopToAnalysis(analyzeCallWithQueryResolution(hydrated), sop.sop);
    deep = sop.used_openai;
  }
  await persistAnalysis(db, analysis, 'recording_completed');
  return {
    ran: true,
    deep,
    call_log_id: id,
    score: analysis.sop_audit?.overall_score,
  };
}

/** Fire from recording attach without blocking the webhook/cron too long. */
export function enqueueCallIqOnRecordingCompleted(callLogId: string, allowDeep = true) {
  void runCallIqOnRecordingCompleted(callLogId, { allowDeep }).catch((e) => {
    console.warn('[callIqWorkflow]', e?.message || e);
  });
}

/** Backstop: recordings that passed filters but never got SOP. */
export async function sweepCallIqWorkflow(limit = 6): Promise<{ scanned: number; ran: number; skipped: number }> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { scanned: 0, ran: 0, skipped: 0 };
  const playbook = await loadSalesPlaybook(supabaseAdmin);
  const cfg = mergeCallIqWorkflow((playbook as any).call_iq_workflow);
  if (!playbook.call_iq_enabled || !cfg.enabled) return { scanned: 0, ran: 0, skipped: 0 };

  const { data: logs } = await supabaseAdmin
    .from('telecaller_call_logs')
    .select('id, call_duration, call_recording_url, lead_id')
    .not('call_recording_url', 'is', null)
    .neq('call_recording_url', '')
    .gte('call_duration', cfg.min_duration_sec)
    .not('lead_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(40);

  const rows = Array.isArray(logs) ? logs : [];
  let ran = 0;
  let skipped = 0;
  for (const row of rows) {
    if (ran >= limit) break;
    const result = await runCallIqOnRecordingCompleted(String(row.id), {
      allowDeep: true,
      playbook,
    });
    if (result.ran) ran += 1;
    else skipped += 1;
  }
  return { scanned: rows.length, ran, skipped };
}
