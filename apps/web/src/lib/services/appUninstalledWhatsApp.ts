import { sendAutomationWhatsApp } from '@/lib/services/whatsappAutomation';

export function buildAppUninstalledTemplateParams(input: { customerName?: string | null }) {
  const customerName = String(input.customerName || 'Customer').trim() || 'Customer';
  return [customerName];
}

export async function notifyAppUninstalledWhatsApp(input: {
  customerId?: string | null;
  phone: string;
  customerName?: string | null;
}) {
  const phone = String(input.phone || '').trim();
  if (!phone || phone.startsWith('del_')) {
    return {
      sent: false,
      skipped: true,
      skipReason: 'missing_phone',
      deliveryStatus: 'SKIPPED' as const,
      triggerKey: 'app_uninstalled' as const,
    };
  }

  const templateParams = buildAppUninstalledTemplateParams(input);

  return sendAutomationWhatsApp({
    triggerKey: 'app_uninstalled',
    phone,
    customerId: input.customerId || null,
    templateParams,
    payload: {
      customer_id: input.customerId || null,
      source: 'fcm_token_invalid',
      templateParams,
    },
  });
}
