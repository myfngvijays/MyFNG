const PICKUP_DONE = new Set([
  'VEHICLE_DROPPED_AT_WORKSHOP',
  'PICKED_UP',
  'PICKUP_COMPLETED',
  'DROPPED', // pickup_tracking enum on older DBs
]);

const CLOSED = new Set(['REJECTED', 'CANCELLED']);

const QC_TERMINAL_STATUSES = new Set([
  'REJECTED',
  'CANCELLED',
  'CLOSED',
  'QC_APPROVED',
  'READY_FOR_BILLING',
  'READY_FOR_DELIVERY',
  'DELIVERED',
  'REWORK_REQUIRED',
]);

/** After QC pass the floor job is done — billing / payment / delivery. */
export const FLOOR_DONE_STATUSES = new Set([
  'QC_APPROVED',
  'READY_FOR_BILLING',
  'INVOICE_GENERATED',
  'PAYMENT_AWAITING',
  'AWAITING_PAYMENT',
  'READY_FOR_DELIVERY',
  'DELIVERED',
  'CLOSED',
  'COMPLETED',
]);

export function isQcPassed(lead: { qc_status?: string | null; status?: string | null }) {
  const qc = String(lead.qc_status || '').toUpperCase();
  if (qc === 'PASSED' || qc === 'APPROVED') return true;
  return FLOOR_DONE_STATUSES.has(String(lead.status || '').toUpperCase());
}

/** Mechanic assign only after pickup is done (or pickup not required). */
export function isReadyForMechanicAssign(lead: {
  pickup_required?: boolean | null;
  pickup_status?: string | null;
  status?: string | null;
  assigned_mechanic_id?: string | null;
}) {
  if (!lead.pickup_required) return true;
  const pickup = String(lead.pickup_status || '').toUpperCase();
  const status = String(lead.status || '').toUpperCase();
  return PICKUP_DONE.has(pickup) || PICKUP_DONE.has(status);
}

function isPastPickupCard(lead: {
  pickup_status?: string | null;
  status?: string | null;
  drop_status?: string | null;
  drop_otp_verified_at?: string | null;
  drop_completed_time?: string | null;
}) {
  const status = String(lead.status || '').toUpperCase();
  const pickup = String(lead.pickup_status || '').toUpperCase();
  if (CLOSED.has(status) || FLOOR_DONE_STATUSES.has(status) || status === 'COD_PENDING') return true;
  if (['DELIVERED', 'OUT_FOR_DELIVERY'].includes(pickup)) return true;
  if (lead.drop_otp_verified_at || lead.drop_completed_time) return true;
  if (String(lead.drop_status || '').toUpperCase() === 'DELIVERED') return true;
  return false;
}

/** Advisor still needs to assign a pickup boy. */
export function isWaitingPickupAssign(lead: {
  pickup_required?: boolean | null;
  assigned_pickup_boy_id?: string | null;
  pickup_status?: string | null;
  status?: string | null;
}) {
  if (!lead.pickup_required) return false;
  if (lead.assigned_pickup_boy_id) return false;
  if (isPastPickupCard(lead)) return false;
  if (isReadyForMechanicAssign(lead)) return false;
  return true;
}

/** Pickup boy assigned but vehicle not yet at workshop — show on advisor home for tracking. */
export function isPickupInProgress(lead: {
  pickup_required?: boolean | null;
  assigned_pickup_boy_id?: string | null;
  pickup_status?: string | null;
  status?: string | null;
}) {
  if (!lead.pickup_required) return false;
  if (!lead.assigned_pickup_boy_id) return false;
  if (isPastPickupCard(lead)) return false;
  if (isReadyForMechanicAssign(lead)) return false;
  return true;
}

