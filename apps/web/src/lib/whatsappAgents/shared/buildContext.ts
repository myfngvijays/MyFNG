import type { AgentConfig, AgentMemory, AgentType } from './types';
import type { AgentEventType } from './types';

export type ContextBundle = {
  systemPrompt: string;
  userPrompt: string;
};

export function buildAgentContext(input: {
  agentType: AgentType;
  config: AgentConfig;
  memory: AgentMemory;
  conversation: Array<{ direction: string; body: string; at: string }>;
  crm: Record<string, unknown>;
  eventType: AgentEventType;
  customerMessage?: string;
}): ContextBundle {
  const { config, memory, conversation, crm, eventType, customerMessage } = input;

  const conversationLines = conversation
    .slice()
    .reverse()
    .map((m) => `[${m.direction}] ${m.body}`)
    .join('\n');

  const followupHint =
    input.agentType === 'FOLLOWUP'
      ? [
          'This is a ONE-TIME scheduled check-in. Use action SEND_MESSAGE with one short friendly message, then the system will end the conversation. Do NOT use WAIT. If customer already engaged, use END_CONVERSATION.',
          'Write a FRESH message every time — different opening, different angle, different wording. Never reuse or lightly rephrase a previous outbound.',
          'Focus on car service / booking / callback reason from CRM context only. Do NOT mention Prime membership unless CRM explicitly mentions membership.',
        ].join(' ')
      : null;

  const priorOutbound = Array.isArray(memory.extra?.avoid_repeating_messages)
    ? (memory.extra.avoid_repeating_messages as string[])
    : memory.sent_messages
        .filter((m) => m.direction === 'outbound')
        .map((m) => m.message)
        .filter(Boolean);

  const priorOutboundBlock =
    input.agentType === 'FOLLOWUP' && priorOutbound.length
      ? `Previous outbound messages — do NOT repeat or paraphrase these:\n${priorOutbound
          .slice(0, 8)
          .map((m, i) => `${i + 1}. ${m}`)
          .join('\n')}`
      : null;

  const followupContext =
    input.agentType === 'FOLLOWUP' && Object.keys(crm).length
      ? `Follow-up context: ${JSON.stringify({
          customer_name: crm.customer_name || crm.name,
          vehicle_model: crm.vehicle_model || crm.car_label,
          service_type: crm.service_type || crm.service_label,
          follow_up_type: crm.follow_up_type,
          reason: crm.reason,
        })}`
      : null;

  const dispositionAddon =
    typeof memory.extra?.disposition_prompt_addon === 'string'
      ? memory.extra.disposition_prompt_addon
      : null;

  const systemPrompt = [
    config.goal_prompt,
    config.system_prompt_addon,
    dispositionAddon ? `Disposition-specific instruction: ${dispositionAddon}` : null,
    followupHint,
    '',
    'You MUST respond with ONLY valid JSON matching this schema:',
    '{ "action": "SEND_MESSAGE"|"WAIT"|"UPDATE_CRM"|"ASSIGN_TO_HUMAN"|"BOOK_APPOINTMENT"|"END_CONVERSATION"|"ACTIVATE_BOOKING_BOT",',
    '  "message"?: string, "wait_hours"?: number, "wait_days"?: number,',
    '  "crm_fields"?: {}, "assign_reason"?: string, "end_reason"?: string,',
    '  "confidence": 0.0-1.0, "reason": "explanation" }',
    'Never execute actions directly. Only return the JSON decision.',
  ].join('\n');

  const userPrompt = [
    `Event: ${eventType}`,
    customerMessage ? `Customer message: ${customerMessage}` : null,
    `Buying intent: ${memory.buying_intent}`,
    `Sentiment: ${memory.sentiment}`,
    memory.conversation_summary ? `Summary: ${memory.conversation_summary}` : null,
    followupContext,
    Object.keys(crm).length ? `CRM: ${JSON.stringify(crm)}` : null,
    priorOutboundBlock,
    conversationLines ? `Recent conversation:\n${conversationLines}` : 'No prior conversation.',
  ]
    .filter(Boolean)
    .join('\n\n');

  return { systemPrompt, userPrompt };
}
