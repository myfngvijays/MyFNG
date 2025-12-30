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
import { pickUserLang, rewritePreservingFacts } from '@/lib/chatbot_v2/reply/language';
import { routeMessage } from '@/lib/chatbot_v2/router';
import { answerFromFaqOrKb } from '@/lib/chatbot_v2/kb/retriever';
import { runToolCallingAgent } from '@/lib/chatbot_v2/agent/agent';

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

  // KB-first fast path for informational questions (stable + avoids agent/tool costs).
  // IMPORTANT: if KB returns an answer, return it directly with empty CTA.
  const kbEligible =
    intent.intent === 'GeneralInfo' ||
    intent.intent === 'WarrantySupport' ||
    intent.intent === 'RepairIssue' ||
    intent.intent === 'CleaningDetailing';
  if (kbEligible) {
    const raw = await answerFromFaqOrKb({ userText, lang });
    if (raw) {
      const answer = await rewritePreservingFacts({ userText, answerFacts: raw, lang });
      const out: ChatbotV2Response = {
        type: 'answer',
        message: answer,
        cta: '',
        data: {
          conversationId,
          intent,
          // Persist extractedPatch so frontend retains memory; no server patch on KB fast path.
          contextPatch: {
            ...extractedPatch,
            conversationId,
            lastKbQuery: userText.slice(0, 200),
            lastKbAnswerFacts: raw.slice(0, 1200),
            lastKbAt: Date.now(),
          },
          lang,
        },
      };
      return NextResponse.json(out);
    }
  }

  // Flow override: if user is already in booking/pricing flow, keep routing consistent.
  // Only override when current message is ambiguous (GeneralInfo). If user explicitly asks booking/pricing,
  // respect the classifier result so the user can switch flows.
  const looksLikeYesNo = /^(yes|haan|ha|sahi|correct|ok|okay|bilkul|no|nahi|nahin|change|galat|wrong)\b/i.test(userText.trim());
  const looksLikeBookingStep =
    looksLikeYesNo ||
    /([6-9]\d{9})/.test(userText.replace(/\D/g, '')) || // phone
    /\b([A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{3,4})\b/i.test(userText) || // vehicle number
    /(pickup|self\s*visit|self\s*drop|walk\s*in)/i.test(userText) ||
    /\b(tata|maruti|suzuki|hyundai|mahindra|honda|toyota|kia|mg|renault|nissan|ford|skoda|volkswagen|vw|bmw|audi|mercedes)\b/i.test(
      userText
    ); // model line
  const looksLikePricingStep =
    looksLikeBookingStep || /(price|cost|charges|rate|kitna|fees|estimate|quotation|quote|periodic|service)/i.test(userText);

  // IMPORTANT: do NOT hijack informational KB questions into booking/pricing.
  if (context.flow === 'BOOKING' && intent.intent === 'GeneralInfo' && looksLikeBookingStep) {
    intent = { ...intent, intent: 'BookingRequest', confidence: Math.max(intent.confidence, 0.75) };
  }
  if (context.flow === 'PRICING' && intent.intent === 'GeneralInfo' && looksLikePricingStep) {
    intent = { ...intent, intent: 'PriceEnquiry', confidence: Math.max(intent.confidence, 0.75) };
  }
  // Workshop flow: if we just asked for area/city/pincode, treat the next location-like message as WorkshopLocation.
  const looksLikeLocationReply =
    /^\d{6}$/.test(userText.replace(/\D/g, '')) ||
    (/^[a-zA-Z\u0900-\u097F\s]{3,40}$/.test(userText.trim()) && !/\b(price|cost|book|booking|repair|clean|service)\b/i.test(userText));
  if (context.flow === 'WORKSHOP' && intent.intent === 'GeneralInfo' && looksLikeLocationReply) {
    intent = { ...intent, intent: 'WorkshopLocation', confidence: Math.max(intent.confidence, 0.75) };
  }
  const missing = detectMissingInfo(context);

  // Agent gate (min-cost): use agent primarily for actionable flows.
  // If agent fails or returns invalid output, fall back to deterministic router.
  const isValidLatLng = (lat: unknown, lng: unknown) => {
    const la = Number(lat);
    const lo = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;
    if (Math.abs(la) > 90 || Math.abs(lo) > 180) return false;
    if (Math.abs(la) < 0.0001 && Math.abs(lo) < 0.0001) return false;
    return true;
  };
  const canUseWorkshopAgent = isValidLatLng(context.locationLat, context.locationLng);

  const agentEligible =
    intent.intent === 'PriceEnquiry' ||
    intent.intent === 'PeriodicService' ||
    // Keep WorkshopLocation deterministic for stable UI (carousel) and to avoid odd location/tool behavior.
    intent.intent === 'BookingRequest';
  if (agentEligible) {
    const agent = await runToolCallingAgent({ userText, lang, context, intent });
    if (agent) {
      const out: ChatbotV2Response = {
        type: agent.response.type,
        message: agent.response.message,
        cta: agent.response.cta,
        data: {
          ...agent.response.data,
          conversationId,
          intent,
          contextPatch: { ...extractedPatch, ...agent.contextPatch, conversationId },
          lang,
          agent: agent.meta,
        },
      };
      return NextResponse.json(out);
    }
  }

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

  // UI payload (optional): lift to top-level for frontend convenience
  const ui = (out.data as any)?.ui;
  if (ui) {
    const withUi: any = { ...out, ui };
    return NextResponse.json(withUi);
  }
  return NextResponse.json(out);
}


