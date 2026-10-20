import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { getMobileAuthConfig } from '@/lib/mobile-auth-config';

export const STATUS_COMPONENTS = [
  { key: 'public_website', group: 'Website', name: 'Public website', description: 'myfng.in, service pages, city pages, and booking' },
  { key: 'staff_dashboard', group: 'Website', name: 'Staff dashboards', description: 'Workshop, advisor, mechanic, pickup, and admin dashboards' },
  { key: 'customer_app', group: 'Mobile apps', name: 'Customer app', description: 'Bookings and account in the customer app' },
  { key: 'workshop_app', group: 'Mobile apps', name: 'Workshop app', description: 'Jobs for advisors, mechanics, and pickup staff' },
  { key: 'sms_otp', group: 'Sign in', name: 'SMS OTP', description: 'Login code by SMS' },
  { key: 'whatsapp_otp', group: 'Sign in', name: 'WhatsApp OTP', description: 'Login code on WhatsApp' },
  { key: 'staff_login', group: 'Sign in', name: 'Dashboard login', description: 'Staff sign-in to the dashboard' },
  { key: 'checkout', group: 'Payments', name: 'UPI and card checkout', description: 'Booking payment window' },
  { key: 'invoices', group: 'Payments', name: 'Invoices', description: 'Workshop invoices' },
  { key: 'whatsapp_booking', group: 'WhatsApp', name: 'Booking alerts', description: 'Booking confirmation on WhatsApp' },
  { key: 'whatsapp_jobs', group: 'WhatsApp', name: 'Job alerts', description: 'Pickup and job updates on WhatsApp' },
  { key: 'pickup_assign', group: 'Pickup and jobs', name: 'Pickup assignment', description: 'Assigning a pickup boy' },
  { key: 'live_tracking', group: 'Pickup and jobs', name: 'Live tracking', description: 'Pickup location on the map' },
  { key: 'job_status', group: 'Pickup and jobs', name: 'Job status', description: 'Workshop job steps shown to the customer' },
] as const;

export type ComponentKey = (typeof STATUS_COMPONENTS)[number]['key'];
export type PublicStatus = 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance';
export type IncidentState = 'investigating' | 'identified' | 'monitoring' | 'resolved';
export type UpdateState = IncidentState | 'update';
export type IncidentImpact = 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance';
export type MaintenanceState = 'scheduled' | 'in_progress' | 'completed';

type ProbeStatus = 'operational' | 'degraded' | 'major_outage';

const COMPONENT_KEYS = new Set<string>(STATUS_COMPONENTS.map((item) => item.key));
const IMPACTS = new Set<IncidentImpact>(['degraded', 'partial_outage', 'major_outage', 'maintenance']);
const INCIDENT_STATES = new Set<IncidentState>(['investigating', 'identified', 'monitoring', 'resolved']);
const UPDATE_STATES = new Set<UpdateState>([...INCIDENT_STATES, 'update']);
const MAINTENANCE_STATES = new Set<MaintenanceState>(['scheduled', 'in_progress', 'completed']);

const RANK: Record<PublicStatus, number> = {
  operational: 0,
  maintenance: 1,
  degraded: 2,
  partial_outage: 3,
  major_outage: 4,
};

const CACHE_MS = 45_000;
const HISTORY_DAYS = 30;

export const STATUS_LABEL: Record<PublicStatus, string> = {
  operational: 'Operational',
  degraded: 'Degraded performance',
  partial_outage: 'Partial outage',
  major_outage: 'Major outage',
  maintenance: 'Maintenance',
};

export const INCIDENT_STATE_LABEL: Record<UpdateState, string> = {
  investigating: 'Investigating',
  identified: 'Identified',
  monitoring: 'Monitoring',
  resolved: 'Resolved',
  update: 'Update',
};

let probeCache: {
  at: number;
  value: Record<ComponentKey, ProbeStatus>;
  notes: Partial<Record<ComponentKey, string>>;
} | null = null;

