import { processWhatsAppBrainMessage, type BrainProcessResult } from '@/lib/whatsappBotFlow/brain';
import type { BrainProcessInput } from '@/lib/whatsappBotFlow/brain';
import { processBookingAgentMessage, type BookingAgentResult } from './booking/handler';
import { processChaseAgentEvent, shouldRouteToChaseAgent, type ChaseAgentResult } from './chase/handler';
import { isPhoneLeadLost } from './lostLeadGuard';
import { endStaleAgentInstances } from './shared/instanceService';

export type InboundWhatsAppResult = BrainProcessResult | BookingAgentResult | ChaseAgentResult;

function summarizeInboundResult(result: InboundWhatsAppResult): string {
  if ('skippedReason' in result && result.skippedReason && !result.handled) {
    return `skipped:${result.skippedReason}`;
  }
  if (result.handled) {
    const sent = 'sent' in result ? Boolean(result.sent) : false;
    const route = 'route' in result && result.route ? String(result.route) : 'handled';
    return sent ? `sent:${route}` : `handled_not_sent:${route}`;
  }
  return 'not_handled';
}

export async function processInboundWhatsAppMessage(
  input: BrainProcessInput,
): Promise<InboundWhatsAppResult> {
  if (await isPhoneLeadLost(input.phone)) {
    return {
      handled: false,
      skippedReason: 'lead_marked_lost',
      latencyMs: 0,
    } as InboundWhatsAppResult;
  }

  if (!input.dryRun) {
    await endStaleAgentInstances(input.phone, 72);
  }

  let bookingResult: BookingAgentResult;
  try {
    bookingResult = await processBookingAgentMessage({
      phone: input.phone,
      message: input.message,
      profileName: input.profileName,
      dryRun: input.dryRun,
      inboundReceivedAt: input.inboundReceivedAt,
    });
  } catch (error: unknown) {
    console.error('[whatsapp-router] booking agent failed', {
      phone: input.phone,
      error: String((error as { message?: string })?.message || error),
    });
    bookingResult = { handled: false, skippedReason: 'booking_agent_error' };
  }

  if (bookingResult.handled) {
    if (bookingResult.sent || input.dryRun || !bookingResult.reply?.trim()) {
      return bookingResult;
    }
  }

  const routeChase = await shouldRouteToChaseAgent(input.phone, input.message);
  if (routeChase) {
    try {
      const chaseResult = await processChaseAgentEvent({
        phone: input.phone,
        eventType: 'CUSTOMER_REPLY',
        customerMessage: input.message,
        profileName: input.profileName,
        dryRun: input.dryRun,
      });
      if (chaseResult.handled) {
        if (chaseResult.sent || input.dryRun || !chaseResult.reply?.trim()) {
          return chaseResult;
        }
      }
    } catch (error: unknown) {
      console.error('[whatsapp-router] chase agent failed', {
        phone: input.phone,
        error: String((error as { message?: string })?.message || error),
      });
    }
  }

  return processWhatsAppBrainMessage(input);
}

export function summarizeInboundWhatsAppResult(result: InboundWhatsAppResult): string {
  return summarizeInboundResult(result);
}
