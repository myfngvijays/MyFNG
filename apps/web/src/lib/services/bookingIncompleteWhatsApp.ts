import { sendAutomationWhatsApp } from '@/lib/services/whatsappAutomation';

export type BookingDraftRow = {
  id: string;
  customer_id: string;
  customer_phone?: string | null;
  customer_name?: string | null;
  car_label?: string | null;
  service_label?: string | null;
  draft_payload?: Record<string, unknown> | null;
};

export function buildBookingIncompleteTemplateParams(draft: BookingDraftRow): string[] {
  const payload = (draft.draft_payload || {}) as Record<string, unknown>;
  const customerName =
    String(draft.customer_name || payload.customerName || 'Customer').trim() || 'Customer';
  const car =
    String(draft.car_label || payload.carLabel || 'Your vehicle').trim() || 'Your vehicle';
  const service =
    String(draft.service_label || payload.serviceLabel || 'Car Service').trim() || 'Car Service';
  return [customerName, car, service];
}

export async function notifyBookingIncompleteWhatsApp(draft: BookingDraftRow) {
  const phone = String(draft.customer_phone || '').trim();
  if (!phone) {
    return {
      sent: false,
      skipped: true,
      skipReason: 'missing_phone',
      deliveryStatus: 'SKIPPED' as const,
      triggerKey: 'booking_incomplete' as const,
    };
  }

  const templateParams = buildBookingIncompleteTemplateParams(draft);
  return sendAutomationWhatsApp({
    triggerKey: 'booking_incomplete',
    phone,
    customerId: draft.customer_id,
    templateParams,
    payload: {
      booking_draft_id: draft.id,
      templateParams,
    },
  });
}

export function deriveBookingDraftLabels(payload: Record<string, unknown>) {
  const carModel = payload.carModel as
    | { make?: string; model_name?: string; variant?: string }
    | null
    | undefined;
  const makeModel = [carModel?.make, carModel?.model_name, carModel?.variant]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
  const vehicleNumber = String(payload.vehicleNumber || '').trim();
  const carLabel = makeModel || (vehicleNumber && vehicleNumber !== 'NA' ? vehicleNumber : 'Your vehicle');

  const serviceNames = payload.serviceNames as Record<string, string> | undefined;
  const selectedServices = Array.isArray(payload.selectedServices)
    ? payload.selectedServices.map((value) => String(value))
    : [];
  const firstServiceId = selectedServices[0];
  const serviceLabel =
    (firstServiceId && serviceNames?.[firstServiceId]) ||
    String(payload.selectedCategory || payload.serviceLabel || 'Car Service')
      .replace(/_/g, ' ')
      .trim() ||
    'Car Service';

  return { carLabel, serviceLabel };
}