function worst(current: PublicStatus, next: PublicStatus): PublicStatus {
  return RANK[next] > RANK[current] ? next : current;
}

function customerMessage(status: PublicStatus): string {
  switch (status) {
    case 'operational':
      return 'Working normally';
    case 'degraded':
      return 'Slower than usual';
    case 'partial_outage':
      return 'Some customers are affected';
    case 'major_outage':
      return 'Unavailable right now';
    case 'maintenance':
      return 'Under maintenance';
  }
}

const SERVICE_DETAIL: Record<ComponentKey, Record<PublicStatus, string>> = {
  public_website: {
    operational: 'myfng.in is responding. Customers can open the home page, service pages, city pages, and start a booking in the browser. Staff dashboards are checked separately.',
    degraded: 'The public site is up, but home, service, city, or booking pages are opening slower than usual. Staff dashboards are checked separately.',
    partial_outage: 'Some public pages are failing to load. Other pages on myfng.in may still open. This does not by itself mean the staff dashboard is down.',
    major_outage: 'The public website is not loading. Customers cannot open myfng.in or start a booking from the browser.',
    maintenance: 'The public website is in a planned maintenance window. Pages may stay unavailable until that window ends.',
  },
  staff_dashboard: {
    operational: 'Workshop, advisor, mechanic, pickup, and admin dashboards can load their own data. Staff can open leads and daily work in the browser. The public website is checked separately.',
    degraded: 'Staff dashboards are up, but lead lists and job screens may take longer to load.',
    partial_outage: 'Some dashboard screens are failing. Other staff tools may still open.',
    major_outage: 'Staff dashboards cannot load data. Workshop and admin teams cannot work from the browser until this recovers.',
    maintenance: 'Staff dashboards are in a planned maintenance window.',
  },
  customer_app: {
    operational: 'The customer app can open. Bookings, order status, and the account screen are able to load. The workshop app is checked separately.',
    degraded: 'The customer app is open, but bookings and order status may load slowly.',
    partial_outage: 'Some screens in the customer app are failing. Other screens may still open.',
    major_outage: 'The customer app cannot load bookings or account data.',
    maintenance: 'The customer app is in a planned maintenance window.',
  },
  workshop_app: {
    operational: 'The workshop app can open jobs for advisors, mechanics, and pickup staff. Assignments and job actions are able to load. The customer app is checked separately.',
    degraded: 'The workshop app is open, but job lists may load slowly.',
    partial_outage: 'Some workshop-app screens are failing. Other job screens may still open.',
    major_outage: 'The workshop app cannot load jobs for workshop staff.',
    maintenance: 'The workshop app is in a planned maintenance window.',
  },
  sms_otp: {
    operational: 'Customers can receive a login code by SMS.',
    degraded: 'An SMS login code may arrive late.',
    partial_outage: 'Some SMS login codes are not going out.',
    major_outage: 'SMS login codes cannot be sent right now.',
    maintenance: 'SMS login codes are paused for planned maintenance.',
  },
  whatsapp_otp: {
    operational: 'Customers can receive the login code on WhatsApp. SMS OTP is checked separately.',
    degraded: 'WhatsApp OTP is working, but the login code on WhatsApp may arrive late.',
    partial_outage: 'Some customers are not receiving the WhatsApp login code. Others still are. SMS OTP is separate.',
    major_outage: 'WhatsApp OTP is not being sent. Customers cannot get a login code on WhatsApp.',
    maintenance: 'WhatsApp OTP is in a planned maintenance window. SMS OTP is checked separately.',
  },
  staff_login: {
    operational: 'Staff can sign in to the dashboard with their account. SMS OTP and WhatsApp OTP are checked separately.',
    degraded: 'Dashboard sign-in is working, but it may be slow.',
    partial_outage: 'Some staff accounts cannot sign in. Others still can.',
    major_outage: 'Dashboard sign-in is not working. Staff cannot open the dashboard.',
    maintenance: 'Dashboard sign-in is in a planned maintenance window.',
  },
  checkout: {
    operational: 'A customer can pay a booking with UPI or card. The payment window is opening and new payments are being accepted. Invoices are checked separately.',
    degraded: 'UPI and card checkout is open, but a payment may be slow or need one retry.',
    partial_outage: 'Some UPI or card payments are failing. Others are still completing.',
    major_outage: 'UPI and card checkout cannot take a new booking payment.',
    maintenance: 'UPI and card checkout is in a planned maintenance window.',
  },
  invoices: {
    operational: 'A workshop invoice can be opened and paid. This is separate from the booking checkout above.',
    degraded: 'Invoices are available, but opening or paying one may be slow.',
    partial_outage: 'Some invoices cannot be opened or paid. Others still can.',
    major_outage: 'Invoices cannot be opened or paid right now.',
    maintenance: 'Invoices are in a planned maintenance window.',
  },
  whatsapp_booking: {
    operational: 'A booking confirmation can be sent on WhatsApp after a customer books. Later job updates are checked separately.',
    degraded: 'Booking WhatsApp messages are sending, but some may arrive late.',
    partial_outage: 'Some booking confirmations are not going out on WhatsApp. The booking itself may still exist in the app.',
    major_outage: 'Booking confirmations are not being sent on WhatsApp.',
    maintenance: 'Booking WhatsApp alerts are paused for planned maintenance.',
  },
  whatsapp_jobs: {
    operational: 'Job messages such as pickup, work started, and ready for delivery can be sent on WhatsApp. Booking confirmations are checked separately.',
    degraded: 'Job WhatsApp messages are sending, but some may arrive late.',
    partial_outage: 'Some job updates are not going out on WhatsApp. The job can still change inside the app.',
    major_outage: 'Job updates are not being sent on WhatsApp.',
    maintenance: 'Job WhatsApp alerts are paused for planned maintenance.',
  },
  pickup_assign: {
    operational: 'A pickup can be assigned to a pickup boy, and the assignment list is loading. Live map tracking is checked separately.',
    degraded: 'Pickup assignment is available, but the list may load slowly.',
    partial_outage: 'Some pickup assignments are not saving or not showing in the list.',
    major_outage: 'Pickup assignment is not available. A new pickup cannot be assigned.',
    maintenance: 'Pickup assignment is in a planned maintenance window.',
  },
  live_tracking: {
    operational: 'The live location of an active pickup is available on the map. Assigning the pickup is checked separately.',
    degraded: 'Pickup tracking is up, but the map or the location may refresh slowly.',
    partial_outage: 'Live location is missing for some pickups. The assignment can still exist.',
    major_outage: 'Live pickup tracking is not available.',
    maintenance: 'Live tracking is in a planned maintenance window.',
  },
  job_status: {
    operational: 'A job can move through the workshop steps, and the customer can see the latest status. Pickup assignment and the live map are checked separately.',
    degraded: 'Job status is updating, but the status screen may refresh slowly.',
    partial_outage: 'Some jobs are not showing the latest status. Others are.',
    major_outage: 'Job status is not loading or not updating.',
    maintenance: 'Job status is in a planned maintenance window.',
  },
};

