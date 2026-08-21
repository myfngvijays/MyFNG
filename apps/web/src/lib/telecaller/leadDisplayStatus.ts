/** Match lead detail "Select status" + All / New — colors aligned with mobile CrmQueueTab */

export const LEAD_STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'Fresh' },
  { id: 'interested', label: 'Interested' },
  { id: 'will_visit', label: 'He will visit' },
  { id: 'callback', label: 'Follow-up' },
  { id: 'booking_confirmed', label: 'Booking confirmed' },
  { id: 'in_service', label: 'In Service' },
  { id: 'service_done', label: 'Service Done' },
  { id: 'lost', label: 'Lost' },
] as const;

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

/** Lead list cards: only Lost + Booking keep accent; others neutral. */
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
  if (s.includes('BOOKING')) {
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
  if (s.includes('BOOKING')) return 'bg-emerald-50 border-emerald-200';
  return 'bg-slate-50 border-slate-200';
}

export function leadStatusPillClass(lead: any): string {
  const s = leadDisplayStatus(lead).toUpperCase();
  if (s.includes('LOST')) return 'bg-red-100 text-red-700';
  if (s.includes('BOOKING')) return 'bg-emerald-100 text-emerald-800';
  return 'bg-slate-100 text-slate-600';
}
