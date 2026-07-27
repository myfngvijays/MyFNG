/**
 * When customer taps a plan in "View plans" list → auto-send that plan's points checklist
 * (15 / 30 / 50 / 60 points for periodic, and checklist for other services).
 */

import {
  TELECALLER_PRICING_LIST_PREFIX,
  findPlanByListReplyId,
  formatSelectedPlanPointsWhatsApp,
  getOilTypeForPlan,
  getPlanTierLabel,
  type PricingPlanItem,
} from '@/lib/whatsappBotFlow/periodicPlansUi';
import { getFlowSession } from '@/lib/whatsappBotFlow/sessionStore';
import { sendAgentTextMessage } from '@/lib/whatsappAgents/shared/outbound';
import { normalizePhoneNumber } from '@/lib/services/whatsappService';
import {
  normalizeChecklistItems,
  resolveServiceChecklist,
} from '@/lib/chatbot_v2/checklist-queries';
import { getPeriodicChecklistFallback } from '@/lib/services/periodicChecklistFallbacks';

export type PricingListReply = {
  id: string;
  title: string;
  description: string;
};

export function extractPricingPlanListReply(inbound: any): PricingListReply | null {
  const interactive = inbound?.interactive;
  if (!interactive || String(interactive.type || '').toLowerCase() !== 'list_reply') {
    return null;
  }
  const reply = interactive?.list_reply || {};
  const id = String(reply.id || '').trim();
  const title = String(reply.title || '').trim();
  const description = String(reply.description || '').trim();
  if (!id && !title) return null;

  const looksLikePricingId =
    id.startsWith(TELECALLER_PRICING_LIST_PREFIX) ||
    /^(semi|full|plan|svc)_\d+$/i.test(id);
  const looksLikePlanTitle = /^(basic|general|premium|platinum)\b/i.test(title);

  if (!looksLikePricingId && !looksLikePlanTitle) return null;

  return { id: id || `title:${title}`, title, description };
}

/** @deprecated use extractPricingPlanListReply */
export function extractPricingPlanListReplyId(inbound: any): string | null {
  return extractPricingPlanListReply(inbound)?.id || null;
}

