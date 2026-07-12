import { sendAutomationWhatsApp } from '@/lib/services/whatsappAutomation';
import { getAutomationTemplateExamples } from '@/lib/services/whatsappAutomationMeta';

function formatInrAmount(amount: number | string): string {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return String(amount || '0');
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, '');
}

export async function notifyMembershipPaymentSuccessWhatsApp(input: {
  customerId?: string | null;
  phone: string;
  customerName?: string | null;
  amount: number | string;
  planName: string;
  transactionId: string;
}) {
  const phone = String(input.phone || '').trim();
  if (!phone) {
    return {
      sent: false,
      skipped: true,
      skipReason: 'missing_phone',
      deliveryStatus: 'SKIPPED' as const,
      triggerKey: 'membership_payment_success' as const,
    };
  }

  const examples = await getAutomationTemplateExamples('membership_payment_success');
  const templateParams = [
    String(input.customerName || examples[0] || 'Customer').trim(),
    formatInrAmount(input.amount),
    String(input.planName || examples[2] || 'MyFNG Prime').trim(),
    String(input.transactionId || examples[3] || 'N/A').trim(),
  ];

  return sendAutomationWhatsApp({
    triggerKey: 'membership_payment_success',
    phone,
    customerId: input.customerId || null,
    templateParams,
    payload: {
      plan_name: input.planName,
      amount: templateParams[1],
      transaction_id: input.transactionId,
      templateParams,
    },
  });
}

export async function notifyMembershipPaymentFailedWhatsApp(input: {
  customerId?: string | null;
  phone: string;
  customerName?: string | null;
  amount: number | string;
  planName: string;
  reason?: string | null;
}) {
  const phone = String(input.phone || '').trim();
  if (!phone) {
    return {
      sent: false,
      skipped: true,
      skipReason: 'missing_phone',
      deliveryStatus: 'SKIPPED' as const,
      triggerKey: 'membership_payment_failed' as const,
    };
  }

  const examples = await getAutomationTemplateExamples('membership_payment_failed');
  const templateParams = [
    String(input.customerName || examples[0] || 'Customer').trim(),
    formatInrAmount(input.amount),
    String(input.planName || examples[2] || 'MyFNG Prime').trim(),
  ];

  return sendAutomationWhatsApp({
    triggerKey: 'membership_payment_failed',
    phone,
    customerId: input.customerId || null,
    templateParams,
    payload: {
      plan_name: input.planName,
      amount: templateParams[1],
      reason: input.reason || null,
      templateParams,
    },
  });
}
