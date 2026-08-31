const PICKUP_DONE = new Set([
  'VEHICLE_DROPPED_AT_WORKSHOP',
  'ARRIVED_AT_WORKSHOP',
  'DROPPED', // pickup_tracking enum on older DBs
  'PICKED_UP',
  'PICKUP_COMPLETED',
]);

const CLOSED = new Set(['REJECTED', 'CANCELLED', 'CLOSED']);

export type PickupHistoryStatus = 'COMPLETED' | 'CANCELLED' | 'IN_PROGRESS';

/** Pickup leg finished — vehicle at workshop or later. */
export function isPickupLegComplete(lead: {
  pickup_status?: string | null;
  status?: string | null;
}) {
  const pickup = String(lead.pickup_status || '').toUpperCase();
  const status = String(lead.status || '').toUpperCase();
  return PICKUP_DONE.has(pickup) || PICKUP_DONE.has(status);
}

export function isHistoryTaskCancelled(lead: { status?: string | null }) {
  const status = String(lead.status || '').toUpperCase();
  return status === 'CANCELLED' || status === 'REJECTED';
}

/** Completed pickup/delivery leg for history tab filters & stats. */
export function isHistoryTaskCompleted(lead: {
  pickup_status?: string | null;
  status?: string | null;
}) {
  if (isHistoryTaskCancelled(lead)) return false;
  if (isPickupLegComplete(lead)) return true;
  const status = String(lead.status || '').toUpperCase();
  const pickup = String(lead.pickup_status || '').toUpperCase();
  return (
    status === 'DELIVERED' ||
    status === 'DELIVERED_TO_CUSTOMER' ||
    status === 'CLOSED' ||
    pickup === 'DELIVERED' ||
    pickup === 'PICKED_UP'
  );
}

export function formatPickupHistoryStatus(lead: {
  pickup_status?: string | null;
  status?: string | null;
}): PickupHistoryStatus {
  if (isHistoryTaskCancelled(lead)) return 'CANCELLED';
  if (isHistoryTaskCompleted(lead)) return 'COMPLETED';
  return 'IN_PROGRESS';
}

export function getPickupHistoryCompletedAt(lead: {
  pickup_arrival_time?: string | null;
  pickup_completed_at?: string | null;
  delivered_at?: string | null;
  updated_at?: string | null;
}): string | null {
  return (
    lead.pickup_arrival_time ||
    lead.pickup_completed_at ||
    lead.delivered_at ||
    lead.updated_at ||
    null
  );
}

export function formatPickupStatusLabel(status: string): string {
  const s = String(status || '').toUpperCase();
  if (s === 'COMPLETED' || isPickupLegComplete({ status: s })) return 'Completed';
  if (s === 'CANCELLED' || s === 'REJECTED') return 'Cancelled';
  if (['VEHICLE_IN_TRANSIT', 'IN_TRANSIT', 'ON_THE_WAY', 'PICKED', 'PICKED_UP'].includes(s)) {
    return 'In transit';
  }
  if (s === 'OTP_VERIFIED') return 'OTP verified';
  if (['ASSIGNED', 'NOT_ASSIGNED', 'PENDING', 'ACCEPTED'].includes(s)) return 'Pending';
  return String(status || '').replace(/_/g, ' ');
}

/** Lead no longer needs pickup-boy action (workshop/QC/billing/delivery done). */
export function isPickupBoyInactiveLead(lead: { status?: string | null }) {
  const status = String(lead.status || '').toUpperCase();
  return [
    'WORK_COMPLETED',
    'QC_PENDING',
    'QC_APPROVED',
    'READY_FOR_BILLING',
    'READY_FOR_DELIVERY',
    'DELIVERED',
    'DELIVERED_TO_CUSTOMER',
    'CLOSED',
    'CANCELLED',
    'REJECTED',
  ].includes(status);
}