export function summaryFor(status: PublicStatus): string {
  switch (status) {
    case 'operational':
      return 'You can book a service, sign in, pay, get WhatsApp alerts, and track a pickup as usual.';
    case 'degraded':
      return 'MyFNG is still available. The services marked below may be slow.';
    case 'partial_outage':
      return 'Part of MyFNG is disrupted. Only the services marked below are affected.';
    case 'major_outage':
      return 'A main service is down. The notes below say what still works.';
    case 'maintenance':
      return 'Planned work is in progress. Affected services are marked below.';
  }
}

export function serviceDetail(key: ComponentKey, status: PublicStatus): string {
  return SERVICE_DETAIL[key][status];
}

export function headlineFor(status: PublicStatus): string {
  switch (status) {
    case 'operational':
      return 'All systems operational';
    case 'degraded':
      return 'Some systems are slower than usual';
    case 'partial_outage':
      return 'Partial service disruption';
    case 'major_outage':
      return 'Major outage';
    case 'maintenance':
      return 'Scheduled maintenance in progress';
  }
}

function cleanText(value: unknown, max: number): string {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, max);
}

export function parseComponentKeys(value: unknown): ComponentKey[] {
  if (!Array.isArray(value)) return [];
  const keys = value
    .map((item) => String(item || '').trim())
    .filter((item): item is ComponentKey => COMPONENT_KEYS.has(item));
  return [...new Set(keys)];
}

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = String(error.message || '');
  return error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(msg);
}

