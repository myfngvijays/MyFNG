import { runMisaAgent } from '@/lib/chatbot_v2/runAgent';
import { getBookingsBySession } from '@/lib/chatbot_v2/booking';
import { formatWhatsAppReply } from '@/lib/whatsappBotFlow/formatReply';
import { performWhatsAppHandoff } from '@/lib/whatsappBotFlow/handoff';
import { isRsaRelatedMessage } from '@/lib/whatsappBotFlow/rsaIntent';
import {
  extractCarModelFromMessage,
  formatPeriodicPricingForWhatsApp,
  isPeriodicPricing,
  type PricingPlanItem,
} from '@/lib/whatsappBotFlow/periodicPlansUi';
import { normalizePhoneNumber } from '@/lib/services/whatsappService';
import { fetchAgentConfig } from '../shared/configStore';
import { logAgentAction } from '../shared/executeAction';
import {
  endInstance,
  findOrCreateInstance,
  getActiveInstance,
  updateInstance,
} from '../shared/instanceService';
import { loadMemory, saveMemory, shouldSkipBotsForHumanAssignment, customerRequestedHumanAgent, clearCustomerHumanRequest } from '../shared/memoryService';
import { sendAgentTextMessage } from '../shared/outbound';
import { hasBookingIntent, isGreetingMessage } from './intent';
import {
  parseMisaChoice,
  wantsHumanHelp,
  sendMisaOrHumanChoiceButtons,
  MISA_CHOICE_BODY,
} from './choiceButtons';
import { bookingSessionId, buildBookingSystemPrompt } from './prompt';
import { filterBookingTools } from './tools';

export type BookingAgentInput = {
  phone: string;
  message: string;
  profileName?: string | null;
  dryRun?: boolean;
  inboundReceivedAt?: string | null;
  force?: boolean;
  sessionId?: string;
  /** Keep MISA chat history during admin dry-run tests. */
  persistTestSession?: boolean;
};

export type BookingAgentResult = {
  handled: boolean;
  skippedReason?: string;
  reply?: string;
  sessionId?: string;
  model?: string;
  sent?: boolean;
  instanceId?: string;
  bookingCreated?: boolean;
  route?: 'BOOKING_AGENT' | 'BOOKING_RSA_HANDOFF';
  pricing?: PricingPlanItem[];
  latencyMs?: number;
};

