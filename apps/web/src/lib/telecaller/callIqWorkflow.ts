/**
 * Auto Call IQ: every connected recording is audited (Deep AI when possible).
 * Lead-status / 90s flowchart gates no longer skip a real conversation.
 */

import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { analyzeCallWithQueryResolution } from '@/lib/telecaller/callIntelligenceDeep';
import { analyzeSopFree, analyzeSopWithOpenAI, attachSopToAnalysis } from '@/lib/telecaller/callIqSop';
import { attachTranscriptToSopInput } from '@/lib/telecaller/callIqTranscript';
import { loadSalesPlaybook } from '@/lib/telecaller/loadSalesPlaybook';
import {
  listCallIqWorkflows,
  mergeCallIqWorkflow,
  type CallIqNamedWorkflow,
  type SalesPlaybook,
} from '@/lib/telecaller/salesPlaybookDefaults';
import type { CallAnalysisResult } from '@/lib/telecaller/callIntelligence';

export {
  mergeCallIqWorkflow,
  defaultCallIqWorkflow,
  listCallIqWorkflows,
  persistCallIqWorkflows,
  DEFAULT_CALL_IQ_LEAD_STATUSES,
} from '@/lib/telecaller/salesPlaybookDefaults';
export type { CallIqWorkflowConfig, CallIqNamedWorkflow } from '@/lib/telecaller/salesPlaybookDefaults';

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
  const store = mergeCallIqWorkflow((playbook as any).call_iq_workflow);
  const enabledFlows = listCallIqWorkflows(store);
  const cfg = enabledFlows.find((w) => w.enabled) || enabledFlows[0];
  if (!cfg) {
    return { ran: false, skipped: 'no_workflow', call_log_id: id };
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
  const status = String(log.call_status || '').toUpperCase();
  const answered =
    duration > 0 ||
    status === 'ANSWERED' ||
    status === 'COMPLETED' ||
    status === 'CONNECTED';
  if (!answered) return { ran: false, skipped: 'not_connected', call_log_id: id };

  const lead = Array.isArray(log.lead) ? log.lead[0] : log.lead;

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

  const allowDeep =
    opts?.allowDeep !== false &&
    cfg.use_deep_ai !== false &&
    Boolean(recording) &&
    duration >= 15;
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

/** Backstop: connected recordings that never got Deep SOP. */
export async function sweepCallIqWorkflow(limit = 8): Promise<{ scanned: number; ran: number; skipped: number }> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { scanned: 0, ran: 0, skipped: 0 };
  const playbook = await loadSalesPlaybook(supabaseAdmin);

  const { data: logs } = await supabaseAdmin
    .from('telecaller_call_logs')
    .select('id, call_duration, call_recording_url')
    .not('call_recording_url', 'is', null)
    .neq('call_recording_url', '')
    .gte('call_duration', 15)
    .order('created_at', { ascending: false })
    .limit(80);

  const rows = Array.isArray(logs) ? logs : [];
  const ids = rows.map((r: any) => String(r.id)).filter(Boolean);
  const done = new Set<string>();
  if (ids.length) {
    const { data: existing } = await supabaseAdmin
      .from('telecaller_call_analyses')
      .select('call_log_id, engine, sop_audit')
      .in('call_log_id', ids);
    for (const row of Array.isArray(existing) ? existing : []) {
      const engine = String(row?.engine || row?.sop_audit?.engine || '');
      if (engine.includes('openai_sop') || engine.includes('openai_deep')) {
        done.add(String(row.call_log_id));
      }
    }
  }

  let ran = 0;
  let skipped = 0;
  for (const row of rows) {
    if (ran >= limit) break;
    const id = String(row.id);
    if (done.has(id)) {
      skipped += 1;
      continue;
    }
    const result = await runCallIqOnRecordingCompleted(id, {
      allowDeep: true,
      playbook,
    });
    if (result.ran) ran += 1;
    else skipped += 1;
  }
  return { scanned: rows.length, ran, skipped };
}