function admin() {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (error || !supabaseAdmin) return null;
  return supabaseAdmin as any;
}

async function withTimeout<T>(fn: () => Promise<T>, ms = 6000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function probeWebsite(): Promise<ProbeStatus> {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
  const start = Date.now();
  try {
    const response = await withTimeout(() => fetch(`${origin}/`, { redirect: 'follow' }), 6000);
    if (!response.ok) return 'major_outage';
    return Date.now() - start > 3000 ? 'degraded' : 'operational';
  } catch {
    return 'major_outage';
  }
}

async function probeJobStatus(): Promise<ProbeStatus> {
  const client = admin();
  if (!client) return 'major_outage';
  const start = Date.now();
  try {
    const { error } = await withTimeout(() => client.from('service_leads').select('id').limit(1));
    if (error) return 'major_outage';
    return Date.now() - start > 2500 ? 'degraded' : 'operational';
  } catch {
    return 'major_outage';
  }
}

function worstProbe(a: ProbeStatus, b: ProbeStatus): ProbeStatus {
  const rank: Record<ProbeStatus, number> = { operational: 0, degraded: 1, major_outage: 2 };
  return rank[a] >= rank[b] ? a : b;
}

async function probeDatabase(): Promise<ProbeStatus> {
  const client = admin();
  if (!client) return 'major_outage';
  const start = Date.now();
  try {
    const { error } = await withTimeout(() => client.from('roles').select('id').limit(1));
    if (error) return 'major_outage';
    return Date.now() - start > 2500 ? 'degraded' : 'operational';
  } catch {
    return 'major_outage';
  }
}

async function probeAuth(): Promise<ProbeStatus> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return 'major_outage';
  const start = Date.now();
  try {
    const response = await withTimeout(() =>
      fetch(`${url.replace(/\/$/, '')}/auth/v1/health`, { headers: { apikey: key } }),
    );
    if (!response.ok) return 'major_outage';
    return Date.now() - start > 2500 ? 'degraded' : 'operational';
  } catch {
    return 'major_outage';
  }
}

async function probeRazorpay(): Promise<ProbeStatus> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return 'major_outage';
  const start = Date.now();
  try {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const response = await withTimeout(() =>
      fetch('https://api.razorpay.com/v1/payments?count=1', {
        headers: { Authorization: `Basic ${auth}` },
      }),
    );
    if (!response.ok) return 'major_outage';
    return Date.now() - start > 4000 ? 'degraded' : 'operational';
  } catch {
    return 'major_outage';
  }
}

async function probeWhatsApp(): Promise<ProbeStatus> {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneId || !token) return 'major_outage';
  const apiUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0';
  const start = Date.now();
  try {
    const response = await withTimeout(() =>
      fetch(`${apiUrl}/${phoneId}`, { headers: { Authorization: `Bearer ${token}` } }),
    );
    if (!response.ok) {
      if (response.status === 429 || response.status >= 500) return 'degraded';
      return 'major_outage';
    }
    return Date.now() - start > 4000 ? 'degraded' : 'operational';
  } catch {
    return 'degraded';
  }
}

