/**
 * Free Call Intelligence — no paid ASR/LLM.
 * Scores & insights from call logs, notes, outcomes, recording metadata.
 */

export type CallSentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'ANGRY' | 'UNKNOWN';

export type ConversationTag =
  | 'INTERESTED'
  | 'NOT_INTERESTED'
  | 'CALLBACK'
  | 'BOOKING'
  | 'PRICE_QUERY'
  | 'COMPLAINT'
  | 'WRONG_NUMBER'
  | 'NO_RESPONSE'
  | 'INFO_COLLECTED'
  | 'OTHER';

export type AnalyzeCallInput = {
  id: string;
  call_status?: string | null;
  call_duration?: number | null;
  outcome?: string | null;
  notes?: string | null;
  customer_response?: string | null;
  lead_id?: string | null;
  call_recording_url?: string | null;
  phone_number?: string | null;
  created_at?: string | null;
  lead_status?: string | null;
  /** From service_leads.problem_description when available */
  problem_description?: string | null;
  service_type?: string | null;
};

export type SolutionAdequacy = 'PROPER' | 'PARTIAL' | 'MISSING' | 'NOT_NEEDED' | 'UNKNOWN';

export type CallAnalysisResult = {
  call_log_id: string;
  sentiment: CallSentiment;
  sentiment_score: number; // -1 .. +1
  conversation_tags: ConversationTag[];
  quality_score: number; // 0..100
  quality_grade: 'A' | 'B' | 'C' | 'D' | 'F';
  quality_flags: string[];
  speech_insights: string[];
  summary: string;
  buying_intent: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  /** What customer said / problem (from notes + lead) */
  customer_problem: string | null;
  customer_problem_categories: string[];
  /** What telecaller offered / committed */
  agent_solution: string | null;
  solution_adequacy: SolutionAdequacy;
  solution_score: number; // 0..100
  coaching_tips: string[];
  /** Per customer-query resolution (deep) */
  query_resolutions?: Array<{
    id: string;
    query: string;
    agent_answer: string | null;
    resolution: 'RESOLVED' | 'PARTIAL' | 'UNRESOLVED' | 'UNKNOWN';
    evidence: string | null;
    gap: string | null;
  }>;
  overall_resolution?: string;
  queries_total?: number;
  queries_resolved?: number;
  queries_partial?: number;
  queries_unresolved?: number;
  resolution_score?: number;
  unresolved_gaps?: string[];
  /** MY FNG Sales SOP structured audit (Call IQ) */
  sop_audit?: import('@/lib/telecaller/callIqSop').CallIqSopAudit;
  analyzed_at: string;
  engine: 'free_heuristics_v1' | 'free_query_v2' | 'openai_deep_v1';
};

const POSITIVE_RE =
  /\b(interested|haan|haa+|yes|ok(ay)?|confirm|book|booking|will visit|aunga|aaunga|kal aata|thank|thanks|good|accha|achha|perfect|done|ready|slot|price batao|kitna)\b/i;

const NEGATIVE_RE =
  /\b(not interested|nahi|nahin|no\b|don't|dont|mat|busy|later|don't call|dont call|stop|band|waste|expensive|mehnga|costly)\b/i;

const ANGRY_RE =
  /\b(angry|fraud|scam|cheat|idiot|bakwas|bewakoof|complaint|police|legal|harass|bar bar|ruk ja)\b/i;

const CALLBACK_RE =
  /\b(callback|call back|follow[- ]?up|baad mein|baad me|evening|shaam|kal call|ring later|recall)\b/i;

const BOOKING_RE =
  /\b(book(ing)?|confirm(ed)?|appointment|slot|workshop|visit|aayega|aunga)\b/i;

const PRICE_RE =
  /\b(price|kitna|cost|charge|rate|budget|discount|offer|coupon)\b/i;

