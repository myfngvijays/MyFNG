/**
 * Default MY FNG sales playbook — same grounding TeleCRM Call-IQ / Lead-IQ used.
 * Editable from AI Suite → Sales Playbook.
 */

export const DEFAULT_CALL_IQ_PROMPT = `You are a call quality auditor for MY FNG’s sales team.
Listen to the call and check if the agent followed MY FNG Sales SOP & Pitch.
Audit Checklist:
1. Lead Reception
- Lead source tagged in TeleCRM?
2. Qualification
- Asked 4 Qs: Location, Car Model, Last Service, Urgency (today/this week)?
- Took Registration Number before sharing pricing.
- Confirmed service type (Periodic / Repair, engine, AC, brake, denting, painting, etc.).
3. Pitch (USPs)
- Introduced MY FNG clearly (50+ A-grade workshops)?
- Highlighted USPs:
- Free pickup & drop
- Photo/video proof of work
- OEM/OES spare parts only
- Transparent pricing (no hidden charges)
- Warranty (3 months / 1,000 km)
- Same-day service
- Free inspection & top-up (within 6 months / 5,000 km)
Pitch should be consultative (ask needs first, suggest plans), not pushy.
Personalize as per car/service need (General, Premium, Platinum, Custom Repairs).
4. Objection Handling
- Price → handled with value (not discount)?
- Trust → handled with warranty/photos/videos?
- Technical doubt → escalated to expert?
5. Closing
- Asked for booking confirmation?
- Use soft urgency (weekend slots fill fast, weekday benefit).
6. Soft Skills
- Warm, polite, confident tone.
- Listen more than speak.
- Avoid slang, rushing, background noise.
- Use customer’s preferred language (Hindi, Marathi, English).
7. Outcome
- Lead Status updated - Auto Status Definitions (very important):
- Attempt Contact → You called but no answer / not reachable.
- Follow-Up → Customer asked to call later.
- He Will Visit → Customer said he’ll visit workshop within 2 months.
- Interested → Customer wants service in future (within 1 month).
- Appointment Scheduled → Customer confirmed booking in 1–2 days.
- If Lost, was reason captured?
Map those TeleCRM labels onto MY FNG CRM statuses when you return suggested_lead_status:
- Attempt Contact → Ringing / No answer
- Follow-Up → Follow-up
- He Will Visit → He will visit
- Appointment Scheduled → Booking confirmed
- Interested → Interested
- Lost → Lost
Extra Capture:
- Customer answers (Location, Car Model, Last Service, Urgency, Reg. no.)
- Customer problems/issues & objections
- Which USPs highlighted vs missed
- Pickup option offered (Y/N)
- Customer need & preference (Pickup/Visit)
- Call summary & client overview
- Customer intent (Low/Medium/High)
- Decision stage (Checking / Consideration / Closing)
- Positive highlights & improvement suggestions
- Overall score out of 100
Return results strictly in structured fields.`;

export const DEFAULT_LEAD_IQ_PROMPT = `You are this rep's sales strategist for one lead. The rep already has the lead in front of them - your job is to read between the lines and tell them what the lead's situation actually means and how to win it. Study the lead's fields and the full timeline of actions as evidence, then think like someone who has closed thousands of deals: where does this person really stand, what is driving them, and what is the smartest next move.

Produce intelligence the rep could not arrive at on their own. For each field in the schema, deliver a judgement - read the buyer's intent and temperature, surface the hidden risk or objection, and give them the exact angle, words, or move that advances the deal. Treat the stored data as raw material for reasoning, not as the answer: bring a fact forward only when it is the reason behind your call, and even then lead with the insight. Skip anything the rep can already read off the lead, and never restate contact details.

Make every conclusion unmistakably about this lead - cite the real names, dates, amounts, and prior interactions that justify it. No generic, copy-paste advice. Fill every field defined in the schema.

Hold pricing firm unless the negotiation guidance in the system prompt says otherwise. Write each field in the same language as the workspace's configured language.

Return only the JSON object that matches the schema. Do not include any kind of id in your answers. For whatsapp and call script, return the template message and call script directly respectively without any extra details. For facts, do not mention the lead fields information again, derive facts from the action.`;

