import { sendAutomationWhatsApp } from '@/lib/services/whatsappAutomation';

export async function notifyWorkshopProximityWhatsApp(input: {
  customerId: string;
  phone: string;
  customerName?: string | null;
  workshopName: string;
  workshopId: string;
}) {
  const phone = String(input.phone || '').trim();
  if (!phone) {
    return {
      sent: false,
      skipped: true,
      skipReason: 'missing_phone',
      deliveryStatus: 'SKIPPED' as const,
      triggerKey: 'workshop_proximity' as const,
    };
  }

  const customerName = String(input.customerName || 'Customer').trim() || 'Customer';
  // Meta body (workshop_proximity_nearby): {{1}} name, {{2}} workshop
  const templateParams = [
    customerName,
    String(input.workshopName || 'MyFNG Workshop').trim(),
  ];

  return sendAutomationWhatsApp({
    triggerKey: 'workshop_proximity',
    phone,
    customerId: input.customerId,
    templateParams,
    payload: {
      workshop_id: input.workshopId,
      templateParams,
    },
  });
}