const COMPLAINT_RE =
  /\b(complaint|issue|problem|not working|kharaab|kharab|service bad|refund)\b/i;

const WRONG_RE = /\b(wrong number|galat number|not this|kisi aur)\b/i;

const INFO_RE =
  /\b(info collected|details|address|pincode|vehicle|reg(istration)?|otp)\b/i;

/** Customer problem / symptom keywords (Hinglish + auto service) */
const PROBLEM_PATTERNS: Array<{ cat: string; re: RegExp }> = [
  { cat: 'Engine / pickup', re: /\b(engine|pickup|pick up|power loss|jerk|vibration|overheat|smoke|smoke aa|starting|start nahi|crank)\b/i },
  { cat: 'AC / cooling', re: /\b(ac|a\/c|air condition|cooling|gas|blower|not cool|thanda nahi)\b/i },
  { cat: 'Brake / safety', re: /\b(brake|braking|abs|pad|disc|squeal|jhhatka)\b/i },
  { cat: 'Battery / electrical', re: /\b(battery|electrical|wiring|fuse|light|headlight|indicator|horn)\b/i },
  { cat: 'Suspension / noise', re: /\b(suspension|shock|noise|awaz|rattling|knock|knocking|bearing)\b/i },
  { cat: 'Clutch / gear', re: /\b(clutch|gear|transmission|gearbox|slipping)\b/i },
  { cat: 'Oil / leak', re: /\b(oil|leak|leaking|coolant|water leak|tel)\b/i },
  { cat: 'Tyre / wheel', re: /\b(tyre|tire|wheel|alignment|balancing|puncture)\b/i },
  { cat: 'Periodic service', re: /\b(service|servicing|periodic|general service|full service|oil change|filter)\b/i },
  { cat: 'Dent / body', re: /\b(dent|scratch|body|paint|bumper|accident)\b/i },
  { cat: 'RSA / breakdown', re: /\b(breakdown|rsa|tow|towing|stuck|battery dead|jumpstart)\b/i },
  { cat: 'Price concern', re: /\b(price|kitna|expensive|mehnga|costly|budget|discount)\b/i },
  { cat: 'Complaint / redo', re: /\b(complaint|issue|problem|not working|kharaab|kharab|phir se|same problem|refund)\b/i },
];

const SOLUTION_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: 'Workshop visit offered', re: /\b(workshop|visit|aao|aana|bring car|car le aao|branch|centre|center)\b/i },
  { label: 'Booking / slot given', re: /\b(book(ed|ing)?|slot|confirm(ed)?|appointment|time diya|kal .* (am|pm)|morning slot)\b/i },
  { label: 'Price / estimate shared', re: /\b(price|estimate|quote|approx|lagbhag|₹|rs\.?|rupees|kitna lagega|charges bataye)\b/i },
  { label: 'Pickup / drop offered', re: /\b(pickup|pick up|drop|doorstep|ghar se)\b/i },
  { label: 'Diagnosis explained', re: /\b(check|diagnose|inspection|dekhenge|scan|obd|free checkup)\b/i },
  { label: 'Callback scheduled', re: /\b(callback|call back|follow[- ]?up|kal call|shaam ko call|ring later)\b/i },
  { label: 'Discount / offer', re: /\b(discount|offer|coupon|promo|save|saving)\b/i },
  { label: 'RSA / tow arranged', re: /\b(tow|rsa|mechanic bhej|on[- ]?spot|jump ?start)\b/i },
  { label: 'Addressed concern', re: /\b(samjha|explain|clarify|clear kiya|solution|solve|fix)\b/i },
];

function cleanNotes(raw?: string | null) {
  return String(raw || '')
    .replace(/\[Smartflo\]\s*/gi, '')
    .replace(/\bSmartflo\b/gi, '')
    .replace(/Recording synced\.?/gi, '')
    .trim();
}

