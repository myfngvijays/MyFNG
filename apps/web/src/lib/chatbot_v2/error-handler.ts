import { NextResponse } from 'next/server';

export function logError(operation: string, error: unknown, context?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(`[CHATBOT] ${operation} failed`, { message, stack, ...(context || {}) });
}

export function handleChatError(error: unknown, sessionId: string) {
  logError('chat request', error, { sessionId });
  return NextResponse.json(
    {
      session_id: sessionId,
      response:
        "I apologize, but I'm having trouble processing your request right now. Please try again or contact our team at +91 91523 07030.",
      sources: [],
      error: true,
    },
    { status: 500 }
  );
}
