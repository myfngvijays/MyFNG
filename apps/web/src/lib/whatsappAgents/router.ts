import { processWhatsAppBrainMessage, type BrainProcessResult } from '@/lib/whatsappBotFlow/brain';
import type { BrainProcessInput } from '@/lib/whatsappBotFlow/brain';
import { processBookingAgentMessage, type BookingAgentResult } from './booking/handler';
import { processChaseAgentEvent, shouldRouteToChaseAgent, type ChaseAgentResult } from './chase/handler';
import { isPhoneLeadLost } from './lostLeadGuard';

export type InboundWhatsAppResult = BrainProcessResult | BookingAgentResult | ChaseAgentResult;

export async function processInboundWhatsAppMessage(
  input: BrainProcessInput,
): Promise<InboundWhatsAppResult> {
  // Telecaller marked Lost → do not continue bot booking / flow / chase
  if (await isPhoneLeadLost(input.phone)) {
    return {
      handled: false,
      skippedReason: 'lead_marked_lost',
      latencyMs: 0,
    } as InboundWhatsAppResult;
  }

  const bookingResult = await processBookingAgentMessage({
    phone: input.phone,
    message: input.message,
    profileName: input.profileName,
    dryRun: input.dryRun,
    inboundReceivedAt: input.inboundReceivedAt,
  });

  if (bookingResult.handled) {
    return bookingResult;
  }

  const routeChase = await shouldRouteToChaseAgent(input.phone, input.message);
  if (routeChase) {
    const chaseResult = await processChaseAgentEvent({
      phone: input.phone,
      eventType: 'CUSTOMER_REPLY',
      customerMessage: input.message,
      profileName: input.profileName,
      dryRun: input.dryRun,
    });
    if (chaseResult.handled) {
      return chaseResult;
    }
  }

  return processWhatsAppBrainMessage(input);
}