async function probePickupTable(): Promise<ProbeStatus> {
  const client = admin();
  if (!client) return 'major_outage';
  const start = Date.now();
  try {
    const { error } = await withTimeout(() => client.from('pickup_delivery_tasks').select('id').limit(1));
    if (error) return 'major_outage';
    return Date.now() - start > 2500 ? 'degraded' : 'operational';
  } catch {
    return 'major_outage';
  }
}

async function probeMaps(): Promise<ProbeStatus> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return 'degraded';
  try {
    await withTimeout(() => fetch('https://maps.googleapis.com', { method: 'HEAD' }), 5000);
    return 'operational';
  } catch {
    return 'degraded';
  }
}

function operatorOrigin(apiUrl: string): string | null {
  const cleaned = apiUrl.replace(/\{\{[^}]+\}\}/g, 'x').trim();
  if (!cleaned) return null;
  try {
    const url = new URL(cleaned.includes('://') ? cleaned : `https://${cleaned}`);
    return url.origin;
  } catch {
    return null;
  }
}

async function probeSmsOtp(): Promise<{ status: ProbeStatus; note: string | null }> {
  const client = admin();
  if (!client) return { status: 'major_outage', note: null };
  try {
    const [config, templatesRes, tmRes] = await Promise.all([
      getMobileAuthConfig(client),
      client
        .from('dlt_sms_templates')
        .select('kind, status, event_key, dlt_template_id')
        .eq('event_key', 'OTP_VERIFICATION')
        .limit(5),
      client
        .from('dlt_sms_telemarketers')
        .select('is_primary, is_active, api_url, api_key, default_header')
        .eq('is_primary', true)
        .limit(1),
    ]);
    const errMsg = `${templatesRes.error?.message || ''} ${tmRes.error?.message || ''}`;
    if (templatesRes.error || tmRes.error) {
      if (/does not exist|PGRST205|42P01/i.test(errMsg)) return { status: 'major_outage', note: null };
      return { status: 'degraded', note: null };
    }
    const templateReady = (templatesRes.data || []).some(
      (row: { kind?: string; status?: string; dlt_template_id?: string }) =>
        row.kind === 'CONTENT' && row.status === 'APPROVED' && String(row.dlt_template_id || '').trim(),
    );
    const pipe = (tmRes.data || []).find(
      (row: { is_primary?: boolean; is_active?: boolean; api_url?: string; api_key?: string }) =>
        row.is_primary && row.is_active && String(row.api_url || '').trim() && String(row.api_key || '').trim(),
    );
    if (!templateReady || !pipe) {
      return { status: 'major_outage', note: null };
    }
    const origin = operatorOrigin(String(pipe.api_url || ''));
    let reach: ProbeStatus = 'operational';
    if (!origin) reach = 'degraded';
    else {
      const start = Date.now();
      try {
        await withTimeout(() => fetch(origin, { method: 'HEAD' }), 5000);
        if (Date.now() - start > 4000) reach = 'degraded';
      } catch {
        reach = 'degraded';
      }
    }
    if (reach !== 'operational') return { status: reach, note: null };
    if (!config.sms_otp_enabled) {
      return {
        status: 'operational',
        note: 'SMS login codes are not being sent right now. Sign in with WhatsApp OTP.',
      };
    }
    return { status: 'operational', note: null };
  } catch {
    return { status: 'degraded', note: null };
  }
}

