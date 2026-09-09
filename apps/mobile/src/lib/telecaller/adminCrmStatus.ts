export const ADMIN_CRM_STATUS_OPTIONS = [
  { id: 'FRESH', label: 'Fresh' },
  { id: 'INTERESTED', label: 'Interested' },
  { id: 'WILL_VISIT', label: 'He will visit' },
  { id: 'CALLBACK', label: 'Follow-up' },
  { id: 'BOOKING_CONFIRMED', label: 'Booking confirmed' },
  { id: 'IN_SERVICE', label: 'In Service' },
  { id: 'SERVICE_DONE', label: 'Service Done' },
  { id: 'LOST', label: 'Lost' },
  { id: 'RINGING', label: 'Ringing / No answer' },
] as const;

export type AdminCrmStatusId = (typeof ADMIN_CRM_STATUS_OPTIONS)[number]['id'];

export const ADMIN_CRM_LOST_REASONS = [
  'Not Interested',
  'Unqualified Lead',
  'No-Response to Calls',
  'Already Service Done',
  'Under Warranty',
  'Looking For Authorised Service Center',
  'Other Reasons',
] as const;

function looksLikeRingingText(raw: unknown): boolean {
  return /\bringing\b|\bno\s*answer\b|\bcall\s+not\s+received\b|\bnot\s+received\b|\bdidn'?t\s+(pick|receive|answer)\b|\bnot\s+picking\b|\bno\s+response\b|\bcall\s+cut\b|\bcut\s+the\s+call\b/i.test(
    String(raw || ''),
  );
}

function activityLooksLikeRinging(meta: any, extraRemark?: unknown): boolean {
  if (
    looksLikeRingingText(meta?.last_call_label) ||
    looksLikeRingingText(meta?.telecaller_remarks) ||
    looksLikeRingingText(extraRemark)
  ) {
    return true;
  }
  const hist = Array.isArray(meta?.profile_history) ? meta.profile_history : [];
  for (const entry of hist) {
    if (String(entry?.status || '').toUpperCase() === 'RINGING') return true;
    if (looksLikeRingingText(entry?.remark) || looksLikeRingingText(entry?.summary)) return true;
  }
  return false;
}

export function resolveAdminCrmStatusId(lead: any): AdminCrmStatusId {
  const result = String(lead?.coupon_meta?.last_call_result || '').trim().toUpperCase();
  if (result === 'COMPLETED') return 'SERVICE_DONE';
  if (
    (!result || result === 'FRESH' || result === 'RINGING') &&
    activityLooksLikeRinging(lead?.coupon_meta, lead?.telecaller_remarks)
  ) {
    return 'RINGING';
  }
  if (result === 'RINGING') return 'RINGING';
  if (result && result !== 'FRESH' && ADMIN_CRM_STATUS_OPTIONS.some((o) => o.id === result)) {
    return result as AdminCrmStatusId;
  }
  const label = String(
    lead?.coupon_meta?.last_call_label || lead?.display_status || lead?.status || '',
  )
    .trim()
    .toLowerCase();
  if (label.startsWith('lost')) return 'LOST';
  if (label === 'completed' || label === 'service done') return 'SERVICE_DONE';
  const match = ADMIN_CRM_STATUS_OPTIONS.find((o) => o.label.toLowerCase() === label);
  if (match) return match.id;
  const st = String(lead?.status || '').trim().toUpperCase();
  if (st === 'VALIDATED') return 'BOOKING_CONFIRMED';
  if (st === 'IN_PROGRESS') return 'IN_SERVICE';
  if (st === 'COMPLETED' || st === 'READY_FOR_DELIVERY') return 'SERVICE_DONE';
  if (st === 'REJECTED' || st === 'CANCELLED') return 'LOST';
  return 'FRESH';
}

export function adminCrmStatusLabel(lead: any): string {
  const id = resolveAdminCrmStatusId(lead);
  return ADMIN_CRM_STATUS_OPTIONS.find((o) => o.id === id)?.label || 'Fresh';
}