function clip(text: string, max = 180) {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * Extract customer problem + whether agent gave a proper solution (free heuristics).
 */
export function extractProblemAndSolution(input: {
  notes?: string | null;
  customer_response?: string | null;
  outcome?: string | null;
  problem_description?: string | null;
  service_type?: string | null;
  lead_status?: string | null;
  answered: boolean;
  durationSec: number;
}): {
  customer_problem: string | null;
  customer_problem_categories: string[];
  agent_solution: string | null;
  solution_adequacy: SolutionAdequacy;
  solution_score: number;
  coaching_tips: string[];
} {
  const notes = cleanNotes(input.notes);
  const response = cleanNotes(input.customer_response);
  const leadProblem = cleanNotes(input.problem_description);
  const serviceType = cleanNotes(input.service_type);
  const outcome = cleanNotes(input.outcome);
  const blob = [notes, response, leadProblem, serviceType, outcome].filter(Boolean).join(' \n ');
  const tips: string[] = [];

  const categories: string[] = [];
  for (const p of PROBLEM_PATTERNS) {
    if (p.re.test(blob)) categories.push(p.cat);
  }
  if (serviceType && !categories.length) {
    categories.push(`Service: ${clip(serviceType, 40)}`);
  }

  // Prefer explicit lead problem, then notes snippets that look like issues
  let customer_problem: string | null = null;
  if (leadProblem.length >= 8) {
    customer_problem = clip(leadProblem);
  } else if (response.length >= 8) {
    customer_problem = clip(response);
  } else if (notes.length >= 12) {
    // Pull sentence-ish chunks that mention problem words
    const chunks = notes
      .split(/[.|·\n|;]+/)
      .map((c) => c.trim())
      .filter((c) => c.length >= 8);
    const problemish = chunks.find((c) =>
      PROBLEM_PATTERNS.some((p) => p.re.test(c)) ||
      /\b(chahiye|problem|issue|complaint|service|book|visit|price)\b/i.test(c),
    );
    customer_problem = clip(problemish || chunks[0] || notes);
  } else if (categories.length) {
    customer_problem = `Likely: ${categories.slice(0, 3).join(', ')}`;
  }

  const solutionHits = SOLUTION_PATTERNS.filter((s) => s.re.test(blob)).map((s) => s.label);
  let agent_solution: string | null = null;
  if (solutionHits.length) {
    agent_solution = solutionHits.slice(0, 4).join('; ');
  } else if (notes.length >= 20 && /\b(bataya|bola|offered|diya|confirm|book|slot|price)\b/i.test(notes)) {
    agent_solution = clip(notes);
  }

  const hasProblemSignal =
    Boolean(customer_problem) || categories.length > 0 || COMPLAINT_RE.test(blob) || PRICE_RE.test(blob);
  const hasSolutionSignal = solutionHits.length > 0 || Boolean(agent_solution);
  const bookingDone =
    BOOKING_RE.test(blob) ||
    /\bBOOKING_CONFIRMED\b/i.test(String(input.lead_status || '')) ||
    solutionHits.some((s) => /booking|slot/i.test(s));
  const onlyCallback = solutionHits.length === 1 && /callback/i.test(solutionHits[0]);
  const notInterested =
    /\b(not interested|nahi chahiye|no need)\b/i.test(blob) ||
    String(input.lead_status || '').toUpperCase().includes('LOST');

  let solution_adequacy: SolutionAdequacy = 'UNKNOWN';
  let solution_score = 40;

  if (!input.answered || input.durationSec < 8) {
    solution_adequacy = 'NOT_NEEDED';
    solution_score = 50;
    customer_problem = customer_problem || 'Call not connected — problem not captured';
    agent_solution = agent_solution || 'No solution possible (no connect)';
    tips.push('Reconnect / leave clear callback note if number is valid');
  } else if (notInterested && !hasProblemSignal) {
    solution_adequacy = 'NOT_NEEDED';
    solution_score = 70;
    if (!customer_problem) customer_problem = 'Customer not interested / declined';
    if (!agent_solution) agent_solution = 'Politely closed / marked lost';
  } else if (!hasProblemSignal && notes.length < 12) {
    solution_adequacy = 'UNKNOWN';
    solution_score = 25;
    customer_problem = customer_problem || 'Problem not written in notes';
    agent_solution = agent_solution || 'Solution not documented';
    tips.push('Notes mein customer ki exact problem likho (e.g. AC not cooling, brake noise)');
    tips.push('Jo solution/offer diya (slot, price, pickup) clearly note karo');
  } else if (hasProblemSignal && bookingDone) {
    solution_adequacy = 'PROPER';
    solution_score = 90;
    tips.push('Good: problem + booking/next step documented');
  } else if (hasProblemSignal && hasSolutionSignal && !onlyCallback) {
    solution_adequacy = 'PROPER';
    solution_score = 80;
  } else if (hasProblemSignal && onlyCallback) {
    solution_adequacy = 'PARTIAL';
    solution_score = 55;
    tips.push('Sirf callback hai — problem pe concrete offer try karo (slot / estimate / workshop)');
  } else if (hasProblemSignal && !hasSolutionSignal) {
    solution_adequacy = 'MISSING';
    solution_score = 30;
    agent_solution = agent_solution || 'No clear solution found in notes';
    tips.push('Customer problem note hai lekin solution missing — price/slot/workshop offer add karo');
    tips.push('Ask: pickup needed? preferred time? budget?');
  } else if (!hasProblemSignal && hasSolutionSignal) {
    solution_adequacy = 'PARTIAL';
    solution_score = 50;
    tips.push('Solution mention hai lekin customer problem clear nahi — pehle issue capture karo');
  } else {
    solution_adequacy = 'PARTIAL';
    solution_score = 45;
    tips.push('Notes thode vague hain — problem + solution dono 1–2 lines mein likho');
  }

  if (hasProblemSignal && categories.includes('Complaint / redo') && solution_adequacy !== 'PROPER') {
    tips.push('Complaint/repeat issue — escalate path + free inspection offer clearly document karo');
    solution_score = Math.max(20, solution_score - 10);
  }

  return {
    customer_problem,
    customer_problem_categories: Array.from(new Set(categories)).slice(0, 6),
    agent_solution,
    solution_adequacy,
    solution_score: Math.max(0, Math.min(100, Math.round(solution_score))),
    coaching_tips: tips.slice(0, 4),
  };
}

function normalizeStatus(s?: string | null) {
  return String(s || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
}

function gradeFromScore(score: number): CallAnalysisResult['quality_grade'] {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export function analyzeCallTextSentiment(text: string): {
  sentiment: CallSentiment;
  score: number;
  buying_intent: CallAnalysisResult['buying_intent'];
  tags: ConversationTag[];
} {
  const t = text.toLowerCase();
  if (!t.trim()) {
    return { sentiment: 'UNKNOWN', score: 0, buying_intent: 'NONE', tags: [] };
  }

  const tags: ConversationTag[] = [];
  let score = 0;

  if (ANGRY_RE.test(t)) {
    score -= 0.9;
    tags.push('COMPLAINT');
  }
  if (NEGATIVE_RE.test(t)) score -= 0.45;
  if (POSITIVE_RE.test(t)) score += 0.55;
  if (CALLBACK_RE.test(t)) {
    tags.push('CALLBACK');
    score += 0.1;
  }
  if (BOOKING_RE.test(t)) {
    tags.push('BOOKING');
    score += 0.35;
  }
  if (PRICE_RE.test(t)) {
    tags.push('PRICE_QUERY');
    score += 0.15;
  }
  if (COMPLAINT_RE.test(t) && !tags.includes('COMPLAINT')) tags.push('COMPLAINT');
  if (WRONG_RE.test(t)) {
    tags.push('WRONG_NUMBER');
    score -= 0.2;
  }
  if (INFO_RE.test(t)) {
    tags.push('INFO_COLLECTED');
    score += 0.2;
  }
  if (/\b(not interested|nahi chahiye|no need)\b/i.test(t)) {
    tags.push('NOT_INTERESTED');
  } else if (/\b(interested|haan interested|will book)\b/i.test(t)) {
    tags.push('INTERESTED');
  }

  score = Math.max(-1, Math.min(1, score));

  let sentiment: CallSentiment = 'NEUTRAL';
  if (ANGRY_RE.test(t) || score <= -0.7) sentiment = 'ANGRY';
  else if (score <= -0.25) sentiment = 'NEGATIVE';
  else if (score >= 0.35) sentiment = 'POSITIVE';
  else if (!POSITIVE_RE.test(t) && !NEGATIVE_RE.test(t) && tags.length === 0) {
    sentiment = 'NEUTRAL';
  }

  let buying_intent: CallAnalysisResult['buying_intent'] = 'NONE';
  if (tags.includes('BOOKING') || score >= 0.5) buying_intent = 'HIGH';
  else if (tags.includes('INTERESTED') || tags.includes('PRICE_QUERY') || tags.includes('CALLBACK')) {
    buying_intent = 'MEDIUM';
  } else if (tags.includes('NOT_INTERESTED') || tags.includes('WRONG_NUMBER')) {
    buying_intent = 'NONE';
  } else if (score > 0.1) buying_intent = 'LOW';

  if (tags.length === 0) tags.push('OTHER');
  return { sentiment, score, buying_intent, tags: Array.from(new Set(tags)) };
}

/**
 * Free per-call analysis (recording / conversation / quality / sentiment).
 */
export function analyzeCallRecording(input: AnalyzeCallInput): CallAnalysisResult {
  const status = normalizeStatus(input.call_status);
  const duration = Number(input.call_duration);
  const dur = Number.isFinite(duration) && duration >= 0 ? duration : 0;
  const notes = cleanNotes(input.notes);
  const response = cleanNotes(input.customer_response);
  const textBlob = [notes, response, input.outcome, input.problem_description]
    .filter(Boolean)
    .join(' · ');
  const textAnalysis = analyzeCallTextSentiment(textBlob);

  const flags: string[] = [];
  const speech: string[] = [];
  let quality = 40; // base

  const answered =
    status === 'ANSWERED' ||
    status === 'COMPLETED' ||
    status === 'CONNECTED' ||
    dur > 0;

  const problemSolution = extractProblemAndSolution({
    notes: input.notes,
    customer_response: input.customer_response,
    outcome: input.outcome,
    problem_description: input.problem_description,
    service_type: input.service_type,
    lead_status: input.lead_status,
    answered,
    durationSec: dur,
  });

  if (answered) {
    quality += 15;
    speech.push(dur > 0 ? `Talk time ~${Math.round(dur)}s` : 'Marked answered');
  } else {
    flags.push('Not connected');
    speech.push('No connect / no talk time');
    quality -= 10;
  }

  if (String(input.call_recording_url || '').trim()) {
    quality += 12;
    speech.push('Recording available');
  } else if (answered && dur >= 15) {
    flags.push('Answered but recording missing');
    quality -= 8;
  }

  if (input.lead_id) {
    quality += 8;
  } else {
    flags.push('No lead linked');
    quality -= 5;
  }

  if (notes.length >= 12) {
    quality += 12;
    speech.push('Agent notes present (conversation proxy)');
  } else if (answered && dur >= 20) {
    flags.push('Thin / missing notes');
    quality -= 10;
  }

  // Duration bands (speech analytics proxy)
  if (answered) {
    if (dur > 0 && dur < 15) {
      flags.push('Very short connect (<15s)');
      quality -= 12;
      speech.push('Likely hang-up / wrong person');
    } else if (dur >= 15 && dur < 45) {
      speech.push('Short conversation');
      quality += 2;
    } else if (dur >= 45 && dur <= 180) {
      speech.push('Healthy talk window');
      quality += 10;
    } else if (dur > 180 && dur <= 600) {
      speech.push('Long conversation');
      quality += 8;
    } else if (dur > 600) {
      flags.push('Unusually long call (>10m)');
      quality -= 3;
      speech.push('Review for hold/idle time');
    }
  }

  const outcome = normalizeStatus(input.outcome);
  if (outcome && outcome !== 'NONE') {
    quality += 6;
  } else if (answered && dur >= 30) {
    flags.push('No disposition/outcome set');
    quality -= 6;
  }

  // Sentiment adjusts quality slightly (customer mood ≠ agent fault always)
  if (textAnalysis.sentiment === 'POSITIVE') quality += 6;
  if (textAnalysis.sentiment === 'ANGRY') {
    flags.push('Angry / complaint language in notes');
    quality -= 4;
  }
  if (textAnalysis.tags.includes('BOOKING') || textAnalysis.tags.includes('INTERESTED')) {
    quality += 5;
  }
  if (textAnalysis.tags.includes('NO_RESPONSE') || status === 'NO_ANSWER' || status === 'MISSED') {
    textAnalysis.tags = Array.from(new Set([...textAnalysis.tags, 'NO_RESPONSE' as ConversationTag]));
  }

  // Problem / solution coaching weight
  if (problemSolution.solution_adequacy === 'PROPER') {
    quality += 10;
    speech.push('Customer problem + agent solution documented');
  } else if (problemSolution.solution_adequacy === 'PARTIAL') {
    quality += 2;
    flags.push('Solution only partial / incomplete');
  } else if (problemSolution.solution_adequacy === 'MISSING') {
    quality -= 12;
    flags.push('Customer problem without clear solution');
  } else if (problemSolution.solution_adequacy === 'UNKNOWN' && answered && dur >= 20) {
    quality -= 6;
    flags.push('Problem/solution not clear in notes');
  }

  if (problemSolution.customer_problem_categories.length) {
    speech.push(`Problem area: ${problemSolution.customer_problem_categories.slice(0, 3).join(', ')}`);
  }

  quality = Math.max(0, Math.min(100, Math.round(quality * 0.75 + problemSolution.solution_score * 0.25)));

  const summaryParts: string[] = [];
  summaryParts.push(
    answered
      ? `Connected call${dur ? ` (${Math.round(dur)}s)` : ''}`
      : `Unconnected (${status || 'unknown'})`,
  );
  if (problemSolution.customer_problem) {
    summaryParts.push(`Problem: ${clip(problemSolution.customer_problem, 80)}`);
  }
  if (problemSolution.agent_solution) {
    summaryParts.push(`Solution: ${clip(problemSolution.agent_solution, 80)}`);
  }
  summaryParts.push(`Solution ${problemSolution.solution_adequacy.toLowerCase()}`);
  if (textAnalysis.sentiment !== 'UNKNOWN') {
    summaryParts.push(`Sentiment ${textAnalysis.sentiment.toLowerCase()}`);
  }
  if (textAnalysis.tags.filter((t) => t !== 'OTHER').length) {
    summaryParts.push(
      `Tags: ${textAnalysis.tags
        .filter((t) => t !== 'OTHER')
        .slice(0, 4)
        .join(', ')}`,
    );
  }
  if (flags.length) summaryParts.push(`Flags: ${flags.slice(0, 3).join('; ')}`);

  return {
    call_log_id: String(input.id),
    sentiment: textAnalysis.sentiment,
    sentiment_score: textAnalysis.score,
    conversation_tags: textAnalysis.tags,
    quality_score: quality,
    quality_grade: gradeFromScore(quality),
    quality_flags: flags,
    speech_insights: speech,
    summary: summaryParts.join(' · '),
    buying_intent: textAnalysis.buying_intent,
    customer_problem: problemSolution.customer_problem,
    customer_problem_categories: problemSolution.customer_problem_categories,
    agent_solution: problemSolution.agent_solution,
    solution_adequacy: problemSolution.solution_adequacy,
    solution_score: problemSolution.solution_score,
    coaching_tips: problemSolution.coaching_tips,
    query_resolutions: [],
    overall_resolution: 'UNKNOWN',
    queries_total: 0,
    queries_resolved: 0,
    queries_partial: 0,
    queries_unresolved: 0,
    resolution_score: problemSolution.solution_score,
    unresolved_gaps: [],
    analyzed_at: new Date().toISOString(),
    engine: 'free_heuristics_v1',
  };
}

export type AgentPerfRow = {
  telecaller_id: string;
  telecaller_name: string;
  total_calls: number;
  answered: number;
  connect_rate: number;
  talk_seconds: number;
  avg_duration: number;
  with_recording: number;
  recording_rate: number;
  with_notes: number;
  notes_rate: number;
  short_calls: number;
  quality_avg: number;
  sentiment_positive: number;
  sentiment_negative: number;
  high_intent: number;
  performance_score: number;
};

export function scoreAgentPerformance(input: {
  telecaller_id: string;
  telecaller_name: string;
  analyses: CallAnalysisResult[];
  calls: Array<{
    call_status?: string | null;
    call_duration?: number | null;
    call_recording_url?: string | null;
    notes?: string | null;
  }>;
}): AgentPerfRow {
  const total = input.calls.length;
  let answered = 0;
  let talk = 0;
  let withRec = 0;
  let withNotes = 0;
  let short = 0;

  for (const c of input.calls) {
    const st = normalizeStatus(c.call_status);
    const dur = Number(c.call_duration) || 0;
    const isAns =
      st === 'ANSWERED' || st === 'COMPLETED' || st === 'CONNECTED' || dur > 0;
    if (isAns) {
      answered += 1;
      talk += dur;
      if (dur > 0 && dur < 15) short += 1;
    }
    if (String(c.call_recording_url || '').trim()) withRec += 1;
    if (cleanNotes(c.notes).length >= 12) withNotes += 1;
  }

  const connect_rate = total ? answered / total : 0;
  const recording_rate = total ? withRec / total : 0;
  const notes_rate = total ? withNotes / total : 0;
  const avg_duration = answered ? talk / answered : 0;

  const quality_avg = input.analyses.length
    ? input.analyses.reduce((s, a) => s + a.quality_score, 0) / input.analyses.length
    : 0;
  const sentiment_positive = input.analyses.filter((a) => a.sentiment === 'POSITIVE').length;
  const sentiment_negative = input.analyses.filter(
    (a) => a.sentiment === 'NEGATIVE' || a.sentiment === 'ANGRY',
  ).length;
  const high_intent = input.analyses.filter((a) => a.buying_intent === 'HIGH').length;

  // Composite 0–100
  let perf =
    connect_rate * 30 +
    Math.min(1, avg_duration / 90) * 20 +
    recording_rate * 15 +
    notes_rate * 15 +
    (quality_avg / 100) * 15 +
    (total ? high_intent / total : 0) * 10 -
    (answered ? short / answered : 0) * 10;
  perf = Math.max(0, Math.min(100, Math.round(perf)));

  return {
    telecaller_id: input.telecaller_id,
    telecaller_name: input.telecaller_name,
    total_calls: total,
    answered,
    connect_rate,
    talk_seconds: talk,
    avg_duration,
    with_recording: withRec,
    recording_rate,
    with_notes: withNotes,
    notes_rate,
    short_calls: short,
    quality_avg: Math.round(quality_avg),
    sentiment_positive,
    sentiment_negative,
    high_intent,
    performance_score: perf,
  };
}
