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

/** Mechanic assign only after pickup is done (or pickup not required). */
export function isReadyForMechanicAssign(lead: {
  pickup_required?: boolean | null;
  pickup_status?: string | null;
  status?: string | null;
}) {
  if (!lead.pickup_required) return true;
  const pickup = String(lead.pickup_status || '').toUpperCase();
  const status = String(lead.status || '').toUpperCase();
  return PICKUP_DONE.has(pickup) || PICKUP_DONE.has(status);
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
  const status = String(lead.status || '').toUpperCase();
  if (CLOSED.has(status)) return false;
  if (isReadyForMechanicAssign(lead)) return false;
  return true;
}

/** Pickup boy assigned but vehicle not yet at workshop. */
export function isPickupInProgress(lead: {
  pickup_required?: boolean | null;
  assigned_pickup_boy_id?: string | null;
  pickup_status?: string | null;
  status?: string | null;
}) {
  if (!lead.pickup_required) return false;
  if (!lead.assigned_pickup_boy_id) return false;
  const status = String(lead.status || '').toUpperCase();
  if (CLOSED.has(status)) return false;
  if (isReadyForMechanicAssign(lead)) return false;
  return true;
}

/** QC queue count — mechanic must have finished first. */
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
