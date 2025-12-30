import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import type { ChatbotV2Context, PricingHit, UserLang, WorkshopHit } from '../types';
import { answerFromFaqOrKb } from '../kb/retriever';
import { fetchNearestWorkshops, fetchPeriodicServicePricing, createServiceLead, createBookingTokenPaymentLink } from '../db/supabase';
import { rewritePreservingFacts } from '../reply/language';

function safeText(s: unknown, max = 400) {
  return String(s ?? '')
    .replace(/\r/g, '')
    .trim()
    .slice(0, max);
}

export type AgentToolResult =
  | { ok: true; kind: 'kb'; answer: string }
  | { ok: true; kind: 'pricing'; items: PricingHit[] }
  | { ok: true; kind: 'workshops'; radiusKm: number; workshops: WorkshopHit[] }
  | { ok: true; kind: 'lead'; leadId: string; leadNumber: string }
  | { ok: true; kind: 'payment'; invoiceId: string; invoiceNumber: string; paymentLink: string }
  | { ok: false; error: string };

export function buildChatbotTools(params: { lang: UserLang; context: ChatbotV2Context }) {
  const { lang } = params;

  const kbAnswerTool = new DynamicStructuredTool({
    name: 'kb_answer',
    description:
      'Use this ONLY for general informational questions about MY FNG (FAQ-style). Input should be the user question. Returns a short factual answer.',
    schema: z.object({ query: z.string().min(1).max(500) }),
    func: async ({ query }) => {
      try {
        const raw = await answerFromFaqOrKb({ userText: query, lang });
        if (!raw) return JSON.stringify({ ok: false, error: 'No KB answer found.' } satisfies AgentToolResult);
        const rewritten = await rewritePreservingFacts({ userText: query, answerFacts: raw, lang });
        return JSON.stringify({ ok: true, kind: 'kb', answer: safeText(rewritten, 700) } satisfies AgentToolResult);
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: safeText(e?.message || 'KB error') } satisfies AgentToolResult);
      }
    },
  });

  const pricingTool = new DynamicStructuredTool({
    name: 'get_pricing',
    description: 'Fetch periodic service pricing packages. Use this when user asks price/cost.',
    schema: z.object({}),
    func: async () => {
      try {
        const items = await fetchPeriodicServicePricing();
        return JSON.stringify({ ok: true, kind: 'pricing', items } satisfies AgentToolResult);
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: safeText(e?.message || 'Pricing error') } satisfies AgentToolResult);
      }
    },
  });

  const nearestWorkshopsTool = new DynamicStructuredTool({
    name: 'get_nearest_workshops',
    description:
      'Find nearest verified workshops using lat/lng. Use ONLY when user explicitly asks nearest/nearby workshop/location.',
    schema: z.object({
      lat: z.number(),
      lng: z.number(),
    }),
    func: async ({ lat, lng }) => {
      try {
        const { radiusKm, workshops } = await fetchNearestWorkshops({ lat, lng, radiiKm: [15, 50, 100, 200], limit: 5 });
        return JSON.stringify({ ok: true, kind: 'workshops', radiusKm, workshops } satisfies AgentToolResult);
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: safeText(e?.message || 'Workshops error') } satisfies AgentToolResult);
      }
    },
  });

  const createLeadTool = new DynamicStructuredTool({
    name: 'create_lead',
    description:
      'Create a booking lead in DB. Only call when you already have phone + vehicle number + pickup preference + location label/address.',
    schema: z.object({
      customerName: z.string().max(80).optional(),
      customerPhone: z.string().min(10).max(14),
      vehicleNumber: z.string().min(6).max(16),
      vehicleModel: z.string().max(60).nullable().optional(),
      pickupRequired: z.boolean(),
      addressText: z.string().max(160).nullable().optional(),
      lat: z.number().nullable().optional(),
      lng: z.number().nullable().optional(),
      problemDescription: z.string().max(240).nullable().optional(),
      serviceTypeLabel: z.string().max(80),
    }),
    func: async (input) => {
      try {
        const lead = await createServiceLead({
          customerName: input.customerName || 'Customer',
          customerPhone: input.customerPhone,
          vehicleNumber: input.vehicleNumber,
          vehicleModel: input.vehicleModel ?? null,
          pickupRequired: Boolean(input.pickupRequired),
          addressText: input.addressText ?? null,
          lat: input.lat ?? null,
          lng: input.lng ?? null,
          problemDescription: input.problemDescription ?? null,
          serviceTypeLabel: input.serviceTypeLabel,
        });
        return JSON.stringify({ ok: true, kind: 'lead', leadId: lead.leadId, leadNumber: lead.leadNumber } satisfies AgentToolResult);
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: safeText(e?.message || 'Lead create error') } satisfies AgentToolResult);
      }
    },
  });

  const paymentLinkTool = new DynamicStructuredTool({
    name: 'create_payment_link',
    description: 'Create booking token payment link for an existing leadId.',
    schema: z.object({ leadId: z.string().min(1) }),
    func: async ({ leadId }) => {
      try {
        const p = await createBookingTokenPaymentLink(leadId);
        return JSON.stringify({ ok: true, kind: 'payment', ...p } satisfies AgentToolResult);
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: safeText(e?.message || 'Payment link error') } satisfies AgentToolResult);
      }
    },
  });

  return [kbAnswerTool, pricingTool, nearestWorkshopsTool, createLeadTool, paymentLinkTool];
}


