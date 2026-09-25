/** CRM queue tiles that are call dispositions (not pipeline status). */
export const CRM_DISPOSITION_RESULTS = [
  'INTERESTED',
  'WILL_VISIT',
  'CALLBACK',
  'LOST',
  'BOOKING_CONFIRMED',
  'IN_SERVICE',
  'SERVICE_DONE',
] as const;

export type CrmDispositionResult = (typeof CRM_DISPOSITION_RESULTS)[number];

/** Filters that should use last_call_at for date range (activity day, not lead created day). */
export const CRM_ACTIVITY_DATE_FILTERS = new Set([
  'ringing',
  'interested',
  'will_visit',
  'callback',
]);

/**
 * "Fresh" (filter id `new` / `fresh`) = pipeline NEW and not yet worked.
 * Ringing is its own filter — do not fold it into Fresh.
 */
export function applyCrmNewLeadFilter(query: any) {
  return query
    .eq('status', 'NEW')
    .or(
      'coupon_meta->>last_call_result.is.null,coupon_meta->>last_call_result.eq.FRESH',
    );
}

/**
 * Booking / workshop pipeline needs vehicle, PIN and address.
 * Soft CRM statuses (Fresh, Ringing, Interested, Follow-up, Lost) do not.
 */
export function crmDispositionNeedsFullProfile(result: unknown): boolean {
  const a = String(result || '')
    .trim()
    .toUpperCase();
  return a === 'BOOKING_CONFIRMED' || a === 'IN_SERVICE' || a === 'SERVICE_DONE';
}

export function applyCrmLeadDateRange(
  query: any,
  filter: string | null | undefined,
  from: string | null | undefined,
  to: string | null | undefined,
  dateField?: string | null,
) {
  if (!from && !to) return query;
  const requested = String(dateField || '')
    .toLowerCase()
    .trim();
  let col = 'created_at';
  if (requested === 'updated_at' || requested === 'modified') {
    col = 'updated_at';
  } else if (requested === 'last_call_at' || requested === 'activity') {
    col = 'last_call_at';
  } else if (CRM_ACTIVITY_DATE_FILTERS.has(String(filter || '').toLowerCase())) {
    col = 'last_call_at';
  }
  let q = query;
  if (from) q = q.gte(col, from);
  if (to) q = q.lte(col, to);
  return q;
}

/** Resolve list sort column from date filter field. */
export function resolveCrmLeadOrderColumn(dateField?: string | null): 'created_at' | 'updated_at' {
  const requested = String(dateField || '')
    .toLowerCase()
    .trim();
  if (requested === 'updated_at' || requested === 'modified') return 'updated_at';
  return 'created_at';
}

/** Name / phone / lead# lookup should ignore status + date tiles. */
export function isCrmLeadLookupQuery(q: string | null | undefined): boolean {
  return Boolean(String(q || '').trim());
}

/** Status / disposition tiles for the CRM queue (skipped while searching). */
export function applyCrmQueueStatusFilter(
  query: any,
  filter: string | null | undefined,
  lostReason?: string | null,
) {
  const f = String(filter || '').trim().toLowerCase();
  if (!f || f === 'all') return query;
  if (f === 'new' || f === 'fresh') return applyCrmNewLeadFilter(query);
  if (f === 'ringing') return query.filter('coupon_meta->>last_call_result', 'eq', 'RINGING');
  if (f === 'interested') return query.filter('coupon_meta->>last_call_result', 'eq', 'INTERESTED');
  if (f === 'will_visit') return query.filter('coupon_meta->>last_call_result', 'eq', 'WILL_VISIT');
  if (f === 'booking_confirmed') return query.eq('status', 'VALIDATED');
  if (f === 'booked') {
    return query.in('status', [
      'VALIDATED',
      'ASSIGNED',
      'ACCEPTED',
      'IN_PROGRESS',
      'COMPLETED',
    ]);
  }
  if (f === 'in_service') return query.eq('status', 'IN_PROGRESS');
  if (f === 'service_done') return query.eq('status', 'COMPLETED');
  if (f === 'lost' || f === 'rejected') {
    let next = query.eq('status', 'REJECTED');
    const reason = String(lostReason || '').trim();
    if (reason) next = next.filter('coupon_meta->>last_lost_reason', 'eq', reason);
    return next;
  }
  if (f === 'callback' || f === 'followup' || f === 'follow_up') {
    return query
      .filter('coupon_meta->>last_call_result', 'eq', 'CALLBACK')
      .not('status', 'in', '(IN_PROGRESS,COMPLETED,READY_FOR_DELIVERY,DELIVERED,CLOSED,CANCELLED,REJECTED)');
  }
  if (f === 'overdue_callback') {
    return query
      .eq('follow_up_required', true)
      .lte('next_follow_up_at', new Date().toISOString())
      .not('status', 'in', '(IN_PROGRESS,COMPLETED,READY_FOR_DELIVERY,DELIVERED,CLOSED,CANCELLED,REJECTED)');
  }
  if (f === 'incomplete') return query.eq('is_incomplete', true);
  return query.filter('coupon_meta->>last_call_result', 'eq', f.toUpperCase());
}