/** Active pickup task for pickup boy home / tasks list. */
export function isActivePickupBoyTask(lead: {
  pickup_required?: boolean | null;
  pickup_status?: string | null;
  status?: string | null;
}) {
  if (!lead.pickup_required) return false;
  const status = String(lead.status || '').toUpperCase();
  if (CLOSED.has(status) || isPickupBoyInactiveLead(lead)) return false;
  if (isPickupLegComplete(lead)) return false;
  return true;
}

/** Delivery leg — vehicle ready to return to customer. */
export function isActiveDeliveryBoyTask(lead: {
  status?: string | null;
  pickup_status?: string | null;
}) {
  const status = String(lead.status || '').toUpperCase();
  const pickup = String(lead.pickup_status || '').toUpperCase();
  return (
    status === 'READY_FOR_DELIVERY' ||
    status === 'COD_PENDING' ||
    pickup === 'OUT_FOR_DELIVERY'
  );
}

/** History tab — pickup/delivery legs finished for this pickup boy. */
export function isPickupBoyHistoryTask(lead: {
  pickup_status?: string | null;
  status?: string | null;
}) {
  if (isPickupLegComplete(lead)) return true;
  const status = String(lead.status || '').toUpperCase();
  const pickup = String(lead.pickup_status || '').toUpperCase();
  return (
    status === 'DELIVERED' ||
    status === 'DELIVERED_TO_CUSTOMER' ||
    status === 'CLOSED' ||
    pickup === 'DELIVERED'
  );
}

export function isPickupBoyOpenTask(lead: {
  pickup_required?: boolean | null;
  pickup_status?: string | null;
  status?: string | null;
}) {
  return isActivePickupBoyTask(lead) || isActiveDeliveryBoyTask(lead);
}

export function isPickupInTransit(lead: {
  pickup_status?: string | null;
  status?: string | null;
}) {
  const pickup = String(lead.pickup_status || '').toUpperCase();
  const status = String(lead.status || '').toUpperCase();
  return (
    ['ON_THE_WAY', 'OTP_VERIFIED', 'VEHICLE_IN_TRANSIT', 'IN_TRANSIT', 'PICKED_UP'].includes(pickup) ||
    ['ON_THE_WAY', 'VEHICLE_IN_TRANSIT', 'IN_TRANSIT'].includes(status)
  );
}

export function isPickupScheduled(lead: {
  pickup_status?: string | null;
  status?: string | null;
}) {
  if (!isActivePickupBoyTask(lead)) return false;
  if (isPickupInTransit(lead)) return false;
  const pickup = String(lead.pickup_status || '').toUpperCase();
  const status = String(lead.status || '').toUpperCase();
  return (
    ['ASSIGNED', 'NOT_ASSIGNED', 'PENDING', 'ACCEPTED'].includes(pickup) ||
    ['ACCEPTED', 'ASSIGNED_TO_WORKSHOP', 'ASSIGNED'].includes(status)
  );
}

export function isDeliveryInTransit(lead: {
  pickup_status?: string | null;
  status?: string | null;
}) {
  const pickup = String(lead.pickup_status || '').toUpperCase();
  const status = String(lead.status || '').toUpperCase();
  return pickup === 'OUT_FOR_DELIVERY' || status === 'COD_PENDING';
}

export function isDeliveryScheduled(lead: {
  status?: string | null;
  pickup_status?: string | null;
}) {
  if (!isActiveDeliveryBoyTask(lead)) return false;
  return !isDeliveryInTransit(lead);
}

export type PickupDashboardBucket = 'upcoming' | 'ongoing' | 'completed';

/** Bucket active/completed leads for pickup-boy home dashboard sections. */
export function classifyPickupBoyDashboardTask(lead: {
  pickup_required?: boolean | null;
  pickup_status?: string | null;
  status?: string | null;
}): PickupDashboardBucket | null {
  if (isHistoryTaskCompleted(lead)) return 'completed';
  if (!isActivePickupBoyTask(lead) && !isActiveDeliveryBoyTask(lead)) return null;
  if (isPickupInTransit(lead) || isDeliveryInTransit(lead)) return 'ongoing';
  if (isPickupScheduled(lead) || isDeliveryScheduled(lead)) return 'upcoming';
  return 'ongoing';
}
