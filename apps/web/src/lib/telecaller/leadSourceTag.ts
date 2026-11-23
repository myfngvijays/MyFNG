import { resolveBookingSource } from '@/lib/booking-lead-utils';
import { resolveAdminCrmStatusId } from '@/lib/telecaller/leadDisplayStatus';

export type LeadSourceTag = {
  /** Short line shown under the lead status in the CRM list. */
  label: string;
  /** booking = customer booked, still not called (yellow row); otp = OTP verified, no booking. */
  tone: 'booking' | 'otp' | 'neutral';
  /** Channel family — drives the pill colour in the CRM list. */
  kind: LeadSourceKind;
};

export type LeadSourceKind =
  | 'app'
  | 'website'
  | 'misa'
  | 'whatsapp'
  | 'sarv'
  | 'meta'
  | 'google'
  | 'telecaller'
  | 'other';

function sourceKind(lead: any, channel: string): LeadSourceKind {
  const text = `${channel} ${lead?.lead_source || ''} ${lead?.created_from || ''}`.toLowerCase();
  if (/misa/.test(text)) return 'misa';
  if (/sarv|incoming call/.test(text)) return 'sarv';
  if (/meta|instagram|facebook/.test(text)) return 'meta';
  if (/google/.test(text)) return 'google';
  if (/whatsapp|waca/.test(text)) return 'whatsapp';
  if (/app booking|mobile/.test(text)) return 'app';
  if (/website|web\b|delhi_service/.test(text)) return 'website';
  if (/telecaller|manual|crm|upload|partner|reference|banner/.test(text)) return 'telecaller';
  return 'other';
}

function ms(value: unknown): number {
  const t = new Date(String(value || '')).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Customer booked from App / Website / MISA, lead is Fresh and nobody has called since.
 * Set by stampLeadFreshWithHistory (service-lead-reopen) on every booking.
 */
export function isPendingBookingLead(lead: any): boolean {
  const meta = lead?.coupon_meta && typeof lead.coupon_meta === 'object' ? lead.coupon_meta : {};
  const bookedAt = ms(meta.priority_booking_at);
  if (!bookedAt) return false;
  if (resolveAdminCrmStatusId(lead) !== 'FRESH') return false;
  // "Mark as called" on the lead detail banner counts as a call.
  const calledAt = Math.max(ms(lead?.last_call_at), ms(meta.last_call_at), ms(meta.priority_booking_acked_at));
  return !(calledAt > bookedAt);
}

/** Where the lead came from, so the telecaller knows without opening it. */
export function leadSourceTag(lead: any): LeadSourceTag | null {
  if (!lead || typeof lead !== 'object') return null;
  const meta = lead.coupon_meta && typeof lead.coupon_meta === 'object' ? lead.coupon_meta : {};

  let channel = '';
  try {
    channel = resolveBookingSource(lead).booking_source_label;
  } catch {
    channel = String(lead.lead_source || '').trim();
  }
  channel = channel || 'Other';
  const kind = sourceKind(lead, channel);

  if (isPendingBookingLead(lead)) {
    const base = /booking/i.test(channel) ? channel : `${channel} booking`;
    return { label: `${base} · call pending`, tone: 'booking', kind };
  }

  const result = String(meta.last_call_result || '').trim().toUpperCase();
  const otpOnly =
    result === 'OTP_VERIFIED' ||
    (Boolean(lead.is_incomplete) && Boolean(meta.otp_verified_at || meta.website_otp_verified));
  if (otpOnly) {
    return { label: `OTP verified · ${channel}`, tone: 'otp', kind };
  }

  return { label: channel, tone: 'neutral', kind };
}

/**
 * Same tag without the channel name — for telecallers whose template has
 * "Lead source dekhna" OFF. Booking / OTP state still shows.
 */
export function leadSourceTagWithoutChannel(lead: any): LeadSourceTag | null {
  const tag = leadSourceTag(lead);
  if (!tag) return null;
  if (tag.tone === 'booking') return { label: 'Booking · call pending', tone: 'booking', kind: 'other' };
  if (tag.tone === 'otp') return { label: 'OTP verified', tone: 'otp', kind: 'other' };
  return null;
}
