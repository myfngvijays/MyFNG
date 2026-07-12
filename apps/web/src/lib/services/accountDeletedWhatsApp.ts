import { sendAutomationWhatsApp } from '@/lib/services/whatsappAutomation';

export function buildAccountDeletedTemplateParams(input: { customerName?: string | null }) {
  const customerName = String(input.customerName || 'Customer').trim() || 'Customer';
  return [customerName];
}

export async function notifyAccountDeletedWhatsApp(input: {
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
      triggerKey: 'account_deleted' as const,
    };
  }

  const templateParams = buildAccountDeletedTemplateParams(input);

  return sendAutomationWhatsApp({
    triggerKey: 'account_deleted',
    phone,
    customerId: input.customerId || null,
    templateParams,
    payload: {
      customer_id: input.customerId || null,
      templateParams,
    },
  });
}
