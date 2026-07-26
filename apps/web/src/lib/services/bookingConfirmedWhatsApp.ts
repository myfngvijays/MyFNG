import { resolveBookingServiceLabel } from '@/lib/booking-wallet-apply';
import { sendAutomationWhatsApp } from '@/lib/services/whatsappAutomation';

export type BookingConfirmedLead = {
  id?: string | null;
  lead_number?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  vehicle_number?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_variant?: string | null;
  service_type?: string | null;
  preferred_slot_start?: string | null;
  preferred_date?: string | null;
  preferred_time_slot?: string | null;
  pickup_required?: boolean | null;
  pickup_address?: string | null;
  customer_address?: string | null;
  city?: string | null;
  pincode?: string | null;
  workshop_name?: string | null;
  estimated_amount?: number | null;
  payment_mode?: string | null;
  address_type?: string | null;
  flat_number?: string | null;
  landmark?: string | null;
};

function formatPickupDatetime(lead: BookingConfirmedLead): string {
  if (lead.preferred_slot_start) {
    const date = new Date(lead.preferred_slot_start);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }
  }

  const parts = [lead.preferred_date, lead.preferred_time_slot]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  if (parts.length > 0) return parts.join(', ');

  return 'To be confirmed';
}

export function formatBookingCarLabel(lead: BookingConfirmedLead): string {
  const makeModel = [lead.vehicle_make, lead.vehicle_model, lead.vehicle_variant]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();

  if (makeModel) return makeModel;
  const reg = String(lead.vehicle_number || '').trim();
  return reg && reg !== 'NA' ? reg : 'Your vehicle';
}

export function resolveBookingConfirmedServiceLabel(
  lead: BookingConfirmedLead,
  body?: Record<string, unknown> | null
): string {
  const fromBody = body ? resolveBookingServiceLabel(body) : null;
  if (fromBody) return fromBody;

  const serviceType = String(lead.service_type || '').trim();
  if (serviceType && serviceType !== 'CAR_SERVICE') {
    return serviceType.replace(/_/g, ' ');
  }

  return 'Car Service';
}

