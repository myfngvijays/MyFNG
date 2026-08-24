/**
 * Lead IQ — strategist brief from lead history + playbook (TeleCRM-style).
 */

import type { SalesPlaybook } from '@/lib/telecaller/salesPlaybookDefaults';
import { defaultSalesPlaybook } from '@/lib/telecaller/salesPlaybookDefaults';

export type LeadIqBrief = {
  lead_id: string;
  verdict: string;
  intent_level: 'Low' | 'Medium' | 'High';
  buyer_type: string;
  decision_stage: 'Only Checking' | 'Consideration' | 'Closing';
  hidden_risk: string;
  next_move: string;
  whatsapp_script: string;
  call_script: string;
  facts: string[];
  temperature: string;
  engine: 'free_lead_iq_v1' | 'openai_lead_iq_v1';
  generated_at: string;
};

export type LeadIqInput = {
  lead_id: string;
  customer_name?: string | null;
  lead_number?: string | null;
  status?: string | null;
  city?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_number?: string | null;
  service_type?: string | null;
  problem_description?: string | null;
  lead_source?: string | null;
  estimated_amount?: number | string | null;
  telecaller_remarks?: string | null;
  next_follow_up_at?: string | null;
  last_call_at?: string | null;
  total_calls?: number | null;
  coupon_meta?: any;
  created_at?: string | null;
  recent_calls?: Array<{
    created_at?: string | null;
    call_status?: string | null;
    call_duration?: number | null;
    notes?: string | null;
    outcome?: string | null;
    sop_audit?: any;
  }>;
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_CALL_INTEL_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

function clean(raw?: string | null) {
  return String(raw || '').replace(/\s+/g, ' ').trim();
}

function clip(s: string, n = 220) {
  const t = s.trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

function firstName(name?: string | null) {
  const n = clean(name);
  return n.split(/\s+/)[0] || 'there';
}

export function analyzeLeadIqFree(input: LeadIqInput): LeadIqBrief {
  const status = String(input.status || '').toUpperCase();
  const lastResult = String(input.coupon_meta?.last_call_result || '').toUpperCase();
  const notes = (input.recent_calls || [])
    .map((c) => clean(c.notes))
    .filter(Boolean)
    .join(' · ');
  const problem = clean(input.problem_description);
  const car = [input.vehicle_make, input.vehicle_model].filter(Boolean).join(' ');
  const city = clean(input.city);
  const calls = Number(input.total_calls) || (input.recent_calls || []).length;
  const booked = status === 'VALIDATED' || lastResult.includes('BOOK');
  const interested = lastResult === 'INTERESTED' || /interested|book|slot/i.test(notes);
  const willVisit = lastResult === 'WILL_VISIT' || /visit|aaunga/i.test(notes);
  const checking = /price|kitna|estimate|just checking/i.test(`${notes} ${problem}`);
  const noConnect = calls > 0 && (input.recent_calls || []).every((c) => {
    const st = String(c.call_status || '').toUpperCase();
    return !['ANSWERED', 'COMPLETED', 'CONNECTED'].includes(st) && !(Number(c.call_duration) > 0);
  });

  const intent: LeadIqBrief['intent_level'] = booked
    ? 'High'
    : interested || willVisit
      ? 'Medium'
      : checking || problem
        ? 'Medium'
        : 'Low';
  const stage: LeadIqBrief['decision_stage'] = booked
    ? 'Closing'
    : interested || willVisit || checking
      ? 'Consideration'
      : 'Only Checking';

  const facts: string[] = [];
  if (car) facts.push(`${car}${input.vehicle_number ? ` · ${input.vehicle_number}` : ''}`);
  if (city) facts.push(`Area: ${city}`);
  if (input.service_type) facts.push(`Need: ${input.service_type}`);
  if (problem) facts.push(`Issue: ${clip(problem, 90)}`);
  if (calls) facts.push(`${calls} logged call${calls === 1 ? '' : 's'}`);
  if (lastResult) facts.push(`Last result: ${lastResult.replace(/_/g, ' ')}`);
  if (input.next_follow_up_at) facts.push(`Follow-up: ${input.next_follow_up_at}`);

  let hidden = 'Intent unclear — notes / last result thin.';
  if (checking) hidden = 'Price-shopping risk — quote only after reg. no. + make/model, sell value not discount.';
  if (noConnect) hidden = 'Connect risk — multiple attempts with no talk. Try WhatsApp + different time window.';
  if (willVisit && !booked) hidden = 'Soft visit promise — lock a slot or pickup so it does not go cold.';
  if (/mechanic|regular/i.test(notes)) hidden = 'Local mechanic pull — contrast photos, warranty, OEM/OES without attacking them.';

  const next = booked
    ? 'Confirm appointment details and send WhatsApp with workshop / pickup time.'
    : noConnect
      ? 'Send a short WhatsApp (name + car + pickup offer), then call in a different IST window.'
      : checking
        ? 'Ask registration number, then give a consultative estimate + free pickup.'
        : willVisit
          ? 'Convert visit intent into a held weekday slot or pickup booking.'
          : 'Qualify Location, Car, Last service, Urgency — then pitch pickup + warranty.';

  const name = firstName(input.customer_name);
  const wa = `Hi ${name}, MY FNG here.${car ? ` Regarding your ${car}` : ''}${problem ? ` (${clip(problem, 40)})` : ''}. We can do free pickup & drop + photo/video updates + OEM/OES parts with warranty. Share your car number — I’ll send a clear estimate.`;
  const script = `Hi ${name}, MY FNG. ${car ? `Calling about your ${car}. ` : ''}Quick 4: your area, last service, is it this week or later, and car number so I don’t guess the price. Then I’ll suggest General/Premium and free pickup if that’s easier.`;

  const buyer = city
    ? `Out-of-warranty car owner${city ? ` in ${city}` : ''}`
    : 'Out-of-warranty / multi-brand service shopper';

  const verdict = booked
    ? `${name} is in closing — protect the booking and confirm logistics.`
    : intent === 'High'
      ? `${name} is warm — lock pickup or a slot on this call.`
      : intent === 'Medium'
        ? `${name} is evaluating — win with a precise estimate + proof (photos/warranty), not discount.`
        : `${name} is early / cold — qualify first, then one USP (pickup) to earn the next call.`;

  return {
    lead_id: input.lead_id,
    verdict,
    intent_level: intent,
    buyer_type: buyer,
    decision_stage: stage,
    hidden_risk: hidden,
    next_move: next,
    whatsapp_script: wa,
    call_script: script,
    facts: facts.slice(0, 8),
    temperature: intent === 'High' ? 'Hot' : intent === 'Medium' ? 'Warm' : 'Cold',
    engine: 'free_lead_iq_v1',
    generated_at: new Date().toISOString(),
  };
}

export async function analyzeLeadIqWithOpenAI(
  input: LeadIqInput,
  playbook?: SalesPlaybook | null,
): Promise<{ brief: LeadIqBrief; used_openai: boolean; warning?: string }> {
  const fallback = analyzeLeadIqFree(input);
  const book = playbook || defaultSalesPlaybook();
  if (!OPENAI_API_KEY) {
    return { brief: fallback, used_openai: false, warning: 'OPENAI_API_KEY missing — free Lead IQ used' };
  }

  const system = `${book.lead_iq_prompt}

SALES PLAYBOOK:
Voice: ${book.voice_style}
ICP: ${clip(book.icp, 800)}
Features: ${clip(book.product_features, 800)}
Pricing: ${clip(book.pricing, 600)}
Objections: ${clip(book.objection_handling, 800)}
Competitors: ${clip(book.competitors, 600)}

Return ONLY JSON:
{
  "verdict": "string",
  "intent_level": "Low|Medium|High",
  "buyer_type": "string",
  "decision_stage": "Only Checking|Consideration|Closing",
  "hidden_risk": "string",
  "next_move": "string",
  "whatsapp_script": "string",
  "call_script": "string",
  "facts": ["derived insight, not raw field dump"],
  "temperature": "Hot|Warm|Cold"
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
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: `Lead dossier:\n${JSON.stringify(
              {
                customer_name: input.customer_name,
                lead_number: input.lead_number,
                status: input.status,
                city: input.city,
                vehicle: [input.vehicle_make, input.vehicle_model, input.vehicle_number].filter(Boolean).join(' '),
                service_type: input.service_type,
                problem_description: input.problem_description,
                lead_source: input.lead_source,
                estimated_amount: input.estimated_amount,
                remarks: input.telecaller_remarks,
                last_call_result: input.coupon_meta?.last_call_result,
                next_follow_up_at: input.next_follow_up_at,
                last_call_at: input.last_call_at,
                total_calls: input.total_calls,
                created_at: input.created_at,
                recent_calls: (input.recent_calls || []).slice(0, 8).map((c) => ({
                  at: c.created_at,
                  status: c.call_status,
                  duration: c.call_duration,
                  notes: clip(clean(c.notes), 240),
                  outcome: c.outcome,
                  sop_score: c.sop_audit?.overall_score,
                  sop_status: c.sop_audit?.suggested_lead_status,
                })),
              },
              null,
              2,
            )}`,
          },
        ],
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { brief: fallback, used_openai: false, warning: `OpenAI Lead IQ failed (${res.status}) ${clip(errText, 100)}` };
    }
    const json = await res.json();
    const parsed = JSON.parse(String(json?.choices?.[0]?.message?.content || '{}'));
    const intent = ['Low', 'Medium', 'High'].includes(String(parsed.intent_level))
      ? parsed.intent_level
      : fallback.intent_level;
    const stage = ['Only Checking', 'Consideration', 'Closing'].includes(String(parsed.decision_stage))
      ? parsed.decision_stage
      : fallback.decision_stage;
    return {
      brief: {
        lead_id: input.lead_id,
        verdict: String(parsed.verdict || fallback.verdict),
        intent_level: intent,
        buyer_type: String(parsed.buyer_type || fallback.buyer_type),
        decision_stage: stage,
        hidden_risk: String(parsed.hidden_risk || fallback.hidden_risk),
        next_move: String(parsed.next_move || fallback.next_move),
        whatsapp_script: String(parsed.whatsapp_script || fallback.whatsapp_script),
        call_script: String(parsed.call_script || fallback.call_script),
        facts: Array.isArray(parsed.facts) ? parsed.facts.map(String).slice(0, 8) : fallback.facts,
        temperature: String(parsed.temperature || fallback.temperature),
        engine: 'openai_lead_iq_v1',
        generated_at: new Date().toISOString(),
      },
      used_openai: true,
    };
  } catch (e: any) {
    return { brief: fallback, used_openai: false, warning: e?.message || 'Lead IQ parse failed' };
  }
}
