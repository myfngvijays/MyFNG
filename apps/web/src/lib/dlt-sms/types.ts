export const DLT_STATUSES = ['APPROVED', 'PENDING', 'REJECTED'] as const;
export type DltStatus = (typeof DLT_STATUSES)[number];

export const DLT_ENTITY_STATUSES = ['APPROVED', 'PENDING', 'REJECTED', 'NOT_REGISTERED'] as const;
export type DltEntityStatus = (typeof DLT_ENTITY_STATUSES)[number];

export const DLT_OPERATORS = [
  { id: 'JIO', label: 'Jio TrueConnect', portal: 'https://trueconnect.jio.com' },
  { id: 'AIRTEL', label: 'Airtel DLT', portal: 'https://www.airtel.in/business/commercial-communication' },
  { id: 'VIL', label: 'Vodafone Idea DLT', portal: 'https://www.vilpower.in' },
  { id: 'BSNL', label: 'BSNL DLT', portal: 'https://www.ucc-bsnl.co.in' },
] as const;

export const DLT_HEADER_TYPES = ['TRANS', 'PROMO', 'SEAMLESS'] as const;
export type DltHeaderType = (typeof DLT_HEADER_TYPES)[number];

export const DLT_TEMPLATE_CATEGORIES = [
  'TRANSACTIONAL',
  'SERVICE_IMPLICIT',
  'SERVICE_EXPLICIT',
  'PROMOTIONAL',
] as const;
export type DltTemplateCategory = (typeof DLT_TEMPLATE_CATEGORIES)[number];

export const DLT_PROVIDERS = [
  { id: 'MYFNG', label: 'MyFNG own pipe (operator HTTP)' },
  { id: 'JIO', label: 'Jio operator HTTP / CPaaS' },
  { id: 'AIRTEL', label: 'Airtel operator HTTP' },
  { id: 'VIL', label: 'Vi operator HTTP' },
  { id: 'BSNL', label: 'BSNL operator HTTP' },
  { id: 'HTTP', label: 'Generic operator HTTP' },
  { id: 'SMPP', label: 'SMPP bind (operator SMSC)' },
] as const;
export type DltProvider = (typeof DLT_PROVIDERS)[number]['id'];

export const DEFAULT_OPERATOR_BODY = `{
  "pe_id": "{{pe_id}}",
  "header": "{{header}}",
  "dlt_template_id": "{{dlt_template_id}}",
  "destination": "91{{phone}}",
  "message": "{{message}}"
}`;

export const DLT_CTA_TYPES = ['URL', 'PHONE', 'SHORTCODE'] as const;
export type DltCtaType = (typeof DLT_CTA_TYPES)[number];

export const DLT_EVENT_KEYS = [
  { id: '', label: 'Manual / unmapped' },
  { id: 'OTP_VERIFICATION', label: 'OTP verification' },
  { id: 'INVOICE_GENERATED', label: 'Invoice generated' },
  { id: 'PAYMENT_RECEIVED', label: 'Payment received' },
  { id: 'LEAD_CREATED', label: 'Lead / booking created' },
  { id: 'LEAD_ACCEPTED', label: 'Lead accepted' },
  { id: 'MECHANIC_ASSIGNED', label: 'Mechanic assigned' },
  { id: 'WORK_STARTED', label: 'Work started' },
  { id: 'READY_FOR_DELIVERY', label: 'Ready for delivery' },
  { id: 'BOOKING_CONFIRMED', label: 'Booking confirmed' },
] as const;

export type DltSmsEntity = {
  id: string;
  config_key: string;
  pe_id: string;
  pe_name: string;
  brand_name: string;
  operator: string;
  portal_url: string;
  entity_status: DltEntityStatus;
  pan: string;
  gstin: string;
  registered_address: string;
  admin_notes: string;
  updated_at: string;
};

export type DltSmsHeader = {
  id: string;
  header: string;
  header_type: DltHeaderType;
  status: DltStatus;
  dlt_header_id: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type DltSmsTemplate = {
  id: string;
  kind: 'CONSENT' | 'CONTENT';
  name: string;
  header_id: string | null;
  header?: string | null;
  category: DltTemplateCategory;
  template_text: string;
  variables: string[];
  dlt_template_id: string;
  provider_template_id: string;
  event_key: string;
  status: DltStatus;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type DltSmsTelemarketer = {
  id: string;
  name: string;
  provider: DltProvider;
  tm_id: string;
  has_api_key: boolean;
  api_key_hint: string;
  api_url: string;
  default_header: string;
  is_primary: boolean;
  is_active: boolean;
  extra_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type DltSmsCta = {
  id: string;
  cta_type: DltCtaType;
  value: string;
  status: DltStatus;
  notes: string;
  created_at: string;
};

export type DltSmsLog = {
  id: string;
  phone: string;
  template_id: string | null;
  header: string;
  message: string;
  provider: string;
  status: 'SENT' | 'FAILED' | 'PENDING';
  provider_message_id: string;
  error: string;
  created_at: string;
};

export type DltStatusCounts = {
  approved: number;
  pending: number;
  rejected: number;
  total: number;
};

export type DltSetupStep = {
  id: string;
  label: string;
  done: boolean;
  hint: string;
};

export type DltSmsSnapshot = {
  entity: DltSmsEntity;
  stats: {
    entity: DltStatusCounts;
    headers: DltStatusCounts;
    consent: DltStatusCounts;
    content: DltStatusCounts;
    cta: DltStatusCounts;
  };
  headers: DltSmsHeader[];
  consentTemplates: DltSmsTemplate[];
  contentTemplates: DltSmsTemplate[];
  telemarketers: DltSmsTelemarketer[];
  cta: DltSmsCta[];
  logs: DltSmsLog[];
  setupSteps: DltSetupStep[];
  readyToSend: boolean;
};

export function emptyCounts(): DltStatusCounts {
  return { approved: 0, pending: 0, rejected: 0, total: 0 };
}

export function countByStatus(rows: Array<{ status: string }>): DltStatusCounts {
  const counts = emptyCounts();
  for (const row of rows) {
    counts.total += 1;
    if (row.status === 'APPROVED') counts.approved += 1;
    else if (row.status === 'PENDING') counts.pending += 1;
    else if (row.status === 'REJECTED') counts.rejected += 1;
  }
  return counts;
}

export function defaultEntity(): DltSmsEntity {
  return {
    id: '',
    config_key: 'default',
    pe_id: '',
    pe_name: '',
    brand_name: 'MyFNG',
    operator: 'JIO',
    portal_url: 'https://trueconnect.jio.com',
    entity_status: 'NOT_REGISTERED',
    pan: '',
    gstin: '',
    registered_address: '',
    admin_notes: '',
    updated_at: new Date().toISOString(),
  };
}

export function normalizeHeader(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
}

export function isValidHeader(value: string): boolean {
  return /^[A-Z0-9]{3,6}$/.test(normalizeHeader(value));
}
