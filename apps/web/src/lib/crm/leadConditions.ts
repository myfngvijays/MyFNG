/**
 * TeleCRM-style lead conditions for the Leads list ("+ Add condition").
 * Client-safe: catalog, types, labels. The server turns them into a query (leadConditionsServer.ts).
 *
 * Two kinds:
 *  - Field conditions on the lead itself (name, city, assignee, amount, dates …)
 *  - Activity conditions (call, WhatsApp, note, task, assignee change, status change, merge, custom API)
 */

export type LeadCondition = {
  id: string;
  key: string;
  op: string;
  value?: string;
  values?: string[];
  /** Date preset: today | yesterday | last7 | last30 | this_month | last_month | custom | any */
  preset?: string;
  from?: string;
  to?: string;
  /** Activity extras: status, by, min_duration, to, template, result … */
  extra?: Record<string, string>;
};

export type OptionSource =
  | 'telecallers'
  | 'workshops'
  | 'tags'
  | 'statuses'
  | 'lost_reasons'
  | 'other_reasons'
  | 'cities'
  | 'sources'
  | 'vehicle_classes'
  | 'triggers'
  | 'telecrm_statuses'
  | 'api_templates';

export type FieldType = 'text' | 'select' | 'number' | 'date' | 'bool';

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  /** service_leads column or json path (coupon_meta->>x) */
  column: string;
  options?: OptionSource;
  staticOptions?: Array<{ value: string; label: string }>;
  /** select on city: partial match instead of exact */
  partial?: boolean;
};

export type ActivityDef = {
  key: string;
  label: string;
  hint: string;
  icon: 'call' | 'whatsapp' | 'note' | 'task' | 'assignee' | 'status' | 'merge' | 'api';
};

export const PRIORITY_OPTIONS = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

const PIPELINE_OPTIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'VALIDATED', label: 'Booking confirmed' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'REJECTED', label: 'Rejected / Lost' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const FUEL_OPTIONS = ['PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID', 'LPG'].map((v) => ({ value: v, label: v }));

export const FIELD_DEFS: FieldDef[] = [
  { key: 'name', label: 'Name', type: 'text', column: 'customer_name' },
  { key: 'phone', label: 'Phone', type: 'text', column: 'customer_phone' },
  { key: 'email', label: 'Email', type: 'text', column: 'customer_email' },
  { key: 'lead_number', label: 'Lead number', type: 'text', column: 'lead_number' },
  { key: 'crm_status', label: 'Lead Status', type: 'select', column: 'coupon_meta->>last_call_result', options: 'statuses' },
  { key: 'pipeline_status', label: 'Pipeline status', type: 'select', column: 'status', staticOptions: PIPELINE_OPTIONS },
  { key: 'assignee', label: 'Assignee', type: 'select', column: 'assigned_telecaller_id', options: 'telecallers' },
  { key: 'lost_reason', label: 'Lost Reason', type: 'select', column: 'coupon_meta->>last_lost_reason', options: 'lost_reasons' },
  { key: 'other_reason', label: 'Other Reason', type: 'select', column: 'coupon_meta->>last_other_reason', options: 'other_reasons' },
  { key: 'tags', label: 'Tags', type: 'select', column: 'tags', options: 'tags' },
  { key: 'priority', label: 'Priority', type: 'select', column: 'lead_priority', staticOptions: PRIORITY_OPTIONS },
  { key: 'source', label: 'Lead source', type: 'select', column: 'lead_source', options: 'sources' },
  { key: 'trigger', label: 'Message trigger', type: 'select', column: 'coupon_meta->>message_trigger_label', options: 'triggers' },
  { key: 'telecrm_status', label: 'TeleCRM status (imported)', type: 'select', column: 'coupon_meta->>telecrm_status', options: 'telecrm_statuses' },
  { key: 'city', label: 'City', type: 'select', column: 'city', options: 'cities', partial: true },
  { key: 'area', label: 'Area', type: 'text', column: 'coupon_meta->>area' },
  { key: 'pincode', label: 'Pincode', type: 'text', column: 'pincode' },
  { key: 'address', label: 'Address', type: 'text', column: 'customer_address' },
  { key: 'workshop', label: 'Workshop', type: 'select', column: 'workshop_id', options: 'workshops' },
  { key: 'car_number', label: 'Car number', type: 'text', column: 'vehicle_number' },
  { key: 'make', label: 'Make', type: 'text', column: 'vehicle_make' },
  { key: 'model', label: 'Model', type: 'text', column: 'vehicle_model' },
  { key: 'vehicle_class', label: 'Vehicle class', type: 'select', column: 'coupon_meta->>vehicle_class', options: 'vehicle_classes' },
  { key: 'fuel', label: 'Fuel type', type: 'select', column: 'vehicle_fuel_type', staticOptions: FUEL_OPTIONS },
  { key: 'vehicle_year', label: 'Car year', type: 'number', column: 'vehicle_year' },
  { key: 'odometer', label: 'Odometer (km)', type: 'number', column: 'odometer_km' },
  { key: 'package', label: 'Package / service', type: 'text', column: 'service_type' },
  { key: 'amount', label: 'Amount', type: 'number', column: 'estimated_amount' },
  { key: 'pickup', label: 'Pickup required', type: 'bool', column: 'pickup_required' },
  { key: 'coupon', label: 'Coupon code', type: 'text', column: 'coupon_code' },
  { key: 'remark', label: 'Telecaller remark', type: 'text', column: 'coupon_meta->>telecaller_remarks' },
  { key: 'lead_note', label: 'Lead note', type: 'text', column: 'notes' },
  { key: 'referred_by', label: 'Referred by', type: 'text', column: 'coupon_meta->>referred_by' },
  { key: 'second_car', label: 'Second car', type: 'text', column: 'coupon_meta->>second_car' },
  { key: 'repeat_customer', label: 'Repeat customer', type: 'bool', column: 'coupon_meta->>repeat_customer' },
  { key: 'follow_up_required', label: 'Follow-up required', type: 'bool', column: 'follow_up_required' },
  { key: 'incomplete', label: 'Incomplete lead', type: 'bool', column: 'is_incomplete' },
  { key: 'total_calls', label: 'Total calls', type: 'number', column: 'total_calls' },
  { key: 'created_at', label: 'Created On', type: 'date', column: 'created_at' },
  { key: 'updated_at', label: 'Modified On', type: 'date', column: 'updated_at' },
  { key: 'last_call_at', label: 'Last call', type: 'date', column: 'last_call_at' },
  { key: 'next_follow_up_at', label: 'Next reminder', type: 'date', column: 'next_follow_up_at' },
  { key: 'preferred_slot', label: 'Booked slot', type: 'date', column: 'preferred_slot_start' },
  { key: 'booking_confirmed_at', label: 'Booking confirmed on', type: 'date', column: 'coupon_meta->>booking_confirmed_at' },
  { key: 'service_done_at', label: 'Service done on', type: 'date', column: 'coupon_meta->>service_done_at' },
  { key: 'last_inbound_at', label: 'Last WhatsApp from customer', type: 'date', column: 'coupon_meta->>last_inbound_at' },
];