export function isWaitingDeliveryAssign(lead: {
  status?: string | null;
  drop_assigned_to?: string | null;
  drop_status?: string | null;
  drop_otp_verified_at?: string | null;
  drop_completed_time?: string | null;
}) {
  const status = String(lead.status || '').toUpperCase();
  if (status !== 'READY_FOR_DELIVERY' && status !== 'COD_PENDING') return false;
  if (String(lead.drop_assigned_to || '').trim()) return false;
  if (lead.drop_otp_verified_at || lead.drop_completed_time) return false;
  if (String(lead.drop_status || '').toUpperCase() === 'DELIVERED') return false;
  return true;
}

export function isDeliveryInProgress(lead: {
  status?: string | null;
  drop_assigned_to?: string | null;
  drop_status?: string | null;
  drop_otp_verified_at?: string | null;
  drop_completed_time?: string | null;
}) {
  const status = String(lead.status || '').toUpperCase();
  if (status === 'DELIVERED' || status === 'DELIVERED_TO_CUSTOMER') return false;
  if (status !== 'READY_FOR_DELIVERY' && status !== 'COD_PENDING') return false;
  if (!String(lead.drop_assigned_to || '').trim()) return false;
  if (lead.drop_otp_verified_at || lead.drop_completed_time) return false;
  if (String(lead.drop_status || '').toUpperCase() === 'DELIVERED') return false;
  return true;
}

/** QC queue: only after mechanic finished — not default qc_status on new leads. */
export function isPendingQc(lead: {
  status?: string | null;
  qc_status?: string | null;
  mechanic_completed_at?: string | null;
}) {
  const status = String(lead.status || '').toUpperCase();
  if (QC_TERMINAL_STATUSES.has(status)) return false;

  const workDone =
    status === 'WORK_COMPLETED' ||
    status === 'QC_PENDING' ||
    Boolean(lead.mechanic_completed_at);
  if (!workDone) return false;

  const qc = String(lead.qc_status || '').toUpperCase();
  if (qc === 'PASSED' || qc === 'APPROVED' || qc === 'FAILED') return false;
  return !qc || qc === 'PENDING';
}

/** QC Queue chips — PENDING includes mechanic-complete with qc_status = PENDING. */
export function qcQueueTab(lead: {
  status?: string | null;
  qc_status?: string | null;
  mechanic_completed_at?: string | null;
}): 'PENDING' | 'PASSED' | 'FAILED' | 'REWORK' | 'OTHER' {
  if (isPendingQc(lead)) return 'PENDING';
  const qc = String(lead.qc_status || '').toUpperCase();
  if (qc === 'PASSED' || qc === 'APPROVED') return 'PASSED';
  if (qc === 'FAILED') return 'FAILED';
  if (qc === 'REWORK_REQUIRED' || qc === 'REWORK') return 'REWORK';
  return 'OTHER';
}

type LeadLookupClient = {
  from: (table: string) => {
    select: (cols: string) => any;
  };
};

/** QC Review / job screens may receive a lead UUID or a mechanic_jobs UUID. */
export async function resolveAdvisorLeadId(
  client: LeadLookupClient,
  ids: { leadId?: string | null; jobId?: string | null },
): Promise<string | null> {
  const unique = [...new Set([ids.leadId, ids.jobId].map((x) => String(x || '').trim()).filter(Boolean))];
  for (const id of unique) {
    const { data } = await client.from('service_leads').select('id').eq('id', id).maybeSingle();
    if (data?.id) return String(data.id);
  }
  for (const id of unique) {
    const { data } = await client.from('mechanic_jobs').select('lead_id').eq('id', id).limit(1);
    const leadId = Array.isArray(data) ? data[0]?.lead_id : (data as any)?.lead_id;
    if (leadId) return String(leadId);
  }
  return unique[0] || null;
}

export async function latestMechanicJobForLead(client: LeadLookupClient, leadId: string) {
  const { data, error } = await client
    .from('mechanic_jobs')
    .select('id, lead_id, mechanic_id, mechanic_status, started_at, work_notes, updated_at, created_at')
    .eq('lead_id', leadId)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error) return { data: null, error };
  const row = Array.isArray(data) ? data[0] : data;
  return { data: row || null, error: null };
}
