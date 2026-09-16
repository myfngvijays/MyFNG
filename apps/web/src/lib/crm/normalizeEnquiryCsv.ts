/**
 * Normalize TeleCRM / dialer CSVs into crm_enquiries columns.
 * TeleCRM headers (Phone, CARNO, Model…) must not be dropped just because
 * they are not named phone_no / car_number.
 */

export const ENQUIRY_CSV_COLUMNS = [
  'name',
  'phone_no',
  'alternate_phone',
  'model',
  'package',
  'workshop',
  'address',
  'plan',
  'pickup_visit',
  'car_number',
  'next_followup_at',
  'package_rate_access',
  'lead_number',
  'remark',
  'disposition',
  'lost_reason',
  'assignee_name',
  'user_note',
  'created_at',
  'updated_at',
] as const;

/** CRM lost reasons that TeleCRM already uses — anything else becomes Other Reasons. */
export const TELECRM_KNOWN_LOST_REASONS = [
  'Not Interested',
  'Unqualified Lead',
  'No-Response to Calls',
  'Already Service Done',
  'Under Warranty',
  'Looking For Authorised Service Center',
  'Other Reasons',
] as const;

export type EnquiryCsvColumn = (typeof ENQUIRY_CSV_COLUMNS)[number];
export type EnquiryCsvRow = Record<string, string>;

const EMPTY_RE = /^(?:|_+|-+|\.+|na|n\/a|null|undefined|none)$/i;

