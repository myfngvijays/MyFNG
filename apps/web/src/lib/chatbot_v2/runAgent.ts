import { CHATBOT_TOOLS, executeToolCall } from './chatbot-tools';
import { getSession, saveSession, type SessionData } from './session';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type?: string;
    function?: {
      name: string;
      arguments: string;
    };
  }>;
};

import type { MisaBookingChannel } from './misaLeadSource';

export type RunAgentOptions = {
  sessionId: string;
  message: string;
  systemPrompt: string;
  tools?: typeof CHATBOT_TOOLS;
  model?: string;
  maxIterations?: number;
  maxTokens?: number;
  persistSession?: boolean;
  bookingChannel?: MisaBookingChannel;
  dryRun?: boolean;
  channelPhone?: string;
};

export type RunAgentResult = {
  response: string;
  sessionData: SessionData;
  model: string;
  pricing?: Array<{
    service_name: string;
    min_price: number;
    max_price: number;
    description?: string | null;
  }>;
};

async function createCompletion(
  messages: ChatMessage[],
  model: string,
  tools: typeof CHATBOT_TOOLS,
  maxTokens: number,
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is missing');
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`OpenAI completion failed (${res.status}): ${txt.slice(0, 300)}`);
  }

  const data = (await res.json()) as any;
  return data?.choices?.[0]?.message as ChatMessage | undefined;
}

export async function runMisaAgent(opts: RunAgentOptions): Promise<RunAgentResult> {
  const {
    sessionId,
    message,
    systemPrompt,
    tools = CHATBOT_TOOLS,
    model = 'gpt-4o',
    maxIterations = 5,
    maxTokens = 1000,
    persistSession = true,
    bookingChannel,
    dryRun = false,
    channelPhone,
  } = opts;

  const sessionData = await getSession(sessionId);
  const history = sessionData.history || [];

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((msg: any) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: String(msg.content || ''),
    })),
    { role: 'user', content: message },
  ];

  let assistantMessage = await createCompletion(messages, model, tools, maxTokens);
  let toolCalls = assistantMessage?.tool_calls || [];
  let finalResponse = String(assistantMessage?.content || '');
  let pricing:
    | Array<{
        service_name: string;
        min_price: number;
        max_price: number;
        description?: string | null;
      }>
    | undefined;

  let iteration = 0;
  while (toolCalls.length > 0 && iteration < maxIterations) {
    iteration += 1;
    messages.push({
      role: 'assistant',
      content: String(assistantMessage?.content || ''),
      tool_calls: toolCalls,
    });

    for (const toolCall of toolCalls) {
      const toolName = toolCall?.function?.name;
      if (!toolName) continue;

      const toolArgs = JSON.parse(toolCall.function?.arguments || '{}');
      if (toolName === 'create_booking') {
        toolArgs.session_id = sessionId;
      }

      const toolResult = await executeToolCall(toolName, toolArgs, {
        bookingChannel,
        sessionId,
        sessionData,
        dryRun,
        channelPhone,
      });
      if (
        toolName === 'get_service_pricing' &&
        toolResult?.success &&
        Array.isArray(toolResult.pricing) &&
        toolResult.pricing.length > 0
      ) {
        pricing = toolResult.pricing;
      }
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult),
      });
    }

    assistantMessage = await createCompletion(messages, model, tools, maxTokens);
    toolCalls = assistantMessage?.tool_calls || [];
    finalResponse = String(assistantMessage?.content || '');
  }

  if (!finalResponse || finalResponse.trim() === '') {
    finalResponse = "I'm here to help! Could you please rephrase your question?";
  }

  history.push({ role: 'user', content: message });
  history.push({ role: 'assistant', content: finalResponse });
  sessionData.history = history.slice(-20);

  if (persistSession) {
    await saveSession(sessionId, sessionData);
  }

  return {
    response: finalResponse,
    sessionData,
    model,
    pricing,
  };
}