export const ACTIVITY_DEFS: ActivityDef[] = [
  { key: 'call', label: 'Call', hint: 'Calls made on the lead', icon: 'call' },
  { key: 'whatsapp', label: 'WhatsApp', hint: 'Customer messaged on WhatsApp', icon: 'whatsapp' },
  { key: 'note', label: 'Note', hint: 'Telecaller remark / note', icon: 'note' },
  { key: 'task', label: 'Task', hint: 'Reminders / follow-up tasks', icon: 'task' },
  { key: 'assignee_change', label: 'Assignee Change to', hint: 'Lead transferred', icon: 'assignee' },
  { key: 'status_change', label: 'Status Change to', hint: 'Lead was ever in a status', icon: 'status' },
  { key: 'lead_merged', label: 'Lead Merged', hint: 'Duplicate leads merged into it', icon: 'merge' },
  { key: 'custom_api', label: 'Custom API', hint: 'API template sent for the lead', icon: 'api' },
];

export const FIELD_BY_KEY = new Map(FIELD_DEFS.map((f) => [f.key, f]));
export const ACTIVITY_BY_KEY = new Map(ACTIVITY_DEFS.map((a) => [a.key, a]));

export function opsForField(type: FieldType): Array<{ value: string; label: string }> {
  switch (type) {
    case 'text':
      return [
        { value: 'contains', label: 'contains' },
        { value: 'not_contains', label: 'does not contain' },
        { value: 'is', label: 'is' },
        { value: 'is_not', label: 'is not' },
        { value: 'empty', label: 'is empty' },
        { value: 'not_empty', label: 'is not empty' },
      ];
    case 'select':
      return [
        { value: 'any_of', label: 'is any of' },
        { value: 'none_of', label: 'is none of' },
        { value: 'empty', label: 'is empty' },
        { value: 'not_empty', label: 'is not empty' },
      ];
    case 'number':
      return [
        { value: 'eq', label: '=' },
        { value: 'gt', label: '>' },
        { value: 'lt', label: '<' },
        { value: 'between', label: 'between' },
        { value: 'empty', label: 'is empty' },
        { value: 'not_empty', label: 'is not empty' },
      ];
    case 'date':
      return [
        { value: 'in_range', label: 'is' },
        { value: 'empty', label: 'is empty' },
        { value: 'not_empty', label: 'is not empty' },
      ];
    case 'bool':
      return [
        { value: 'yes', label: 'is Yes' },
        { value: 'no', label: 'is No' },
      ];
  }
}

