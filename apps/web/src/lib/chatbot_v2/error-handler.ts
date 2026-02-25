import { NextResponse } from 'next/server';

/**
 * Custom error class for chatbot-specific errors
 */
export class ChatbotError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage: string,
    public statusCode: number = 200 // Don't break the chat UI
  ) {
    super(message);
    this.name = 'ChatbotError';
  }
}

/**
 * Fallback responses for different error types
 */
export const FALLBACK_RESPONSES = {
  openai_error: "I'm having trouble understanding right now. Could you rephrase that?",
  database_error: "I'm having trouble accessing our data. Please try again in a moment.",
  timeout: 'This is taking longer than expected. Please try again.',
  validation_error: "I didn't quite get that. Could you provide more details?",
  rate_limit: "You're sending messages too quickly. Please wait a moment.",
  unknown:
    "I'm having trouble processing your request right now. Please contact our support team at **+91 91523 07030** for immediate assistance.",
};

/**
 * Handle errors gracefully and return appropriate responses
 */
export function handleChatError(error: unknown, sessionId: string): NextResponse {
  console.error('[ERROR]', error);

  // Handle known ChatbotError
  if (error instanceof ChatbotError) {
    return NextResponse.json(
      {
        type: 'answer',
        conversationId: sessionId,
        session_id: sessionId,
        assistantMessage: error.userMessage,
        message: error.userMessage,
        response: error.userMessage,
        contextPatch: { conversationId: sessionId },
        data: { conversationId: sessionId, contextPatch: { conversationId: sessionId } },
        sources: [],
        error: error.code,
      },
      { status: error.statusCode }
    );
  }

  // Handle OpenAI errors
  if (error instanceof Error && error.message.includes('OpenAI')) {
    return NextResponse.json({
      type: 'answer',
      conversationId: sessionId,
      session_id: sessionId,
      assistantMessage: FALLBACK_RESPONSES.openai_error,
      message: FALLBACK_RESPONSES.openai_error,
      response: FALLBACK_RESPONSES.openai_error,
      contextPatch: { conversationId: sessionId },
      data: { conversationId: sessionId, contextPatch: { conversationId: sessionId } },
      sources: [],
      error: 'openai_error',
    });
  }

  // Handle database errors
  if (error instanceof Error && (error.message.includes('Supabase') || error.message.includes('database'))) {
    return NextResponse.json({
      type: 'answer',
      conversationId: sessionId,
      session_id: sessionId,
      assistantMessage: FALLBACK_RESPONSES.database_error,
      message: FALLBACK_RESPONSES.database_error,
      response: FALLBACK_RESPONSES.database_error,
      contextPatch: { conversationId: sessionId },
      data: { conversationId: sessionId, contextPatch: { conversationId: sessionId } },
      sources: [],
      error: 'database_error',
    });
  }

  // Handle timeout errors
  if (error instanceof Error && error.message.includes('timeout')) {
    return NextResponse.json({
      type: 'answer',
      conversationId: sessionId,
      session_id: sessionId,
      assistantMessage: FALLBACK_RESPONSES.timeout,
      message: FALLBACK_RESPONSES.timeout,
      response: FALLBACK_RESPONSES.timeout,
      contextPatch: { conversationId: sessionId },
      data: { conversationId: sessionId, contextPatch: { conversationId: sessionId } },
      sources: [],
      error: 'timeout',
    });
  }

  // Unknown error - use generic fallback
  return NextResponse.json({
    type: 'answer',
    conversationId: sessionId,
    session_id: sessionId,
    assistantMessage: FALLBACK_RESPONSES.unknown,
    message: FALLBACK_RESPONSES.unknown,
    response: FALLBACK_RESPONSES.unknown,
    contextPatch: { conversationId: sessionId },
    data: { conversationId: sessionId, contextPatch: { conversationId: sessionId } },
    sources: [],
    error: 'unknown',
  });
}

/**
 * Async wrapper with error handling
 */
export async function withErrorHandling<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error('[ERROR] Operation failed, using fallback:', error);
    return fallback;
  }
}

/**
 * Log errors with context
 */
export function logError(operation: string, error: unknown, context?: Record<string, any>) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(`[ERROR] ${operation} failed:`, {
    message: errorMessage,
    stack: errorStack,
    ...context,
    timestamp: new Date().toISOString(),
  });
}
