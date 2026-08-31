const PICKUP_DONE = new Set([
  'VEHICLE_DROPPED_AT_WORKSHOP',
  'PICKED_UP',
  'PICKUP_COMPLETED',
]);

const CLOSED = new Set(['REJECTED', 'CANCELLED']);

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
