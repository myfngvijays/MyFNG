/** TeleCRM-style Call-IQ agents + structured output fields. */

export type CallIqFieldType = 'text' | 'number' | 'dropdown';

export type CallIqAgentField = {
  id: string;
  key: string;
  name: string;
  response_type: CallIqFieldType;
  options?: string[];
};

export type CallIqAgentVersion = {
  version: number;
  instruction: string;
  fields: CallIqAgentField[];
  created_at?: string | null;
};

export type CallIqAgent = {
  id: string;
  slug: string;
  name: string;
  provider: string;
  agent_type: string;
  current_version: number;
  /** Live SOP agent — workflow / Deep AI uses this one. */
  is_active: boolean;
  versions: CallIqAgentVersion[];
  updated_at?: string | null;
};

export const CALL_IQ_PROVIDER = 'Deep AI';

export function displayCallIqProvider(raw?: string | null) {
  const p = String(raw || '').trim();
  if (!p || /openai/i.test(p)) return CALL_IQ_PROVIDER;
  return p;
}

export const CALL_IQ_FIELD_TYPE_LABELS: Record<CallIqFieldType, string> = {
  text: 'Text',
  number: 'Number',
  dropdown: 'Dropdown',
};

export const CALL_IQ_OPTION_CHIP_CLASSES = [
  'bg-rose-100 text-rose-800',
  'bg-teal-100 text-teal-800',
  'bg-amber-100 text-amber-900',
  'bg-slate-100 text-slate-700',
  'bg-sky-100 text-sky-800',
  'bg-violet-100 text-violet-800',
  'bg-emerald-100 text-emerald-800',
  'bg-orange-100 text-orange-800',
];

function f(
  key: string,
  name: string,
  response_type: CallIqFieldType,
  options?: string[],
): CallIqAgentField {
  return { id: key, key, name, response_type, options };
}

/** Call Audit SOP New — same fields as TeleCRM Version 5 screenshots. */
export const DEFAULT_SOP_NEW_FIELDS: CallIqAgentField[] = [
  f('customer_location', 'Customer Location', 'text'),
  f('customer_car_model', 'Car Model', 'number'),
  f('last_service', 'Last Service Date', 'text'),
  f('urgency', 'Service Urgency', 'text'),
  f('registration_number', 'Registration Number', 'text'),
  f('registration_before_pricing', 'Registration Number Taken Before Pricing', 'dropdown', ['Yes', 'No']),
  f('usps_highlighted', 'USPs Highlighted', 'text'),
  f('usps_missed', 'USPs Missed', 'text'),
  f('pitch_style', 'Pitch Style', 'dropdown', ['Consultative', 'Pushy']),
  f('pitch_personalization', 'Pitch Personalization', 'dropdown', ['Yes as per car service need', 'No']),
  f('customer_problems_reported', 'Customer Problems Reported', 'text'),
  f('customer_need', 'Customer Need', 'text'),
  f('service_type_preference', 'Service Type Preference', 'dropdown', [
    'Pickup',
    'Workshop Visit',
    'Not Decided',
  ]),
  f('pickup_option_asked', 'Pickup Option Asked - Agent', 'dropdown', ['Yes', 'No']),
  f('next_follow_up', 'Next Follow-up', 'text'),
  f('customer_reference_source', 'Customer Reference Source', 'text'),
  f('customer_objections', 'Customer Objections', 'text'),
  f('objection_handling_notes', 'Objection Handling Notes', 'text'),
  f('objection_handling_quality', 'Objection Handling Quality', 'dropdown', [
    'Strong',
    'Average',
    'Weak',
    'Not Applicable',
  ]),
  f('closing_attempt', 'Closing Attempt', 'dropdown', ['Clear Ask', 'Weak Ask', 'No Ask']),
  f('urgency_fomo_used', 'Urgency or FOMO Used', 'dropdown', ['Yes', 'No']),
  f('tone_and_confidence', 'Tone and Confidence', 'dropdown', [
    'Polite and Confident',
    'Rushed',
    'Unclear',
    'Poor',
  ]),
  f('listening_vs_talking', 'Listening vs Talking', 'dropdown', ['Listened Well', 'Interrupted Often']),
  f('language_adaptability', 'Language Adaptability', 'dropdown', ['Yes Customers Language', 'No']),
  f('professionalism', 'Professionalism', 'dropdown', ['Yes', 'No']),
  f('lead_status_updated', 'Lead Status Updated', 'text'),
  f('lost_reason', 'Lost Reason if any', 'text'),
  f('summary_of_call', 'Summary of Call', 'text'),
  f('client_overview', 'Client Overview', 'text'),
  f('customer_intent_level', 'Customer Intent Level', 'dropdown', ['Low', 'Medium', 'High']),
  f('decision_stage', 'Decision Stage', 'dropdown', ['Only Checking', 'Consideration', 'Closing']),
  f('overall_score', 'Overall Score', 'number'),
  f('positive_highlights', 'Positive Highlights', 'text'),
  f('improvement_suggestions', 'Improvement Suggestions', 'text'),
];

