import {
  buildBookingConfirmedTemplateParams,
  formatPickupDatetime,
  resolveMyfngWorkshopName,
  type BookingConfirmedLead,
} from '@/lib/services/bookingConfirmedWhatsApp';
import { sendAutomationWhatsApp } from '@/lib/services/whatsappAutomation';
import { sendTextMessage } from '@/lib/services/whatsappService';

const PICKUP_TEMPLATE = 'pickup_booking_updated';
const VISIT_TEMPLATE = 'visit_booking_updated';

const PICKUP_BODY =
  'Hi {{1}},\n\nYour MyFNG service booking has been updated.\n\nBooking ID: {{2}}\nCar: {{3}}\nUpdated service: {{4}}\nPickup: {{5}}\nWorkshop: {{6}}\n\nIf you have any questions, reply to this message.';

const VISIT_BODY =
  'Hi {{1}},\n\nYour MyFNG service booking has been updated.\n\nBooking ID: {{2}}\nCar: {{3}}\nUpdated service: {{4}}\nVisit: {{5}}\nWorkshop: {{6}}\n\nIf you have any questions, reply to this message.';

function buildUpdateText(input: { isPickup: boolean; templateParams: string[] }) {
  const [name, bookingId, car, service, when, workshop] = input.templateParams;
  const whenLabel = input.isPickup ? 'Pickup' : 'Visit';
  return [
    `Hi ${name || 'Customer'},`,
    '',
    'Your MyFNG service booking has been updated.',
    '',
    `Booking ID: ${bookingId || ''}`,
    `Car: ${car || ''}`,
    `Updated service: ${service || ''}`,
    `${whenLabel}: ${when || ''}`,
    `Workshop: ${workshop || 'MyFNG'}`,
    '',
    'If you have any questions, reply to this message.',
  ].join('\n');
}

/**
 * Notify customer when telecaller updates an already-confirmed booking.
 * Never uses booking_confirmed — that template is only for first confirmation.
 * Order: booking_updated template → plain text (24h session).
 */
export async function notifyBookingUpdatedWhatsApp(input: {
  lead: BookingConfirmedLead;
  customerId?: string | null;
  body?: Record<string, unknown> | null;
  amount?: number | null;
  serviceLabel?: string | null;
  previousServiceLabel?: string | null;
}) {
  const phone = String(input.lead.customer_phone || '').trim();
  if (!phone) {
    return {
      sent: false,
      skipped: true,
      skipReason: 'missing_phone',
      deliveryStatus: 'SKIPPED' as const,
      triggerKey: 'booking_updated' as const,
    };
  }

  const isPickup = input.lead.pickup_required === true;
  const templateName = isPickup ? PICKUP_TEMPLATE : VISIT_TEMPLATE;
  const templateBody = isPickup ? PICKUP_BODY : VISIT_BODY;
  const base = buildBookingConfirmedTemplateParams(input.lead, {
    serviceLabel: input.serviceLabel,
    amount: input.amount,
    body: input.body,
  });
  const when = formatPickupDatetime(input.lead);
  const workshop = await resolveMyfngWorkshopName(input.lead);
  const templateParams = [base[0], base[1], base[2], base[3], when, workshop];

  const payload = {
    lead_id: input.lead.id || null,
    lead_number: input.lead.lead_number || null,
    service_label: input.serviceLabel || null,
    previous_service_label: input.previousServiceLabel || null,
    pickup_or_visit: isPickup ? 'pickup' : 'visit',
    templateParams,
    reason: 'lead_services_updated',
  };

  const updated = await sendAutomationWhatsApp({
    triggerKey: 'booking_updated',
    templateName,
    templateBody,
    phone,
    customerId: input.customerId || null,
    templateParams,
    payload,
    skipCooldownCheck: true,
  });
  if (updated.sent) return updated;

  const textResult = await sendTextMessage(
    phone,
    buildUpdateText({
      isPickup,
      templateParams,
    }),
  );

  if (textResult.success) {
    return {
      sent: true,
      skipped: false,
      triggerKey: 'booking_updated' as const,
      deliveryStatus: 'SENT' as const,
      phone,
      channel: 'text_fallback',
    };
  }

  return {
    sent: false,
    skipped: true,
    skipReason: updated.skipReason || textResult.error || 'send_failed',
    triggerKey: 'booking_updated' as const,
    deliveryStatus: 'FAILED' as const,
    details: {
      booking_updated: updated.skipReason || updated.deliveryStatus,
      text: textResult.error || null,
    },
  };
}
