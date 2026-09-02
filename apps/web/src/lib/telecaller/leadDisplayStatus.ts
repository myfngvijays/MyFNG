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
    const id = String(r.id || r.code || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
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
  RINGING: 'Ringing',
  OTP_VERIFIED: 'OTP Verified',
};

function shortLeadStatusLabel(label: string): string {
  const s = String(label || '').trim();
  if (/^lost\b/i.test(s) || /^lost\s*[·•\-:|]/i.test(s)) return 'Lost';
  if (/^callback\b/i.test(s)) return 'Follow-up';
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
  if (lead && typeof lead === 'object' && Boolean(lead.is_incomplete)) {
    const result = String(lead?.coupon_meta?.last_call_result || '').toUpperCase();
    if (result && RESULT_LABEL[result] && result !== 'FRESH') {
      return RESULT_LABEL[result];
    }
    const label = String(lead?.coupon_meta?.last_call_label || '').trim();
    if (label && !/^fresh$/i.test(label) && !/^new$/i.test(label) && !/^incomplete$/i.test(label)) {
      return shortLeadStatusLabel(label);
    }
    return 'Fresh';
  }

  const label = String(lead?.coupon_meta?.last_call_label || '').trim();
  if (label && /otp verified/i.test(label)) return label;
  if (label) return shortLeadStatusLabel(label);

  const result = String(lead?.coupon_meta?.last_call_result || '').toUpperCase();
  if (result && RESULT_LABEL[result]) return RESULT_LABEL[result];

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

/** Lead list cards: Lost, Booking confirmed, and Service Done keep accent. */
export function leadStatusCardColors(leadOrLabel: any): {
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

  if (s.includes('LOST') || s === 'REJECTED') {
    return { cardBg: '#FEF2F2', border: '#FECACA', badgeBg: '#FEE2E2', badgeText: '#B91C1C' };
  }
  if (
    s.includes('BOOKING') ||
    s.includes('SERVICE DONE') ||
    s === 'SERVICE_DONE' ||
    s === 'COMPLETED'
  ) {
    return { cardBg: '#ECFDF5', border: '#A7F3D0', badgeBg: '#D1FAE5', badgeText: '#047857' };
  }
  return { cardBg: '#FFFFFF', border: '#E5E7EB', badgeBg: '#F1F5F9', badgeText: '#475569' };
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

export function resolveAdminCrmStatusId(lead: any): AdminCrmStatusId {
  const result = String(lead?.coupon_meta?.last_call_result || '').trim().toUpperCase();
  if (result === 'COMPLETED') return 'SERVICE_DONE';
  if (ADMIN_CRM_STATUS_OPTIONS.some((o) => o.id === result)) return result as AdminCrmStatusId;
  const label = String(leadDisplayStatus(lead) || '').trim().toLowerCase();
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

export function buildAdminCrmStatusCouponMeta(
  prevMeta: Record<string, unknown> | null | undefined,
  statusIdInput: string,
  opts?: { lostReason?: string | null; note?: string | null; actor?: string | null },
): { ok: true; coupon_meta: Record<string, unknown>; label: string } | { ok: false; error: string } {
  const statusIdRaw = String(statusIdInput || '').trim().toUpperCase();
  const statusId = statusIdRaw === 'COMPLETED' ? 'SERVICE_DONE' : statusIdRaw;
  const spec = ADMIN_CRM_STATUS_OPTIONS.find((o) => o.id === statusId);
  if (!spec) return { ok: false, error: 'Invalid lead status' };

  const lostReason = String(opts?.lostReason || '').trim();
  if (statusId === 'LOST' && !lostReason) {
    return { ok: false, error: 'Lost reason is required' };
  }

  const now = new Date().toISOString();
  const label = statusId === 'LOST' ? `Lost · ${lostReason}` : spec.label;
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
      profile_history: [historyEntry, ...prevHistory].slice(0, 50),
    },
  };
}
