/** CRM queue filter rules — keep in sync with apps/web/src/lib/telecaller/crmLeadFilters.ts */

export function splitCrmStatusFilter(filter: string | null | undefined): string[] {
  return Array.from(
    new Set(
      String(filter || '')
        .split(',')
        .map((v) => v.trim().toLowerCase())
        .filter((v) => v && v !== 'all'),
    ),
  );
}

export function leadMatchesCrmQueueFilter(lead: any, filter: string | null | undefined): boolean {
  const ids = splitCrmStatusFilter(filter);
  if (ids.length > 1) return ids.some((id) => leadMatchesCrmQueueFilter(lead, id));
  const f = String(filter || '').trim().toLowerCase();
  if (!f || f === 'all') return true;
  const result = String(lead?.coupon_meta?.last_call_result || '').trim().toUpperCase();
  const status = String(lead?.status || '').trim().toUpperCase();
  if (f === 'new' || f === 'fresh') return status === 'NEW' && (!result || result === 'FRESH');
  if (f === 'ringing') return result === 'RINGING';
  if (f === 'interested') return result === 'INTERESTED';
  if (f === 'will_visit') return result === 'WILL_VISIT';
  if (f === 'booking_confirmed') return status === 'VALIDATED';
  if (f === 'booked')
    return ['VALIDATED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(status);
  if (f === 'in_service') return status === 'IN_PROGRESS';
  if (f === 'service_done') return status === 'COMPLETED';
  if (f === 'lost' || f === 'rejected') return status === 'REJECTED';
  if (f === 'callback' || f === 'followup' || f === 'follow_up') {
    return (
      result === 'CALLBACK' &&
      !['IN_PROGRESS', 'COMPLETED', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED', 'CANCELLED', 'REJECTED'].includes(
        status,
      )
    );
  }
  if (f === 'incomplete') return Boolean(lead?.is_incomplete);
  if (f === 'other') return result === 'OTHER';
  return result === f.toUpperCase();
}