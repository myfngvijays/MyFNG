/** Match lead detail "Select status" + All / New */
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

export function leadStatusBannerClass(lead: any): string {
  const label = leadDisplayStatus(lead).toUpperCase();
  if (label.includes('LOST') || label === 'REJECTED') {
    return 'bg-red-50 border-red-200';
  }
  if (label.includes('BOOKING') || label === 'SERVICE DONE' || label.startsWith('SERVICE DONE') || label === 'COMPLETED') {
    return 'bg-emerald-50 border-emerald-200';
  }
  if (label.includes('INTERESTED') || label.includes('WILL VISIT') || label.includes('IN SERVICE')) {
    return 'bg-blue-50 border-blue-200';
  }
  if (label === 'NEW') {
    return 'bg-blue-50 border-blue-200';
  }
  const status = String(lead?.status || '').toUpperCase();
  if (status === 'ASSIGNED') return 'bg-indigo-50 border-indigo-200';
  if (status === 'ACCEPTED' || status === 'VALIDATED') return 'bg-emerald-50 border-emerald-200';
  if (status === 'REJECTED') return 'bg-red-50 border-red-200';
  return 'bg-gray-50 border-gray-200';
}

export function leadStatusPillClass(lead: any): string {
  const label = leadDisplayStatus(lead).toUpperCase();
  if (label.includes('LOST')) return 'bg-red-50 text-red-700';
  if (label.includes('BOOKING') || label === 'SERVICE DONE' || label.startsWith('SERVICE DONE')) {
    return 'bg-emerald-50 text-emerald-700';
  }
  if (label.includes('INTERESTED') || label.includes('WILL VISIT') || label.includes('IN SERVICE')) {
    return 'bg-blue-50 text-[#004AAD]';
  }
  if (label === 'NEW') return 'bg-slate-100 text-slate-600';
  return 'bg-slate-100 text-slate-600';
}
