import {
  buildBookingConfirmedTemplateParams,
  type BookingConfirmedLead,
} from '@/lib/services/bookingConfirmedWhatsApp';
import { sendAutomationWhatsApp } from '@/lib/services/whatsappAutomation';
import { sendTextMessage } from '@/lib/services/whatsappService';

function buildUpdateText(input: {
  lead: BookingConfirmedLead;
  serviceLabel?: string | null;
  previousServiceLabel?: string | null;
  templateParams: string[];
}) {
  const name = String(input.lead.customer_name || 'Customer').trim() || 'Customer';
  const bookingId = String(input.lead.lead_number || input.lead.id || '').trim();
  const service = String(input.serviceLabel || input.templateParams[3] || 'your service').trim();
  const prev = String(input.previousServiceLabel || '').trim();
  return [
    `Hi ${name},`,
    '',
    bookingId
      ? `Your MyFNG booking ${bookingId} has been updated.`
      : 'Your MyFNG booking has been updated.',
    prev && prev !== service ? `Previous: ${prev}` : null,
    `Updated service: ${service}`,
    input.templateParams[4] ? `Schedule: ${input.templateParams[4]}` : null,
    '',
    'Reply if you have any questions. — Team MyFNG',
  ]
    .filter((line) => line != null)
    .join('\n');
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

  const templateParams = buildBookingConfirmedTemplateParams(input.lead, {
    serviceLabel: input.serviceLabel,
    amount: input.amount,
    body: input.body,
  });

  const payload = {
    lead_id: input.lead.id || null,
    lead_number: input.lead.lead_number || null,
    service_label: input.serviceLabel || null,
    previous_service_label: input.previousServiceLabel || null,
    templateParams,
    reason: 'lead_services_updated',
  };

  // 1) Dedicated booking_updated template (if configured + approved)
  const updated = await sendAutomationWhatsApp({
    triggerKey: 'booking_updated',
    phone,
    customerId: input.customerId || null,
    templateParams,
    payload,
    skipCooldownCheck: true,
  });
  if (updated.sent) return updated;

  // 2) Plain text — works inside 24h WhatsApp session window
  const textResult = await sendTextMessage(
    phone,
    buildUpdateText({
      lead: input.lead,
      serviceLabel: input.serviceLabel,
      previousServiceLabel: input.previousServiceLabel,
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
