import { z } from 'zod';
import type { ChatbotV2Context, ChatbotV2Response, ClassifiedIntent, UserLang } from '../types';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { buildChatbotTools } from './tools';

function safeText(s: unknown, max = 1200) {
  return String(s ?? '')
    .replace(/\r/g, '')
    .trim()
    .slice(0, max);
}

const AgentOutputSchema = z.object({
  type: z.enum(['answer', 'pricing', 'booking', 'escalation']),
  message: z.string().min(1),
  // CTA is allowed to be empty string (UI already hides it)
  cta: z.string(),
  data: z.record(z.any()).default({}),
  contextPatch: z.record(z.any()).optional(),
});

export type AgentRunResult = {
  response: ChatbotV2Response;
  contextPatch: Partial<ChatbotV2Context>;
  meta: { toolCalls: number };
};

function extractJsonObject(text: string) {
  const t = String(text || '').trim();
  if (!t) return null;
  // If model returns extra text, try to salvage the first JSON object.
  const i = t.indexOf('{');
  const j = t.lastIndexOf('}');
  if (i === -1 || j === -1 || j <= i) return null;
  const slice = t.slice(i, j + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

export async function runToolCallingAgent(params: {
  userText: string;
  lang: UserLang;
  context: ChatbotV2Context;
  intent: ClassifiedIntent;
}): Promise<AgentRunResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const tools = buildChatbotTools({ lang: params.lang, context: params.context });

  const llm = new ChatOpenAI({
    apiKey,
    model: modelName,
    temperature: 0.2,
  });

  // IMPORTANT: LangChain prompt templates treat `{` and `}` as formatting tokens.
  // We must escape braces in the system prompt because we include a JSON schema example.
  const escapeBraces = (s: string) => s.replaceAll('{', '{{').replaceAll('}', '}}');

  const sysRaw =
    'You are MY FNG AI Assistant, India. Style: friendly, confident, short Hinglish/English/Hindi.\n' +
    'Goal: help user quickly, keep conversation stable, and convert to booking when user shows intent.\n' +
    '\n' +
    'Hard output rules:\n' +
    '- Output ONLY valid JSON. No markdown, no extra text.\n' +
    '- Max 3–5 short lines in message.\n' +
    '- CTA: empty string unless the next input is genuinely required.\n' +
    '- You may call AT MOST ONE tool. If you call a tool, use its result.\n' +
    '\n' +
    'When to ask for details (strict):\n' +
    '- If user asks Pricing: ask ONLY missing (car model OR area) if needed, else answer.\n' +
    '- If user asks Booking: ask ONLY the next missing field in order: car model → area → pickup/self → phone → vehicle number.\n' +
    '- Do NOT ask date/time unless user asks.\n' +
    '- Do NOT ask for car/phone when user only asked a general info question.\n' +
    '\n' +
    'Knowledge behavior:\n' +
    '- If you can answer from common MY FNG facts (aggregator platform, verified workshops, transparency, updates, warranty/support), answer directly.\n' +
    '- If unsure, keep a clarifying question (1 line) instead of sending menu.\n' +
    '\n' +
    'Tool choice hints:\n' +
    '- Use get_pricing when user asks price/cost.\n' +
    '- Use create_lead only when required booking fields are present.\n' +
    '- Use create_payment_link only if user explicitly asks for payment link and leadId exists.\n' +
    '\n' +
    'JSON schema:\n' +
    '{ "type": "answer|pricing|booking|escalation", "message": "...", "cta": "", "data": {}, "contextPatch": {} }';
  const sys = escapeBraces(sysRaw);

  const user =
    `User message: ${safeText(params.userText, 600)}\n` +
    `Detected intent: ${params.intent.intent} (confidence ${params.intent.confidence})\n` +
    `Known context: ${safeText(JSON.stringify(params.context || {}), 700)}`;

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', sys],
    ['human', '{input}'],
    ['placeholder', '{agent_scratchpad}'],
  ]);

  const agent = await createOpenAIToolsAgent({ llm, tools, prompt });
  const executor = new AgentExecutor({
    agent,
    tools,
    // We allow at most one tool execution step; agent may still answer directly.
    maxIterations: 2,
    returnIntermediateSteps: true,
    verbose: false,
  });

  const result: any = await executor.invoke({ input: user });
  const outputText = safeText(result?.output || '');
  const steps = Array.isArray(result?.intermediateSteps) ? result.intermediateSteps : [];
  const toolCalls = steps.length;

  if (toolCalls > 1) {
    // Enforce stability/cost: more than one tool call is not allowed.
    return null;
  }

  const obj = extractJsonObject(outputText);
  const parsed = obj ? AgentOutputSchema.safeParse(obj) : { success: false as const };
  if (!parsed.success) return null;

  const response: ChatbotV2Response = {
    type: parsed.data.type,
    message: parsed.data.message.trim(),
    cta: String(parsed.data.cta || ''),
    data: parsed.data.data || {},
  };
  const contextPatch = (parsed.data.contextPatch || {}) as Partial<ChatbotV2Context>;

  return { response, contextPatch, meta: { toolCalls } };
}