async function getProbes(): Promise<{
  value: Record<ComponentKey, ProbeStatus>;
  notes: Partial<Record<ComponentKey, string>>;
}> {
  if (probeCache && Date.now() - probeCache.at < CACHE_MS) {
    return { value: probeCache.value, notes: probeCache.notes };
  }
  const [website, db, auth, payments, whatsapp, pickupTable, maps, jobs, sms] = await Promise.all([
    probeWebsite(),
    probeDatabase(),
    probeAuth(),
    probeRazorpay(),
    probeWhatsApp(),
    probePickupTable(),
    probeMaps(),
    probeJobStatus(),
    probeSmsOtp(),
  ]);
  const liveTracking: ProbeStatus = pickupTable === 'major_outage' ? 'major_outage' : maps !== 'operational' ? 'degraded' : pickupTable;
  const value: Record<ComponentKey, ProbeStatus> = {
    public_website: website,
    staff_dashboard: db,
    customer_app: db,
    workshop_app: db,
    sms_otp: sms.status,
    whatsapp_otp: whatsapp,
    staff_login: auth,
    checkout: payments,
    invoices: worstProbe(db, payments),
    whatsapp_booking: whatsapp,
    whatsapp_jobs: whatsapp,
    pickup_assign: pickupTable,
    live_tracking: liveTracking,
    job_status: jobs,
  };
  const notes: Partial<Record<ComponentKey, string>> = {};
  if (sms.note) notes.sms_otp = sms.note;
  probeCache = { at: Date.now(), value, notes };
  return { value, notes };
}

type IncidentRow = {
  id: string;
  title: string;
  impact: IncidentImpact;
  component_keys: string[] | null;
  state: IncidentState;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

type UpdateRow = {
  id: string;
  incident_id: string;
  state: UpdateState;
  body: string;
  created_at: string;
};

type MaintenanceRow = {
  id: string;
  title: string;
  body: string;
  component_keys: string[] | null;
  starts_at: string;
  ends_at: string;
  state: MaintenanceState;
  created_at: string;
  updated_at: string;
};

export type StatusUpdate = { id: string; state: UpdateState; body: string; createdAt: string };
export type StatusIncident = {
  id: string;
  title: string;
  impact: IncidentImpact;
  state: IncidentState;
  componentKeys: ComponentKey[];
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  updates: StatusUpdate[];
};
export type StatusMaintenance = {
  id: string;
  title: string;
  body: string;
  state: MaintenanceState;
  componentKeys: ComponentKey[];
  startsAt: string;
  endsAt: string;
  createdAt: string;
};

function mapIncident(row: IncidentRow, updates: UpdateRow[]): StatusIncident {
  return {
    id: row.id,
    title: row.title,
    impact: row.impact,
    state: row.state,
    componentKeys: parseComponentKeys(row.component_keys),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    updates: updates
      .filter((item) => item.incident_id === row.id)
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
      .map((item) => ({ id: item.id, state: item.state, body: item.body, createdAt: item.created_at })),
  };
}

function mapMaintenance(row: MaintenanceRow): StatusMaintenance {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    state: row.state,
    componentKeys: parseComponentKeys(row.component_keys),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
  };
}

export async function loadStatusRecords(): Promise<{
  tablesReady: boolean;
  incidents: StatusIncident[];
  maintenances: StatusMaintenance[];
}> {
  const client = admin();
  if (!client) return { tablesReady: false, incidents: [], maintenances: [] };
  const [incidentsRes, maintenanceRes] = await Promise.all([
    client
      .from('status_incidents')
      .select('id, title, impact, component_keys, state, created_at, updated_at, resolved_at')
      .order('created_at', { ascending: false })
      .limit(80),
    client
      .from('status_maintenances')
      .select('id, title, body, component_keys, starts_at, ends_at, state, created_at, updated_at')
      .order('starts_at', { ascending: false })
      .limit(80),
  ]);
  if (isMissingTable(incidentsRes.error) || isMissingTable(maintenanceRes.error)) {
    return { tablesReady: false, incidents: [], maintenances: [] };
  }
  const incidentRows = (incidentsRes.data || []) as IncidentRow[];
  const ids = incidentRows.map((row) => row.id);
  let updates: UpdateRow[] = [];
  if (ids.length) {
    const updatesRes = await client
      .from('status_incident_updates')
      .select('id, incident_id, state, body, created_at')
      .in('incident_id', ids)
      .order('created_at', { ascending: false });
    if (!updatesRes.error) updates = (updatesRes.data || []) as UpdateRow[];
  }
  return {
    tablesReady: !incidentsRes.error && !maintenanceRes.error,
    incidents: incidentRows.map((row) => mapIncident(row, updates)),
    maintenances: ((maintenanceRes.data || []) as MaintenanceRow[]).map(mapMaintenance),
  };
}

