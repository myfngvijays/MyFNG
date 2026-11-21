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

/** "interested,lost" → ['interested','lost'] (lower-case, no 'all'). One id = old single filter. */
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
  } else {
    // Activity date only when every picked status is an activity filter.
    const ids = splitCrmStatusFilter(filter);
    if (ids.length && ids.every((id) => CRM_ACTIVITY_DATE_FILTERS.has(id))) col = 'last_call_at';
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

/** Name / phone / lead# lookup. Status tiles still apply on top of the search. */
export function isCrmLeadLookupQuery(q: string | null | undefined): boolean {
  return Boolean(String(q || '').trim());
}

/** Same rules as applyCrmQueueStatusFilter, for a row already loaded in the list. */
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
  if (f === 'booked') return ['VALIDATED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(status);
  if (f === 'in_service') return status === 'IN_PROGRESS';
  if (f === 'service_done') return status === 'COMPLETED';
  if (f === 'lost' || f === 'rejected') return status === 'REJECTED';
  if (f === 'callback' || f === 'followup' || f === 'follow_up') {
    return result === 'CALLBACK' && !['IN_PROGRESS', 'COMPLETED', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED', 'CANCELLED', 'REJECTED'].includes(status);
  }
  if (f === 'incomplete') return Boolean(lead?.is_incomplete);
  if (f === 'other') return result === 'OTHER';
  return result === f.toUpperCase();
}

/** Status / disposition tiles for the CRM queue. Search does not skip these. */
export function applyCrmQueueStatusFilter(
  query: any,
  filter: string | null | undefined,
  lostReason?: string | null,
  otherReason?: string | null,
) {
  const ids = splitCrmStatusFilter(filter);
  if (ids.length > 1) {
    // Several statuses picked → OR of each one's condition.
    const clauses = ids.map((id) => crmStatusOrClause(id, id === 'other' ? otherReason : lostReason)).filter(Boolean);
    return clauses.length ? query.or(clauses.join(',')) : query;
  }
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
  if (f === 'other') {
    let next = query.filter('coupon_meta->>last_call_result', 'eq', 'OTHER');
    const reason = String(lostReason || '').trim();
    if (reason) next = next.filter('coupon_meta->>last_other_reason', 'eq', reason);
    return next;
  }
  return query.filter('coupon_meta->>last_call_result', 'eq', f.toUpperCase());
}

const CLOSED_FOR_FOLLOW_UP = '(IN_PROGRESS,COMPLETED,READY_FOR_DELIVERY,DELIVERED,CLOSED,CANCELLED,REJECTED)';

/** PostgREST or()-clause for one status id — same rules as applyCrmQueueStatusFilter. */
function crmStatusOrClause(f: string, reason?: string | null): string {
  const clean = (v: string) => v.replace(/[,()"]/g, ' ').trim();
  const r = clean(String(reason || ''));
  switch (f) {
    case 'new':
    case 'fresh':
      return 'and(status.eq.NEW,or(coupon_meta->>last_call_result.is.null,coupon_meta->>last_call_result.eq.FRESH))';
    case 'ringing':
      return 'coupon_meta->>last_call_result.eq.RINGING';
    case 'interested':
      return 'coupon_meta->>last_call_result.eq.INTERESTED';
    case 'will_visit':
      return 'coupon_meta->>last_call_result.eq.WILL_VISIT';
    case 'booking_confirmed':
      return 'status.eq.VALIDATED';
    case 'booked':
      return 'status.in.(VALIDATED,ASSIGNED,ACCEPTED,IN_PROGRESS,COMPLETED)';
    case 'in_service':
      return 'status.eq.IN_PROGRESS';
    case 'service_done':
      return 'status.eq.COMPLETED';
    case 'lost':
    case 'rejected':
      return r ? `and(status.eq.REJECTED,coupon_meta->>last_lost_reason.eq."${r}")` : 'status.eq.REJECTED';
    case 'callback':
    case 'followup':
    case 'follow_up':
      return `and(coupon_meta->>last_call_result.eq.CALLBACK,status.not.in.${CLOSED_FOR_FOLLOW_UP})`;
    case 'overdue_callback':
      return `and(follow_up_required.is.true,next_follow_up_at.lte.${new Date().toISOString()},status.not.in.${CLOSED_FOR_FOLLOW_UP})`;
    case 'incomplete':
      return 'is_incomplete.is.true';
    case 'other':
      return r
        ? `and(coupon_meta->>last_call_result.eq.OTHER,coupon_meta->>last_other_reason.eq."${r}")`
        : 'coupon_meta->>last_call_result.eq.OTHER';
    default: {
      const code = f.toUpperCase().replace(/[^A-Z0-9_]/g, '');
      return code ? `coupon_meta->>last_call_result.eq.${code}` : '';
    }
  }
}
