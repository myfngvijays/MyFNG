import { NextRequest, NextResponse } from 'next/server';
import { getSession, saveSession } from '@/lib/chatbot_v2/session';
import { logChatActivity } from '@/lib/chatbot_v2/telecrm';
import { handleChatError, logError } from '@/lib/chatbot_v2/error-handler';
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
  const fromBody = String(body?.session_id || '').trim();
  if (fromBody) return fromBody;

  const fromContext = String(body?.context?.conversationId || '').trim();
  if (fromContext) return fromContext;

  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as V2Request | null;
  const message = String(body?.message || '').trim();
  const sessionId = getSessionId(body || {});

  if (!sessionId || !message) {
    return NextResponse.json(
      {
        type: 'answer',
        intent: 'llm_managed',
        conversationId: sessionId,
        session_id: sessionId,
        response: 'Message missing hai.',
        message: 'Message missing hai.',
        assistantMessage: 'Message missing hai.',
        cta: 'Aapko kis cheez me help chahiye?',
        contextPatch: { conversationId: sessionId },
        data: { conversationId: sessionId, contextPatch: { conversationId: sessionId } },
      },
      { status: 400 }
    );
  }

  try {
    const sessionData = await getSession(sessionId);
    const history = sessionData.history || [];

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
    let finalResponse = String(assistantMessage?.content || '');

    const maxIterations = 5;
    let iteration = 0;

    while (toolCalls.length > 0 && iteration < maxIterations) {
      iteration++;
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

        const toolResult = await executeToolCall(toolName, toolArgs);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }

      assistantMessage = await createCompletion(messages);
      toolCalls = assistantMessage?.tool_calls || [];
      finalResponse = String(assistantMessage?.content || '');
    }

    if (!finalResponse || finalResponse.trim() === '') {
      finalResponse = "I'm here to help! Could you please rephrase your question?";
    }

    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: finalResponse });
    sessionData.history = history.slice(-20);
    await saveSession(sessionId, sessionData);

    void logChatActivity(sessionId, message, 'user').catch((err) => {
      logError('TeleCRM user message logging', err, { sessionId });
    });
    void logChatActivity(sessionId, finalResponse, 'bot').catch((err) => {
      logError('TeleCRM bot message logging', err, { sessionId });
    });

    return NextResponse.json({
      type: 'answer',
      conversationId: sessionId,
      session_id: sessionId,
      response: finalResponse,
      message: finalResponse,
      assistantMessage: finalResponse,
      cta: '',
      contextPatch: {
        conversationId: sessionId,
      },
      data: {
        conversationId: sessionId,
        contextPatch: {
          conversationId: sessionId,
        },
      },
      sources: [],
      intent: 'llm_managed',
    });
  } catch (error) {
    return handleChatError(error, sessionId);
  }
}