export const DEFAULT_ICP = `MY FNG serves individual car owners in Mumbai, Navi Mumbai, Thane, and surrounding areas who own out-of-warranty or non-warranty passenger vehicles and want a trustworthy alternative to expensive authorized service centers or unreliable local garages.

Ideal customers include:
1. Car owners whose vehicles are 3+ years old.
2. First, second, or third owners.
3. Working professionals, business owners, doctors, IT professionals, and families.
4. Customers who value transparency, convenience, genuine parts, pickup & drop, and digital service updates.
5. Customers searching online for car service, maintenance, repairs, denting & painting, AC repair, battery replacement, insurance repairs, or periodic servicing.
6. Customers dissatisfied with dealership pricing or who have had poor experiences with local garages.
7. Customers looking for quality over the cheapest price.

Buying signals:
1. Service is due or overdue.
2. Warning light or mechanical issue.
3. Wants an estimate before visiting.
4. Wants pickup & drop.
5. Wants photos/videos during service.
6. Comparing garages.
7. Looking for a trusted long-term service partner.`;

export const DEFAULT_PRODUCT_FEATURES = `MY FNG is a technology-enabled car service platform that connects customers with verified, high-quality multi-brand workshops while providing a transparent, convenient, and trustworthy servicing experience.

1. Car Periodic Service — scheduled maintenance using OEM/OES parts and high-quality oils.
2. Free Pickup & Drop — collect/return the vehicle from customer location.
3. Transparent Service Process — real-time photos and videos before, during, and after servicing.
4. Genuine OEM/OES Parts — reliability and long-term performance.
5. Service Warranty — eligible services backed by warranty (3 months / 1,000 km).
6. Same-Day Delivery (where possible) — minimize vehicle downtime.
7. Fixed & Transparent Pricing — estimates before work, no hidden charges.
8. Mechanical Repairs — engine, suspension, brakes, AC by experienced technicians.
9. Denting & Painting — professional body repairs and paint restoration.
10. Free inspection & top-up within 6 months / 5,000 km.`;

export const DEFAULT_PRICING = `MY FNG pricing is transparent and depends on car make, model, fuel type, year, and the job.

Collect the customer's car registration number or make, model, fuel type, and year BEFORE quoting.

Service packages:
- Basic / General Service — essential maintenance for regularly maintained vehicles.
- Premium Service — premium engine oil; maximum protection.
- Platinum / Custom Repairs — mechanical, AC, brake, denting & painting as needed.

Principles:
- Share estimates before work starts.
- Get customer approval before execution.
- Do not lead with discount. Sell value (warranty, OEM/OES, photos, pickup).
- Hold pricing firm unless negotiation guidance says otherwise.`;

export const DEFAULT_OBJECTION_HANDLING = `Objection: "I'll think about it."
Response: Clarify whether the hold-up is price, trust, or timing. Offer a clear next step (estimate on reg. no. / hold a weekday slot).

Objection: "I'll call my regular mechanic."
Response: Position transparency, documented photos/videos, warranty, and convenience vs local garage guesswork.

Objection: "I'm just checking prices."
Response: Ask for registration number + make/model to give a personalized accurate estimate — not a generic number.

Objection: "My car is running fine."
Response: Regular service prevents expensive repairs and improves safety / fuel efficiency. Offer inspection + top-up promise.

Objection: "I don't have time."
Response: Promote Free pickup & drop so they don't visit the workshop.

Objection: "I'll service it next month."
Response: Ask last service date. Warn delay can raise cost. Offer a future booking date now.`;

export const DEFAULT_COMPETITORS = `Primary competitors: Authorized Service Centers (Maruti, Hyundai, Tata, Mahindra, Honda, Toyota, Kia, etc.).

Competitor strengths: manufacturer-backed service, brand-specific expertise, genuine OEM parts, best for vehicles still under warranty.

Where MY FNG wins:
1. More affordable than most dealerships (out-of-warranty cars).
2. Free pickup & drop.
3. Transparent pricing.
4. Photo & video updates during servicing.
5. Faster turnaround for routine services.
6. Personalized customer support.
7. Access to verified multi-brand A-grade workshops.

Always position MY FNG positively. Do not criticise competitors.`;

export const DEFAULT_VOICE_STYLE = `Warm, polite, confident. Consultative — ask needs first, then suggest General / Premium / Platinum / custom repair. Hindi, Marathi, or English matching the customer. No slang, no rushing, no pushy discounting.`;

/** All MY FNG CRM lead statuses (same names as Lead Status picker) */
export const ALL_CRM_LEAD_STATUS_NAMES = [
  'Fresh',
  'Interested',
  'He will visit',
  'Follow-up',
  'Booking confirmed',
  'In Service',
  'Ringing / No answer',
  'Service Done',
  'Lost',
] as const;

