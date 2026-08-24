/**
 * Call IQ — MY FNG Sales SOP auditor.
 * Free heuristics from notes + lead fields; Deep AI uses the TeleCRM prompt + playbook.
 */

import type { AnalyzeCallInput, CallAnalysisResult } from '@/lib/telecaller/callIntelligence';
import type { SalesPlaybook } from '@/lib/telecaller/salesPlaybookDefaults';
import { defaultSalesPlaybook } from '@/lib/telecaller/salesPlaybookDefaults';
import { DEFAULT_SOP_NEW_FIELDS, fieldsToSchemaHint } from '@/lib/telecaller/callIqAgents';

export type YesNoUnknown = 'Yes' | 'No' | 'Unknown';
export type ServicePref = 'Pickup' | 'Workshop Visit' | 'Not Decided';
export type ObjectionQuality = 'Strong' | 'Average' | 'Weak' | 'Not Applicable';
export type ClosingAttempt = 'Clear Ask' | 'Weak Ask' | 'No Ask';
export type ToneConfidence = 'Polite and Confident' | 'Rushed' | 'Unclear' | 'Poor';
export type ListeningVsTalking = 'Listened Well' | 'Interrupted Often' | 'Unknown';
export type LanguageAdapt = 'Yes Customers Language' | 'No';
export type IntentLevel = 'Low' | 'Medium' | 'High';
export type DecisionStage = 'Only Checking' | 'Consideration' | 'Closing';
export type SuggestedStatus =
  | 'Fresh'
  | 'Interested'
  | 'He will visit'
  | 'Follow-up'
  | 'Booking confirmed'
  | 'In Service'
  | 'Service Done'
  | 'Lost'
  | 'Ringing / No answer'
  | 'Unknown';

/** Map leftover TeleCRM labels onto MY FNG CRM statuses. */
export function toCrmSuggestedStatus(raw?: string | null): SuggestedStatus {
  const s = String(raw || '').trim();
  const key = s.toLowerCase().replace(/[_-]+/g, ' ');
  if (key === 'appointment scheduled' || key === 'booking confirmed' || key === 'validated') {
    return 'Booking confirmed';
  }
  if (key === 'attempt contact' || key === 'attempted contact' || key === 'ringing / no answer' || key === 'ringing') {
    return 'Ringing / No answer';
  }
  if (key === 'he will visit' || key === 'will visit') return 'He will visit';
  if (key === 'follow up' || key === 'follow-up' || key === 'callback') return 'Follow-up';
  if (key === 'interested') return 'Interested';
  if (key === 'fresh' || key === 'new') return 'Fresh';
  if (key === 'in service') return 'In Service';
  if (key === 'service done') return 'Service Done';
  if (key === 'lost') return 'Lost';
  if (key === 'unknown' || !s) return 'Unknown';
  const allowed: SuggestedStatus[] = [
    'Fresh',
    'Interested',
    'He will visit',
    'Follow-up',
    'Booking confirmed',
    'In Service',
    'Service Done',
    'Lost',
    'Ringing / No answer',
    'Unknown',
  ];
  return allowed.find((x) => x.toLowerCase() === key) || 'Unknown';
}

export const MYFNG_USPS = [
  'Free pickup & drop',
  'Photo/video proof of work',
  'OEM/OES spare parts only',
  'Transparent pricing (no hidden charges)',
  'Warranty (3 months / 1,000 km)',
  'Same-day service',
  'Free inspection & top-up (within 6 months / 5,000 km)',
  '50+ A-grade workshops',
] as const;