function maintenanceIsLive(item: StatusMaintenance, now: number): boolean {
  if (item.state === 'completed') return false;
  if (item.state === 'in_progress') return true;
  const start = +new Date(item.startsAt);
  const end = +new Date(item.endsAt);
  return item.state === 'scheduled' && start <= now && end >= now;
}

function affects(keys: ComponentKey[], component: ComponentKey): boolean {
  return keys.length === 0 || keys.includes(component);
}

export async function buildPublicStatus() {
  const [probeBundle, records] = await Promise.all([getProbes(), loadStatusRecords()]);
  const probes = probeBundle.value;
  const now = Date.now();
  const openIncidents = records.incidents.filter((item) => item.state !== 'resolved');
  const liveMaintenance = records.maintenances.filter((item) => maintenanceIsLive(item, now));
  const upcoming = records.maintenances
    .filter((item) => item.state !== 'completed' && +new Date(item.endsAt) >= now)
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));

  const components = STATUS_COMPONENTS.map((component) => {
    const probed = probes[component.key];
    let status: PublicStatus = probed;
    for (const incident of openIncidents) {
      if (!affects(incident.componentKeys, component.key)) continue;
      status = worst(status, incident.impact);
    }
    for (const item of liveMaintenance) {
      if (!affects(item.componentKeys, component.key)) continue;
      if (status === 'operational' || status === 'degraded') status = 'maintenance';
    }
    return {
      key: component.key,
      group: component.group,
      name: component.name,
      description: component.description,
      status,
      label: STATUS_LABEL[status],
      message: customerMessage(status),
      detail: status === probed && probeBundle.notes[component.key]
        ? probeBundle.notes[component.key]
        : serviceDetail(component.key, status),
    };
  });

  let overall: PublicStatus = 'operational';
  for (const component of components) overall = worst(overall, component.status);

  const historyCutoff = now - HISTORY_DAYS * 24 * 60 * 60 * 1000;
  const history = [
    ...records.incidents
      .filter((item) => item.state === 'resolved' && +new Date(item.resolvedAt || item.updatedAt) >= historyCutoff)
      .map((item) => ({
        id: item.id,
        kind: 'incident' as const,
        title: item.title,
        endedAt: item.resolvedAt || item.updatedAt,
        updates: item.updates,
      })),
    ...records.maintenances
      .filter((item) => item.state === 'completed' && +new Date(item.endsAt) >= historyCutoff)
      .map((item) => ({
        id: item.id,
        kind: 'maintenance' as const,
        title: item.title,
        endedAt: item.endsAt,
        updates: [{ id: item.id, state: 'update' as const, body: item.body, createdAt: item.endsAt }],
      })),
  ].sort((a, b) => +new Date(b.endedAt) - +new Date(a.endedAt));

  return {
    overall,
    headline: headlineFor(overall),
    summary: summaryFor(overall),
    updatedAt: new Date().toISOString(),
    components,
    incidents: openIncidents,
    maintenances: upcoming,
    history,
    tablesReady: records.tablesReady,
    catalog: STATUS_COMPONENTS,
    allIncidents: records.incidents,
    allMaintenances: records.maintenances,
  };
}

export function publicPayload(full: Awaited<ReturnType<typeof buildPublicStatus>>) {
  const { tablesReady: _tables, catalog: _catalog, allIncidents: _allIncidents, allMaintenances: _allMaintenances, ...safe } = full;
  return safe;
}

function assertTitle(value: unknown) {
  const title = cleanText(value, 160);
  if (title.length < 3) throw new Error('Title must be at least 3 characters.');
  return title;
}

function assertBody(value: unknown) {
  const body = cleanText(value, 2000);
  if (!body) throw new Error('Update text is required.');
  return body;
}

