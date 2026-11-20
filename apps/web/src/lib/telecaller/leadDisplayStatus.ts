import { activityLooksLikeRinging } from '@/lib/telecaller/callDisposition';

/** Match lead detail "Select status" + All / New — colors aligned with mobile CrmQueueTab */

export const LEAD_STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'Fresh' },
  { id: 'ringing', label: 'Ringing' },
  { id: 'interested', label: 'Interested' },
  { id: 'will_visit', label: 'He will visit' },
  { id: 'callback', label: 'Follow-up' },
  { id: 'booking_confirmed', label: 'Booking confirmed' },
  { id: 'in_service', label: 'In Service' },
  { id: 'service_done', label: 'Service Done' },
  { id: 'lost', label: 'Lost' },
] as const;

/** One Fresh + one Follow-up — skip incomplete/callback aliases from the statuses API. */
export function mergeCrmStatusFilters(
  rows: Array<{ id?: string; code?: string; label?: string; name?: string }>,
  allLabel = 'All',
): Array<{ id: string; label: string }> {
  const out: Array<{ id: string; label: string }> = [
    { id: 'all', label: allLabel },
    { id: 'new', label: 'Fresh' },
    { id: 'ringing', label: 'Ringing' },
    { id: 'interested', label: 'Interested' },
    { id: 'will_visit', label: 'He will visit' },
    { id: 'callback', label: 'Follow-up' },
    { id: 'booking_confirmed', label: 'Booking confirmed' },
    { id: 'in_service', label: 'In Service' },
    { id: 'service_done', label: 'Service Done' },
    { id: 'lost', label: 'Lost' },
  ];
  const skipIds = new Set([
    'all',
    'fresh',
    'new',
    'incomplete',
    'ringing',
    'ringing_no_answer',
    'callback',
    'follow_up',
    'followup',
    'interested',
    'will_visit',
    'booking_confirmed',
    'in_service',
    'service_done',
    'lost',
  ]);
  const seenLabels = new Set(out.map((r) => r.label.toLowerCase()));

  const normalizeLabel = (id: string, raw: string) => {
    if (
      id === 'callback' ||
      id === 'follow_up' ||
      id === 'followup' ||
      /^callback$/i.test(raw)
    ) {
      return 'Follow-up';
    }
    return String(raw || '').trim() || id;
  };

  for (const r of rows) {
    const code = String(r.code || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
    const rawId = String(r.id || '').trim();
    const id = code && !/^[0-9a-f]{8}-/i.test(code) ? code : rawId && !/^[0-9a-f]{8}-/i.test(rawId) ? rawId.toLowerCase().replace(/\s+/g, '_') : '';
    if (!id || skipIds.has(id)) continue;
    const label = normalizeLabel(id, String(r.label || r.name || r.code || id));
    const labelKey = label.toLowerCase();
    if (seenLabels.has(labelKey)) continue;
    skipIds.add(id);
    seenLabels.add(labelKey);
    out.push({ id, label });
  }
  return out;
}

export const LOST_REASON_FILTERS = [
  { id: '', label: 'All lost reasons' },
  { id: 'Not Interested', label: 'Not Interested' },
  { id: 'Unqualified Lead', label: 'Unqualified Lead' },
  { id: 'No-Response to Calls', label: 'No-Response to Calls' },
  { id: 'Already Service Done', label: 'Already Service Done' },
  { id: 'Under Warranty', label: 'Under Warranty' },
  { id: 'Looking For Authorised Service Center', label: 'Looking For Authorised Service Center' },
  { id: 'Other Reasons', label: 'Other Reasons' },
] as const;

const RESULT_LABEL: Record<string, string> = {
  FRESH: 'Fresh',
  INTERESTED: 'Interested',
  WILL_VISIT: 'He will visit',
  CALLBACK: 'Follow-up',
  BOOKING_CONFIRMED: 'Booking confirmed',
  IN_SERVICE: 'In Service',
  SERVICE_DONE: 'Service Done',
  LOST: 'Lost',
  OTHER: 'Other',
  RINGING: 'Ringing',
  OTP_VERIFIED: 'OTP Verified',
};

function shortLeadStatusLabel(label: string): string {
  const s = String(label || '').trim();
  if (/^lost\b/i.test(s) || /^lost\s*[·•\-:|]/i.test(s)) return 'Lost';
  if (/^callback\b/i.test(s)) return 'Follow-up';
  if (/^ringing\b/i.test(s)) return 'Ringing';
  // Strip "Status · detail" for list badges (keep primary status only)
  const beforeDot = s.split(/\s*[·•|]\s*/)[0]?.trim();
  if (beforeDot && /^lost\b/i.test(beforeDot)) return 'Lost';
  return s;
}

const PIPELINE_LABEL: Record<string, string> = {
  NEW: 'Fresh',
  VALIDATED: 'Booking confirmed',
  IN_PROGRESS: 'In Service',
  COMPLETED: 'Service Done',
  REJECTED: 'Lost',
  CONTACTED: 'Contacted',
  ASSIGNED: 'Assigned',
  ACCEPTED: 'Accepted',
  PENDING: 'Pending',
  INCOMPLETE: 'Fresh',
};

/** Friendly CRM status for list/detail badges (not raw ANSWERED / NEW). */
export function leadDisplayStatus(lead: any): string {
  const ringingStuck =
    activityLooksLikeRinging(lead?.coupon_meta, lead?.telecaller_remarks) &&
    !['INTERESTED', 'WILL_VISIT', 'CALLBACK', 'BOOKING_CONFIRMED', 'IN_SERVICE', 'SERVICE_DONE', 'LOST', 'OTHER'].includes(
      String(lead?.coupon_meta?.last_call_result || '').toUpperCase(),
    );

  if (lead && typeof lead === 'object' && Boolean(lead.is_incomplete)) {
    const result = String(lead?.coupon_meta?.last_call_result || '').toUpperCase();
    if (result && RESULT_LABEL[result] && result !== 'FRESH') {
      return RESULT_LABEL[result];
    }
    if (ringingStuck) return 'Ringing';
    const label = String(lead?.coupon_meta?.last_call_label || '').trim();
    if (label && !/^fresh$/i.test(label) && !/^new$/i.test(label) && !/^incomplete$/i.test(label)) {
      return shortLeadStatusLabel(label);
    }
    return 'Fresh';
  }

  const resultEarly = String(lead?.coupon_meta?.last_call_result || '').toUpperCase();
  if (resultEarly === 'FRESH') return 'Fresh';
  if (ringingStuck && (!resultEarly || resultEarly === 'FRESH' || resultEarly === 'RINGING')) {
    return 'Ringing';
  }

  const label = String(lead?.coupon_meta?.last_call_label || '').trim();
  if (label && /otp verified/i.test(label)) return label;
  if (label && !/^fresh$/i.test(label) && !/^new$/i.test(label)) return shortLeadStatusLabel(label);

  const result = String(lead?.coupon_meta?.last_call_result || '').toUpperCase();
  if (result && RESULT_LABEL[result] && result !== 'FRESH') return RESULT_LABEL[result];

  const hist = Array.isArray(lead?.coupon_meta?.profile_history)
    ? lead.coupon_meta.profile_history
    : [];
  for (const entry of hist) {
    const s = String(entry?.status || '').toUpperCase();
    if (s && RESULT_LABEL[s]) return RESULT_LABEL[s];
  }

  const status = String(lead?.status || '').toUpperCase();
  return shortLeadStatusLabel(PIPELINE_LABEL[status] || status.replace(/_/g, ' ') || 'Fresh');
}

type StatusTint = {
  cardBg: string;
  border: string;
  badgeBg: string;
  badgeText: string;
};

function statusTint(_cardBg: string, _border: string, badgeBg: string, badgeText: string): StatusTint {
  return { cardBg: '#FFFFFF', border: '#E5E7EB', badgeBg, badgeText };
}

/** Soft row tint + a clearly colored status pill. */
function statusTintFromLabel(label: string): StatusTint {
  const s = String(label || '').toUpperCase();

  if (s.includes('NOT INTERESTED') || s.includes('LOST') || s === 'REJECTED') {
    return statusTint('#FEF2F2', '#FECACA', '#FECACA', '#7F1D1D');
  }
  if (s.includes('OTP')) {
    return statusTint('#FFFFFF', '#E5E7EB', '#F5D0FE', '#701A75');
  }
  if (s.includes('RINGING') || s.includes('NO ANSWER') || s.includes('NO-RESPONSE')) {
    return statusTint('#FFFBEB', '#FDE68A', '#FDE68A', '#451A03');
  }
  if (s.includes('WILL VISIT')) {
    return statusTint('#F5F3FF', '#DDD6FE', '#DDD6FE', '#4C1D95');
  }
  if (s.includes('INTERESTED')) {
    return statusTint('#FFF7ED', '#FDBA74', '#FDBA74', '#7C2D12');
  }
  if (s.includes('CALLBACK') || s.includes('FOLLOW-UP') || s.includes('FOLLOW UP')) {
    return statusTint('#F0F9FF', '#7DD3FC', '#BAE6FD', '#0C4A6E');
  }
  if (s.includes('BOOKING') || s.includes('CONFIRMED') || s.includes('VALIDATED')) {
    return statusTint('#ECFDF5', '#6EE7B7', '#A7F3D0', '#064E3B');
  }
  if (s.includes('IN SERVICE') || s === 'IN_PROGRESS' || s.includes('IN PROGRESS')) {
    return statusTint('#EEF2FF', '#A5B4FC', '#C7D2FE', '#312E81');
  }
  if (s.includes('SERVICE DONE') || s === 'SERVICE_DONE' || s === 'COMPLETED' || s === 'DONE') {
    return statusTint('#F0FDF4', '#86EFAC', '#BBF7D0', '#14532D');
  }
  if (s.includes('ASSIGNED')) {
    return statusTint('#FAF5FF', '#E9D5FF', '#E9D5FF', '#581C87');
  }
  if (s.includes('CONTACTED')) {
    return statusTint('#ECFEFF', '#A5F3FC', '#A5F3FC', '#155E75');
  }
  if (s.includes('ACCEPTED')) {
    return statusTint('#F7FEE7', '#BEF264', '#D9F99D', '#365314');
  }
  if (s.includes('PENDING')) {
    return statusTint('#FEFCE8', '#FDE047', '#FEF08A', '#713F12');
  }
  if (s === 'NEW' || s.includes('FRESH') || s.includes('INCOMPLETE')) {
    return statusTint('#EFF6FF', '#93C5FD', '#BFDBFE', '#1E3A8A');
  }
  return statusTint('#F8FAFC', '#E2E8F0', '#E2E8F0', '#0F172A');
}

/** Lead list cards and status pills. */
export function leadStatusCardColors(leadOrLabel: any): StatusTint {
  const label =
    typeof leadOrLabel === 'string'
      ? leadOrLabel
      : leadDisplayStatus(leadOrLabel);
  return statusTintFromLabel(label);
}

/** Home KPI tiles — full status palette (previous look). */
export function leadStatusKpiColors(leadOrLabel: any): {
  cardBg: string;
  border: string;
  badgeBg: string;
  badgeText: string;
} {
  const label =
    typeof leadOrLabel === 'string'
      ? leadOrLabel
      : leadDisplayStatus(leadOrLabel);
  const s = String(label || '').toUpperCase();
  const incomplete =
    (leadOrLabel && typeof leadOrLabel === 'object' && Boolean(leadOrLabel.is_incomplete)) ||
    s.includes('INCOMPLETE');

  if (s.includes('LOST') || s === 'REJECTED') {
    return { cardBg: '#FEF2F2', border: '#FECACA', badgeBg: '#FEE2E2', badgeText: '#B91C1C' };
  }
  if (s.includes('BOOKING') || s === 'SERVICE DONE' || s.startsWith('SERVICE DONE') || s === 'COMPLETED') {
    return { cardBg: '#ECFDF5', border: '#A7F3D0', badgeBg: '#D1FAE5', badgeText: '#047857' };
  }
  if (s.includes('IN SERVICE') || s === 'IN_PROGRESS') {
    return { cardBg: '#EFF6FF', border: '#BFDBFE', badgeBg: '#DBEAFE', badgeText: '#1D4ED8' };
  }
  if (s.includes('WILL VISIT')) {
    return { cardBg: '#F5F3FF', border: '#DDD6FE', badgeBg: '#EDE9FE', badgeText: '#6D28D9' };
  }
  if (s.includes('CALLBACK') || s.includes('FOLLOW-UP') || s.includes('FOLLOW UP')) {
    return { cardBg: '#F0F9FF', border: '#BAE6FD', badgeBg: '#E0F2FE', badgeText: '#0369A1' };
  }
  if (s.includes('INTERESTED')) {
    return { cardBg: '#FFF7ED', border: '#FED7AA', badgeBg: '#FFEDD5', badgeText: '#C2410C' };
  }
  if (s.includes('RINGING')) {
    return { cardBg: '#F8FAFC', border: '#CBD5E1', badgeBg: '#E2E8F0', badgeText: '#334155' };
  }
  if (s === 'OTHER' || s.startsWith('OTHER')) {
    return { cardBg: '#F8FAFC', border: '#E2E8F0', badgeBg: '#F1F5F9', badgeText: '#475569' };
  }
  if (incomplete) {
    return { cardBg: '#FFFBEB', border: '#FDE68A', badgeBg: '#B45309', badgeText: '#FFFFFF' };
  }
  if (s === 'NEW' || s === 'FRESH' || s.includes('FRESH')) {
    return { cardBg: '#EFF6FF', border: '#BFDBFE', badgeBg: '#1D4ED8', badgeText: '#FFFFFF' };
  }
  return { cardBg: '#FFFFFF', border: '#E5E7EB', badgeBg: '#F1F5F9', badgeText: '#475569' };
}

export function leadStatusBannerClass(lead: any): string {
  const s = leadDisplayStatus(lead).toUpperCase();
  if (s.includes('LOST') || s === 'REJECTED') return 'bg-red-50 border-red-200';
  if (s.includes('BOOKING') || s.includes('SERVICE DONE') || s === 'COMPLETED') return 'bg-emerald-50 border-emerald-200';
  return 'bg-slate-50 border-slate-200';
}

export function leadStatusPillClass(lead: any): string {
  const s = leadDisplayStatus(lead).toUpperCase();
  if (s.includes('LOST')) return 'bg-red-100 text-red-700';
  if (s.includes('BOOKING') || s.includes('SERVICE DONE') || s === 'COMPLETED') return 'bg-emerald-100 text-emerald-800';
  return 'bg-slate-100 text-slate-600';
}

export const ADMIN_CRM_STATUS_OPTIONS = [
  { id: 'FRESH', label: 'Fresh' },
  { id: 'RINGING', label: 'Ringing' },
  { id: 'INTERESTED', label: 'Interested' },
  { id: 'WILL_VISIT', label: 'He will visit' },
  { id: 'CALLBACK', label: 'Follow-up' },
  { id: 'BOOKING_CONFIRMED', label: 'Booking confirmed' },
  { id: 'IN_SERVICE', label: 'In Service' },
  { id: 'SERVICE_DONE', label: 'Service Done' },
  { id: 'LOST', label: 'Lost' },
  { id: 'OTHER', label: 'Other' },
] as const;

export type AdminCrmStatusId = (typeof ADMIN_CRM_STATUS_OPTIONS)[number]['id'];

export type CrmStatusChoice = { id: string; label: string };

/** Built-in labels stay. Extra rows from Lead Status (Attempted Contact, etc.) are appended. */
export function mergeAdminStatusChoices(
  rows: Array<{ code?: string; name?: string; is_active?: boolean | null }>,
): CrmStatusChoice[] {
  const out: CrmStatusChoice[] = ADMIN_CRM_STATUS_OPTIONS.map((opt) => ({
    id: opt.id,
    label: opt.label,
  }));
  const seen = new Set(out.map((opt) => opt.id));
  const extras: CrmStatusChoice[] = [];
  for (const row of rows) {
    if (row?.is_active === false) continue;
    const id = String(row?.code || '').trim().toUpperCase();
    const label = String(row?.name || '').trim();
    if (!id || !label || seen.has(id)) continue;
    seen.add(id);
    extras.push({ id, label });
  }
  const tail = new Set(['LOST', 'OTHER']);
  return [...out.filter((opt) => !tail.has(opt.id)), ...extras, ...out.filter((opt) => tail.has(opt.id))];
}

/** Same workshop `status` mapping telecaller CRM uses (Service Done → COMPLETED). */
export const ADMIN_CRM_TO_LEAD_STATUS: Record<string, string> = {
  BOOKING_CONFIRMED: 'VALIDATED',
  IN_SERVICE: 'IN_PROGRESS',
  SERVICE_DONE: 'COMPLETED',
  LOST: 'REJECTED',
};

const WORKSHOP_TERMINAL = new Set(['COMPLETED', 'CANCELLED']);

export function adminCrmMappedWorkshopStatus(
  crmStatusId: string,
  currentWorkshopStatus?: string | null,
): string | undefined {
  const crmId = String(crmStatusId || '').trim().toUpperCase();
  const normalized = crmId === 'COMPLETED' ? 'SERVICE_DONE' : crmId;
  const mapped = ADMIN_CRM_TO_LEAD_STATUS[normalized];
  if (!mapped) return undefined;
  const current = String(currentWorkshopStatus || '').trim().toUpperCase();
  if ((normalized === 'SERVICE_DONE' || normalized === 'LOST') || !WORKSHOP_TERMINAL.has(current)) {
    return mapped;
  }
  return undefined;
}

export function resolveAdminCrmStatusId(lead: any): string {
  const result = String(lead?.coupon_meta?.last_call_result || '').trim().toUpperCase();
  if (result === 'FRESH') return 'FRESH';
  if (result === 'COMPLETED') return 'SERVICE_DONE';
  if (
    (!result || result === 'FRESH' || result === 'RINGING') &&
    activityLooksLikeRinging(lead?.coupon_meta, lead?.telecaller_remarks)
  ) {
    return 'RINGING';
  }
  if (result === 'FRESH') return 'FRESH';
  if (result === 'RINGING') return 'RINGING';
  if (result && result !== 'FRESH' && ADMIN_CRM_STATUS_OPTIONS.some((o) => o.id === result)) {
    return result;
  }
  if (result && /^[A-Z][A-Z0-9_]{1,39}$/.test(result)) return result;
  const label = String(leadDisplayStatus(lead) || '').trim().toLowerCase();
  if (label.startsWith('lost')) return 'LOST';
  if (label.startsWith('other')) return 'OTHER';
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

export function buildAdminCrmStatusCouponMeta(
  prevMeta: Record<string, unknown> | null | undefined,
  statusIdInput: string,
  opts?: { lostReason?: string | null; note?: string | null; actor?: string | null; label?: string | null },
): { ok: true; coupon_meta: Record<string, unknown>; label: string } | { ok: false; error: string } {
  const statusIdRaw = String(statusIdInput || '').trim().toUpperCase();
  const statusId = statusIdRaw === 'COMPLETED' ? 'SERVICE_DONE' : statusIdRaw;
  const spec = ADMIN_CRM_STATUS_OPTIONS.find((o) => o.id === statusId);
  const customLabel = String(opts?.label || '').trim();
  if (!spec && !/^[A-Z][A-Z0-9_]{1,39}$/.test(statusId)) {
    return { ok: false, error: 'Invalid lead status' };
  }

  const lostReason = String(opts?.lostReason || '').trim();
  if (statusId === 'LOST' && !lostReason) {
    return { ok: false, error: 'Lost reason is required' };
  }
  const otherItem = statusId === 'OTHER' ? lostReason : '';

  const now = new Date().toISOString();
  const label =
    statusId === 'LOST'
      ? `Lost · ${lostReason}`
      : otherItem
        ? `Other · ${otherItem}`
        : spec?.label || customLabel || statusId.replace(/_/g, ' ');
  const prev = prevMeta && typeof prevMeta === 'object' && !Array.isArray(prevMeta) ? { ...prevMeta } : {};
  const prevHistory = Array.isArray(prev.profile_history) ? prev.profile_history : [];
  const historyEntry = {
    at: now,
    summary: `${opts?.actor || 'Admin'} updated ${label}`,
    remark: String(opts?.note || '').trim() || null,
    status: statusId,
  };

  return {
    ok: true,
    label,
    coupon_meta: {
      ...prev,
      last_call_result: statusId,
      last_call_label: label,
      last_call_at: now,
      last_lost_reason: statusId === 'LOST' ? lostReason : prev.last_lost_reason || null,
      last_other_reason: statusId === 'OTHER' ? otherItem || null : prev.last_other_reason || null,
      profile_history: [historyEntry, ...prevHistory].slice(0, 50),
    },
  };
}