function normKey(key: string): string {
  return String(key || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_');
}

function isEmptyCell(value: unknown): boolean {
  const s = String(value ?? '').trim();
  return !s || EMPTY_RE.test(s);
}

function cell(row: EnquiryCsvRow, keys: string[]): string {
  for (const key of keys) {
    const v = row[key];
    if (!isEmptyCell(v)) return String(v).trim();
  }
  return '';
}

export function normalizePhoneDigits(raw: string): string {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  // 91 + 10-digit mobile, or 0091...
  if (digits.startsWith('0091') && digits.length >= 14) digits = digits.slice(-10);
  else if (digits.startsWith('91') && digits.length >= 12) digits = digits.slice(-10);
  else if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  else if (digits.length > 10) digits = digits.slice(-10);
  return digits;
}

export function isValidEnquiryPhone(raw: string): boolean {
  return /^[6-9]\d{9}$/.test(normalizePhoneDigits(raw));
}

function tokenKey(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** TeleCRM LEADTAG tokens → our CRM tag / lead_source names. */
const TELECRM_LEAD_TAG_ALIASES: Array<{ keys: string[]; name: string }> = [
  { keys: ['sarvincm', 'sarv-incm', 'sarv_incm', 'sarv', 'incomingsarvcall', 'incomingsarv'], name: 'Incoming Sarv Call' },
  { keys: ['website', 'web', 'site'], name: 'Website' },
  { keys: ['app', 'appbooking', 'mobile', 'mobileapp'], name: 'App Booking' },
];

export function parseLeadTagTokens(raw: string): string[] {
  return String(raw || '')
    .split(/[,;|/]+/)
    .map((t) => t.trim())
    .filter((t) => t && !EMPTY_RE.test(t));
}

export function matchLeadTags(raw: string, catalog: string[] = []): string[] {
  const tokens = parseLeadTagTokens(raw);
  const catalogRows = (catalog || [])
    .map((name) => ({ name: String(name || '').trim(), key: tokenKey(name) }))
    .filter((r) => r.name);
  const out: string[] = [];

  for (const token of tokens) {
    const key = tokenKey(token);
    if (!key) continue;

    const alias = TELECRM_LEAD_TAG_ALIASES.find((a) => a.keys.some((k) => tokenKey(k) === key));
    let name = alias?.name || '';

    if (name) {
      const catalogHit = catalogRows.find((c) => c.key === tokenKey(name));
      if (catalogHit) name = catalogHit.name;
    } else {
      const catalogHit =
        catalogRows.find((c) => c.key === key) ||
        catalogRows.find((c) => c.key.includes(key) || key.includes(c.key));
      name = catalogHit?.name || '';
    }

    if (name && !out.some((n) => tokenKey(n) === tokenKey(name))) out.push(name);
  }

  return out;
}

export function primaryLeadSourceFromTags(tagsCsv: string): string {
  const tags = parseLeadTagTokens(tagsCsv);
  const lower = tags.map((t) => t.toLowerCase());
  if (lower.some((t) => t.includes('app booking'))) return 'App Booking';
  if (lower.some((t) => t === 'website' || t === 'web')) return 'Website';
  if (lower.some((t) => t.includes('sarv'))) return 'Incoming Sarv Call';
  return tags[0] || 'Other';
}

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function pad2(n: string | number): string {
  return String(n).padStart(2, '0');
}

function toIso(y: string, m: string, d: string, hh = '00', mm = '00', ss = '00'): string {
  if (!y || !m || !d) return '';
  return `${y}-${pad2(m)}-${pad2(d)}T${pad2(hh)}:${pad2(mm)}:${pad2(ss)}+05:30`;
}

function parseTimePart(time: string): { hh: string; mm: string; ss: string } {
  const tm = String(time || '').trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!tm) return { hh: '00', mm: '00', ss: '00' };
  return { hh: tm[1], mm: tm[2], ss: tm[3] || '00' };
}

function parseDateParts(date: string): { y: string; m: string; d: string } | null {
  const s = String(date || '').trim();
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    const y = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    const a = Number(dmy[1]);
    const b = Number(dmy[2]);
    // India: DD/MM/YYYY. If first part > 12 it must be day.
    if (a > 12) return { d: dmy[1], m: dmy[2], y };
    if (b > 12) return { d: dmy[2], m: dmy[1], y };
    return { d: dmy[1], m: dmy[2], y };
  }
  const ymd = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (ymd) return { y: ymd[1], m: ymd[2], d: ymd[3] };
  const dMon = s.match(/^(\d{1,2})[\s\-\/]([A-Za-z]{3,9})[\s\-\/,]+(\d{2,4})$/);
  if (dMon) {
    const mon = MONTHS[dMon[2].slice(0, 3).toLowerCase()];
    if (mon) return { d: dMon[1], m: mon, y: dMon[3].length === 2 ? `20${dMon[3]}` : dMon[3] };
  }
  const serial = Number(s);
  if (/^\d{5}(\.\d+)?$/.test(s) && serial >= 20000 && serial <= 80000) {
    const utc = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000;
    const dt = new Date(utc);
    return { y: String(dt.getUTCFullYear()), m: pad2(dt.getUTCMonth() + 1), d: pad2(dt.getUTCDate()) };
  }
  return null;
}

export function combineTelecrmDateTime(dateStr: string, timeStr: string): string {
  let date = String(dateStr || '').trim();
  let time = String(timeStr || '').trim();
  if (isEmptyCell(date) && isEmptyCell(time)) return '';

  const isoAlready = date.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
  if (isoAlready) return date.includes('+') || date.endsWith('Z') ? date : `${isoAlready[1]}T${isoAlready[2]}+05:30`;

  const combined = date.match(/^(.+?)\s+(\d{1,2}:\d{2}(?::\d{2})?)/);
  if (combined) {
    date = combined[1];
    if (isEmptyCell(time)) time = combined[2];
  }

  const parts = parseDateParts(date);
  if (!parts) return '';
  const t = parseTimePart(time);
  return toIso(parts.y, parts.m, parts.d, t.hh, t.mm, t.ss);
}

