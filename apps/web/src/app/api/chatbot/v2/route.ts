import { NextResponse } from 'next/server';

import type { ChatbotV2Request, ChatbotV2Response } from '@/lib/chatbot_v2/types';
import { classifyIntent } from '@/lib/chatbot_v2/intent/classifier';
import {
  ensureConversationId,
  extractLikelyQuestion,
  extractContextPatchFromUserText,
  mergeContext,
  normalizeContext,
  detectMissingInfo,
} from '@/lib/chatbot_v2/memory/context';
import { pickUserLang } from '@/lib/chatbot_v2/reply/language';
import { routeMessage } from '@/lib/chatbot_v2/router';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as ChatbotV2Request | null;
  if (!body?.message || typeof body.message !== 'string') {
    const resp: ChatbotV2Response = {
      type: 'answer',
      message: 'Message missing hai.',
      cta: 'Aapko kis cheez me help chahiye?',
      data: {},
    };
    return NextResponse.json(resp, { status: 400 });
  }

  const rawMessage = body.message;
  const userText = extractLikelyQuestion(rawMessage);

  const baseCtx = normalizeContext(body.context || {});
  const conversationId = ensureConversationId(baseCtx);
  // Apply best-effort extraction from message (phone, vehicle number, pickup/self, etc.)
  const extractedPatch = extractContextPatchFromUserText(userText);
  const context = mergeContext(baseCtx, { conversationId, ...extractedPatch });

  const lang = pickUserLang(context, userText);
  let intent = await classifyIntent({ message: userText, context });

  // Flow override: if user is already in booking/pricing flow, keep routing consistent.
  // Only override when current message is ambiguous (GeneralInfo). If user explicitly asks booking/pricing,
  // respect the classifier result so the user can switch flows.
  if (context.flow === 'BOOKING' && intent.intent === 'GeneralInfo') {
    intent = { ...intent, intent: 'BookingRequest', confidence: Math.max(intent.confidence, 0.75) };
  }
  if (context.flow === 'PRICING' && intent.intent === 'GeneralInfo') {
    intent = { ...intent, intent: 'PriceEnquiry', confidence: Math.max(intent.confidence, 0.75) };
  }
  const missing = detectMissingInfo(context);

  const { response, contextPatch } = await routeMessage({ userText, lang, intent, context, missing });

  // Strict response format; context is returned inside data for the frontend to store.
  const out: ChatbotV2Response = {
    type: response.type,
    message: response.message,
    cta: response.cta,
    data: {
      ...response.data,
      conversationId,
      intent,
      // Persist extracted + server patches so frontend can keep state without re-asking.
      contextPatch: { ...extractedPatch, ...contextPatch, conversationId },
      lang,
    },
  };

  return NextResponse.json(out);
}


