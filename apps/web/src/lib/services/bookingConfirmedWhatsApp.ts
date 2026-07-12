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
      });
    }
  }

  const parts = [lead.preferred_date, lead.preferred_time_slot].map((value) => String(value || '').trim()).filter(Boolean);
  if (parts.length > 0) return parts.join(' · ');

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

export function buildBookingConfirmedTemplateParams(
  lead: BookingConfirmedLead,
  options?: { serviceLabel?: string | null }
) {
  const customerName = String(lead.customer_name || 'Customer').trim() || 'Customer';
  const bookingId = String(lead.lead_number || lead.id || 'N/A').trim();
  const car = formatBookingCarLabel(lead);
  const service = options?.serviceLabel || resolveBookingConfirmedServiceLabel(lead);
  const pickup = formatPickupDatetime(lead);

  return [customerName, bookingId, car, service, pickup];
}

export async function notifyBookingConfirmedWhatsApp(input: {
  lead: BookingConfirmedLead;
  customerId?: string | null;
  body?: Record<string, unknown> | null;
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

  const serviceLabel = resolveBookingConfirmedServiceLabel(input.lead, input.body);
  const templateParams = buildBookingConfirmedTemplateParams(input.lead, { serviceLabel });

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