function matchPlanFromSession(
  plans: PricingPlanItem[],
  reply: PricingListReply,
): PricingPlanItem | null {
  if (!plans.length) return null;

  const byId = reply.id ? findPlanByListReplyId(plans, reply.id) : null;
  if (byId) return byId;

  const blob = `${reply.title} ${reply.description}`.toLowerCase();
  const priceMatch = blob.match(/₹\s*([\d,]+)/);
  const price = priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : null;
  const ptsMatch = blob.match(/(\d+)\s*pts?/i);
  const pts = ptsMatch ? Number(ptsMatch[1]) : null;
  const title = reply.title.toLowerCase();

  const scored = plans
    .map((p) => {
      const tier = getPlanTierLabel(p.service_name).toLowerCase();
      const name = String(p.service_name || '').toLowerCase();
      let score = 0;
      if (title && (tier === title || name.includes(title.split(/\s+/)[0] || title))) score += 3;
      if (price != null && Math.round(Number(p.min_price || 0)) === price) score += 5;
      if (pts != null && Number(p.points) === pts) score += 4;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.p || null;
}

function parseReplyMeta(reply: PricingListReply) {
  const blob = `${reply.title} ${reply.description}`;
  const tierMatch = blob.match(/\b(basic|general|premium|platinum)\b/i);
  const ptsMatch = blob.match(/\b(15|30|50|60)\b/);
  const priceMatch = blob.match(/₹\s*([\d,]+)/);
  const tier = tierMatch ? tierMatch[1] : null;
  const points =
    ptsMatch
      ? Number(ptsMatch[1])
      : tier
        ? ({ basic: 15, general: 30, premium: 50, platinum: 60 } as Record<string, number>)[
            tier.toLowerCase()
          ] || null
        : null;
  const price = priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : 0;
  return { tier, points, price, blob };
}

export async function tryHandlePricingPlanListReply(input: {
  senderPhone: string;
  replyId?: string;
  reply?: PricingListReply | null;
}): Promise<boolean> {
  const phone = normalizePhoneNumber(input.senderPhone);
  const reply: PricingListReply = input.reply || {
    id: String(input.replyId || '').trim(),
    title: '',
    description: '',
  };
  if (!phone || (!reply.id && !reply.title)) return false;

  let plans: PricingPlanItem[] = [];
  try {
    const session = await getFlowSession(phone);
    const stored = (session?.variables as any)?.last_telecaller_pricing;
    if (Array.isArray(stored?.plans)) {
      plans = stored.plans as PricingPlanItem[];
    }
  } catch (e) {
    console.error('[pricing-plan-reply] session load failed', e);
  }

  const meta = parseReplyMeta(reply);
  let plan = matchPlanFromSession(plans, reply);

  // If session plan points conflict with selected pts (e.g. Basic vs Platinum), ignore session plan
  if (
    plan &&
    meta.points &&
    typeof plan.points === 'number' &&
    plan.points > 0 &&
    plan.points !== meta.points
  ) {
    plan = null;
  }

  const serviceTypeId =
    String(plan?.service_type_id || '').trim() ||
    (reply.id.startsWith(TELECALLER_PRICING_LIST_PREFIX) &&
    !/^(semi|full|plan|svc)_/i.test(reply.id.slice(TELECALLER_PRICING_LIST_PREFIX.length))
      ? reply.id.slice(TELECALLER_PRICING_LIST_PREFIX.length)
      : '');

  const tierFromPlan = plan ? getPlanTierLabel(plan.service_name) : null;
  const tierLabel = (meta.tier || tierFromPlan || '').replace(/^./, (c) => c.toUpperCase()) || null;
  const oil = plan ? getOilTypeForPlan(plan) : null;
  const oilHint = oil === 'semi' || oil === 'full' ? oil : null;
  const pointsHint = meta.points || (plan?.points != null ? Number(plan.points) : null);

  let checklist = await resolveServiceChecklist({
    serviceTypeId: serviceTypeId || null,
    serviceName: plan?.service_name || reply.title || tierLabel,
    tier: tierLabel,
    oil: oilHint,
    pointsHint,
  });

  // Force correct periodic fallback if still wrong/empty
  if (
    pointsHint &&
    (!checklist.items.length ||
      (checklist.points != null && checklist.points !== pointsHint) ||
      checklist.items.length !== pointsHint)
  ) {
    const fallback = getPeriodicChecklistFallback({
      points: pointsHint,
      tier: tierLabel,
      serviceName: reply.title,
    });
    if (fallback?.items?.length) {
      checklist = {
        items: fallback.items,
        points: fallback.points,
        serviceTypeId: checklist.serviceTypeId,
        serviceName: plan?.service_name || fallback.title,
        title: fallback.title,
      };
    }
  }

  console.log('[pricing-plan-reply]', {
    phone,
    replyId: reply.id,
    title: reply.title,
    description: reply.description,
    meta,
    serviceTypeId,
    tierLabel,
    pointsHint,
    checklistCount: checklist.items.length,
    checklistPoints: checklist.points,
    sessionPlans: plans.length,
  });

  const displayName =
    plan?.service_name ||
    (tierLabel
      ? `${tierLabel}${oilHint === 'full' ? ' - Fully Synthetic' : oilHint === 'semi' ? ' - Semi Synthetic' : ''}`
      : reply.title) ||
    'Service';

  const items = normalizeChecklistItems(checklist.items);
  const enriched: PricingPlanItem = {
    service_name: displayName,
    min_price: meta.price || Number(plan?.min_price || 0),
    max_price: Number(plan?.max_price || 0),
    description: plan?.description || null,
    service_type_id: checklist.serviceTypeId || plan?.service_type_id || serviceTypeId || null,
    checklist_items: items,
    points: checklist.points || pointsHint || items.length || null,
  };

  const message = formatSelectedPlanPointsWhatsApp(enriched);

  // WhatsApp text limit ~4096; Platinum 60 lines is fine. Still guard.
  const payload = message.length > 4000 ? `${message.slice(0, 3980)}\n…(truncated)` : message;

  const sendRes = await sendAgentTextMessage({
    phone,
    message: payload,
    source: 'telecaller_pricing_plan_points',
    meta: {
      kind: 'plan_points',
      reply_id: reply.id,
      service_type_id: enriched.service_type_id || null,
      service_name: enriched.service_name,
      points: enriched.points,
      checklist_count: items.length,
    },
  });

  if (!sendRes.success) {
    console.error('[pricing-plan-reply] send failed', sendRes.error, {
      messagePreview: payload.slice(0, 200),
      checklistCount: items.length,
    });
  }

  return Boolean(sendRes?.success);
}
