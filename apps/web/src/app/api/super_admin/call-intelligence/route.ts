import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import {
  resolveReportDateRange,
  type ReportDatePreset,
} from '@/lib/report-date-range';
import {
  scoreAgentPerformance,
  type CallAnalysisResult,
} from '@/lib/telecaller/callIntelligence';
import {
  analyzeCallWithQueryResolution,
  deepAnalyzeWithOpenAI,
} from '@/lib/telecaller/callIntelligenceDeep';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

async function assertAdminOrManager(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { ok: false as const, status: 401, error: 'Unauthorized', supabase, db: null as any };
  }
  const profile = await resolveUserProfile(supabase, user);
  const roleCode = String((profile?.roles as any)?.role_code || '')
    .trim()
    .toUpperCase();
  if (!['SUPER_ADMIN', 'SUB_ADMIN', 'LEAD_MANAGER'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden', supabase, db: null as any };
  }
  const { supabaseAdmin } = getSupabaseAdmin();
  const db = supabaseAdmin ?? supabase;
  return { ok: true as const, status: 200, error: null, supabase, db, roleCode, profile };
}

function mapRow(r: any) {
  return {
    id: r.id,
    telecaller_id: r.telecaller_id,
    lead_id: r.lead_id,
    call_status: r.call_status,
    call_duration: r.call_duration,
    outcome: r.outcome,
    notes: r.notes,
    customer_response: r.customer_response,
    phone_number: r.phone_number,
    call_recording_url: r.call_recording_url,
    created_at: r.created_at,
    lead_status: r.lead?.status || null,
    lead_number: r.lead?.lead_number || null,
    customer_name: r.lead?.customer_name || null,
    problem_description: r.lead?.problem_description || null,
    service_type: r.lead?.service_type || null,
    telecaller_name: r.telecaller?.full_name || null,
  };
}

async function upsertAnalyses(db: any, analyses: CallAnalysisResult[]) {
  if (!analyses.length) return { ok: true, persisted: false };
  const payload = analyses.map((a) => ({
    call_log_id: a.call_log_id,
    sentiment: a.sentiment,
    sentiment_score: a.sentiment_score,
    conversation_tags: a.conversation_tags,
    quality_score: a.quality_score,
    quality_grade: a.quality_grade,
    quality_flags: a.quality_flags,
    speech_insights: a.speech_insights,
    summary: a.summary,
    buying_intent: a.buying_intent,
    customer_problem: a.customer_problem,
    customer_problem_categories: a.customer_problem_categories,
    agent_solution: a.agent_solution,
    solution_adequacy: a.solution_adequacy,
    solution_score: a.solution_score,
    coaching_tips: a.coaching_tips,
    query_resolutions: a.query_resolutions || [],
    overall_resolution: a.overall_resolution || null,
    queries_total: a.queries_total ?? null,
    queries_resolved: a.queries_resolved ?? null,
    queries_partial: a.queries_partial ?? null,
    queries_unresolved: a.queries_unresolved ?? null,
    resolution_score: a.resolution_score ?? a.solution_score,
    unresolved_gaps: a.unresolved_gaps || [],
    engine: a.engine,
    analyzed_at: a.analyzed_at,
    updated_at: new Date().toISOString(),
  }));
  let { error } = await db.from('telecaller_call_analyses').upsert(payload, {
    onConflict: 'call_log_id',
  });
  if (error && /query_resolutions|overall_resolution|unresolved_gaps|column/i.test(error.message || '')) {
    const mid = payload.map(
      ({
        query_resolutions,
        overall_resolution,
        queries_total,
        queries_resolved,
        queries_partial,
        queries_unresolved,
        resolution_score,
        unresolved_gaps,
        ...rest
      }) => rest,
    );
    const retry = await db.from('telecaller_call_analyses').upsert(mid, { onConflict: 'call_log_id' });
    error = retry.error;
    if (!error) {
      return {
        ok: true,
        persisted: true,
        warning: 'Run database/341_call_analyses_query_resolutions.sql to store per-query resolution',
      };
    }
  }
  // Older table without problem/solution columns — retry core fields
  if (error && /customer_problem|agent_solution|solution_adequacy|coaching_tips|column/i.test(error.message || '')) {
    const slim = payload.map(
      ({
        customer_problem,
        customer_problem_categories,
        agent_solution,
        solution_adequacy,
        solution_score,
        coaching_tips,
        query_resolutions,
        overall_resolution,
        queries_total,
        queries_resolved,
        queries_partial,
        queries_unresolved,
        resolution_score,
        unresolved_gaps,
        ...rest
      }) => rest,
    );
    const retry = await db.from('telecaller_call_analyses').upsert(slim, { onConflict: 'call_log_id' });
    error = retry.error;
    if (!error) {
      return {
        ok: true,
        persisted: true,
        warning: 'Run database/340 + 341 migrations to store problem/query fields',
      };
    }
  }
  if (error) {
    if (/does not exist|schema cache|PGRST205|42P01/i.test(error.message || '')) {
      return { ok: true, persisted: false, warning: 'Run database/339_telecaller_call_analyses.sql' };
    }
    return { ok: false, persisted: false, error: error.message };
  }
  return { ok: true, persisted: true };
}

