import { CHATBOT_TOOLS } from '@/lib/chatbot_v2/chatbot-tools';
import { runMisaAgent } from '@/lib/chatbot_v2/runAgent';
import { MISA_GREETING_EN, SYSTEM_PROMPT } from '@/lib/chatbot_v2/chatbot-system-prompt';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { shouldSkipBotsForHumanAssignment } from '@/lib/whatsappAgents/shared/memoryService';
import {
  normalizePhoneNumber,
  sendListMessage,
  sendReplyButtonsMessage,
  type WhatsAppSendResult,
} from '@/lib/services/whatsappService';
import {
  fetchWhatsAppBrainConfig,
  type WhatsAppBrainConfig,
  type WhatsAppBrainToolsConfig,
} from './brainConfig';
import { executeBotFlow } from './executor';
import { formatWhatsAppReply } from './formatReply';
import {
  buildPeriodicPlanListSections,
  canSendPeriodicPlanList,
  extractCarModelFromMessage,
  filterPeriodicPlansByOilReply,
  formatPeriodicPricingForWhatsApp,
  groupPeriodicPlans,
  isPeriodicPricing,
  type PricingPlanItem,
} from './periodicPlansUi';
import { getFlowSession, upsertFlowSession } from './sessionStore';
import { isRsaRelatedMessage } from './rsaIntent';
import { performWhatsAppHandoff } from './handoff';
import { sendBrainOutboundMessage } from './sessionWindow';

const WHATSAPP_CHANNEL_RULES = `
# WHATSAPP CHANNEL RULES (MANDATORY)
- MISA = MyFNG Instant Service Assistant. Never paraphrase or reorder the full form (wrong: "Instant Service Assistant for MyFNG").
- On "hi/hello", greet in 1-2 lines. Introduce as: "${MISA_GREETING_EN}" then ask what they need (service, pricing, booking, RSA).
- Towing / breakdown / flat tyre / battery dead = RSA (Roadside Assistance). Never refuse towing help.
- Do NOT use markdown **double asterisks** — WhatsApp cannot render them.
- For emphasis use *single asterisks* sparingly, or plain text with emojis.
- Avoid long decorative separator lines (━━━━). Use short breaks or blank lines.
- When get_service_pricing returns plans, list EVERY plan in the pricing array — never truncate to 3.
- Follow plan_count and instruction fields from tool results exactly.
- Keep replies concise; avoid repeating service name in title and description lines.
- Group output: Semi Synthetic plans first, then Fully Synthetic.
- One line per plan: Tier · points · price (no duplicate paragraphs).
`;

const TOOL_GROUPS: Record<keyof WhatsAppBrainToolsConfig, string[]> = {
  pricing: ['get_service_pricing', 'validate_pincode'],
  workshops: ['search_workshops'],
  service_details: ['get_service_details'],
  booking: ['send_booking_otp', 'verify_booking_otp', 'create_booking', 'set_customer_name', 'set_vehicle_number', 'set_preferred_schedule'],
};

export type BrainProcessInput = {
  phone: string;
  message: string;
  profileName?: string | null;
  dryRun?: boolean;
  inboundReceivedAt?: string | null;
};

export type BrainProcessResult = {
  handled: boolean;
  skippedReason?: string;
  reply?: string;
  sessionId?: string;
  model?: string;
  sent?: boolean;
  latencyMs?: number;
  pricing?: PricingPlanItem[];
  route?: 'FLOW' | 'AI' | 'FLOW_FALLBACK' | 'PRICING_CONTEXT' | 'RSA_HANDOFF';
  flowTrace?: string[];
};

function buildSystemPrompt(config: WhatsAppBrainConfig, profileName?: string | null): string {
  const nameLine = profileName ? `\nCustomer WhatsApp name: ${profileName}` : '';
  const addon = config.system_prompt_addon?.trim();
  return [
    SYSTEM_PROMPT,
    WHATSAPP_CHANNEL_RULES,
    addon ? `\n# ADMIN ADD-ON\n${addon}${nameLine}` : nameLine,
  ]
    .filter(Boolean)
    .join('\n');
}