export const DEFAULT_SOP_NEW_INSTRUCTION = `- Overall score out of 100
Return results strictly in structured fields.`;

const TRANS_INSTRUCTION = `Listen via the call transcript first.
- Overall score out of 100
Return results strictly in structured fields.`;

const BASIC_FIELDS: CallIqAgentField[] = [
  f('summary_of_call', 'Summary of Call', 'text'),
  f('customer_intent_level', 'Customer Intent Level', 'dropdown', ['Low', 'Medium', 'High']),
  f('decision_stage', 'Decision Stage', 'dropdown', ['Only Checking', 'Consideration', 'Closing']),
  f('overall_score', 'Overall Score', 'number'),
  f('positive_highlights', 'Positive Highlights', 'text'),
  f('improvement_suggestions', 'Improvement Suggestions', 'text'),
];

export function defaultCallIqAgents(): CallIqAgent[] {
  const now = new Date().toISOString();
  const ver = (instruction: string, fields: CallIqAgentField[], version = 1): CallIqAgentVersion => ({
    version,
    instruction,
    fields: fields.map((x) => ({ ...x, options: x.options ? [...x.options] : undefined })),
    created_at: now,
  });
  return [
    {
      id: 'seed-sop-new',
      slug: 'call-audit-sop-new',
      name: 'Call Audit SOP New',
      provider: CALL_IQ_PROVIDER,
      agent_type: 'Call-IQ',
      current_version: 5,
      is_active: true,
      versions: [ver(DEFAULT_SOP_NEW_INSTRUCTION, DEFAULT_SOP_NEW_FIELDS, 5)],
      updated_at: now,
    },
    {
      id: 'seed-trans',
      slug: 'call-audit-trans',
      name: 'Call Audit Trans',
      provider: CALL_IQ_PROVIDER,
      agent_type: 'Call-IQ',
      current_version: 1,
      is_active: false,
      versions: [ver(TRANS_INSTRUCTION, DEFAULT_SOP_NEW_FIELDS, 1)],
      updated_at: now,
    },
    {
      id: 'seed-sop',
      slug: 'call-audit-sop',
      name: 'Call Audit SOP',
      provider: CALL_IQ_PROVIDER,
      agent_type: 'Call-IQ',
      current_version: 1,
      is_active: false,
      versions: [ver(DEFAULT_SOP_NEW_INSTRUCTION, DEFAULT_SOP_NEW_FIELDS, 1)],
      updated_at: now,
    },
    {
      id: 'seed-basic',
      slug: 'call-audit',
      name: 'Call Audit',
      provider: CALL_IQ_PROVIDER,
      agent_type: 'Call-IQ',
      current_version: 1,
      is_active: false,
      versions: [ver(DEFAULT_SOP_NEW_INSTRUCTION, BASIC_FIELDS, 1)],
      updated_at: now,
    },
  ];
}

export function getAgentVersion(agent: CallIqAgent, version?: number | null): CallIqAgentVersion | null {
  const want = version && version > 0 ? version : agent.current_version;
  return agent.versions.find((v) => v.version === want) || agent.versions[agent.versions.length - 1] || null;
}

export function fieldsToSchemaHint(fields: CallIqAgentField[]): string {
  const lines = fields.map((field) => {
    if (field.response_type === 'dropdown' && field.options?.length) {
      return `  "${field.key}": "${field.options.join('|')}"  // ${field.name}`;
    }
    if (field.response_type === 'number') {
      return `  "${field.key}": 0  // ${field.name}`;
    }
    return `  "${field.key}": "string|null"  // ${field.name}`;
  });
  return `{\n${lines.join(',\n')}\n}`;
}

export function slugifyAgentName(name: string) {
  return String(name || 'agent')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'agent';
}

export function newFieldId() {
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