function truncateForWhatsApp(text: string, max = 3900): string {
  const trimmed = String(text || '').trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 3).trim()}...`;
}

async function detectRecentBooking(sessionId: string, sinceMs: number): Promise<boolean> {
  const bookings = await getBookingsBySession(sessionId);
  return bookings.some((b) => {
    const created = new Date(String(b.created_at || '')).getTime();
    return Number.isFinite(created) && created >= sinceMs;
  });
}

export async function shouldRouteToBookingAgent(phone: string, message: string): Promise<boolean> {
  const config = await fetchAgentConfig('BOOKING');
  if (!config.enabled) return false;

  if (parseMisaChoice(message) === 'misa') return true;
  if (await customerRequestedHumanAgent(phone)) return false;

  if (config.rules_json.skip_assigned_chats && (await shouldSkipBotsForHumanAssignment(phone))) {
    return false;
  }

  if (parseMisaChoice(message) || wantsHumanHelp(message) || isGreetingMessage(message)) return true;

  const active = await getActiveInstance('BOOKING', phone);
  if (active) return true;

  return hasBookingIntent(message);
}

export async function processBookingAgentMessage(input: BookingAgentInput): Promise<BookingAgentResult> {
  const started = Date.now();
  const phone = normalizePhoneNumber(input.phone);
  const message = String(input.message || '').trim();

  if (!phone || !message) {
    return { handled: false, skippedReason: 'missing_phone_or_message' };
  }

  const config = await fetchAgentConfig('BOOKING');
  if (!config.enabled && !input.dryRun) {
    return { handled: false, skippedReason: 'booking_agent_disabled' };
  }

  if (!input.force && !input.dryRun) {
    const shouldRoute = await shouldRouteToBookingAgent(phone, message);
    if (!shouldRoute) {
      return { handled: false, skippedReason: 'no_booking_intent' };
    }
  }

  if (await customerRequestedHumanAgent(phone) && parseMisaChoice(message) !== 'misa') {
    return { handled: false, skippedReason: 'assigned_to_human' };
  }

  if (config.rules_json.skip_assigned_chats && (await shouldSkipBotsForHumanAssignment(phone))) {
    if (parseMisaChoice(message) !== 'misa') {
      return { handled: false, skippedReason: 'assigned_to_human' };
    }
  }

  const existing = input.dryRun ? null : await getActiveInstance('BOOKING', phone);
  const storedChoice = String((existing?.metadata as { misa_choice?: string } | null)?.misa_choice || '');
  const misaChoice =
    storedChoice || ((existing?.follow_up_count || 0) > 0 ? 'misa' : '');
  const choiceTap = parseMisaChoice(message);

  const persistChoice = async (next: 'pending' | 'misa' | 'human') => {
    if (input.dryRun) return existing;
    const instance = await findOrCreateInstance({
      agentType: 'BOOKING',
      phone,
      metadata: {
        source: 'inbound_whatsapp',
        profile_name: input.profileName || null,
        misa_choice: next,
      },
    });
    await updateInstance(instance.id, {
      metadata: { ...(instance.metadata || {}), misa_choice: next },
      last_customer_reply_at: new Date().toISOString(),
    });
    return instance;
  };

  if (choiceTap === 'human' || (wantsHumanHelp(message) && choiceTap !== 'misa' && misaChoice === 'misa')) {
    // Mid-MISA “callback / human” → show buttons instead of a wrong AI reply.
    if (choiceTap !== 'human') {
      if (!input.dryRun) {
        await persistChoice('pending');
        const sentButtons = await sendMisaOrHumanChoiceButtons(phone);
        return {
          handled: true,
          reply: MISA_CHOICE_BODY,
          sent: sentButtons,
          route: 'BOOKING_AGENT',
          latencyMs: Date.now() - started,
        };
      }
      return {
        handled: true,
        reply: MISA_CHOICE_BODY,
        sent: false,
        route: 'BOOKING_AGENT',
        latencyMs: Date.now() - started,
      };
    }
    if (!input.dryRun) {
      await performWhatsAppHandoff({
        phone,
        note: 'Customer tapped Human agent on WhatsApp',
        message,
        profileName: input.profileName,
        createRsaLead: false,
      });
      const instance = await persistChoice('human');
      if (instance?.id) await endInstance(instance.id, 'ESCALATED');
      const sendResult = await sendAgentTextMessage({
        phone,
        message: 'Done. A MyFNG team member will message you here shortly.',
        source: 'whatsapp_booking_agent',
        meta: { route: 'MISA_HUMAN_HANDOFF' },
      });
      return {
        handled: true,
        reply: 'Done. A MyFNG team member will message you here shortly.',
        sent: sendResult.success,
        route: 'BOOKING_RSA_HANDOFF',
        latencyMs: Date.now() - started,
      };
    }
    return {
      handled: true,
      reply: 'Done. A MyFNG team member will message you here shortly.',
      sent: false,
      route: 'BOOKING_RSA_HANDOFF',
      latencyMs: Date.now() - started,
    };
  }

  if (choiceTap === 'misa') {
    if (!input.dryRun) await clearCustomerHumanRequest(phone);
    const talkReply = 'Great — tell me what you need (booking, pricing, or workshop).';
    if (!input.dryRun) {
      await persistChoice('misa');
      const sendResult = await sendAgentTextMessage({
        phone,
        message: talkReply,
        source: 'whatsapp_booking_agent',
        meta: { route: 'MISA_CHOICE_TALK' },
      });
      return {
        handled: true,
        reply: talkReply,
        sent: sendResult.success,
        route: 'BOOKING_AGENT',
        latencyMs: Date.now() - started,
      };
    }
    return {
      handled: true,
      reply: talkReply,
      sent: false,
      route: 'BOOKING_AGENT',
      latencyMs: Date.now() - started,
    };
  }

  const offerChoice =
    wantsHumanHelp(message) ||
    isGreetingMessage(message) ||
    (!misaChoice && !hasBookingIntent(message)) ||
    (misaChoice === 'pending' && !hasBookingIntent(message));

  if (offerChoice && misaChoice !== 'misa') {
    if (!input.dryRun) {
      await persistChoice('pending');
      const sentButtons = await sendMisaOrHumanChoiceButtons(phone);
      return {
        handled: true,
        reply: MISA_CHOICE_BODY,
        sent: sentButtons,
        route: 'BOOKING_AGENT',
        latencyMs: Date.now() - started,
      };
    }
    return {
      handled: true,
      reply: MISA_CHOICE_BODY,
      sent: false,
      route: 'BOOKING_AGENT',
      latencyMs: Date.now() - started,
    };
  }

  if (isRsaRelatedMessage(message)) {
    const handoffNote = 'RSA request routed from MISA AI';
    if (!input.dryRun) {
      await performWhatsAppHandoff({
        phone,
        note: handoffNote,
        message,
        profileName: input.profileName,
        createRsaLead: true,
      });
      const instance = await findOrCreateInstance({
        agentType: 'BOOKING',
        phone,
        metadata: { source: 'inbound_rsa' },
      });
      await endInstance(instance.id, 'ESCALATED');
    }
    return {
      handled: true,
      reply: 'Our RSA team will assist you shortly. A human agent has been notified.',
      route: 'BOOKING_RSA_HANDOFF',
      sent: !input.dryRun,
      latencyMs: Date.now() - started,
    };
  }

  const sessionId = input.sessionId || bookingSessionId(phone);
  const tools = filterBookingTools(config.tools_json);

  const instance = input.dryRun
    ? null
    : await findOrCreateInstance({
        agentType: 'BOOKING',
        phone,
        metadata: {
          source: 'inbound_whatsapp',
          profile_name: input.profileName || null,
        },
      });

  const agent = await runMisaAgent({
    sessionId,
    message,
    systemPrompt: buildBookingSystemPrompt(config, input.profileName, phone, input.dryRun),
    tools,
    model: config.model,
    maxTokens: 1800,
    persistSession: !input.dryRun || Boolean(input.persistTestSession),
    bookingChannel: 'WHATSAPP',
    dryRun: input.dryRun,
    channelPhone: phone,
  });

  let reply = '';
  let sent = false;
  let pricing: PricingPlanItem[] | undefined = agent.pricing;

  if (agent.pricing && isPeriodicPricing(agent.pricing)) {
    const carModel = extractCarModelFromMessage(message);
    reply = truncateForWhatsApp(
      formatWhatsAppReply(formatPeriodicPricingForWhatsApp(agent.pricing, { carModel })),
    );
  } else {
    reply = truncateForWhatsApp(formatWhatsAppReply(agent.response));
  }

  if (!input.dryRun) {
    const sendResult = await sendAgentTextMessage({
      phone,
      message: reply,
      source: 'whatsapp_booking_agent',
      meta: { route: 'BOOKING_AGENT', instance_id: instance?.id },
    });
    sent = sendResult.success;
  }

  const bookingCreated = await detectRecentBooking(sessionId, started - 5000);

  if (instance) {
    const memory = await loadMemory(instance.id);
    memory.conversation_summary = `${memory.conversation_summary}\nCustomer: ${message}\nBot: ${reply}`.trim().slice(-2000);
    if (bookingCreated) memory.buying_intent = 'HIGH';
    memory.sent_messages = [
      ...memory.sent_messages,
      { at: new Date().toISOString(), message: reply, direction: 'outbound' },
    ].slice(-20);
    await saveMemory(memory);

    await updateInstance(instance.id, {
      follow_up_count: (instance.follow_up_count || 0) + 1,
      last_action_at: new Date().toISOString(),
      last_customer_reply_at: new Date().toISOString(),
    });

    await logAgentAction({
      instanceId: instance.id,
      eventType: 'CUSTOMER_REPLY',
      aiDecision: {
        action: bookingCreated ? 'BOOK_APPOINTMENT' : 'SEND_MESSAGE',
        message: reply,
        confidence: bookingCreated ? 0.95 : 0.85,
        reason: bookingCreated ? 'Booking created via MISA tools' : 'Booking conversation reply',
      },
      validatedAction: bookingCreated ? 'BOOK_APPOINTMENT' : 'SEND_MESSAGE',
      executionStatus: sent || input.dryRun ? 'EXECUTED' : 'FAILED',
      messageSent: reply,
      latencyMs: Date.now() - started,
    });

    if (bookingCreated) {
      await endInstance(instance.id, 'CONVERTED');
    }
  }

  return {
    handled: true,
    reply,
    sessionId,
    model: agent.model,
    sent,
    instanceId: instance?.id,
    bookingCreated,
    pricing,
    route: 'BOOKING_AGENT',
    latencyMs: Date.now() - started,
  };
}

export async function activateBookingAgentFromChase(input: {
  phone: string;
  leadId?: string | null;
  telecrmId?: string | null;
  note?: string;
}): Promise<{ instanceId: string }> {
  const instance = await findOrCreateInstance({
    agentType: 'BOOKING',
    phone: input.phone,
    leadId: input.leadId,
    telecrmId: input.telecrmId,
    goal: input.note || 'Activated from Chase Bot — customer showed buying intent',
    metadata: { source: 'chase_handoff' },
  });
  return { instanceId: instance.id };
}
