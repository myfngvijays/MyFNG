/**
 * Deep call query-resolution analysis.
 * - Free path: structured multi-query extraction from notes
 * - Deep path (on-demand): OpenAI JSON reasoning over notes/lead context
 *   (no auto speech-to-text — avoids SARV-style cost burn)
 */

import type {
  AnalyzeCallInput,
  CallAnalysisResult,
  SolutionAdequacy,
} from '@/lib/telecaller/callIntelligence';
import { analyzeCallRecording, extractProblemAndSolution } from '@/lib/telecaller/callIntelligence';

export type QueryResolutionStatus = 'RESOLVED' | 'PARTIAL' | 'UNRESOLVED' | 'UNKNOWN';

export type QueryResolutionItem = {
  id: string;
  query: string;
  agent_answer: string | null;
  resolution: QueryResolutionStatus;
  evidence: string | null;
  gap: string | null;
};

export type OverallResolution =
  | 'FULLY_RESOLVED'
  | 'PARTIALLY_RESOLVED'
  | 'NOT_RESOLVED'
  | 'NOT_APPLICABLE'
  | 'UNKNOWN';

export type DeepResolutionResult = {
  queries: QueryResolutionItem[];
  overall_resolution: OverallResolution;
  queries_total: number;
  queries_resolved: number;
  queries_partial: number;
  queries_unresolved: number;
  resolution_score: number;
  customer_problem_summary: string | null;
  agent_handling_summary: string | null;
  unresolved_gaps: string[];
  coaching_tips: string[];
  engine: 'free_query_v2' | 'openai_deep_v1';
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_CALL_INTEL_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

function clean(raw?: string | null) {
  return String(raw || '')
    .replace(/\[Smartflo\]\s*/gi, '')
    .replace(/\bSmartflo\b/gi, '')
    .replace(/Recording synced\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function clip(s: string, n = 160) {
  const t = s.trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

/** Topic packs: customer asks X → agent should cover Y */
const QUERY_TOPICS: Array<{
  id: string;
  queryLabel: string;
  ask: RegExp;
  answer: RegExp;
  gapIfMissing: string;
}> = [
  {
    id: 'price',
    queryLabel: 'Price / charges kitna lagenge?',
    ask: /\b(price|kitna|cost|charge|rate|budget|mehnga|expensive|estimate|quote)\b/i,
    answer: /\b(₹|rs\.?|rupees|\d{3,5}|approx|lagbhag|estimate|quote|package|discount|offer|bataya|bataye)\b/i,
    gapIfMissing: 'Price/estimate clearly nahi diya',
  },
  {
    id: 'slot',
    queryLabel: 'Kab aana hai / slot time?',
    ask: /\b(kab|when|time|slot|date|kal|aaj|morning|evening|shaam|subah|available)\b/i,
    answer: /\b(slot|book(ed|ing)?|confirm(ed)?|\d{1,2}\s*(am|pm|:)|kal|aaj|morning|evening|appointment)\b/i,
    gapIfMissing: 'Concrete date/time slot confirm nahi hua',
  },
  {
    id: 'workshop',
    queryLabel: 'Kaunsa workshop / kahan le jaayein?',
    ask: /\b(workshop|where|kahan|location|address|branch|centre|center|near)\b/i,
    answer: /\b(workshop|branch|address|location|map|near|pincode|ghatkopar|andheri|thane|borivali|visit)\b/i,
    gapIfMissing: 'Workshop/location clear nahi bataaya',
  },
  {
    id: 'pickup',
    queryLabel: 'Pickup / drop milega?',
    ask: /\b(pickup|pick up|drop|doorstep|ghar se|tow)\b/i,
    answer: /\b(pickup|pick up|drop|arrange|available|nahi|yes|haan|doorstep)\b/i,
    gapIfMissing: 'Pickup/drop haan/na clear nahi',
  },
  {
    id: 'issue_fix',
    queryLabel: 'Car problem ka solution kya hoga?',
    ask: /\b(problem|issue|noise|ac|brake|engine|battery|leak|service|repair|kharaab|not working|thanda|start)\b/i,
    answer: /\b(check|diagnose|inspection|repair|replace|service|oil|gas|pad|solve|dekhenge|fix|free checkup)\b/i,
    gapIfMissing: 'Problem pe technical/next-step solution missing',
  },
  {
    id: 'duration',
    queryLabel: 'Kitna time lagega / ETA?',
    ask: /\b(kitna time|how long|eta|duration|kab tak|same day|kitne din)\b/i,
    answer: /\b(\d+\s*(hour|hr|min|day|din)|same day|next day|eta|lagbhag|approx)\b/i,
    gapIfMissing: 'ETA / duration clear nahi',
  },
  {
    id: 'warranty',
    queryLabel: 'Warranty / guarantee?',
    ask: /\b(warranty|guarantee|warrenty|guarantee)\b/i,
    answer: /\b(warranty|guarantee|months|days|covered|applicable)\b/i,
    gapIfMissing: 'Warranty answer missing',
  },
  {
    id: 'callback',
    queryLabel: 'Phir call / follow-up?',
    ask: /\b(callback|call back|phir call|baad mein|follow)\b/i,
    answer: /\b(callback|call back|kal call|shaam|follow[- ]?up|ring)\b/i,
    gapIfMissing: 'Follow-up time commit nahi hua',
  },
];

function splitNoteChunks(text: string): string[] {
  return text
    .split(/(?:\n+|·|\||;+(?=\s)|(?<=\d)[.)]\s+|(?:\?\s*)|(?:\.\s+(?=[A-Z0-9]))+)/)
    .map((c) => c.trim())
    .filter((c) => c.length >= 6);
}

/**
 * Free deep-ish: detect each customer query topic and whether notes show an answer.
 */
export function extractQueryResolutionsFree(input: AnalyzeCallInput & { answered: boolean }): DeepResolutionResult {
  const notes = clean(input.notes);
  const response = clean(input.customer_response);
  const leadProblem = clean(input.problem_description);
  const outcome = clean(input.outcome);
  const blob = [leadProblem, response, notes, outcome, clean(input.service_type)].filter(Boolean).join('\n');

  const tips: string[] = [];
  const gaps: string[] = [];
  const queries: QueryResolutionItem[] = [];

  if (!input.answered) {
    return {
      queries: [
        {
          id: 'q0',
          query: 'Call not connected',
          agent_answer: null,
          resolution: 'UNKNOWN',
          evidence: null,
          gap: 'Customer queries capture nahi ho sake',
        },
      ],
      overall_resolution: 'NOT_APPLICABLE',
      queries_total: 0,
      queries_resolved: 0,
      queries_partial: 0,
      queries_unresolved: 0,
      resolution_score: 50,
      customer_problem_summary: 'No connect',
      agent_handling_summary: null,
      unresolved_gaps: ['Reconnect and document every customer question'],
      coaching_tips: ['Valid number pe dubara try + notes mein Q→A format likho'],
      engine: 'free_query_v2',
    };
  }

  // Topic-based queries that appear in text
  for (const topic of QUERY_TOPICS) {
    if (!topic.ask.test(blob)) continue;
    const answeredOk = topic.answer.test(blob);
    const chunks = splitNoteChunks(blob);
    const askChunk = chunks.find((c) => topic.ask.test(c)) || topic.queryLabel;
    const ansChunk = chunks.find((c) => topic.answer.test(c)) || null;

    let resolution: QueryResolutionStatus = 'UNRESOLVED';
    if (answeredOk && ansChunk && ansChunk !== askChunk) resolution = 'RESOLVED';
    else if (answeredOk) resolution = 'PARTIAL';
    else {
      gaps.push(topic.gapIfMissing);
      tips.push(topic.gapIfMissing);
    }

    queries.push({
      id: topic.id,
      query: clip(askChunk, 120),
      agent_answer: ansChunk ? clip(ansChunk, 140) : answeredOk ? 'Answer signal found (details thin)' : null,
      resolution,
      evidence: answeredOk ? clip(ansChunk || blob, 100) : null,
      gap: answeredOk ? null : topic.gapIfMissing,
    });
  }

  // Explicit question marks / "pucha" lines as extra queries
  const qLines = splitNoteChunks(blob).filter((c) =>
    /\?|pucha|poocha|customer (bola|asked|want|chahiye|kehta)|woh puch/i.test(c),
  );
  for (let i = 0; i < qLines.length && queries.length < 10; i++) {
    const line = qLines[i];
    if (queries.some((q) => q.query.includes(line.slice(0, 40)))) continue;
    // Find a nearby answer-ish line
    const idx = splitNoteChunks(blob).indexOf(line);
    const neighbors = splitNoteChunks(blob).slice(idx + 1, idx + 3);
    const ans =
      neighbors.find((n) =>
        /\b(bataya|bola|offered|confirm|book|slot|₹|rs|workshop|haan|yes|nahi|solve|check)\b/i.test(n),
      ) || null;
    const resolution: QueryResolutionStatus = ans ? 'PARTIAL' : 'UNRESOLVED';
    if (!ans) {
      gaps.push(`Open question not answered in notes: ${clip(line, 60)}`);
      tips.push(`Is question ka clear answer notes mein likho: “${clip(line, 50)}”`);
    }
    queries.push({
      id: `line_${i}`,
      query: clip(line, 120),
      agent_answer: ans ? clip(ans, 140) : null,
      resolution,
      evidence: ans,
      gap: ans ? null : 'No matching answer line after this question',
    });
  }

  // If still empty, fall back to problem/solution pair as single query
  if (!queries.length) {
    const ps = extractProblemAndSolution({
      notes: input.notes,
      customer_response: input.customer_response,
      outcome: input.outcome,
      problem_description: input.problem_description,
      service_type: input.service_type,
      lead_status: input.lead_status,
      answered: true,
      durationSec: Number(input.call_duration) || 0,
    });
    const resolution: QueryResolutionStatus =
      ps.solution_adequacy === 'PROPER'
        ? 'RESOLVED'
        : ps.solution_adequacy === 'PARTIAL'
          ? 'PARTIAL'
          : ps.solution_adequacy === 'MISSING'
            ? 'UNRESOLVED'
            : 'UNKNOWN';
    queries.push({
      id: 'main',
      query: ps.customer_problem || 'Customer need / issue (not detailed)',
      agent_answer: ps.agent_solution,
      resolution,
      evidence: ps.agent_solution,
      gap: ps.coaching_tips[0] || null,
    });
    tips.push(...ps.coaching_tips);
    if (ps.solution_adequacy === 'MISSING') gaps.push('Main customer need unresolved in notes');
  }

  const queries_resolved = queries.filter((q) => q.resolution === 'RESOLVED').length;
  const queries_partial = queries.filter((q) => q.resolution === 'PARTIAL').length;
  const queries_unresolved = queries.filter((q) => q.resolution === 'UNRESOLVED').length;
  const queries_total = queries.length;

  let overall_resolution: OverallResolution = 'UNKNOWN';
  if (queries_total === 0) overall_resolution = 'UNKNOWN';
  else if (queries_unresolved === 0 && queries_partial === 0) overall_resolution = 'FULLY_RESOLVED';
  else if (queries_resolved === 0 && queries_partial === 0) overall_resolution = 'NOT_RESOLVED';
  else overall_resolution = 'PARTIALLY_RESOLVED';

  const resolution_score = Math.round(
    queries_total
      ? ((queries_resolved * 100 + queries_partial * 55) / queries_total)
      : 40,
  );

  if (overall_resolution !== 'FULLY_RESOLVED') {
    tips.push('Notes format try karo: Q1: … → A1: … | Q2: … → A2: …');
  }

  const psSummary = extractProblemAndSolution({
    notes: input.notes,
    customer_response: input.customer_response,
    outcome: input.outcome,
    problem_description: input.problem_description,
    service_type: input.service_type,
    lead_status: input.lead_status,
    answered: true,
    durationSec: Number(input.call_duration) || 0,
  });

  return {
    queries,
    overall_resolution,
    queries_total,
    queries_resolved,
    queries_partial,
    queries_unresolved,
    resolution_score,
    customer_problem_summary: psSummary.customer_problem,
    agent_handling_summary: psSummary.agent_solution,
    unresolved_gaps: Array.from(new Set(gaps)).slice(0, 6),
    coaching_tips: Array.from(new Set(tips)).slice(0, 5),
    engine: 'free_query_v2',
  };
}

function mapAdequacy(overall: OverallResolution): SolutionAdequacy {
  if (overall === 'FULLY_RESOLVED') return 'PROPER';
  if (overall === 'PARTIALLY_RESOLVED') return 'PARTIAL';
  if (overall === 'NOT_RESOLVED') return 'MISSING';
  if (overall === 'NOT_APPLICABLE') return 'NOT_NEEDED';
  return 'UNKNOWN';
}

export function mergeDeepIntoAnalysis(
  base: CallAnalysisResult,
  deep: DeepResolutionResult,
): CallAnalysisResult {
  const tips = Array.from(new Set([...(base.coaching_tips || []), ...deep.coaching_tips])).slice(0, 6);
  const quality = Math.round(base.quality_score * 0.55 + deep.resolution_score * 0.45);
  const grade =
    quality >= 85 ? 'A' : quality >= 70 ? 'B' : quality >= 55 ? 'C' : quality >= 40 ? 'D' : 'F';

  const qBits = deep.queries
    .slice(0, 4)
    .map((q) => `${q.resolution === 'RESOLVED' ? '✓' : q.resolution === 'PARTIAL' ? '~' : '✗'} ${clip(q.query, 40)}`)
    .join(' | ');

  return {
    ...base,
    customer_problem: deep.customer_problem_summary || base.customer_problem,
    agent_solution: deep.agent_handling_summary || base.agent_solution,
    solution_adequacy: mapAdequacy(deep.overall_resolution),
    solution_score: deep.resolution_score,
    coaching_tips: tips,
    quality_score: Math.max(0, Math.min(100, quality)),
    quality_grade: grade,
    quality_flags: [
      ...base.quality_flags.filter((f) => !/problem|solution/i.test(f)),
      ...(deep.queries_unresolved ? [`${deep.queries_unresolved} query unresolved`] : []),
      ...(deep.overall_resolution === 'FULLY_RESOLVED' ? [] : [`Resolution: ${deep.overall_resolution}`]),
    ].slice(0, 8),
    speech_insights: [
      ...base.speech_insights,
      `Queries ${deep.queries_resolved}/${deep.queries_total} resolved`,
    ].slice(0, 8),
    summary: [
      base.summary.split(' · ')[0],
      deep.overall_resolution.replace(/_/g, ' '),
      qBits,
      deep.customer_problem_summary ? `Problem: ${clip(deep.customer_problem_summary, 70)}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    engine: deep.engine === 'openai_deep_v1' ? 'openai_deep_v1' : 'free_query_v2',
    query_resolutions: deep.queries,
    overall_resolution: deep.overall_resolution,
    queries_total: deep.queries_total,
    queries_resolved: deep.queries_resolved,
    queries_partial: deep.queries_partial,
    queries_unresolved: deep.queries_unresolved,
    resolution_score: deep.resolution_score,
    unresolved_gaps: deep.unresolved_gaps,
  };
}

/**
 * Analyze with free multi-query resolution (always).
 */
export function analyzeCallWithQueryResolution(input: AnalyzeCallInput): CallAnalysisResult {
  const status = String(input.call_status || '').toUpperCase();
  const dur = Number(input.call_duration) || 0;
  const answered =
    status === 'ANSWERED' || status === 'COMPLETED' || status === 'CONNECTED' || dur > 0;
  const base = analyzeCallRecording(input);
  const deep = extractQueryResolutionsFree({ ...input, answered });
  return mergeDeepIntoAnalysis(base, deep);
}

/**
 * On-demand OpenAI deep reasoning over call notes / lead context.
 * Does NOT transcribe audio (keeps cost controlled).
 */
export async function deepAnalyzeWithOpenAI(input: AnalyzeCallInput): Promise<{
  analysis: CallAnalysisResult;
  deep: DeepResolutionResult;
  used_openai: boolean;
  warning?: string;
}> {
  const freeBase = analyzeCallWithQueryResolution(input);

  if (!OPENAI_API_KEY) {
    return {
      analysis: freeBase,
      deep: extractQueryResolutionsFree({
        ...input,
        answered: true,
      }),
      used_openai: false,
      warning: 'OPENAI_API_KEY missing — free query resolution used',
    };
  }

  const notes = clean(input.notes);
  const context = {
    call_status: input.call_status,
    call_duration_sec: input.call_duration,
    outcome: input.outcome,
    notes,
    customer_response: clean(input.customer_response),
    lead_problem_description: clean(input.problem_description),
    service_type: clean(input.service_type),
    lead_status: input.lead_status,
  };

  if (!notes && !context.lead_problem_description && !context.customer_response) {
    return {
      analysis: freeBase,
      deep: extractQueryResolutionsFree({
        ...input,
        answered: (Number(input.call_duration) || 0) > 0,
      }),
      used_openai: false,
      warning: 'Notes empty — deep AI needs call notes / problem text. Free analysis returned.',
    };
  }

  const system = `You are a strict QA coach for Indian auto-service telecalling (Hinglish OK).
Given call notes + lead context, extract EVERY distinct customer query/problem, and judge whether the telecaller gave a proper answer that resolves it.

Rules:
- Do NOT invent facts not present in the text.
- If answer is vague / only "callback" without addressing the ask → PARTIAL or UNRESOLVED.
- Booking/slot/price/workshop/pickup must be concrete to count as RESOLVED.
- Output ONLY valid JSON matching the schema.`;

  const user = `Analyze this telecaller call notes for query resolution.

CONTEXT:
${JSON.stringify(context, null, 2)}

Return JSON:
{
  "customer_problem_summary": "string",
  "agent_handling_summary": "string",
  "queries": [
    {
      "query": "customer's question or problem",
      "agent_answer": "what agent replied/offered or null",
      "resolution": "RESOLVED|PARTIAL|UNRESOLVED",
      "evidence": "short quote from notes",
      "gap": "what is still missing or null"
    }
  ],
  "overall_resolution": "FULLY_RESOLVED|PARTIALLY_RESOLVED|NOT_RESOLVED",
  "unresolved_gaps": ["..."],
  "coaching_tips": ["actionable tip for telecaller"],
  "resolution_score": 0
}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        analysis: freeBase,
        deep: extractQueryResolutionsFree({
          ...input,
          answered: true,
        }),
        used_openai: false,
        warning: `OpenAI failed (${res.status}) — free analysis used. ${clip(errText, 120)}`,
      };
    }

    const json = await res.json();
    const raw = String(json?.choices?.[0]?.message?.content || '').trim();
    const parsed = JSON.parse(raw);

    const queries: QueryResolutionItem[] = (Array.isArray(parsed.queries) ? parsed.queries : [])
      .slice(0, 12)
      .map((q: any, i: number) => ({
        id: `ai_${i + 1}`,
        query: String(q.query || '').trim() || `Query ${i + 1}`,
        agent_answer: q.agent_answer ? String(q.agent_answer) : null,
        resolution: (['RESOLVED', 'PARTIAL', 'UNRESOLVED'].includes(String(q.resolution || '').toUpperCase())
          ? String(q.resolution).toUpperCase()
          : 'UNKNOWN') as QueryResolutionStatus,
        evidence: q.evidence ? String(q.evidence) : null,
        gap: q.gap ? String(q.gap) : null,
      }));

    const queries_resolved = queries.filter((q) => q.resolution === 'RESOLVED').length;
    const queries_partial = queries.filter((q) => q.resolution === 'PARTIAL').length;
    const queries_unresolved = queries.filter((q) => q.resolution === 'UNRESOLVED').length;
    const overall = String(parsed.overall_resolution || 'PARTIALLY_RESOLVED').toUpperCase() as OverallResolution;
    const resolution_score = Math.max(
      0,
      Math.min(100, Number(parsed.resolution_score) || Math.round(
        queries.length ? (queries_resolved * 100 + queries_partial * 55) / queries.length : 40,
      )),
    );

    const deep: DeepResolutionResult = {
      queries: queries.length
        ? queries
        : extractQueryResolutionsFree({ ...input, answered: true }).queries,
      overall_resolution: ['FULLY_RESOLVED', 'PARTIALLY_RESOLVED', 'NOT_RESOLVED', 'NOT_APPLICABLE'].includes(overall)
        ? overall
        : 'PARTIALLY_RESOLVED',
      queries_total: queries.length,
      queries_resolved,
      queries_partial,
      queries_unresolved,
      resolution_score,
      customer_problem_summary: parsed.customer_problem_summary
        ? String(parsed.customer_problem_summary)
        : freeBase.customer_problem,
      agent_handling_summary: parsed.agent_handling_summary
        ? String(parsed.agent_handling_summary)
        : freeBase.agent_solution,
      unresolved_gaps: Array.isArray(parsed.unresolved_gaps)
        ? parsed.unresolved_gaps.map(String).slice(0, 8)
        : [],
      coaching_tips: Array.isArray(parsed.coaching_tips)
        ? parsed.coaching_tips.map(String).slice(0, 6)
        : [],
      engine: 'openai_deep_v1',
    };

    const base = analyzeCallRecording(input);
    return {
      analysis: mergeDeepIntoAnalysis(base, deep),
      deep,
      used_openai: true,
    };
  } catch (e: any) {
    return {
      analysis: freeBase,
      deep: extractQueryResolutionsFree({ ...input, answered: true }),
      used_openai: false,
      warning: e?.message || 'Deep AI parse failed — free analysis used',
    };
  }
}