export const DATE_PRESETS: Array<{ value: string; label: string }> = [
  { value: 'any', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'custom', label: 'Custom' },
];

export const CALL_STATUS_OPTIONS = [
  { value: '', label: 'Any result' },
  { value: 'ANSWERED', label: 'Answered' },
  { value: 'NO_ANSWER', label: 'Not answered' },
  { value: 'RINGING', label: 'Ringing' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export const TASK_STATUS_OPTIONS = [
  { value: '', label: 'Any task' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

/** YYYY-MM-DD for an IST day offset from today. */
function istYmd(offsetDays = 0) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
    new Date(Date.now() + offsetDays * 86_400_000),
  );
}

/** Preset / custom → IST day bounds as ISO instants. null = no date limit. */
export function resolveConditionRange(c: Pick<LeadCondition, 'preset' | 'from' | 'to'>): { from: string | null; to: string | null } {
  const preset = c.preset || (c.from || c.to ? 'custom' : 'any');
  const start = (ymd: string) => new Date(`${ymd}T00:00:00+05:30`).toISOString();
  const end = (ymd: string) => new Date(`${ymd}T23:59:59.999+05:30`).toISOString();
  const today = istYmd();
  switch (preset) {
    case 'today':
      return { from: start(today), to: end(today) };
    case 'yesterday':
      return { from: start(istYmd(-1)), to: end(istYmd(-1)) };
    case 'last7':
      return { from: start(istYmd(-6)), to: end(today) };
    case 'last30':
      return { from: start(istYmd(-29)), to: end(today) };
    case 'this_month':
      return { from: start(`${today.slice(0, 8)}01`), to: end(today) };
    case 'last_month': {
      const [y, m] = today.split('-').map(Number);
      const py = m === 1 ? y - 1 : y;
      const pm = m === 1 ? 12 : m - 1;
      const first = `${py}-${String(pm).padStart(2, '0')}-01`;
      const lastDay = new Date(Date.UTC(py, pm, 0)).getUTCDate();
      return { from: start(first), to: end(`${py}-${String(pm).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`) };
    }
    case 'custom':
      return {
        from: /^\d{4}-\d{2}-\d{2}$/.test(c.from || '') ? start(c.from!) : null,
        to: /^\d{4}-\d{2}-\d{2}$/.test(c.to || '') ? end(c.to!) : null,
      };
    default:
      return { from: null, to: null };
  }
}

export function presetLabel(c: Pick<LeadCondition, 'preset' | 'from' | 'to'>) {
  const p = c.preset || 'any';
  if (p === 'custom') return [c.from, c.to].filter(Boolean).join(' → ') || 'Custom';
  return DATE_PRESETS.find((d) => d.value === p)?.label || 'Any time';
}

export function newConditionId() {
  return Math.random().toString(36).slice(2, 10);
}

/** Parse + validate conditions from a URL / request param. Unknown keys are dropped. */
export function parseLeadConditions(raw: string | null | undefined): LeadCondition[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: LeadCondition[] = [];
  for (const item of parsed.slice(0, 20)) {
    if (!item || typeof item !== 'object') continue;
    const c = item as Record<string, unknown>;
    const key = String(c.key || '');
    if (!FIELD_BY_KEY.has(key) && !ACTIVITY_BY_KEY.has(key)) continue;
    const extra: Record<string, string> = {};
    if (c.extra && typeof c.extra === 'object') {
      for (const [k, v] of Object.entries(c.extra as Record<string, unknown>)) {
        if (v != null && String(v).trim()) extra[k.slice(0, 40)] = String(v).slice(0, 200);
      }
    }
    out.push({
      id: String(c.id || newConditionId()).slice(0, 20),
      key,
      op: String(c.op || '').slice(0, 20),
      value: c.value == null ? undefined : String(c.value).slice(0, 200),
      values: Array.isArray(c.values) ? c.values.slice(0, 100).map((v) => String(v).slice(0, 200)) : undefined,
      preset: c.preset == null ? undefined : String(c.preset).slice(0, 20),
      from: c.from == null ? undefined : String(c.from).slice(0, 10),
      to: c.to == null ? undefined : String(c.to).slice(0, 10),
      extra,
    });
  }
  return out;
}

/** Strip ids for a compact URL / saved view. */
export function serializeLeadConditions(conditions: LeadCondition[]): string {
  return JSON.stringify(
    conditions.map((c) => {
      const o: Record<string, unknown> = { key: c.key, op: c.op };
      if (c.value) o.value = c.value;
      if (c.values?.length) o.values = c.values;
      if (c.preset && c.preset !== 'any') o.preset = c.preset;
      if (c.from) o.from = c.from;
      if (c.to) o.to = c.to;
      if (c.extra && Object.keys(c.extra).length) o.extra = c.extra;
      return o;
    }),
  );
}