/** Default workflow filter — open pipeline (not won/lost/in-service) */
export const DEFAULT_CALL_IQ_LEAD_STATUSES = [
  'Fresh',
  'Interested',
  'He will visit',
  'Follow-up',
  'Ringing / No answer',
];

const LEGACY_TELECRM_STATUS =
  /FRESH 2|ATTEMPTED CONTACT|ATTEMPT CONTACT|CREATED ON/i;

export type CallIqWorkflowConfig = {
  enabled: boolean;
  min_duration_sec: number;
  lead_statuses: string[];
  use_deep_ai: boolean;
  skip_if_sop_exists: boolean;
};

export function defaultCallIqWorkflow(): CallIqWorkflowConfig {
  return {
    enabled: true,
    min_duration_sec: 90,
    lead_statuses: [...DEFAULT_CALL_IQ_LEAD_STATUSES],
    use_deep_ai: true,
    skip_if_sop_exists: true,
  };
}

export function mergeCallIqWorkflow(raw?: Partial<CallIqWorkflowConfig> | null): CallIqWorkflowConfig {
  const base = defaultCallIqWorkflow();
  if (!raw || typeof raw !== 'object') return base;
  const incoming = Array.isArray(raw.lead_statuses)
    ? raw.lead_statuses.map((s) => String(s).trim()).filter(Boolean)
    : [];
  const legacy = incoming.some((s) => LEGACY_TELECRM_STATUS.test(s));
  const statuses = !incoming.length || legacy ? base.lead_statuses : incoming;
  return {
    enabled: raw.enabled !== false,
    min_duration_sec: Math.max(0, Number(raw.min_duration_sec) || base.min_duration_sec),
    lead_statuses: statuses,
    use_deep_ai: raw.use_deep_ai !== false,
    skip_if_sop_exists: raw.skip_if_sop_exists !== false,
  };
}

export type SalesPlaybook = {
  workspace_key: string;
  detail_depth: 'concise' | 'standard' | 'detailed';
  language: string;
  voice_style: string;
  icp: string;
  product_features: string;
  pricing: string;
  objection_handling: string;
  competitors: string;
  call_iq_prompt: string;
  lead_iq_prompt: string;
  call_iq_enabled: boolean;
  lead_iq_enabled: boolean;
  call_iq_workflow?: CallIqWorkflowConfig;
  updated_at?: string | null;
};

export function defaultSalesPlaybook(): SalesPlaybook {
  return {
    workspace_key: 'myfng',
    detail_depth: 'standard',
    language: 'English',
    voice_style: DEFAULT_VOICE_STYLE,
    icp: DEFAULT_ICP,
    product_features: DEFAULT_PRODUCT_FEATURES,
    pricing: DEFAULT_PRICING,
    objection_handling: DEFAULT_OBJECTION_HANDLING,
    competitors: DEFAULT_COMPETITORS,
    call_iq_prompt: DEFAULT_CALL_IQ_PROMPT,
    lead_iq_prompt: DEFAULT_LEAD_IQ_PROMPT,
    call_iq_enabled: true,
    lead_iq_enabled: true,
    call_iq_workflow: defaultCallIqWorkflow(),
  };
}

export function mergePlaybook(row?: Partial<SalesPlaybook> | null): SalesPlaybook {
  const base = defaultSalesPlaybook();
  if (!row) return base;
  return {
    ...base,
    ...row,
    detail_depth:
      row.detail_depth === 'concise' || row.detail_depth === 'detailed'
        ? row.detail_depth
        : 'standard',
    language: String(row.language || base.language),
    voice_style: String(row.voice_style || base.voice_style),
    icp: String(row.icp || base.icp),
    product_features: String(row.product_features || base.product_features),
    pricing: String(row.pricing || base.pricing),
    objection_handling: String(row.objection_handling || base.objection_handling),
    competitors: String(row.competitors || base.competitors),
    call_iq_prompt: String(row.call_iq_prompt || base.call_iq_prompt),
    lead_iq_prompt: String(row.lead_iq_prompt || base.lead_iq_prompt),
    call_iq_enabled: row.call_iq_enabled !== false,
    lead_iq_enabled: row.lead_iq_enabled !== false,
    call_iq_workflow: mergeCallIqWorkflow(row.call_iq_workflow),
  };
}
