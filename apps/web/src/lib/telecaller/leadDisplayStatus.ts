/** Match lead detail "Select status" + All / New — colors aligned with mobile CrmQueueTab */

export const LEAD_STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'incomplete', label: 'Incomplete' },
  { id: 'interested', label: 'Interested' },
  { id: 'will_visit', label: 'He will visit' },
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
  INTERESTED: 'Interested',
  WILL_VISIT: 'He will visit',
  BOOKING_CONFIRMED: 'Booking confirmed',
  IN_SERVICE: 'In Service',
  SERVICE_DONE: 'Service Done',
  LOST: 'Lost',
  RINGING: 'Ringing',
  OTP_VERIFIED: 'OTP Verified',
};

function shortLeadStatusLabel(label: string): string {
  const s = String(label || '').trim();
  if (/^lost\b/i.test(s)) return 'Lost';
  return s;
}

const PIPELINE_LABEL: Record<string, string> = {
  NEW: 'New',
  VALIDATED: 'Booking confirmed',
  IN_PROGRESS: 'In Service',
  COMPLETED: 'Service Done',
  REJECTED: 'Lost',
  CONTACTED: 'Contacted',
  ASSIGNED: 'Assigned',
  ACCEPTED: 'Accepted',
  PENDING: 'Pending',
  INCOMPLETE: 'Incomplete',
};

/** Friendly CRM status for list/detail badges (not raw ANSWERED / NEW). */
export function leadDisplayStatus(lead: any): string {
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
  return shortLeadStatusLabel(PIPELINE_LABEL[status] || status.replace(/_/g, ' ') || 'New');
}

/** Same palette as mobile CrmQueueTab.leadStatusCardColors */
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
    s === 'SERVICE DONE' ||
    s.startsWith('SERVICE DONE') ||
    s === 'COMPLETED'
  ) {
    return { cardBg: '#ECFDF5', border: '#A7F3D0', badgeBg: '#D1FAE5', badgeText: '#047857' };
  }
  if (s.includes('IN SERVICE') || s === 'IN_PROGRESS') {
    return { cardBg: '#EFF6FF', border: '#BFDBFE', badgeBg: '#DBEAFE', badgeText: '#1D4ED8' };
  }
  if (s.includes('WILL VISIT')) {
    return { cardBg: '#F5F3FF', border: '#DDD6FE', badgeBg: '#EDE9FE', badgeText: '#6D28D9' };
  }
  if (s.includes('INTERESTED')) {
    return { cardBg: '#FFF7ED', border: '#FED7AA', badgeBg: '#FFEDD5', badgeText: '#C2410C' };
  }
  if (s.includes('OTP')) {
    return { cardBg: '#FFFBEB', border: '#FDE68A', badgeBg: '#FEF3C7', badgeText: '#B45309' };
  }
  if (s === 'NEW' || s.includes('INCOMPLETE')) {
    return { cardBg: '#F8FAFC', border: '#E2E8F0', badgeBg: '#E2E8F0', badgeText: '#475569' };
  }
  return { cardBg: '#FFFFFF', border: '#E5E7EB', badgeBg: '#F1F5F9', badgeText: '#475569' };
}

export function leadStatusBannerClass(lead: any): string {
  const c = leadStatusCardColors(lead);
  // Tailwind-friendly approximations for banner (detail page)
  const s = leadDisplayStatus(lead).toUpperCase();
  if (s.includes('LOST') || s === 'REJECTED') return 'bg-red-50 border-red-200';
  if (s.includes('BOOKING') || s === 'SERVICE DONE' || s.startsWith('SERVICE DONE') || s === 'COMPLETED') {
    return 'bg-emerald-50 border-emerald-200';
  }
  if (s.includes('IN SERVICE')) return 'bg-blue-50 border-blue-200';
  if (s.includes('WILL VISIT')) return 'bg-violet-50 border-violet-200';
  if (s.includes('INTERESTED')) return 'bg-orange-50 border-orange-200';
  if (s.includes('OTP')) return 'bg-amber-50 border-amber-200';
  if (s === 'NEW' || s.includes('INCOMPLETE')) return 'bg-slate-50 border-slate-200';
  void c;
  return 'bg-gray-50 border-gray-200';
}

export function leadStatusPillClass(lead: any): string {
  const s = leadDisplayStatus(lead).toUpperCase();
  if (s.includes('LOST')) return 'bg-red-100 text-red-700';
  if (s.includes('BOOKING') || s === 'SERVICE DONE' || s.startsWith('SERVICE DONE')) {
    return 'bg-emerald-100 text-emerald-800';
  }
  if (s.includes('IN SERVICE')) return 'bg-blue-100 text-blue-700';
  if (s.includes('WILL VISIT')) return 'bg-violet-100 text-violet-800';
  if (s.includes('INTERESTED')) return 'bg-orange-100 text-orange-700';
  if (s.includes('OTP')) return 'bg-amber-100 text-amber-800';
  if (s === 'NEW' || s.includes('INCOMPLETE')) return 'bg-slate-200 text-slate-700';
  return 'bg-slate-100 text-slate-600';
}