export type CallIqSopAudit = {
  lead_source_tagged: YesNoUnknown;
  asked_location: YesNoUnknown;
  asked_car_model: YesNoUnknown;
  asked_last_service: YesNoUnknown;
  asked_urgency: YesNoUnknown;
  registration_before_pricing: YesNoUnknown;
  service_type_confirmed: YesNoUnknown;
  customer_location: string | null;
  customer_car_model: string | null;
  last_service: string | null;
  urgency: string | null;
  registration_number: string | null;
  service_type: string | null;
  service_type_preference: ServicePref;
  pickup_option_asked: YesNoUnknown;
  customer_problems_reported: string | null;
  customer_need: string | null;
  customer_reference_source: string | null;
  customer_objections: string | null;
  objection_handling_notes: string | null;
  objection_handling_quality: ObjectionQuality;
  myfng_introduced: YesNoUnknown;
  consultative_pitch: YesNoUnknown;
  usps_highlighted: string[];
  usps_missed: string[];
  closing_attempt: ClosingAttempt;
  urgency_fomo_used: YesNoUnknown;
  next_follow_up: string | null;
  tone_and_confidence: ToneConfidence;
  listening_vs_talking: ListeningVsTalking;
  language_adaptability: LanguageAdapt;
  professionalism: YesNoUnknown;
  lead_status_updated: string | null;
  suggested_lead_status: SuggestedStatus;
  lost_reason: string | null;
  summary_of_call: string | null;
  client_overview: string | null;
  customer_intent_level: IntentLevel;
  decision_stage: DecisionStage;
  overall_score: number;
  section_scores: {
    reception: number;
    qualification: number;
    pitch: number;
    objections: number;
    closing: number;
    soft_skills: number;
    outcome: number;
  };
  positive_highlights: string[];
  improvement_suggestions: string[];
  engine: 'free_sop_v1' | 'openai_sop_v1';
  audit_source: 'transcript' | 'notes';
  call_transcript: string | null;
};

