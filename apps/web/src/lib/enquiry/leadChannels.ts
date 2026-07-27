/**
 * Lead channels for telecaller distribution (on/off per telecaller).
 * Empty / missing allowlist = all channels (backward compatible).
 */
export const LEAD_DISTRIBUTION_CHANNELS = [
  { id: 'WHATSAPP', label: 'WhatsApp', hint: 'Inbound WhatsApp messages' },
  { id: 'WHATSAPP_META', label: 'Meta Ads (WA)', hint: 'Instagram / Facebook → WhatsApp' },
  { id: 'WEBSITE_OTP', label: 'Website OTP', hint: 'OTP verified, booking not completed' },
  { id: 'WEBSITE_BOOKING', label: 'Website Booking', hint: 'Full website service booking' },
  { id: 'APP_OTP', label: 'App OTP', hint: 'App OTP verified, booking not completed' },
  { id: 'APP_BOOKING', label: 'App Booking', hint: 'Full app service booking' },
  { id: 'MISA', label: 'MISA AI', hint: 'AI chatbot bookings' },
  { id: 'MANUAL', label: 'Manual / Calls', hint: 'Enquiry API & manual lead create' },
  { id: 'ENQUIRY_API', label: 'Lead Source API', hint: 'External / ads enquiry API' },
] as const;

export type LeadDistributionChannelId = (typeof LEAD_DISTRIBUTION_CHANNELS)[number]['id'];

export const ALL_LEAD_CHANNEL_IDS: LeadDistributionChannelId[] = LEAD_DISTRIBUTION_CHANNELS.map(
  (c) => c.id,
);

/** null = all channels; [] = none; [...] = only those */
export function normalizeAllowedChannels(raw: unknown): LeadDistributionChannelId[] | null {
  if (raw == null) return null; // missing / null = all allowed
  if (!Array.isArray(raw)) return null;
  if (raw.length === 0) return []; // explicitly none
  const set = new Set(ALL_LEAD_CHANNEL_IDS);
  const out = raw
    .map((x) => String(x || '').trim().toUpperCase())
    .filter((x): x is LeadDistributionChannelId => set.has(x as LeadDistributionChannelId));
  return out;
}

export function telecallerAllowsChannel(
  allowedChannels: LeadDistributionChannelId[] | null | undefined,
  channel: string | null | undefined,
): boolean {
  if (!channel) return true;
  if (allowedChannels == null) return true; // all
  if (allowedChannels.length === 0) return false; // none
  return allowedChannels.includes(String(channel).toUpperCase() as LeadDistributionChannelId);
}

/** Map WhatsApp inbound labels → distribution channel */
export function channelFromWhatsAppLabels(createdFrom?: string | null, leadSource?: string | null): LeadDistributionChannelId {
  const hay = `${createdFrom || ''} ${leadSource || ''}`.toLowerCase();
  if (/meta|instagram|facebook|ads/.test(hay)) return 'WHATSAPP_META';
  return 'WHATSAPP';
}

/** Map enquiry lead_source → distribution channel */
export function channelFromEnquiryLeadSource(leadSource?: string | null): LeadDistributionChannelId {
  const s = String(leadSource || '').toLowerCase();
  if (/whatsapp/.test(s) && /meta|instagram|facebook/.test(s)) return 'WHATSAPP_META';
  if (/whatsapp/.test(s)) return 'WHATSAPP';
  if (/misa|ai chatbot|chatbot/.test(s)) return 'MISA';
  if (/app/.test(s)) return 'APP_BOOKING';
  if (/website|web|delhi_service|google/.test(s)) return 'WEBSITE_BOOKING';
  return 'ENQUIRY_API';
}