/**
 * GET /api/super_admin/call-intelligence
 * Overview: call analytics + agent performance + sentiment mix (free heuristics).
 *
 * POST — analyze one or many call_log ids (or latest N in range).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await assertAdminOrManager(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { db } = auth;
    const sp = request.nextUrl.searchParams;
    const preset = (String(sp.get('preset') || 'last_7_days') as ReportDatePreset) || 'last_7_days';
    const range = resolveReportDateRange(
      preset,
      sp.get('start'),
      sp.get('end'),
    );
    const telecallerId = String(sp.get('telecaller_id') || '').trim();
    const limit = Math.min(3000, Math.max(100, Number(sp.get('limit') || 1500) || 1500));

    let q = db
      .from('telecaller_call_logs')
      .select(
        `
        id, telecaller_id, lead_id, call_status, call_duration, outcome, notes,
        customer_response, phone_number, call_recording_url, created_at,
        lead:service_leads!lead_id(id, lead_number, customer_name, status, problem_description, service_type),
        telecaller:telecaller_id(id, full_name)
      `,
      )
      .gte('created_at', range.start)
      .lte('created_at', range.end)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (telecallerId) q = q.eq('telecaller_id', telecallerId);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (Array.isArray(data) ? data : []).map(mapRow);
    const analyses = rows.map((r) =>
      analyzeCallWithQueryResolution({
        id: r.id,
        call_status: r.call_status,
        call_duration: r.call_duration,
        outcome: r.outcome,
        notes: r.notes,
        customer_response: r.customer_response,
        lead_id: r.lead_id,
        call_recording_url: r.call_recording_url,
        phone_number: r.phone_number,
        created_at: r.created_at,
        lead_status: r.lead_status,
        problem_description: r.problem_description,
        service_type: r.service_type,
      }),
    );

    // Persist in background-ish (await for consistency)
    const persist = await upsertAnalyses(db, analyses);

    let total = 0;
    let answered = 0;
    let talk = 0;
    let withRecording = 0;
    let withNotes = 0;
    let shortCalls = 0;
    let solutionProper = 0;
    let solutionPartial = 0;
    let solutionMissing = 0;
    let queriesResolvedSum = 0;
    let queriesTotalSum = 0;
    let fullyResolvedCalls = 0;
    let notResolvedCalls = 0;
    const statusMix: Record<string, number> = {};
    const sentimentMix: Record<string, number> = {};
    const tagMix: Record<string, number> = {};
    const intentMix: Record<string, number> = {};
    const problemCatMix: Record<string, number> = {};
    const solutionMix: Record<string, number> = {};
    const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0, talk: 0 }));
    const byAgent = new Map<string, { name: string; calls: typeof rows; analyses: CallAnalysisResult[] }>();

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const a = analyses[i];
      total += 1;
      const st = String(r.call_status || 'UNKNOWN').toUpperCase();
      statusMix[st] = (statusMix[st] || 0) + 1;
      sentimentMix[a.sentiment] = (sentimentMix[a.sentiment] || 0) + 1;
      intentMix[a.buying_intent] = (intentMix[a.buying_intent] || 0) + 1;
      solutionMix[a.solution_adequacy] = (solutionMix[a.solution_adequacy] || 0) + 1;
      if (a.solution_adequacy === 'PROPER') solutionProper += 1;
      if (a.solution_adequacy === 'PARTIAL') solutionPartial += 1;
      if (a.solution_adequacy === 'MISSING') solutionMissing += 1;
      queriesResolvedSum += Number(a.queries_resolved) || 0;
      queriesTotalSum += Number(a.queries_total) || 0;
      if (a.overall_resolution === 'FULLY_RESOLVED') fullyResolvedCalls += 1;
      if (a.overall_resolution === 'NOT_RESOLVED') notResolvedCalls += 1;
      for (const t of a.conversation_tags) {
        tagMix[t] = (tagMix[t] || 0) + 1;
      }
      for (const c of a.customer_problem_categories || []) {
        problemCatMix[c] = (problemCatMix[c] || 0) + 1;
      }

      const dur = Number(r.call_duration) || 0;
      const isAns =
        st === 'ANSWERED' || st === 'COMPLETED' || st === 'CONNECTED' || dur > 0;
      if (isAns) {
        answered += 1;
        talk += dur;
        if (dur > 0 && dur < 15) shortCalls += 1;
      }
      if (String(r.call_recording_url || '').trim()) withRecording += 1;
      if (String(r.notes || '').replace(/Recording synced\.?/gi, '').trim().length >= 12) {
        withNotes += 1;
      }

      if (r.created_at) {
        const at = new Date(r.created_at);
        if (Number.isFinite(at.getTime())) {
          const istMs = at.getTime() + 5.5 * 60 * 60 * 1000;
          const h = new Date(istMs).getUTCHours();
          hourly[h].count += 1;
          hourly[h].talk += dur;
        }
      }

      const aid = String(r.telecaller_id || 'unknown');
      const bucket = byAgent.get(aid) || {
        name: r.telecaller_name || 'Unknown',
        calls: [],
        analyses: [],
      };
      bucket.calls.push(r);
      bucket.analyses.push(a);
      byAgent.set(aid, bucket);
    }

    const agents = Array.from(byAgent.entries())
      .map(([id, b]) =>
        scoreAgentPerformance({
          telecaller_id: id,
          telecaller_name: b.name,
          calls: b.calls,
          analyses: b.analyses,
        }),
      )
      .sort((a, b) => b.performance_score - a.performance_score);

    const qualityAvg = analyses.length
      ? Math.round(analyses.reduce((s, a) => s + a.quality_score, 0) / analyses.length)
      : 0;

    const enrich = (a: CallAnalysisResult) => {
      const row = rows.find((r) => r.id === a.call_log_id);
      return {
        ...a,
        telecaller_id: row?.telecaller_id || null,
        customer_name: row?.customer_name || null,
        phone_number: row?.phone_number || null,
        telecaller_name: row?.telecaller_name || null,
        lead_number: row?.lead_number || null,
        lead_id: row?.lead_id || null,
        created_at: row?.created_at || null,
        call_duration: row?.call_duration ?? null,
        call_status: row?.call_status || null,
        has_recording: Boolean(String(row?.call_recording_url || '').trim()),
        notes: row?.notes || null,
      };
    };

    const calls = analyses.map(enrich);

    const topIssues = calls
      .filter(
        (a) =>
          a.quality_score < 55 ||
          a.sentiment === 'ANGRY' ||
          a.solution_adequacy === 'MISSING' ||
          a.solution_adequacy === 'PARTIAL' ||
          a.overall_resolution === 'NOT_RESOLVED' ||
          a.overall_resolution === 'PARTIALLY_RESOLVED',
      )
      .slice(0, 200);

    const recent = calls.slice(0, 200);

    // Optional agent detail payload (same scan, filtered)
    let agent_detail: any = null;
    if (telecallerId && byAgent.has(telecallerId)) {
      const bucket = byAgent.get(telecallerId)!;
      const agentScore = scoreAgentPerformance({
        telecaller_id: telecallerId,
        telecaller_name: bucket.name,
        calls: bucket.calls,
        analyses: bucket.analyses,
      });
      const agentCalls = calls.filter((c) => String(c.telecaller_id) === telecallerId);
      const resMix: Record<string, number> = {};
      const probMix: Record<string, number> = {};
      const tips: string[] = [];
      for (const c of agentCalls) {
        const key = String(c.overall_resolution || c.solution_adequacy || 'UNKNOWN');
        resMix[key] = (resMix[key] || 0) + 1;
        for (const p of c.customer_problem_categories || []) {
          probMix[p] = (probMix[p] || 0) + 1;
        }
        for (const t of c.coaching_tips || []) tips.push(t);
      }
      const tipCounts = new Map<string, number>();
      for (const t of tips) tipCounts.set(t, (tipCounts.get(t) || 0) + 1);
      agent_detail = {
        agent: agentScore,
        resolution_mix: resMix,
        problem_category_mix: probMix,
        top_coaching_tips: Array.from(tipCounts.entries())
          .sort((x, y) => y[1] - x[1])
          .slice(0, 8)
          .map(([tip, count]) => ({ tip, count })),
        calls: agentCalls,
        total_calls: agentCalls.length,
      };
    }

    return NextResponse.json({
      success: true,
      free: true,
      engine: 'free_query_v2',
      note:
        'Free multi-query resolution from call notes + metadata. Deep AI is on-demand only.',
      range_label: range.label,
      preset: range.preset,
      persisted: persist.persisted,
      persist_warning: (persist as any).warning || null,
      scanned: total,
      analytics: {
        total_calls: total,
        answered,
        connect_rate: total ? answered / total : 0,
        talk_seconds: talk,
        avg_talk: answered ? talk / answered : 0,
        with_recording: withRecording,
        recording_rate: total ? withRecording / total : 0,
        with_notes: withNotes,
        notes_rate: total ? withNotes / total : 0,
        short_calls: shortCalls,
        quality_avg: qualityAvg,
        solution_proper: solutionProper,
        solution_partial: solutionPartial,
        solution_missing: solutionMissing,
        queries_resolved_sum: queriesResolvedSum,
        queries_total_sum: queriesTotalSum,
        query_resolve_rate: queriesTotalSum ? queriesResolvedSum / queriesTotalSum : 0,
        fully_resolved_calls: fullyResolvedCalls,
        not_resolved_calls: notResolvedCalls,
        status_mix: statusMix,
        sentiment_mix: sentimentMix,
        tag_mix: tagMix,
        intent_mix: intentMix,
        problem_category_mix: problemCatMix,
        solution_mix: solutionMix,
        hourly,
      },
      agents,
      calls,
      top_issues: topIssues,
      recent,
      agent_detail,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await assertAdminOrManager(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { db } = auth;
    const body = await request.json().catch(() => ({}));
    const deep = Boolean(body?.deep);
    const ids = Array.isArray(body?.ids)
      ? body.ids.map((x: any) => String(x || '').trim()).filter(Boolean).slice(0, deep ? 20 : 200)
      : [];
    const callLogId = String(body?.call_log_id || '').trim();
    if (callLogId) ids.push(callLogId);
    const uniqueIds = Array.from(new Set(ids));
    if (!uniqueIds.length) {
      return NextResponse.json({ error: 'call_log_id or ids required' }, { status: 400 });
    }

    const { data, error } = await db
      .from('telecaller_call_logs')
      .select(
        `
        id, telecaller_id, lead_id, call_status, call_duration, outcome, notes,
        customer_response, phone_number, call_recording_url, created_at,
        lead:service_leads!lead_id(id, lead_number, customer_name, status, problem_description, service_type),
        telecaller:telecaller_id(id, full_name)
      `,
      )
      .in('id', uniqueIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (Array.isArray(data) ? data : []).map(mapRow);
    const analyses: CallAnalysisResult[] = [];
    const warnings: string[] = [];
    let usedOpenai = 0;

    for (const r of rows) {
      const input = {
        id: r.id,
        call_status: r.call_status,
        call_duration: r.call_duration,
        outcome: r.outcome,
        notes: r.notes,
        customer_response: r.customer_response,
        lead_id: r.lead_id,
        call_recording_url: r.call_recording_url,
        phone_number: r.phone_number,
        created_at: r.created_at,
        lead_status: r.lead_status,
        problem_description: r.problem_description,
        service_type: r.service_type,
      };
      if (deep) {
        const result = await deepAnalyzeWithOpenAI(input);
        analyses.push(result.analysis);
        if (result.used_openai) usedOpenai += 1;
        if (result.warning) warnings.push(result.warning);
      } else {
        analyses.push(analyzeCallWithQueryResolution(input));
      }
    }

    const persist = await upsertAnalyses(db, analyses);

    return NextResponse.json({
      success: true,
      free: !deep || usedOpenai === 0,
      deep,
      used_openai: usedOpenai,
      engine: deep ? (usedOpenai ? 'openai_deep_v1' : 'free_query_v2') : 'free_query_v2',
      persisted: persist.persisted,
      persist_warning: (persist as any).warning || null,
      warnings: warnings.slice(0, 5),
      analyses: analyses.map((a) => {
        const row = rows.find((r) => r.id === a.call_log_id);
        return {
          ...a,
          customer_name: row?.customer_name || null,
          telecaller_name: row?.telecaller_name || null,
          lead_number: row?.lead_number || null,
          phone_number: row?.phone_number || null,
        };
      }),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
