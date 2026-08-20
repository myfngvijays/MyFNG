export const MISA_LEAD_SOURCE = {
  WHATSAPP: 'WhatsApp MISA AI',
  WEBSITE: 'MISA AI (Website)',
  APP: 'MISA AI (App)',
} as const;

export type MisaBookingChannel = keyof typeof MISA_LEAD_SOURCE;

/** Parent CRM tag — always applied with a channel child when MISA OTP verifies. */
export const MISA_OTP_PARENT_TAG = 'MISA OTP Verified';

/** Channel-specific MISA OTP tags (WhatsApp 6161 / Website / App). */
export const MISA_OTP_CHANNEL_TAG: Record<MisaBookingChannel, string> = {
  WHATSAPP: 'MISA OTP · WhatsApp',
  WEBSITE: 'MISA OTP · Website',
  APP: 'MISA OTP · App',
};

export function getMisaOtpVerifiedLabel(channel: MisaBookingChannel): string {
  return MISA_OTP_CHANNEL_TAG[channel];
}

export function resolveMisaOtpTagNames(channel: MisaBookingChannel): {
  parent: string;
  specific: string;
  names: string[];
} {
  const parent = MISA_OTP_PARENT_TAG;
  const specific = MISA_OTP_CHANNEL_TAG[channel];
  return { parent, specific, names: [parent, specific] };
}

/**
 * Infer WhatsApp / Website / App for an existing OTP lead (meta + lead_source + created_from).
 * Used by Source badges and backfill — does not invent MISA when lead is not MISA OTP.
 */
export function inferMisaOtpChannel(input: {
  misaChannel?: string | null;
  lastCallLabel?: string | null;
  leadSource?: string | null;
  createdFrom?: string | null;
  description?: string | null;
}): MisaBookingChannel | null {
  const explicit = String(input.misaChannel || '')
    .toUpperCase()
    .trim();
  if (explicit === 'WHATSAPP' || explicit === 'WEBSITE' || explicit === 'APP') {
    return explicit;
  }

  const label = String(input.lastCallLabel || '').toLowerCase();
  const source = String(input.leadSource || '').toLowerCase();
  const created = String(input.createdFrom || '').toUpperCase();
  const desc = String(input.description || '').toLowerCase();
  const blob = `${label} ${source} ${desc}`;

  const looksMisa =
    /misa/.test(blob) ||
    label.includes('misa otp') ||
    source.includes('misa') ||
    Boolean(input.misaChannel);

  if (!looksMisa) return null;

  if (
    /whatsapp/.test(blob) ||
    created === 'WHATSAPP' ||
    label.includes('misa otp · whatsapp')
  ) {
    return 'WHATSAPP';
  }
  if (
    /\(app\)/.test(source) ||
    /misa ai \(app\)/.test(source) ||
    label.includes('misa otp · app') ||
    created === 'APP' ||
    created === 'MOBILE_APP' ||
    created === 'MOBILE'
  ) {
    return 'APP';
  }
  if (label.includes('misa otp · website') || /\(website\)/.test(source)) {
    return 'WEBSITE';
  }
  // Legacy single label "MISA OTP Verified" with no channel → Website default
  return 'WEBSITE';
}

export function resolveMisaBookingChannel(input: {
  channel?: MisaBookingChannel;
  sessionId?: string;
}): MisaBookingChannel {
  if (input.channel) return input.channel;
  const sid = String(input.sessionId || '');
  if (sid.startsWith('wa_')) return 'WHATSAPP';
  return 'WEBSITE';
}

export function getMisaLeadSource(channel: MisaBookingChannel): string {
  return MISA_LEAD_SOURCE[channel];
}

export function getMisaCreatedFrom(channel: MisaBookingChannel): string {
  if (channel === 'WHATSAPP') return 'WHATSAPP';
  if (channel === 'APP') return 'APP';
  return 'WEB';
}

export function getMisaTelecrmTag(channel: MisaBookingChannel): string {
  return getMisaLeadSource(channel);
}

/** Map legacy chatbot bookings to a readable MISA label in admin UI. */
export function normalizeMisaLeadSourceLabel(raw: string): string {
  const value = String(raw || '').trim();
  if (!value || value === 'AI Chatbot') return MISA_LEAD_SOURCE.WEBSITE;
  return value;
}
