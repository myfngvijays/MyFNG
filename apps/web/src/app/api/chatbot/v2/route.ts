import { NextRequest, NextResponse } from 'next/server';
import { logChatActivity } from '@/lib/chatbot_v2/telecrm';
import { handleChatError, logError } from '@/lib/chatbot_v2/error-handler';
import { runMisaAgent } from '@/lib/chatbot_v2/runAgent';
import { SYSTEM_PROMPT } from '@/lib/chatbot_v2/chatbot-system-prompt';

export const dynamic = 'force-dynamic';

type V2Request = {
  message?: string;
  context?: Record<string, any>;
  session_id?: string;
};

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
    const agent = await runMisaAgent({
      sessionId,
      message,
      systemPrompt: SYSTEM_PROMPT,
      model: 'gpt-4o',
    });
    const finalResponse = agent.response;

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
