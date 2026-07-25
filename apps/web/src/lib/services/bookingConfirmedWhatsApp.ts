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

/** Clean address for WhatsApp — no duplicate PIN / (home) clutter */
function formatAddressLine(lead: BookingConfirmedLead, body?: Record<string, unknown> | null): string {
  const meta = (body?.coupon_meta || body || {}) as Record<string, unknown>;
  const flat = String(lead.flat_number || meta.flat_number || '').trim();
  const landmark = String(lead.landmark || meta.landmark || '').trim();
  const raw = String(lead.pickup_address || lead.customer_address || '').trim();

  // Prefer structured parts when available
  if (flat || landmark) {
    const area = raw
      .replace(/^Landmark:\s*/i, '')
      .replace(/\s*\(home\)|\s*\(work\)|\s*\(other\)/gi, '')
      .replace(/,?\s*PIN\s*\d{6}/gi, '')
      .replace(/,?\s*Landmark:\s*[^,]*/gi, '')
      .trim();
    // If raw already looks composed, strip noise instead
    const base = [flat, area || raw, landmark ? `Near ${landmark.replace(/^Landmark:\s*/i, '')}` : '']
      .filter(Boolean)
      .join(', ');
    const cityPin = [lead.city, lead.pincode].map((v) => String(v || '').trim()).filter(Boolean).join(' ');
    if (cityPin && !base.toLowerCase().includes(String(lead.pincode || '').toLowerCase())) {
      return `${base}, ${cityPin}`;
    }
    return base || cityPin;
  }

  // Clean stored composed address
  let cleaned = raw
    .replace(/\s*\((home|work|other)\)/gi, '')
    .replace(/,?\s*Landmark:\s*/gi, ', Near ')
    .replace(/,?\s*PIN\s*(\d{6})/gi, ', $1')
    .replace(/,\s*,+/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const city = String(lead.city || '').trim();
  const pin = String(lead.pincode || '').trim();
  if (city && !cleaned.toLowerCase().includes(city.toLowerCase())) {
    cleaned = cleaned ? `${cleaned}, ${city}` : city;
  }
  if (pin && !cleaned.includes(pin)) {
    cleaned = cleaned ? `${cleaned} ${pin}` : pin;
  }

  return cleaned || [city, pin].filter(Boolean).join(' ') || 'Address to be confirmed';
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
