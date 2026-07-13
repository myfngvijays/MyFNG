import { buildAgentContext } from './buildContext';
import { fetchAgentConfig } from './configStore';
import { executeAction, logAgentAction } from './executeAction';
import {
  countDailyOutboundMessages,
  isChatAssignedToHuman,
  loadMemory,
  loadMemoryContext,
  saveMemory,
} from './memoryService';
import { updateInstance } from './instanceService';
import { validateRules } from './ruleEngine';
import type { AgentInstance, AgentRunInput, AgentRunResult, BuyingIntent, Sentiment } from './types';
import { extractJsonFromLlmText, validateDecision } from './validateDecision';
import { emptyMemory } from './configStore';

async function callOpenAiForDecision(systemPrompt: string, userPrompt: string, model: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error: ${text.slice(0, 300)}`);
  }

  const json = await response.json();
  return String(json?.choices?.[0]?.message?.content || '');
}

function inferIntentAndSentiment(message?: string, decision?: { action?: string }): {
  buying_intent?: BuyingIntent;
  sentiment?: Sentiment;
} {
  const text = String(message || '').toLowerCase();
  if (!text) return {};

  if (['stop', 'unsubscribe', 'dont message', "don't message", 'band karo'].some((k) => text.includes(k))) {
    return { sentiment: 'NEGATIVE', buying_intent: 'NONE' };
  }
  if (['angry', 'complaint', 'fraud', 'scam', 'idiot'].some((k) => text.includes(k))) {
    return { sentiment: 'ANGRY' };
  }
  if (['book', 'yes', 'haan', 'confirm', 'slot', 'price', 'kitna', 'interested'].some((k) => text.includes(k))) {
    return { buying_intent: 'HIGH', sentiment: 'POSITIVE' };
  }
  if (decision?.action === 'ACTIVATE_BOOKING_BOT' || decision?.action === 'BOOK_APPOINTMENT') {
    return { buying_intent: 'HIGH' };
  }
  return {};
}

/**
 * Full agent cycle: context → LLM → validate → execute → memory update.
 */
export async function runAgentCycle(input: AgentRunInput & { instance?: AgentInstance | null }): Promise<AgentRunResult> {
  const started = Date.now();
  const config = await fetchAgentConfig(input.agentType);

  if (!config.enabled && !input.dryRun) {
    return { handled: false, skippedReason: 'Agent disabled' };
  }

  const instance = input.instance || null;
  const instanceId = instance?.id || input.instanceId || 'dry-run-instance';
  const phone = input.phone;

  let memory = input.mockMemory
    ? { ...emptyMemory(instanceId), ...input.mockMemory, instance_id: instanceId }
    : emptyMemory(instanceId);

  let crm = input.mockCrm || {};
  let conversation: Array<{ direction: string; body: string; at: string }> = [];

  if (input.customerMessage) {
    conversation.push({
      direction: 'inbound',
      body: input.customerMessage,
      at: new Date().toISOString(),
    });
  }

  if (instance && !input.mockMemory) {
    const ctx = await loadMemoryContext(instance.id, phone, instance.telecrm_id);
    memory = ctx.memory;
    conversation = [...ctx.conversation, ...conversation];
    crm = { ...ctx.crm, ...crm };
  }

  const { systemPrompt, userPrompt } = buildAgentContext({
    agentType: input.agentType,
    config,
    memory,
    conversation,
    crm,
    eventType: input.eventType,
    customerMessage: input.customerMessage,
  });

  let rawLlm: string;
  try {
    rawLlm = await callOpenAiForDecision(systemPrompt, userPrompt, config.model);
  } catch (err: any) {
    return { handled: false, skippedReason: err?.message || 'LLM call failed', latencyMs: Date.now() - started };
  }

  const parsed = validateDecision(extractJsonFromLlmText(rawLlm));
  if (!parsed.ok) {
    return {
      handled: false,
      skippedReason: `Invalid AI decision: ${parsed.error}`,
      latencyMs: Date.now() - started,
    };
  }

  const dailyCount = instance ? await countDailyOutboundMessages(instance.id) : 0;
  const isAssigned = await isChatAssignedToHuman(phone);

  const validation = validateRules({
    config,
    instance,
    decision: parsed.decision,
    customerMessage: input.customerMessage,
    dailyMessageCount: dailyCount,
    isChatAssigned: isAssigned,
  });

  let executionStatus: 'EXECUTED' | 'BLOCKED' | 'FAILED' | 'SKIPPED' = validation.passed ? 'SKIPPED' : 'BLOCKED';
  let execResult: Awaited<ReturnType<typeof executeAction>> | null = null;

  if (validation.passed && instance && !input.dryRun) {
    execResult = await executeAction(parsed.decision, {
      instance,
      config,
      phone,
      customerMessage: input.customerMessage,
    });
    executionStatus =
      execResult.status === 'EXECUTED' ? 'EXECUTED' : execResult.status === 'FAILED' ? 'FAILED' : 'SKIPPED';

    const hints = inferIntentAndSentiment(input.customerMessage, parsed.decision);
    memory.conversation_summary = [
      memory.conversation_summary,
      input.customerMessage ? `Customer: ${input.customerMessage}` : null,
      parsed.decision.message ? `Bot: ${parsed.decision.message}` : `Action: ${parsed.decision.action}`,
    ]
      .filter(Boolean)
      .join('\n')
      .slice(-2000);
    if (hints.buying_intent) memory.buying_intent = hints.buying_intent;
    if (hints.sentiment) memory.sentiment = hints.sentiment;
    await saveMemory(memory);

    if (input.eventType === 'CUSTOMER_REPLY' && instance) {
      await updateInstance(instance.id, {
        last_customer_reply_at: new Date().toISOString(),
      });
    }

    await logAgentAction({
      instanceId: instance.id,
      eventType: input.eventType,
      aiDecision: parsed.decision,
      validatedAction: parsed.decision.action,
      executionStatus,
      blockReason: execResult.error,
      messageSent: parsed.decision.message,
      waitUntil: execResult.waitUntil,
      latencyMs: Date.now() - started,
    });
  } else if (!validation.passed && instance && !input.dryRun) {
    await logAgentAction({
      instanceId: instance.id,
      eventType: input.eventType,
      aiDecision: parsed.decision,
      validatedAction: parsed.decision.action,
      executionStatus: 'BLOCKED',
      blockReason: validation.block_reason,
      latencyMs: Date.now() - started,
    });

    if (parsed.decision.confidence < config.rules_json.confidence_threshold) {
      await executeAction(
        {
          action: 'ASSIGN_TO_HUMAN',
          assign_reason: validation.block_reason || 'Low confidence',
          confidence: parsed.decision.confidence,
          reason: parsed.decision.reason,
        },
        { instance, config, phone, customerMessage: input.customerMessage },
      );
    }
  }

  return {
    handled: true,
    decision: parsed.decision,
    validation,
    wouldExecute: validation.passed && !input.dryRun,
    instanceId: instance?.id,
    latencyMs: Date.now() - started,
  };
}

/** @deprecated Use runAgentCycle */
export async function runAgent(input: AgentRunInput): Promise<AgentRunResult> {
  return runAgentCycle(input);
}