function formatAmount(value: unknown): string {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

/** Clean address for WhatsApp — no duplicate flat / PIN / (home) clutter */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripNoiseFromAddress(raw: string): string {
  return String(raw || '')
    .replace(/^Landmark:\s*/i, '')
    .replace(/\s*\((home|work|other)\)/gi, '')
    .replace(/,?\s*PIN\s*(\d{6})/gi, ', $1')
    .replace(/,?\s*Landmark:\s*/gi, ', Near ')
    .replace(/,\s*,+/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Remove a known prefix segment (e.g. flat already inside composed address). */
function stripLeadingSegment(text: string, segment: string): string {
  const seg = String(segment || '').trim();
  if (!seg || !text) return text;
  const re = new RegExp(`^${escapeRegExp(seg)}\\s*,?\\s*`, 'i');
  return text.replace(re, '').trim();
}

function stripNearLandmark(text: string, landmark: string): string {
  const lm = String(landmark || '')
    .trim()
    .replace(/^Near\s+/i, '')
    .replace(/^Landmark:\s*/i, '');
  if (!lm || !text) return text;
  return text
    .replace(new RegExp(`,?\\s*Near\\s+${escapeRegExp(lm)}\\b`, 'i'), '')
    .replace(new RegExp(`,?\\s*Landmark:\\s*${escapeRegExp(lm)}\\b`, 'i'), '')
    .replace(/,\s*,+/g, ',')
    .trim();
}

function dedupeAddressParts(parts: string[]): string[] {
  const out: string[] = [];
  for (const part of parts) {
    const t = String(part || '').trim();
    if (!t) continue;
    const lower = t.toLowerCase();
    if (out.some((o) => o.toLowerCase() === lower)) continue;
    // Skip if this piece is already fully contained in a previous longer part
    if (out.some((o) => o.toLowerCase().includes(lower))) continue;
    // If a previous shorter part is contained in this one, replace it
    const idx = out.findIndex((o) => lower.includes(o.toLowerCase()) && o.length < t.length);
    if (idx >= 0) {
      out[idx] = t;
      continue;
    }
    out.push(t);
  }
  return out;
}

function formatAddressLine(lead: BookingConfirmedLead, body?: Record<string, unknown> | null): string {
  const meta = (body?.coupon_meta || body || {}) as Record<string, unknown>;
  const flat = String(lead.flat_number || meta.flat_number || '').trim();
  const landmarkRaw = String(lead.landmark || meta.landmark || '')
    .trim()
    .replace(/^Near\s+/i, '')
    .replace(/^Landmark:\s*/i, '');
  const raw = stripNoiseFromAddress(String(lead.pickup_address || lead.customer_address || ''));

  // pickup_address is often already composed as "flat, area, Near landmark, city pin".
  // Never prepend flat/landmark again if they're already inside raw.
  let area = raw;
  if (flat) area = stripLeadingSegment(area, flat);
  if (landmarkRaw) area = stripNearLandmark(area, landmarkRaw);
  // Also drop trailing city/pin from area — we append once below
  const city = String(lead.city || '').trim();
  const pin = String(lead.pincode || '').trim();
  if (city) {
    area = area
      .replace(new RegExp(`,?\\s*${escapeRegExp(city)}(?:\\s+${pin || '\\d{6}'})?\\s*$`, 'i'), '')
      .trim();
  } else if (pin) {
    area = area.replace(new RegExp(`,?\\s*${escapeRegExp(pin)}\\s*$`), '').trim();
  }

  const cityPin = [city, pin].filter(Boolean).join(' ');
  const landmarkPart = landmarkRaw ? `Near ${landmarkRaw}` : '';

  if (flat || landmarkRaw || area) {
    const base = dedupeAddressParts([flat, area, landmarkPart, cityPin]).join(', ');
    return base || cityPin || 'Address to be confirmed';
  }

  let cleaned = raw;
  if (city && !cleaned.toLowerCase().includes(city.toLowerCase())) {
    cleaned = cleaned ? `${cleaned}, ${city}` : city;
  }
  if (pin && !cleaned.includes(pin)) {
    cleaned = cleaned ? `${cleaned} ${pin}` : pin;
  }

  return cleaned || cityPin || 'Address to be confirmed';
}

/**
 * Meta template vars (fixed 5):
 * 1 customer_name
 * 2 booking_id
 * 3 car (+ reg)
 * 4 service (+ amount)
 * 5 schedule + mode + address (clean, short lines via " | ")
 */
export function buildBookingConfirmedTemplateParams(
  lead: BookingConfirmedLead,
  options?: {
    serviceLabel?: string | null;
    amount?: number | null;
    body?: Record<string, unknown> | null;
  }
) {
  const customerName = String(lead.customer_name || 'Customer').trim() || 'Customer';
  const bookingId = String(lead.lead_number || lead.id || 'N/A').trim();

  const carBase = formatBookingCarLabel(lead);
  const reg = String(lead.vehicle_number || '').trim();
  const car =
    reg && reg !== 'NA' && !carBase.toUpperCase().includes(reg.toUpperCase())
      ? `${carBase} (${reg})`
      : carBase;

  const serviceName =
    options?.serviceLabel || resolveBookingConfirmedServiceLabel(lead, options?.body);
  const amount =
    formatAmount(options?.amount) ||
    formatAmount(lead.estimated_amount) ||
    formatAmount((options?.body as any)?.quote?.total) ||
    formatAmount((options?.body as any)?.amount_payable);
  const service = amount ? `${serviceName} | ${amount}` : serviceName;

  const when = formatPickupDatetime(lead);
  const isVisit = lead.pickup_required === false;
  const mode = isVisit ? 'Workshop visit' : 'Doorstep pickup';

  let place = '';
  if (isVisit) {
    const workshop = String(lead.workshop_name || '').trim();
    const cityPin = [lead.city, lead.pincode].map((v) => String(v || '').trim()).filter(Boolean).join(' ');
    place = [workshop, cityPin].filter(Boolean).join(', ') || cityPin || 'Workshop to be assigned';
  } else {
    place = formatAddressLine(lead, options?.body);
  }

  // Compact structured line for {{5}} under "Pickup:" label in template
  const pickup = `${when} | ${mode} | ${place}`;

  return [customerName, bookingId, car, service, pickup];
}

export async function notifyBookingConfirmedWhatsApp(input: {
  lead: BookingConfirmedLead;
  customerId?: string | null;
  body?: Record<string, unknown> | null;
  amount?: number | null;
  serviceLabel?: string | null;
}) {
  const phone = String(input.lead.customer_phone || '').trim();
  if (!phone) {
    return {
      sent: false,
      skipped: true,
      skipReason: 'missing_phone',
      deliveryStatus: 'SKIPPED' as const,
      triggerKey: 'booking_confirmed' as const,
    };
  }

  const serviceLabel =
    input.serviceLabel || resolveBookingConfirmedServiceLabel(input.lead, input.body);
  const templateParams = buildBookingConfirmedTemplateParams(input.lead, {
    serviceLabel,
    amount: input.amount,
    body: input.body,
  });

  return sendAutomationWhatsApp({
    triggerKey: 'booking_confirmed',
    phone,
    customerId: input.customerId || null,
    templateParams,
    payload: {
      lead_id: input.lead.id || null,
      lead_number: input.lead.lead_number || null,
      service_label: serviceLabel,
      templateParams,
    },
  });
}
