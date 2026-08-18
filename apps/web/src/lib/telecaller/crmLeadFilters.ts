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
  'interested',
  'will_visit',
  'callback',
]);

/**
 * "New" = pipeline NEW, not incomplete, and not already moved to a disposition tile.
 * PostgREST: null last_call_result OR value outside disposition list.
 */
export function applyCrmNewLeadFilter(query: any) {
  const notIn = CRM_DISPOSITION_RESULTS.join(',');
  return query
    .eq('status', 'NEW')
    .eq('is_incomplete', false)
    .or(
      `coupon_meta->>last_call_result.is.null,coupon_meta->>last_call_result.not.in.(${notIn})`,
    );
}

export function applyCrmLeadDateRange(
  query: any,
  filter: string | null | undefined,
  from: string | null | undefined,
  to: string | null | undefined,
) {
  if (!from && !to) return query;
  const useActivity = CRM_ACTIVITY_DATE_FILTERS.has(String(filter || '').toLowerCase());
  const col = useActivity ? 'last_call_at' : 'created_at';
  let q = query;
  if (from) q = q.gte(col, from);
  if (to) q = q.lte(col, to);
  return q;
}