export function formatEnquiryTimestamp(iso: string): string {
  const s = String(iso || '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
}

const FIELD_ALIASES: Record<EnquiryCsvColumn, string[]> = {
  name: ['name', 'customer_name', 'customer', 'full_name'],
  phone_no: [
    'phone_no',
    'phone',
    'phone_number',
    'mobile',
    'mobile_no',
    'mobile_number',
    'contact',
    'contact_number',
    'customer_phone',
  ],
  alternate_phone: [
    'alternate_phone',
    'alternate_phone_no',
    'alternate_number',
    'alt_phone',
    'secondary_phone',
  ],
  model: ['model', 'vehicle_model', 'vehiclemodel', 'car_model', 'model_name'],
  package: ['package', 'vehicle_package', 'package_type'],
  workshop: ['workshop', 'workshop_name', 'service_center'],
  address: ['address', 'full_address', 'customer_address'],
  plan: ['plan', 'service_plan', 'service_type'],
  pickup_visit: ['pickupvisit', 'pickup_visit', 'pickup_or_visit'],
  car_number: [
    'car_number',
    'carno',
    'car_no',
    'vehicle_number',
    'vehiclenumber',
    'reg_no',
    'regno',
    'registration_number',
  ],
  next_followup_at: [
    'next_followup_at',
    'next_followup_date',
    'next_follow_up_date',
    'next_follow_up_at',
    'callback_date',
  ],
  package_rate_access: ['package_rate_access', 'packagerateaccess', 'package_rate', 'ro'],
  lead_number: ['lead_number', 'leadnumber', 'lead_no'],
  remark: ['remark', 'remarks', 'remark_cordinator', 'feedback'],
  disposition: ['status', 'lead_status', 'leadstatus', 'disposition'],
  lost_reason: ['lost_reason', 'lostreason', 'lost_reasons'],
  assignee_name: ['assignee_name', 'lead_assignee', 'assignee'],
  user_note: ['user_note', 'usernote', 'activity_note', 'notes'],
  created_at: ['created_at'],
  updated_at: ['updated_at'],
};

export type TelecrmCrmStatus = {
  code: string;
  label: string;
  pipeline: string;
};

const TELECRM_STATUS_MAP: Array<{ keys: string[]; code: string; label: string; pipeline: string }> = [
  { keys: ['lost'], code: 'LOST', label: 'Lost', pipeline: 'REJECTED' },
  { keys: ['interested'], code: 'INTERESTED', label: 'Interested', pipeline: 'NEW' },
  { keys: ['followup', 'follow-up', 'callback'], code: 'CALLBACK', label: 'Follow-up', pipeline: 'NEW' },
  { keys: ['hewillvisit', 'he will visit', 'willvisit'], code: 'WILL_VISIT', label: 'He will visit', pipeline: 'NEW' },
  { keys: ['appointmentscheduled', 'bookingconfirmed', 'won'], code: 'BOOKING_CONFIRMED', label: 'Booking confirmed', pipeline: 'VALIDATED' },
  { keys: ['convertedservicedone', 'servicedone'], code: 'SERVICE_DONE', label: 'Service Done', pipeline: 'COMPLETED' },
  { keys: ['inservice'], code: 'IN_SERVICE', label: 'In Service', pipeline: 'IN_PROGRESS' },
  { keys: ['ringing', 'ringingnoanswer'], code: 'RINGING', label: 'Ringing / No answer', pipeline: 'NEW' },
  { keys: ['fresh', 'fresh2', 'new'], code: 'FRESH', label: 'Fresh', pipeline: 'NEW' },
  { keys: ['servicedue'], code: 'CALLBACK', label: 'Follow-up', pipeline: 'NEW' },
  { keys: ['sendtotl', 'sendtotlmanager', 'sendtomanager'], code: 'INTERESTED', label: 'Interested', pipeline: 'NEW' },
  { keys: ['roadserversa', 'rsa'], code: 'FRESH', label: 'Fresh', pipeline: 'NEW' },
];

export function mapTelecrmStatus(raw: string): TelecrmCrmStatus {
  const key = tokenKey(raw);
  if (!key) return { code: 'FRESH', label: 'Fresh', pipeline: 'NEW' };
  const hit = TELECRM_STATUS_MAP.find((row) => row.keys.some((k) => tokenKey(k) === key));
  if (hit) return { code: hit.code, label: hit.label, pipeline: hit.pipeline };
  return { code: 'FRESH', label: String(raw || '').trim() || 'Fresh', pipeline: 'NEW' };
}

export function mapTelecrmLostReason(raw: string, catalog: string[] = []): string {
  const value = String(raw || '').trim();
  if (!value || EMPTY_RE.test(value)) return '';
  const names = [...catalog, ...TELECRM_KNOWN_LOST_REASONS]
    .map((name) => String(name || '').trim())
    .filter(Boolean);
  const key = tokenKey(value);
  const exact = names.find((name) => tokenKey(name) === key);
  if (exact) return exact;
  const other = names.find((name) => tokenKey(name) === 'otherreasons') || 'Other Reasons';
  return other;
}

export function parseEnquiryActivities(raw: string): Array<{
  at: string;
  remark: string;
  by: string;
  status?: string;
}> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function collapseEnquiryCsvLeads(rows: EnquiryCsvRow[]): EnquiryCsvRow[] {
  const groups = new Map<string, EnquiryCsvRow[]>();
  (rows || []).forEach((row, index) => {
    const key = row.telecrm_lead_id || row.phone_no || `row-${index}`;
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  });

  const out: EnquiryCsvRow[] = [];
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) =>
      String(a.action_at || a.updated_at || a.created_at || '').localeCompare(
        String(b.action_at || b.updated_at || b.created_at || ''),
      ),
    );
    const latest = { ...sorted[sorted.length - 1] };
    const activities: Array<{ at: string; remark: string; by: string; status?: string }> = [];
    const seen = new Set<string>();
    const pushActivity = (activity: { at: string; remark: string; by: string; status?: string }) => {
      const remark = String(activity.remark || '').trim();
      if (!remark) return;
      const key = `${activity.at}|${remark}`;
      if (seen.has(key)) return;
      seen.add(key);
      activities.push({ ...activity, remark });
    };
    for (const row of sorted) {
      const existing = parseEnquiryActivities(row.activities_json || '');
      if (existing.length) {
        existing.forEach((activity) => pushActivity(activity));
        continue;
      }
      const note = String(row.user_note || '').trim();
      if (!note) continue;
      pushActivity({
        at: row.action_at || row.updated_at || row.created_at || '',
        remark: note,
        by: row.action_by || row.assignee_name || '',
        status: row.disposition || '',
      });
    }
    latest.activities_json = JSON.stringify(activities);
    latest.user_note = activities[activities.length - 1]?.remark || latest.user_note || '';
    out.push(latest);
  }
  return out;
}