export type AnalyzeSopInput = AnalyzeCallInput & {
  lead_source?: string | null;
  vehicle_number?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  city?: string | null;
  call_transcript?: string | null;
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

function clip(s: string, n = 180) {
  const t = s.trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

function yn(hit: boolean, unknownWhenEmpty = false, empty = false): YesNoUnknown {
  if (unknownWhenEmpty && empty) return 'Unknown';
  return hit ? 'Yes' : 'No';
}

const LOCATION_RE =
  /\b(mumbai|thane|navi|andheri|borivali|pune|kharghar|vashi|kalyan|dombivli|powai|bandra|malad|goregaon|dadar|csmt|location|area|city|sector|locality|address|ghar|idhar|udhar)\b/i;
const CAR_RE =
  /\b(swift|alto|i20|creta|nexon|brezza|baleno|innova|venue|sonet|city|amaze|wagon|dzire|ertiga|fortuner|thar|scorpio|honda|hyundai|maruti|tata|kia|mahindra|toyota|skoda|vw|volkswagen|model|gaadi|car|make)\b/i;
const LAST_SVC_RE =
  /\b(last service|serviced|service hue|mahine|months? ago|km|odometer|pehle kab|last time)\b/i;
const URGENCY_RE =
  /\b(today|tomorrow|is week|this week|urgent|jaldi|abhi|weekend|kal|aaj|turant|asap)\b/i;
const REG_RE = /\b[A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{4}\b/i;
const PRICE_RE = /\b(price|kitna|rs\.?|₹|quote|estimate|charge|rate|mehnga|expensive|budget)\b/i;
const PICKUP_RE = /\b(pickup|pick up|pick-up|ghar se|collect|drop)\b/i;
const VISIT_RE = /\b(visit|aaunga|aunga|workshop aata|khud aunga|walk.?in)\b/i;
const BOOK_RE = /\b(book|booking|slot|appointment|confirm|hold karo|schedule)\b/i;
const INTRO_RE = /\b(my\s*fng|50\+?\s*(a-?grade)?\s*workshop|verified workshop)\b/i;
const CALLBACK_RE = /\b(callback|call later|baad mein|kal call|follow.?up|ring later)\b/i;
const LOST_RE = /\b(not interested|nahi chahiye|lost|reject|do not call|wrong number)\b/i;
const FOMO_RE = /\b(weekend|slot.*(fill|full)|weekday|jaldi book|limited)\b/i;
const TRUST_HANDLE_RE = /\b(warranty|photo|video|oem|oes|proof|transparent)\b/i;
const VALUE_HANDLE_RE = /\b(value|warranty|pickup|oem|parts|quality|package)\b/i;
const DISCOUNT_RE = /\b(discount|kam karo|sasta|offer de do)\b/i;

const USP_PATTERNS: Array<{ label: (typeof MYFNG_USPS)[number]; re: RegExp }> = [
  { label: 'Free pickup & drop', re: /\b(pickup|pick up|pick-up|drop)\b/i },
  { label: 'Photo/video proof of work', re: /\b(photo|video|pics?|proof)\b/i },
  { label: 'OEM/OES spare parts only', re: /\b(oem|oes|genuine|original parts)\b/i },
  { label: 'Transparent pricing (no hidden charges)', re: /\b(transparent|no hidden|estimate|quote)\b/i },
  { label: 'Warranty (3 months / 1,000 km)', re: /\b(warranty|guarantee|3\s*month|1000\s*km)\b/i },
  { label: 'Same-day service', re: /\b(same.?day|aaj hi|same day)\b/i },
  { label: 'Free inspection & top-up (within 6 months / 5,000 km)', re: /\b(inspection|top-?up|5000)\b/i },
  { label: '50+ A-grade workshops', re: /\b(50\+|a-?grade|verified workshop|my\s*fng)\b/i },
];

function suggestedStatus(input: AnalyzeSopInput, text: string, answered: boolean): SuggestedStatus {
  const st = String(input.lead_status || '').toUpperCase();
  if (st === 'VALIDATED' || BOOK_RE.test(text)) return 'Booking confirmed';
  if (st === 'IN_PROGRESS') return 'In Service';
  if (st === 'COMPLETED') return 'Service Done';
  if (st === 'REJECTED' || st === 'CANCELLED' || LOST_RE.test(text)) return 'Lost';
  if (/\b(will visit|he will visit|aaunga|visit)\b/i.test(text)) return 'He will visit';
  if (/\binterested\b/i.test(text)) return 'Interested';
  if (CALLBACK_RE.test(text)) return 'Follow-up';
  if (!answered || /\[ringing\]|no answer|call cut/i.test(text)) return 'Ringing / No answer';
  return 'Fresh';
}

function decisionFrom(text: string, closing: ClosingAttempt, intent: IntentLevel): DecisionStage {
  if (closing === 'Clear Ask' || BOOK_RE.test(text) || intent === 'High') return 'Closing';
  if (intent === 'Medium' || PRICE_RE.test(text) || /consider/i.test(text)) return 'Consideration';
  return 'Only Checking';
}

export function analyzeSopFree(input: AnalyzeSopInput): CallIqSopAudit {
  const transcript = clean(input.call_transcript);
  const notes = transcript || clean(input.notes);
  const response = clean(input.customer_response);
  const problem = clean(input.problem_description);
  const text = [notes, response, problem, input.outcome, input.service_type].filter(Boolean).join(' · ');
  const empty = text.length < 8;
  const status = String(input.call_status || '').toUpperCase();
  const dur = Number(input.call_duration) || 0;
  const answered =
    status === 'ANSWERED' || status === 'COMPLETED' || status === 'CONNECTED' || dur > 0;

  const city = clean(input.city);
  const carFromLead = [input.vehicle_make, input.vehicle_model].filter(Boolean).join(' ').trim();
  const regLead = clean(input.vehicle_number);
  const locHit = LOCATION_RE.test(text) || Boolean(city);
  const carHit = CAR_RE.test(text) || Boolean(carFromLead);
  const lastHit = LAST_SVC_RE.test(text);
  const urgHit = URGENCY_RE.test(text);
  const regHit = REG_RE.test(text) || Boolean(regLead && regLead !== 'PENDING' && regLead !== 'NA');
  const priced = PRICE_RE.test(text);
  const pickupAsked = PICKUP_RE.test(text);
  const visitPref = VISIT_RE.test(text);
  const booked = BOOK_RE.test(text);
  const intro = INTRO_RE.test(text);
  const uspsHighlighted = USP_PATTERNS.filter((u) => u.re.test(text)).map((u) => u.label);
  const uspsMissed = MYFNG_USPS.filter((u) => !uspsHighlighted.includes(u));

  const askedLocation = yn(locHit, true, empty);
  const askedCar = yn(carHit, true, empty);
  const askedLast = yn(lastHit, true, empty);
  const askedUrg = yn(urgHit, true, empty);
  const regBeforePrice = !priced ? (regHit ? 'Yes' : empty ? 'Unknown' : 'No') : yn(regHit);
  const svcConfirmed = yn(Boolean(clean(input.service_type)) || /\b(periodic|repair|ac|brake|dent|paint|service)\b/i.test(text), true, empty);

  const objections = PRICE_RE.test(text) || /trust|mechanic|soch|think/i.test(text)
    ? clip(text.match(/\b(.{0,40}(price|kitna|mechanic|trust|soch|think).{0,40})\b/i)?.[0] || 'Price / trust mentioned')
    : null;
  let objQuality: ObjectionQuality = 'Not Applicable';
  if (objections) {
    if (VALUE_HANDLE_RE.test(text) && !DISCOUNT_RE.test(text)) objQuality = 'Strong';
    else if (TRUST_HANDLE_RE.test(text) || VALUE_HANDLE_RE.test(text)) objQuality = 'Average';
    else objQuality = 'Weak';
  }

  const closing: ClosingAttempt = booked ? 'Clear Ask' : /book|slot|visit/i.test(text) ? 'Weak Ask' : answered ? 'No Ask' : 'No Ask';
  const suggested = suggestedStatus(input, text, answered);
  const intent: IntentLevel = booked || suggested === 'Booking confirmed'
    ? 'High'
    : suggested === 'Interested' || suggested === 'He will visit' || priced
      ? 'Medium'
      : 'Low';
  const decision = decisionFrom(text, closing, intent);

  const qualYes = [askedLocation, askedCar, askedLast, askedUrg, regBeforePrice, svcConfirmed].filter((x) => x === 'Yes').length;
  const reception = input.lead_source ? 10 : empty ? 4 : 2;
  const qualification = Math.round((qualYes / 6) * 25);
  const pitch = Math.min(20, (intro ? 6 : 0) + uspsHighlighted.length * 2);
  const objectionsScore =
    objQuality === 'Strong' ? 15 : objQuality === 'Average' ? 10 : objQuality === 'Weak' ? 4 : answered ? 10 : 5;
  const closingScore = closing === 'Clear Ask' ? 15 : closing === 'Weak Ask' ? 8 : answered ? 3 : 6;
  const soft = answered && notes.length >= 20 ? 8 : answered ? 5 : 4;
  const outcome = suggested === 'Unknown' ? 2 : 5;
  const overall = Math.max(0, Math.min(100, reception + qualification + pitch + objectionsScore + closingScore + soft + outcome));

  const improvements: string[] = [];
  if (askedLocation !== 'Yes') improvements.push('Ask location / area first');
  if (askedCar !== 'Yes') improvements.push('Confirm car make & model');
  if (askedLast !== 'Yes') improvements.push('Ask last service date / km');
  if (askedUrg !== 'Yes') improvements.push('Ask urgency (today / this week)');
  if (regBeforePrice !== 'Yes') improvements.push('Take registration number before quoting');
  if (uspsMissed.length >= 4) improvements.push('Pitch more USPs (pickup, photos, warranty, OEM/OES)');
  if (closing === 'No Ask' && answered) improvements.push('Ask for booking confirmation / hold a slot');
  if (pickupAsked !== 'Yes' && answered) improvements.push('Offer free pickup & drop');

  const highlights: string[] = [];
  if (intro) highlights.push('MY FNG / workshop network introduced');
  if (uspsHighlighted.length) highlights.push(`USPs covered: ${uspsHighlighted.slice(0, 3).join(', ')}`);
  if (closing === 'Clear Ask') highlights.push('Clear booking ask');
  if (objQuality === 'Strong') highlights.push('Objection handled with value, not discount');
  if (regHit) highlights.push('Registration captured');

  const pref: ServicePref = pickupAsked && !visitPref ? 'Pickup' : visitPref ? 'Workshop Visit' : 'Not Decided';

  return {
    lead_source_tagged: input.lead_source ? 'Yes' : 'No',
    asked_location: askedLocation,
    asked_car_model: askedCar,
    asked_last_service: askedLast,
    asked_urgency: askedUrg,
    registration_before_pricing: regBeforePrice,
    service_type_confirmed: svcConfirmed,
    customer_location: city || (LOCATION_RE.test(text) ? clip(text, 80) : null),
    customer_car_model: carFromLead || null,
    last_service: lastHit ? 'Mentioned in notes' : null,
    urgency: urgHit ? 'Mentioned in notes' : null,
    registration_number: regLead && regLead !== 'PENDING' ? regLead : REG_RE.test(text) ? text.match(REG_RE)?.[0] || null : null,
    service_type: clean(input.service_type) || null,
    service_type_preference: pref,
    pickup_option_asked: yn(pickupAsked, true, empty),
    customer_problems_reported: problem || (notes ? clip(notes, 160) : null),
    customer_need: clean(input.service_type) || (pickupAsked ? 'Pickup service' : null),
    customer_reference_source: clean(input.lead_source) || null,
    customer_objections: objections,
    objection_handling_notes:
      objQuality === 'Not Applicable' ? null : objQuality === 'Strong' ? 'Value / warranty / proof used' : 'Needs stronger value pitch',
    objection_handling_quality: objQuality,
    myfng_introduced: yn(intro, true, empty),
    consultative_pitch: yn((locHit || carHit) && uspsHighlighted.length > 0, true, empty),
    usps_highlighted: uspsHighlighted,
    usps_missed: [...uspsMissed],
    closing_attempt: closing,
    urgency_fomo_used: yn(FOMO_RE.test(text), true, empty),
    next_follow_up: CALLBACK_RE.test(text) ? 'Customer asked later callback' : null,
    tone_and_confidence: answered && notes.length >= 20 ? 'Polite and Confident' : answered && dur > 0 && dur < 20 ? 'Rushed' : 'Unclear',
    listening_vs_talking: notes.length >= 24 ? 'Listened Well' : answered ? 'Unknown' : 'Unknown',
    language_adaptability: /[\u0900-\u097F]|\b(haan|ji|theek|accha)\b/i.test(text)
      ? 'Yes Customers Language'
      : 'Yes Customers Language',
    professionalism: answered ? 'Yes' : 'Unknown',
    lead_status_updated: clean(input.lead_status) || null,
    suggested_lead_status: suggested,
    lost_reason: suggested === 'Lost' ? clip(text, 120) : null,
    summary_of_call: notes ? clip(notes, 240) : answered ? 'Connected — notes thin' : 'No connect',
    client_overview: [carFromLead, city, clean(input.service_type)].filter(Boolean).join(' · ') || null,
    customer_intent_level: intent,
    decision_stage: decision,
    overall_score: overall,
    section_scores: {
      reception,
      qualification,
      pitch,
      objections: objectionsScore,
      closing: closingScore,
      soft_skills: soft,
      outcome,
    },
    positive_highlights: highlights.slice(0, 6),
    improvement_suggestions: improvements.slice(0, 8),
    engine: 'free_sop_v1',
    audit_source: clean(input.call_transcript) ? 'transcript' : 'notes',
    call_transcript: clean(input.call_transcript) || null,
  };
}

function sopJsonSchemaHint() {
  return `{
  "lead_source_tagged": "Yes|No|Unknown",
  "asked_location": "Yes|No|Unknown",
  "asked_car_model": "Yes|No|Unknown",
  "asked_last_service": "Yes|No|Unknown",
  "asked_urgency": "Yes|No|Unknown",
  "registration_before_pricing": "Yes|No|Unknown",
  "service_type_confirmed": "Yes|No|Unknown",
  "customer_location": "string|null",
  "customer_car_model": "string|null",
  "last_service": "string|null",
  "urgency": "string|null",
  "registration_number": "string|null",
  "service_type": "string|null",
  "service_type_preference": "Pickup|Workshop Visit|Not Decided",
  "pickup_option_asked": "Yes|No|Unknown",
  "customer_problems_reported": "string|null",
  "customer_need": "string|null",
  "customer_reference_source": "string|null",
  "customer_objections": "string|null",
  "objection_handling_notes": "string|null",
  "objection_handling_quality": "Strong|Average|Weak|Not Applicable",
  "myfng_introduced": "Yes|No|Unknown",
  "consultative_pitch": "Yes|No|Unknown",
  "usps_highlighted": ["..."],
  "usps_missed": ["..."],
  "closing_attempt": "Clear Ask|Weak Ask|No Ask",
  "urgency_fomo_used": "Yes|No|Unknown",
  "next_follow_up": "string|null",
  "tone_and_confidence": "Polite and Confident|Rushed|Unclear|Poor",
  "listening_vs_talking": "Listened Well|Interrupted Often|Unknown",
  "language_adaptability": "Yes Customers Language|No",
  "professionalism": "Yes|No|Unknown",
  "lead_status_updated": "string|null",
  "suggested_lead_status": "Fresh|Interested|He will visit|Follow-up|Booking confirmed|In Service|Service Done|Lost|Ringing / No answer|Unknown",
  "lost_reason": "string|null",
  "summary_of_call": "string",
  "client_overview": "string",
  "customer_intent_level": "Low|Medium|High",
  "decision_stage": "Only Checking|Consideration|Closing",
  "overall_score": 0,
  "section_scores": { "reception": 0, "qualification": 0, "pitch": 0, "objections": 0, "closing": 0, "soft_skills": 0, "outcome": 0 },
  "positive_highlights": ["..."],
  "improvement_suggestions": ["..."]
}`;
}

function normalizeSop(parsed: any, fallback: CallIqSopAudit): CallIqSopAudit {
  const pick = (key: keyof CallIqSopAudit, allowed?: string[]) => {
    const v = parsed?.[key];
    if (v == null || v === '') return fallback[key];
    if (allowed && !allowed.includes(String(v))) return fallback[key];
    return v;
  };
  const ynA = ['Yes', 'No', 'Unknown'];
  const uspsH = Array.isArray(parsed?.usps_highlighted)
    ? parsed.usps_highlighted.map(String).slice(0, 10)
    : fallback.usps_highlighted;
  const uspsM = Array.isArray(parsed?.usps_missed)
    ? parsed.usps_missed.map(String).slice(0, 10)
    : fallback.usps_missed;
  const ss = parsed?.section_scores || {};
  const score = Math.max(0, Math.min(100, Number(parsed?.overall_score) || fallback.overall_score));
  return {
    ...fallback,
    lead_source_tagged: pick('lead_source_tagged', ynA) as YesNoUnknown,
    asked_location: pick('asked_location', ynA) as YesNoUnknown,
    asked_car_model: pick('asked_car_model', ynA) as YesNoUnknown,
    asked_last_service: pick('asked_last_service', ynA) as YesNoUnknown,
    asked_urgency: pick('asked_urgency', ynA) as YesNoUnknown,
    registration_before_pricing: pick('registration_before_pricing', ynA) as YesNoUnknown,
    service_type_confirmed: pick('service_type_confirmed', ynA) as YesNoUnknown,
    customer_location: parsed?.customer_location != null ? String(parsed.customer_location) : fallback.customer_location,
    customer_car_model: parsed?.customer_car_model != null ? String(parsed.customer_car_model) : fallback.customer_car_model,
    last_service: parsed?.last_service != null ? String(parsed.last_service) : fallback.last_service,
    urgency: parsed?.urgency != null ? String(parsed.urgency) : fallback.urgency,
    registration_number: parsed?.registration_number != null ? String(parsed.registration_number) : fallback.registration_number,
    service_type: parsed?.service_type != null ? String(parsed.service_type) : fallback.service_type,
    service_type_preference: pick('service_type_preference', ['Pickup', 'Workshop Visit', 'Not Decided']) as ServicePref,
    pickup_option_asked: pick('pickup_option_asked', ynA) as YesNoUnknown,
    customer_problems_reported: parsed?.customer_problems_reported != null ? String(parsed.customer_problems_reported) : fallback.customer_problems_reported,
    customer_need: parsed?.customer_need != null ? String(parsed.customer_need) : fallback.customer_need,
    customer_reference_source: parsed?.customer_reference_source != null ? String(parsed.customer_reference_source) : fallback.customer_reference_source,
    customer_objections: parsed?.customer_objections != null ? String(parsed.customer_objections) : fallback.customer_objections,
    objection_handling_notes: parsed?.objection_handling_notes != null ? String(parsed.objection_handling_notes) : fallback.objection_handling_notes,
    objection_handling_quality: pick('objection_handling_quality', ['Strong', 'Average', 'Weak', 'Not Applicable']) as ObjectionQuality,
    myfng_introduced: pick('myfng_introduced', ynA) as YesNoUnknown,
    consultative_pitch: pick('consultative_pitch', ynA) as YesNoUnknown,
    usps_highlighted: uspsH,
    usps_missed: uspsM,
    closing_attempt: pick('closing_attempt', ['Clear Ask', 'Weak Ask', 'No Ask']) as ClosingAttempt,
    urgency_fomo_used: pick('urgency_fomo_used', ynA) as YesNoUnknown,
    next_follow_up: parsed?.next_follow_up != null ? String(parsed.next_follow_up) : fallback.next_follow_up,
    tone_and_confidence: pick('tone_and_confidence', ['Polite and Confident', 'Rushed', 'Unclear', 'Poor']) as ToneConfidence,
    listening_vs_talking: pick('listening_vs_talking', ['Listened Well', 'Interrupted Often', 'Unknown']) as ListeningVsTalking,
    language_adaptability: pick('language_adaptability', ['Yes Customers Language', 'No']) as LanguageAdapt,
    professionalism: pick('professionalism', ynA) as YesNoUnknown,
    lead_status_updated: parsed?.lead_status_updated != null ? String(parsed.lead_status_updated) : fallback.lead_status_updated,
    suggested_lead_status: toCrmSuggestedStatus(
      parsed?.suggested_lead_status ?? fallback.suggested_lead_status,
    ),
    lost_reason: parsed?.lost_reason != null ? String(parsed.lost_reason) : fallback.lost_reason,
    summary_of_call: parsed?.summary_of_call != null ? String(parsed.summary_of_call) : fallback.summary_of_call,
    client_overview: parsed?.client_overview != null ? String(parsed.client_overview) : fallback.client_overview,
    customer_intent_level: pick('customer_intent_level', ['Low', 'Medium', 'High']) as IntentLevel,
    decision_stage: pick('decision_stage', ['Only Checking', 'Consideration', 'Closing']) as DecisionStage,
    overall_score: score,
    section_scores: {
      reception: Number(ss.reception) || fallback.section_scores.reception,
      qualification: Number(ss.qualification) || fallback.section_scores.qualification,
      pitch: Number(ss.pitch) || fallback.section_scores.pitch,
      objections: Number(ss.objections) || fallback.section_scores.objections,
      closing: Number(ss.closing) || fallback.section_scores.closing,
      soft_skills: Number(ss.soft_skills) || fallback.section_scores.soft_skills,
      outcome: Number(ss.outcome) || fallback.section_scores.outcome,
    },
    positive_highlights: Array.isArray(parsed?.positive_highlights)
      ? parsed.positive_highlights.map(String).slice(0, 8)
      : fallback.positive_highlights,
    improvement_suggestions: Array.isArray(parsed?.improvement_suggestions)
      ? parsed.improvement_suggestions.map(String).slice(0, 8)
      : fallback.improvement_suggestions,
    engine: 'openai_sop_v1',
    audit_source: fallback.audit_source,
    call_transcript: fallback.call_transcript,
  };
}

export async function analyzeSopWithOpenAI(
  input: AnalyzeSopInput,
  playbook?: SalesPlaybook | null,
): Promise<{ sop: CallIqSopAudit; used_openai: boolean; warning?: string }> {
  const transcript = clean(input.call_transcript);
  const withTranscript: AnalyzeSopInput = transcript
    ? { ...input, notes: transcript, call_transcript: transcript }
    : input;
  const fallback = analyzeSopFree(withTranscript);
  const book = playbook || defaultSalesPlaybook();
  if (!OPENAI_API_KEY) {
    return { sop: fallback, used_openai: false, warning: 'OPENAI_API_KEY missing — free SOP used' };
  }
  const notes = clean(withTranscript.notes);
  if (!transcript && !notes && !clean(input.problem_description) && !clean(input.customer_response)) {
    return { sop: fallback, used_openai: false, warning: 'No recording transcript or notes — cannot Deep AI' };
  }

  const context = {
    call_status: input.call_status,
    call_duration_sec: input.call_duration,
    outcome: input.outcome,
    audit_source: transcript ? 'recording_transcript' : 'agent_notes',
    recording_transcript: transcript || null,
    agent_notes: clean(input.notes),
    customer_response: clean(input.customer_response),
    lead_problem_description: clean(input.problem_description),
    service_type: clean(input.service_type),
    lead_status: input.lead_status,
    lead_source: input.lead_source,
    vehicle_number: input.vehicle_number,
    vehicle_make: input.vehicle_make,
    vehicle_model: input.vehicle_model,
    city: input.city,
  };

  const system = `${book.call_iq_prompt}

SALES PLAYBOOK (ground truth — score against this, do not invent):
Voice & Style: ${book.voice_style}
Who we sell to: ${clip(book.icp, 900)}
Product features / USPs: ${clip(book.product_features, 900)}
Pricing: ${clip(book.pricing, 700)}
Objection handling: ${clip(book.objection_handling, 900)}
Competitors: ${clip(book.competitors, 700)}

Rules:
- If recording_transcript is present, that IS the call. Score SOP from the transcript (listen via text).
- Do NOT invent facts not present in the transcript / notes / lead fields.
- Agent notes are secondary. Prefer the transcript when they conflict.
- Return ONLY valid JSON matching the schema.`;

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
          {
            role: 'user',
            content: `Audit this MY FNG sales call against the SOP.\n\nCONTEXT:\n${JSON.stringify(context, null, 2)}\n\nReturn JSON:\n${sopJsonSchemaHint()}\n\nAlso fill these Call-IQ output fields:\n${fieldsToSchemaHint(DEFAULT_SOP_NEW_FIELDS)}`,
          },
        ],
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { sop: fallback, used_openai: false, warning: `OpenAI SOP failed (${res.status}) ${clip(errText, 100)}` };
    }
    const json = await res.json();
    const raw = String(json?.choices?.[0]?.message?.content || '').trim();
    const parsed = JSON.parse(raw);
    return { sop: normalizeSop(parsed, fallback), used_openai: true };
  } catch (e: any) {
    return { sop: fallback, used_openai: false, warning: e?.message || 'SOP AI parse failed' };
  }
}

export function attachSopToAnalysis(
  analysis: CallAnalysisResult,
  sop: CallIqSopAudit,
): CallAnalysisResult {
  const quality = Math.round(analysis.quality_score * 0.45 + sop.overall_score * 0.55);
  const grade = quality >= 85 ? 'A' : quality >= 70 ? 'B' : quality >= 55 ? 'C' : quality >= 40 ? 'D' : 'F';
  return {
    ...analysis,
    quality_score: quality,
    quality_grade: grade,
    buying_intent:
      sop.customer_intent_level === 'High'
        ? 'HIGH'
        : sop.customer_intent_level === 'Medium'
          ? 'MEDIUM'
          : sop.customer_intent_level === 'Low'
            ? 'LOW'
            : analysis.buying_intent,
    coaching_tips: Array.from(
      new Set([...(analysis.coaching_tips || []), ...sop.improvement_suggestions]),
    ).slice(0, 8),
    summary: [sop.summary_of_call || analysis.summary, `SOP ${sop.overall_score}/100`, sop.suggested_lead_status]
      .filter(Boolean)
      .join(' · '),
    sop_audit: sop,
    engine:
      sop.engine === 'openai_sop_v1'
        ? 'openai_deep_v1'
        : analysis.engine,
  };
}
