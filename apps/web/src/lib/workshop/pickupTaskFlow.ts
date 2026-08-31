const PICKUP_DONE = new Set([
  'VEHICLE_DROPPED_AT_WORKSHOP',
  'ARRIVED_AT_WORKSHOP',
  'DROPPED',
  'PICKED_UP',
  'PICKUP_COMPLETED',
]);

const CLOSED = new Set(['REJECTED', 'CANCELLED', 'CLOSED']);

export type PickupHistoryStatus = 'COMPLETED' | 'CANCELLED' | 'IN_PROGRESS';

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
    ['ON_THE_WAY', 'OTP_VERIFIED', 'VEHICLE_IN_TRANSIT', 'IN_TRANSIT', 'PICKED_UP', 'PICKED'].includes(pickup) ||
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

export function pickupStatusColor(status: string): string {
  const s = String(status || '').toUpperCase();
  if (['ASSIGNED', 'NOT_ASSIGNED', 'PENDING', 'ACCEPTED'].includes(s)) return '#D97706';
  if (['IN_TRANSIT', 'VEHICLE_IN_TRANSIT', 'ON_THE_WAY', 'OTP_VERIFIED', 'PICKED', 'PICKED_UP'].includes(s)) {
    return '#004AAD';
  }
  if (['VEHICLE_DROPPED_AT_WORKSHOP', 'ARRIVED_AT_WORKSHOP', 'DROPPED', 'DELIVERED', 'DELIVERED_TO_CUSTOMER'].includes(s)) {
    return '#059669';
  }
  if (s === 'READY_FOR_DELIVERY' || s === 'COD_PENDING') return '#0284C7';
  return '#64748B';
}