function modelKey(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function mapEnquiryCsvRow(raw: EnquiryCsvRow, catalogTags: string[] = []): EnquiryCsvRow {
  const row: EnquiryCsvRow = {};
  for (const [key, value] of Object.entries(raw || {})) {
    row[normKey(key)] = String(value ?? '').trim();
  }

  const mapped: EnquiryCsvRow = {};
  for (const col of ENQUIRY_CSV_COLUMNS) {
    mapped[col] = cell(row, FIELD_ALIASES[col]);
  }

  mapped.phone_no = normalizePhoneDigits(mapped.phone_no);
  mapped.alternate_phone = normalizePhoneDigits(mapped.alternate_phone);
  mapped.car_number = mapped.car_number.toUpperCase();
  mapped.model = mapped.model.toUpperCase();
  mapped.make = cell(row, ['make', 'vehicle_make', 'vehiclemake', 'brand', 'car_make']).toUpperCase();
  mapped.lead_tags = matchLeadTags(cell(row, ['leadtag', 'lead_tag', 'leadtagnew', 'lead_tags']), catalogTags).join(', ');
  mapped.dialer_id = cell(row, ['dialer_id', 'dailerid', 'dialerid', 'dialer']);
  mapped.assignee_email = cell(row, ['assignee_emailid', 'assignee_email', 'lead_assignee_email']);
  mapped.telecrm_lead_id = cell(row, ['lead_id', 'telecrm_lead_id', 'leadid']);
  mapped.activities_json = cell(row, ['activities_json']);
  mapped.crm_status = cell(row, ['crm_status']);
  mapped.crm_status_label = cell(row, ['crm_status_label']);
  mapped.crm_pipeline = cell(row, ['crm_pipeline']);
  mapped.action_by = cell(row, ['action_created_by_name', 'action_created_by', 'action_by']);
  mapped.action_at = combineTelecrmDateTime(
    cell(row, ['action_created_at', 'action_created_on', 'action_at']),
    '',
  );
  mapped.lost_reason = mapTelecrmLostReason(mapped.lost_reason);
  const crm = mapTelecrmStatus(mapped.disposition);
  mapped.crm_status = crm.code;
  mapped.crm_status_label = crm.label;
  mapped.crm_pipeline = crm.pipeline;
  mapped.pickup_required = /^pickup$/i.test(mapped.pickup_visit) ? 'true' : '';

  mapped.created_at =
    mapped.created_at ||
    combineTelecrmDateTime(
      cell(row, ['created_on_date', 'created_date', 'createdondate', 'created', 'created_on']),
      cell(row, ['created_on_time', 'created_time', 'createdontime']),
    );
  mapped.updated_at =
    mapped.updated_at ||
    combineTelecrmDateTime(
      cell(row, ['modified_on_date', 'modified_date', 'updated_on_date', 'modifiedondate', 'modified_on', 'updated_on']),
      cell(row, ['modified_on_time', 'modified_time', 'updated_on_time', 'modifiedontime']),
    );
  mapped.next_followup_at = combineTelecrmDateTime(mapped.next_followup_at, '') || mapped.next_followup_at;

  return mapped;
}

export function mapEnquiryCsvRows(rows: EnquiryCsvRow[], catalogTags: string[] = []): EnquiryCsvRow[] {
  return collapseEnquiryCsvLeads((rows || []).map((row) => mapEnquiryCsvRow(row, catalogTags)));
}

type CarModelRow = { make?: string | null; model_name?: string | null };

export function lookupMakeFromModels(model: string, cars: CarModelRow[]): string {
  const want = modelKey(model);
  if (!want || !cars?.length) return '';

  const exact = cars.find((c) => modelKey(String(c.model_name || '')) === want);
  if (exact?.make) return String(exact.make).trim().toUpperCase();

  const starts = cars.find((c) => {
    const name = modelKey(String(c.model_name || ''));
    return name.startsWith(want) || want.startsWith(name);
  });
  if (starts?.make) return String(starts.make).trim().toUpperCase();

  return '';
}

export async function enrichEnquiryMakes(
  rows: EnquiryCsvRow[],
  fetchCars: () => Promise<CarModelRow[]>,
): Promise<EnquiryCsvRow[]> {
  const missing = rows.filter((r) => r.model && !r.make);
  if (!missing.length) return rows;

  let cars: CarModelRow[] = [];
  try {
    cars = (await fetchCars()) || [];
  } catch {
    return rows;
  }
  if (!cars.length) return rows;

  return rows.map((row) => {
    if (row.make || !row.model) return row;
    const make = lookupMakeFromModels(row.model, cars);
    return make ? { ...row, make } : row;
  });
}

export async function enrichEnquiryTags(
  rows: EnquiryCsvRow[],
  fetchTags: () => Promise<string[]>,
): Promise<EnquiryCsvRow[]> {
  let catalog: string[] = [];
  try {
    catalog = (await fetchTags()) || [];
  } catch {
    return rows;
  }
  if (!catalog.length) return rows;

  return rows.map((row) => {
    if (!row.lead_tags) return row;
    const matched = matchLeadTags(row.lead_tags, catalog);
    return { ...row, lead_tags: matched.join(', ') };
  });
}
