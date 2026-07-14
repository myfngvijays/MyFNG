export const MISA_LEAD_SOURCE = {
  WHATSAPP: 'WhatsApp MISA AI',
  WEBSITE: 'MISA AI (Website)',
  APP: 'MISA AI (App)',
} as const;

export type MisaBookingChannel = keyof typeof MISA_LEAD_SOURCE;

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