function filterTools(toolsConfig: WhatsAppBrainToolsConfig) {
  const allowed = new Set<string>();
  (Object.keys(TOOL_GROUPS) as Array<keyof WhatsAppBrainToolsConfig>).forEach((key) => {
    if (!toolsConfig[key]) return;
    TOOL_GROUPS[key].forEach((toolName) => allowed.add(toolName));
  });
  return CHATBOT_TOOLS.filter((tool) => allowed.has(tool.function.name));
}

function waSessionId(phone: string) {
  return `wa_brain_${normalizePhoneNumber(phone)}`;
}

function truncateForWhatsApp(text: string, max = 3900): string {
  const trimmed = String(text || '').trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 3).trim()}...`;
}

async function isChatAssignedToHuman(phone: string): Promise<boolean> {
  return shouldSkipBotsForHumanAssignment(phone);
}

async function archiveBrainOutboundMessage(
  phone: string,
  text: string,
  sendResult: WhatsAppSendResult,
  meta?: Record<string, unknown>,
) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return;

  const now = new Date().toISOString();
  await supabaseAdmin.from('whatsapp_messages').insert({
    provider_message_id: sendResult.messageId || null,
    direction: 'OUTBOUND',
    message_type: 'TEXT',
    sender_phone: null,
    recipient_phone: normalizePhoneNumber(phone),
    text_body: text,
    status: sendResult.success ? 'SENT' : 'FAILED',
    status_at: now,
    error_message: sendResult.success ? null : sendResult.error || 'Brain auto-reply failed',
    payload: {
      source: 'whatsapp_ai_brain',
      response: sendResult.raw || null,
    },
    meta: {
      brain_auto_reply: true,
      ...(meta || {}),
    },
    updated_at: now,
  });
}

function getStoredPricing(session: Awaited<ReturnType<typeof getFlowSession>>): PricingPlanItem[] | null {
  const raw = session?.variables?.last_pricing;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw as PricingPlanItem[];
}

async function sendBrainTextReply(input: {
  phone: string;
  message: string;
  config: WhatsAppBrainConfig;
  inboundReceivedAt?: string | null;
  profileName?: string | null;
}) {
  return sendBrainOutboundMessage({
    phone: input.phone,
    message: input.message,
    config: input.config,
    inboundAt: input.inboundReceivedAt,
    profileName: input.profileName,
  });
}

async function tryPricingContextReply(input: {
  phone: string;
  message: string;
  dryRun?: boolean;
  config: WhatsAppBrainConfig;
  inboundReceivedAt?: string | null;
}): Promise<BrainProcessResult | null> {
  const session = await getFlowSession(input.phone);
  const stored = getStoredPricing(session);
  if (!stored || !isPeriodicPricing(stored)) return null;

  const filtered = filterPeriodicPlansByOilReply(stored, input.message);
  if (!filtered?.length) return null;

  const carModel = String(session?.variables?.last_car || '').trim() || null;
  const reply = truncateForWhatsApp(
    formatPeriodicPricingForWhatsApp(filtered, { carModel }),
  );

  if (input.dryRun) {
    return {
      handled: true,
      reply,
      sessionId: waSessionId(input.phone),
      sent: false,
      pricing: filtered,
      route: 'PRICING_CONTEXT',
    };
  }

  const sendResult = await sendBrainTextReply({
    phone: input.phone,
    message: reply,
    config: input.config,
    inboundReceivedAt: input.inboundReceivedAt,
    profileName: input.profileName,
  });
  await archiveBrainOutboundMessage(input.phone, reply, sendResult, {
    route: 'PRICING_CONTEXT',
    used_template: sendResult.usedTemplate,
  });
  return {
    handled: true,
    reply,
    sessionId: waSessionId(input.phone),
    sent: sendResult.success,
    pricing: filtered,
    route: 'PRICING_CONTEXT',
  };
}

async function tryRsaHandoffReply(input: {
  phone: string;
  message: string;
  profileName?: string | null;
  dryRun?: boolean;
  config: WhatsAppBrainConfig;
  inboundReceivedAt?: string | null;
}): Promise<BrainProcessResult | null> {
  if (!isRsaRelatedMessage(input.message)) return null;

  const reply = truncateForWhatsApp(
    formatWhatsAppReply(
      'Got it — this sounds like *Roadside Assistance (RSA)* (towing, breakdown, flat tyre, battery, etc.).\n\n' +
        'Connecting you to our RSA team. Please share your location/pincode and car details if you have not already.',
    ),
  );

  if (input.dryRun) {
    return {
      handled: true,
      reply,
      sessionId: waSessionId(input.phone),
      sent: false,
      route: 'RSA_HANDOFF',
    };
  }

  const { rsaLeadId } = await performWhatsAppHandoff({
    phone: input.phone,
    note: 'RSA / towing / roadside request detected from WhatsApp brain',
    message: input.message,
    profileName: input.profileName,
    createRsaLead: true,
  });
  await upsertFlowSession({
    phone: input.phone,
    status: 'HANDOFF',
    variables: { intent: 'RSA', last_message: input.message, rsa_lead_id: rsaLeadId },
  });

  const sendResult = await sendBrainTextReply({
    phone: input.phone,
    message: reply,
    config: input.config,
    inboundReceivedAt: input.inboundReceivedAt,
    profileName: input.profileName,
  });
  await archiveBrainOutboundMessage(input.phone, reply, sendResult, {
    route: 'RSA_HANDOFF',
    rsa_lead_id: rsaLeadId,
    used_template: sendResult.usedTemplate,
  });

  return {
    handled: true,
    reply,
    sessionId: waSessionId(input.phone),
    sent: sendResult.success,
    route: 'RSA_HANDOFF',
  };
}

async function sendPeriodicPricingReply(input: {
  phone: string;
  message: string;
  plans: PricingPlanItem[];
  dryRun?: boolean;
  config: WhatsAppBrainConfig;
  inboundReceivedAt?: string | null;
}): Promise<{ reply: string; sent: boolean; usedInteractive: boolean }> {
  const carModel = extractCarModelFromMessage(input.message);
  const grouped = groupPeriodicPlans(input.plans);
  const textReply = truncateForWhatsApp(
    formatPeriodicPricingForWhatsApp(input.plans, { carModel }),
  );

  if (input.dryRun) {
    return { reply: textReply, sent: false, usedInteractive: false };
  }

  if (canSendPeriodicPlanList(input.plans)) {
    const sections = buildPeriodicPlanListSections(input.plans);
    const header = carModel ? `Periodic Service — ${carModel}` : 'Periodic Service Plans';
    const listResult = await sendListMessage({
      phoneNumber: input.phone,
      header,
      body: 'Tap below to view Semi & Fully Synthetic plans with prices.',
      buttonLabel: 'View plans',
      sections,
      footer: 'Reply with plan name to book',
    });

    if (listResult.success) {
      await archiveBrainOutboundMessage(input.phone, textReply, listResult, {
        route: 'AI',
        interactive: 'list',
      });
      return { reply: textReply, sent: true, usedInteractive: true };
    }
  }

  if (grouped.semi.length > 0 && grouped.full.length > 0) {
    const buttonResult = await sendReplyButtonsMessage({
      phoneNumber: input.phone,
      body: carModel
        ? `Choose oil type for *${carModel}* periodic service:`
        : 'Choose oil type for periodic service:',
      buttons: [
        { id: 'oil_semi', title: 'Semi Synthetic' },
        { id: 'oil_full', title: 'Fully Synthetic' },
      ],
      footer: 'Or reply with your pincode & car model',
    });

    if (buttonResult.success) {
      await archiveBrainOutboundMessage(input.phone, textReply, buttonResult, {
        route: 'AI',
        interactive: 'buttons',
      });
      return { reply: textReply, sent: true, usedInteractive: true };
    }
  }

  const sendResult = await sendBrainTextReply({
    phone: input.phone,
    message: textReply,
    config: input.config,
    inboundReceivedAt: input.inboundReceivedAt,
    profileName: input.profileName,
  });
  await archiveBrainOutboundMessage(input.phone, textReply, sendResult, {
    route: 'AI',
    used_template: sendResult.usedTemplate,
  });
  return { reply: textReply, sent: sendResult.success, usedInteractive: false };
}

async function runAiBrain(input: {
  phone: string;
  message: string;
  profileName?: string | null;
  dryRun?: boolean;
  config: WhatsAppBrainConfig;
  started: number;
  inboundReceivedAt?: string | null;
}): Promise<BrainProcessResult> {
  const sessionId = waSessionId(input.phone);
  const tools = filterTools(input.config.tools);

  const agent = await runMisaAgent({
    sessionId,
    message: input.message,
    systemPrompt: buildSystemPrompt(input.config, input.profileName),
    tools,
    model: input.config.model,
    maxTokens: 1800,
    persistSession: !input.dryRun,
    bookingChannel: 'WHATSAPP',
    dryRun: input.dryRun,
    channelPhone: input.phone,
  });

  const carModel = extractCarModelFromMessage(input.message);
  let reply = '';
  let sent = false;

  if (agent.pricing && isPeriodicPricing(agent.pricing)) {
    const pricingReply = await sendPeriodicPricingReply({
      phone: input.phone,
      message: input.message,
      plans: agent.pricing,
      dryRun: input.dryRun,
      config: input.config,
      inboundReceivedAt: input.inboundReceivedAt,
    });
    reply = pricingReply.reply;
    sent = pricingReply.sent;

    if (!input.dryRun) {
      await upsertFlowSession({
        phone: input.phone,
        variables: {
          last_pricing: agent.pricing,
          last_car: carModel,
        },
      });
    }
  } else {
    reply = truncateForWhatsApp(formatWhatsAppReply(agent.response));
    if (!input.dryRun) {
      const sendResult = await sendBrainTextReply({
        phone: input.phone,
        message: reply,
        config: input.config,
        inboundReceivedAt: input.inboundReceivedAt,
        profileName: input.profileName,
      });
      await archiveBrainOutboundMessage(input.phone, reply, sendResult, {
        route: 'AI',
        used_template: sendResult.usedTemplate,
      });
      sent = sendResult.success;
    }
  }

  return {
    handled: true,
    reply,
    sessionId,
    model: agent.model,
    sent,
    latencyMs: Date.now() - input.started,
    pricing: agent.pricing,
    route: 'AI',
  };
}

async function runFlowBrain(input: {
  phone: string;
  message: string;
  profileName?: string | null;
  dryRun?: boolean;
  config: WhatsAppBrainConfig;
  started: number;
}): Promise<BrainProcessResult> {
  const flowResult = await executeBotFlow({
    phone: input.phone,
    message: input.message,
    profileName: input.profileName,
    dryRun: input.dryRun,
    config: input.config,
    inboundReceivedAt: input.inboundReceivedAt,
    profileName: input.profileName,
  });

  if (!flowResult.handled) {
    return {
      handled: false,
      skippedReason: flowResult.skippedReason,
      flowTrace: flowResult.trace,
      latencyMs: Date.now() - input.started,
      route: 'FLOW',
    };
  }

  return {
    handled: true,
    reply: flowResult.reply,
    sessionId: waSessionId(input.phone),
    sent: flowResult.sent,
    latencyMs: Date.now() - input.started,
    flowTrace: flowResult.trace,
    route: 'FLOW',
  };
}

export async function processWhatsAppBrainMessage(input: BrainProcessInput): Promise<BrainProcessResult> {
  const started = Date.now();
  const phone = normalizePhoneNumber(input.phone);
  const message = String(input.message || '').trim();

  if (!phone || !message) {
    return { handled: false, skippedReason: 'missing_phone_or_message' };
  }

  // If MISA just asked for name and customer replied with a real name, persist it on the CRM lead.
  void (async () => {
    try {
      const { looksLikePersonName, updateLeadCustomerNameByPhone } = await import(
        '@/lib/service-lead-reopen'
      );
      if (!looksLikePersonName(message)) return;
      const { supabaseAdmin } = getSupabaseAdmin();
      if (!supabaseAdmin) return;
      const { data: lastOut } = await supabaseAdmin
        .from('whatsapp_messages')
        .select('text_body, direction, created_at, recipient_phone')
        .eq('direction', 'OUTBOUND')
        .or(
          `recipient_phone.eq.${phone},recipient_phone.eq.${phone.slice(-10)},recipient_phone.ilike.%${phone.slice(-10)}`,
        )
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const lastText = String(lastOut?.text_body || '');
      if (!/what'?s your name|your (full )?name|may i know your name|share your name|tell me your name/i.test(lastText)) {
        return;
      }
      await updateLeadCustomerNameByPhone(supabaseAdmin, phone, message);
    } catch (err) {
      console.warn('[whatsapp-brain] name capture skipped', err);
    }
  })();

  const config = await fetchWhatsAppBrainConfig();
  if (!config.enabled && !input.dryRun) {
    return { handled: false, skippedReason: 'brain_disabled' };
  }

  if (config.skip_assigned_chats && (await isChatAssignedToHuman(phone))) {
    return { handled: false, skippedReason: 'assigned_to_human' };
  }

  try {
    const pricingContext = await tryPricingContextReply({
      phone,
      message,
      dryRun: input.dryRun,
      config,
      inboundReceivedAt: input.inboundReceivedAt,
    });
    if (pricingContext) {
      return { ...pricingContext, latencyMs: Date.now() - started };
    }

    const useFlow = config.mode === 'FLOW_FIRST' || config.mode === 'HYBRID';
    if (useFlow) {
      const flowResult = await runFlowBrain({
        phone,
        message,
        profileName: input.profileName,
        dryRun: input.dryRun,
        config,
        started,
      });

      if (flowResult.handled && (flowResult.sent || input.dryRun)) return flowResult;

      if (flowResult.handled && config.mode === 'HYBRID' && !flowResult.sent) {
        // Flow composed a reply but WhatsApp send failed — fall through to MISA AI.
      } else if (flowResult.handled) {
        return flowResult;
      }

      if (config.mode === 'FLOW_FIRST') {
        const fallback = truncateForWhatsApp(
          formatWhatsAppReply(config.fallback_message || 'Thanks for reaching out to MyFNG!'),
        );

        if (input.dryRun) {
          return {
            handled: true,
            reply: fallback,
            sessionId: waSessionId(phone),
            sent: false,
            latencyMs: Date.now() - started,
            skippedReason: flowResult.skippedReason,
            flowTrace: flowResult.flowTrace,
            route: 'FLOW_FALLBACK',
          };
        }

        const sendResult = await sendBrainTextReply({
          phone,
          message: fallback,
          config,
          inboundReceivedAt: input.inboundReceivedAt,
          profileName: input.profileName,
        });
        await archiveBrainOutboundMessage(phone, fallback, sendResult, {
          route: 'FLOW_FALLBACK',
          flow_skip: flowResult.skippedReason,
          used_template: sendResult.usedTemplate,
        });

        return {
          handled: true,
          reply: fallback,
          sessionId: waSessionId(phone),
          sent: sendResult.success,
          latencyMs: Date.now() - started,
          skippedReason: flowResult.skippedReason,
          flowTrace: flowResult.flowTrace,
          route: 'FLOW_FALLBACK',
        };
      }
    }

    const rsaHandoff = await tryRsaHandoffReply({
      phone,
      message,
      profileName: input.profileName,
      dryRun: input.dryRun,
      config,
      inboundReceivedAt: input.inboundReceivedAt,
    });
    if (rsaHandoff) {
      return { ...rsaHandoff, latencyMs: Date.now() - started };
    }

    return await runAiBrain({
      phone,
      message,
      profileName: input.profileName,
      dryRun: input.dryRun,
      config,
      started,
      inboundReceivedAt: input.inboundReceivedAt,
    });
  } catch (error: any) {
    const fallback = formatWhatsAppReply(config.fallback_message || 'Thanks for reaching out to MyFNG!');
    if (!input.dryRun) {
      const sendResult = await sendBrainTextReply({
        phone,
        message: fallback,
        config,
        inboundReceivedAt: input.inboundReceivedAt,
        profileName: input.profileName,
      });
      await archiveBrainOutboundMessage(phone, fallback, sendResult, {
        used_template: sendResult.usedTemplate,
      });
      return {
        handled: true,
        reply: fallback,
        sessionId: waSessionId(phone),
        model: config.model,
        sent: sendResult.success,
        latencyMs: Date.now() - started,
        skippedReason: error?.message || 'agent_error_fallback',
      };
    }

    return {
      handled: false,
      skippedReason: error?.message || 'agent_error',
      latencyMs: Date.now() - started,
    };
  }
}
