import { buildCartAbandonmentPersonalLine } from '@/lib/services/cartAbandonmentPersonalization';
import { sendAutomationWhatsApp } from '@/lib/services/whatsappAutomation';
import type { WhatsAppAutomationTriggerKey } from '@/lib/services/whatsappAutomation';

export type CartAbandonmentTarget = {
  source: 'cart' | 'booking_draft';
  sourceId: string;
  customerId: string;
  phone: string;
  customerName?: string | null;
  carLabel: string;
  serviceLabel: string;
};

const TRIGGER_BY_STAGE = {
  '5m': 'cart_abandoned_5m',
  '3h': 'cart_abandoned_3h',
  '12h': 'cart_abandoned_12h',
} as const satisfies Record<'5m' | '3h' | '12h', WhatsAppAutomationTriggerKey>;

export async function notifyCartAbandonedWhatsApp(
  supabaseAdmin: any,
  target: CartAbandonmentTarget,
  stage: '5m' | '3h' | '12h',
) {
  const phone = String(target.phone || '').trim();
  if (!phone) {
    return {
      sent: false,
      skipped: true,
      skipReason: 'missing_phone',
      deliveryStatus: 'SKIPPED' as const,
      triggerKey: TRIGGER_BY_STAGE[stage],
    };
  }

  const customerName = String(target.customerName || 'Customer').trim() || 'Customer';
  const car = String(target.carLabel || 'Your vehicle').trim() || 'Your vehicle';
  const service = String(target.serviceLabel || 'Car Service').trim() || 'Car Service';
  const triggerKey = TRIGGER_BY_STAGE[stage];

  let templateParams: string[];
  if (stage === '5m') {
    templateParams = [customerName, car, service];
  } else {
    const personalLine = await buildCartAbandonmentPersonalLine(
      supabaseAdmin,
      target.customerId,
      stage,
    );
    templateParams = [customerName, car, service, personalLine];
  }

  return sendAutomationWhatsApp({
    triggerKey,
    phone,
    customerId: target.customerId,
    templateParams,
    payload: {
      source: target.source,
      source_id: target.sourceId,
      stage,
      templateParams,
    },
  });
}

export function deriveCartLabelsFromItems(items: Array<{ service_type?: string | null; metadata?: unknown }>) {
  const first = items[0];
  const metadata =
    first?.metadata && typeof first.metadata === 'object'
      ? (first.metadata as Record<string, unknown>)
      : {};
  const carLabel =
    String(metadata.car_label || metadata.vehicle_label || metadata.vehicleNumber || 'Your vehicle').trim() ||
    'Your vehicle';
  const serviceLabel =
    String(metadata.service_label || first?.service_type || 'Car Service')
      .replace(/_/g, ' ')
      .trim() || 'Car Service';
  return { carLabel, serviceLabel };
}