export async function createIncident(input: {
  title: unknown;
  impact: unknown;
  componentKeys: unknown;
  body: unknown;
  state?: unknown;
}) {
  const client = admin();
  if (!client) throw new Error('Status page is not configured.');
  const title = assertTitle(input.title);
  const impact = String(input.impact || '') as IncidentImpact;
  if (!IMPACTS.has(impact)) throw new Error('Choose an impact.');
  const state = (input.state ? String(input.state) : 'investigating') as IncidentState;
  if (!INCIDENT_STATES.has(state) || state === 'resolved') throw new Error('Choose a starting status.');
  const componentKeys = parseComponentKeys(input.componentKeys);
  const body = assertBody(input.body);
  const now = new Date().toISOString();
  const { data, error } = await client
    .from('status_incidents')
    .insert({
      title,
      impact,
      component_keys: componentKeys,
      state,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();
  if (error || !data) {
    if (isMissingTable(error)) throw new Error('Run database/385_public_status_page.sql first.');
    throw new Error('Could not create the incident.');
  }
  const { error: updateError } = await client.from('status_incident_updates').insert({
    incident_id: data.id,
    state,
    body,
    created_at: now,
  });
  if (updateError) throw new Error('Incident was created, but the first update failed.');
  return data.id as string;
}

export async function addIncidentUpdate(input: { id: unknown; state: unknown; body: unknown }) {
  const client = admin();
  if (!client) throw new Error('Status page is not configured.');
  const id = cleanText(input.id, 80);
  const state = String(input.state || '') as UpdateState;
  if (!UPDATE_STATES.has(state)) throw new Error('Choose an update status.');
  const body = assertBody(input.body);
  const now = new Date().toISOString();
  const { error } = await client.from('status_incident_updates').insert({
    incident_id: id,
    state,
    body,
    created_at: now,
  });
  if (error) {
    if (isMissingTable(error)) throw new Error('Run database/385_public_status_page.sql first.');
    throw new Error('Could not post the update.');
  }
  const patch: Record<string, string | null> = { updated_at: now };
  if (state !== 'update') patch.state = state;
  if (state === 'resolved') patch.resolved_at = now;
  const { error: incidentError } = await client.from('status_incidents').update(patch).eq('id', id);
  if (incidentError) throw new Error('Update was saved, but the incident status did not change.');
}

export async function createMaintenance(input: {
  title: unknown;
  body: unknown;
  componentKeys: unknown;
  startsAt: unknown;
  endsAt: unknown;
}) {
  const client = admin();
  if (!client) throw new Error('Status page is not configured.');
  const title = assertTitle(input.title);
  const body = assertBody(input.body);
  const componentKeys = parseComponentKeys(input.componentKeys);
  const starts = new Date(String(input.startsAt || ''));
  const ends = new Date(String(input.endsAt || ''));
  if (Number.isNaN(+starts) || Number.isNaN(+ends) || +ends <= +starts) {
    throw new Error('Maintenance end time must be after the start time.');
  }
  const now = new Date().toISOString();
  const { error } = await client.from('status_maintenances').insert({
    title,
    body,
    component_keys: componentKeys,
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    state: 'scheduled',
    created_at: now,
    updated_at: now,
  });
  if (error) {
    if (isMissingTable(error)) throw new Error('Run database/385_public_status_page.sql first.');
    throw new Error('Could not schedule maintenance.');
  }
}

export async function setMaintenanceState(input: { id: unknown; state: unknown }) {
  const client = admin();
  if (!client) throw new Error('Status page is not configured.');
  const id = cleanText(input.id, 80);
  const state = String(input.state || '') as MaintenanceState;
  if (!MAINTENANCE_STATES.has(state)) throw new Error('Choose a maintenance status.');
  const { error } = await client
    .from('status_maintenances')
    .update({ state, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    if (isMissingTable(error)) throw new Error('Run database/385_public_status_page.sql first.');
    throw new Error('Could not update maintenance.');
  }
}
