import { NextRequest, NextResponse } from 'next/server';
import { getSession, saveSession } from '@/lib/chatbot_v2/session';
import { logChatActivity } from '@/lib/chatbot_v2/telecrm';
import { handleChatError } from '@/lib/chatbot_v2/error-handler';
import { CHATBOT_TOOLS, executeToolCall } from '@/lib/chatbot_v2/chatbot-tools';
import { SYSTEM_PROMPT } from '@/lib/chatbot_v2/chatbot-system-prompt';

export const dynamic = 'force-dynamic';

type V2Request = {
  message?: string;
  context?: Record<string, any>;
  session_id?: string;
};

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

async function createCompletion(messages: ChatMessage[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages,
      tools: CHATBOT_TOOLS,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`OpenAI completion failed (${res.status}): ${txt.slice(0, 300)}`);
  }

  const data = (await res.json()) as any;
  return data?.choices?.[0]?.message as ChatMessage | undefined;
}

function getSessionId(body: V2Request) {
  const fromContext = String(body?.context?.conversationId || '').trim();
  if (fromContext) return fromContext;
  const fromBody = String(body?.session_id || '').trim();
  if (fromBody) return fromBody;
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as V2Request | null;
  const message = String(body?.message || '').trim();
  const sessionId = getSessionId(body || {});

  if (!message) {
    return NextResponse.json(
      {
        type: 'answer',
        message: 'Message missing hai.',
        cta: 'Aapko kis cheez me help chahiye?',
        assistantMessage: 'Message missing hai.',
        data: { contextPatch: { conversationId: sessionId } },
      },
      { status: 400 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        type: 'answer',
        message: 'Chatbot temporarily unavailable.',
        cta: 'Please try again shortly.',
        assistantMessage: 'Chatbot temporarily unavailable.',
        data: { contextPatch: { conversationId: sessionId } },
      },
      { status: 503 }
    );
  }

  try {
    const sessionData = await getSession(sessionId);
    const history = Array.isArray(sessionData.history) ? sessionData.history : [];

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: String(msg.content || ''),
      })),
      { role: 'user', content: message },
    ];

    let assistantMessage = await createCompletion(messages);
    let toolCalls = assistantMessage?.tool_calls || [];
    let finalResponse = String(assistantMessage?.content || '').trim();

    let iteration = 0;
    const maxIterations = 5;

    while (toolCalls.length > 0 && iteration < maxIterations) {
      iteration += 1;
      messages.push({
        role: 'assistant',
        content: String(assistantMessage?.content || ''),
        tool_calls: toolCalls,
      });

      for (const toolCall of toolCalls) {
        if (toolCall.type && toolCall.type !== 'function') continue;
        if (!toolCall.function?.name) continue;

        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
        if (toolName === 'create_booking') toolArgs.session_id = sessionId;

        const toolResult = await executeToolCall(toolName, toolArgs);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }

      assistantMessage = await createCompletion(messages);
      toolCalls = assistantMessage?.tool_calls || [];
      finalResponse = String(assistantMessage?.content || '').trim();
    }

    if (!finalResponse) {
      finalResponse = "I'm here to help! Could you please rephrase your question?";
    }

    const nextHistory = [...history, { role: 'user', content: message }, { role: 'assistant', content: finalResponse }].slice(-20);
    await saveSession(sessionId, { history: nextHistory });

    void logChatActivity(sessionId, message, 'user');
    void logChatActivity(sessionId, finalResponse, 'bot');

    return NextResponse.json({
      type: 'answer',
      intent: 'llm_managed',
      message: finalResponse,
      cta: '',
      assistantMessage: finalResponse,
      session_id: sessionId,
      data: {
        contextPatch: {
          conversationId: sessionId,
        },
      },
    });
  } catch (error) {
    return handleChatError(error, sessionId);
  }
}
