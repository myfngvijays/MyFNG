/**
 * Telecaller → customer WhatsApp pricing (ONE session text message, no View plans).
 *
 * Rules:
 * - Specific plan(s) selected → those tiers; Periodic expands Semi + Fully (same points, both prices)
 * - Only category selected (Periodic / AC / …) → send ALL plans in that category
 */

import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { getServicePlansByPincode } from '@/lib/chatbot_v2/database-queries';
import {
  formatTelecallerPricingWhatsApp,
  getOilTypeForPlan,
  getPlanTierLabel,
  isPeriodicPricing,
  type PricingPlanItem,
} from '@/lib/whatsappBotFlow/periodicPlansUi';
import { getPeriodicChecklistFallback } from '@/lib/services/periodicChecklistFallbacks';
import { normalizePhoneNumber } from '@/lib/services/whatsappService';
import { sendAgentTextMessage } from '@/lib/whatsappAgents/shared/outbound';
import { parseServiceIdList } from '@/lib/telecaller/crmQuote';

const TIER_POINTS: Record<string, number> = {
  Basic: 15,
  General: 30,
  Premium: 50,
  Platinum: 60,
};

function isPlanError(row: any): boolean {
  return Boolean(row && typeof row === 'object' && row.error);
}

function asPlans(rows: any[]): PricingPlanItem[] {
  return (rows || [])
    .filter((r) => r && !isPlanError(r) && Number(r.min_price || r.max_price || 0) > 0)
    .map((r) => {
      const service_name = String(r.service_name || '');
      const tier = getPlanTierLabel(service_name);
      const points =
        typeof r.points === 'number' && r.points > 0
          ? r.points
          : TIER_POINTS[tier] || null;
      return {
        service_name,
        min_price: Number(r.min_price || 0),
        max_price: Number(r.max_price || r.min_price || 0),
        description: r.description != null ? String(r.description) : null,
        service_type_id: r.service_type_id != null ? String(r.service_type_id) : null,
        points,
      };
    });
}

function truncateForWhatsApp(text: string, max = 4000): string {
  const t = String(text || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 20)}\n…(truncated)`;
}

function isPeriodicCategoryName(name: string): boolean {
  return /periodic/i.test(String(name || ''));
}

const PERIODIC_TIERS = new Set(['Basic', 'General', 'Premium', 'Platinum']);

/**
 * If telecaller selects Basic (Semi), also include Basic (Fully) — same points, different price.
 * Same for General / Premium / Platinum.
 */
function expandPeriodicSelectionToBothOilTypes(
  allPlans: PricingPlanItem[],
  selectedIds: string[],
): PricingPlanItem[] {
  const idSet = new Set(selectedIds.map(String));
  const selected = allPlans.filter((p) => p.service_type_id && idSet.has(String(p.service_type_id)));
  if (!selected.length) return [];

  const tiers = new Set(
    selected
      .map((p) => getPlanTierLabel(p.service_name))
      .filter((t) => PERIODIC_TIERS.has(t)),
  );

  // Non-periodic / unknown tier → keep exact selected ids only
  if (!tiers.size) return selected;

  const byTier = allPlans.filter((p) => PERIODIC_TIERS.has(getPlanTierLabel(p.service_name)) && tiers.has(getPlanTierLabel(p.service_name)));

  // Prefer both oil types when available; keep stable Semi then Fully order
  const oilRank = (p: PricingPlanItem) => {
    const oil = getOilTypeForPlan(p);
    if (oil === 'semi') return 0;
    if (oil === 'full') return 1;
    return 2;
  };
  const tierRank = (p: PricingPlanItem) => {
    const t = getPlanTierLabel(p.service_name);
    if (t === 'Basic') return 15;
    if (t === 'General') return 30;
    if (t === 'Premium') return 50;
    if (t === 'Platinum') return 60;
    return 99;
  };

  return [...byTier].sort((a, b) => tierRank(a) - tierRank(b) || oilRank(a) - oilRank(b));
}

/** Map booking_type / chip labels → category names used by pricing DB */
export function normalizePricingCategories(raw: string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const c of raw || []) {
    const s = String(c || '').trim();
    if (!s) continue;
    const u = s.toUpperCase();
    if (u === 'PERIODIC' || /periodic/i.test(s)) out.push('Car Periodic Service');
    else if (u === 'OTHER_SERVICES' || /other/i.test(s)) {
      /* skip generic — need explicit category chips for others */
      continue;
    } else if (u === 'RSA') continue;
    else if (u === 'MEMBERSHIP') continue;
    else if (/^car\s+/i.test(s) || /service/i.test(s)) out.push(s);
    else out.push(s.startsWith('Car ') ? s : s);
  }
  return Array.from(new Set(out));
}

/**
 * Infer WhatsApp pricing categories from lead meta / labels when chips were never saved.
 * Telecaller default: Periodic (all 4 tiers) when nothing else is set.
 */
export function inferPricingCategoriesFromLead(input: {
  pricingCategories?: string[] | null;
  bookingType?: string | null;
  packageLabel?: string | null;
  interestLabel?: string | null;
  serviceType?: string | null;
  /** When true and nothing matches → Car Periodic Service */
  defaultPeriodic?: boolean;
}): string[] {
  const fromChips = normalizePricingCategories(input.pricingCategories || []);
  if (fromChips.length) return fromChips;

  const hints = [
    input.bookingType,
    input.packageLabel,
    input.interestLabel,
    input.serviceType,
  ]
    .map((s) => String(s || '').trim())
    .filter(Boolean);

  for (const hint of hints) {
    const u = hint.toUpperCase();
    if (u.includes('PERIODIC') || /periodic/i.test(hint)) return ['Car Periodic Service'];
    if (u.includes('AC') && !u.includes('PACKAGE')) return ['Car AC Service'];
    if (u.includes('BATTERY')) return ['Car Battery Service'];
    if (u.includes('BRAKE')) return ['Car Brake Service'];
    if (u.includes('CLUTCH')) return ['Car Clutch Service'];
    if (u.includes('DENT')) return ['Car Denting & Painting'];
    if (u.includes('DETAIL')) return ['Car Detailing Service'];
    if (u.includes('ENGINE')) return ['Car Engine Service'];
    if (u.includes('TYRE') || u.includes('WHEEL')) return ['Car Tyre & Wheel Care'];
    if (u.includes('SUSPENSION') || u.includes('STEERING')) {
      return ['Suspension & Steering Service'];
    }
    if (u.includes('ELECTRICAL')) return ['Electrical & Battery Service'];
  }

  if (input.defaultPeriodic !== false) return ['Car Periodic Service'];
  return [];
}

/** Resolve unique category display names from selected service_type ids. */
export async function resolveCategoriesFromServiceIds(
  serviceTypeIds: string[],
): Promise<string[]> {
  const ids = parseServiceIdList(serviceTypeIds);
  if (!ids.length) return [];

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return [];

  const { data: services } = await supabaseAdmin
    .from('service_types')
    .select('id, category_uuid')
    .in('id', ids);

  const catUuids = Array.from(
    new Set(
      (services || [])
        .map((s: any) => String(s.category_uuid || '').trim())
        .filter(Boolean),
    ),
  );
  if (!catUuids.length) return [];

  const { data: cats } = await supabaseAdmin
    .from('categories')
    .select('uuid, category')
    .in('uuid', catUuids);

  const names = (cats || [])
    .map((c: any) => String(c.category || '').trim())
    .filter(Boolean);

  return Array.from(new Set(names));
}

export type SendLeadPricingResult = {
  sent: boolean;
  phone: string | null;
  carModel: string | null;
  pincode: string | null;
  categories: string[];
  periodicCount: number;
  otherCategoryCount: number;
  messagesSent: number;
  mode?: 'plans' | 'category';
  error?: string;
  details?: string[];
};

export async function sendLeadPricingWhatsApp(input: {
  phone: string;
  pincode: string;
  carModel: string;
  customerName?: string | null;
  leadId?: string | null;
  leadNumber?: string | null;
  /** Specific plan UUIDs — if set, ONLY these plans are sent */
  serviceTypeIds?: string[] | null;
  /** Category names (e.g. ["Car Periodic Service"]) — all plans when no specific ids */
  categories?: string[] | null;
}): Promise<SendLeadPricingResult> {
  const phone = normalizePhoneNumber(input.phone);
  const pincode = String(input.pincode || '').replace(/\D/g, '').slice(0, 6);
  const carModel = String(input.carModel || '').trim();
  const selectedIds = parseServiceIdList(input.serviceTypeIds);

  const empty = (error: string, extra?: Partial<SendLeadPricingResult>): SendLeadPricingResult => ({
    sent: false,
    phone: phone || null,
    carModel: carModel || null,
    pincode,
    categories: [],
    periodicCount: 0,
    otherCategoryCount: 0,
    messagesSent: 0,
    error,
    ...extra,
  });

  if (!phone) return empty('missing_phone', { phone: null });
  if (!/^\d{6}$/.test(pincode)) return empty('pincode_required');
  if (!carModel) return empty('car_model_required', { carModel: null });

  let categories = normalizePricingCategories(
    Array.isArray(input.categories) ? input.categories : [],
  );

  if (!categories.length && selectedIds.length) {
    categories = await resolveCategoriesFromServiceIds(selectedIds);
  }

  if (!categories.length && !selectedIds.length) {
    return empty('services_required', {
      details: [
        'Select a category (Periodic / AC / …) or a specific plan (Basic / General / …) before sending pricing.',
      ],
    });
  }

  // If only plan ids and category resolve failed, still try loading via ids later
  if (!categories.length && selectedIds.length) {
    categories = ['Selected services'];
  }

  const details: string[] = [];
  let periodicCount = 0;
  let otherCategoryCount = 0;
  const blocks: Array<{ category: string; plans: PricingPlanItem[] }> = [];
  const mode: 'plans' | 'category' = selectedIds.length > 0 ? 'plans' : 'category';

  for (const category of categories) {
    let raw: any[] = [];
    if (category === 'Selected services') {
      // Will filter from empty — skip fetch by name
      continue;
    }
    try {
      raw = (await getServicePlansByPincode({ category, carModel, pincode })) as any[];
    } catch {
      continue;
    }
    if (raw?.[0] && isPlanError(raw[0])) {
      details.push(`${category}: ${raw[0].error}`);
      continue;
    }
    let plans = asPlans(raw);
    if (!plans.length) {
      details.push(`${category}: no_prices`);
      continue;
    }

    // Specific plan(s) selected → those tiers; for Periodic expand Semi+Fully (same points)
    if (selectedIds.length) {
      const isPeriodicCat = isPeriodicCategoryName(category) || isPeriodicPricing(plans);
      const filtered = isPeriodicCat
        ? expandPeriodicSelectionToBothOilTypes(plans, selectedIds)
        : plans.filter((p) => p.service_type_id && selectedIds.includes(String(p.service_type_id)));
      if (!filtered.length) {
        details.push(`${category}: selected_plans_not_in_category`);
        continue;
      }
      plans = filtered;
    }

    const isPeriodic = isPeriodicCategoryName(category) || isPeriodicPricing(plans);
    if (isPeriodic) periodicCount += plans.length;
    else otherCategoryCount += 1;

    blocks.push({ category, plans });
  }

  // Fallback: selected ids but category loop found nothing — fetch all cats of those ids again
  if (!blocks.length && selectedIds.length) {
    const cats = await resolveCategoriesFromServiceIds(selectedIds);
    for (const category of cats) {
      let raw: any[] = [];
      try {
        raw = (await getServicePlansByPincode({ category, carModel, pincode })) as any[];
      } catch {
        continue;
      }
      const all = asPlans(raw);
      const isPeriodicCat = isPeriodicCategoryName(category) || isPeriodicPricing(all);
      const plans = isPeriodicCat
        ? expandPeriodicSelectionToBothOilTypes(all, selectedIds)
        : all.filter((p) => p.service_type_id && selectedIds.includes(String(p.service_type_id)));
      if (!plans.length) continue;
      blocks.push({ category, plans });
      if (isPeriodicCat) {
        periodicCount += plans.length;
      } else {
        otherCategoryCount += 1;
      }
    }
    categories = cats.length ? cats : categories;
  }

  if (!blocks.length) {
    return empty('no_pricing_for_selection', {
      categories,
      mode,
      details: [
        ...details,
        selectedIds.length
          ? 'Selected plan(s) not found for this pincode/model. Check selection.'
          : 'No prices found for this category + pincode/model.',
      ],
    });
  }

  // Periodic → nested master checklist so Basic→General→Premium→Platinum
  // shows full points on lowest tier, then only ADDITIONAL points (16–30, 31–50, 51–60)
  const hasPeriodicBlock = blocks.some(
    (b) => isPeriodicCategoryName(b.category) || isPeriodicPricing(b.plans),
  );
  for (const block of blocks) {
    const isPeriodicBlock =
      isPeriodicCategoryName(block.category) || isPeriodicPricing(block.plans);
    if (!isPeriodicBlock && mode !== 'plans') continue;
    block.plans = block.plans.map((plan) => {
      const tier = getPlanTierLabel(plan.service_name);
      const fallback = getPeriodicChecklistFallback({
        points: plan.points,
        tier,
        serviceName: plan.service_name,
      });
      if (isPeriodicBlock && fallback?.items?.length) {
        return {
          ...plan,
          points: fallback.points,
          checklist_items: fallback.items,
        };
      }
      if (Array.isArray(plan.checklist_items) && plan.checklist_items.length) {
        return plan;
      }
      if (!fallback?.items?.length) return plan;
      return {
        ...plan,
        points: fallback.points || plan.points,
        checklist_items: fallback.items,
      };
    });
  }

  // Label services line: category, or category + plan names when filtered
  const serviceLabelParts: string[] = [];
  for (const block of blocks) {
    if (mode === 'plans' && block.plans.length <= 3) {
      const planLabels = block.plans.map((p) => {
        const tier = getPlanTierLabel(p.service_name);
        const pts = p.points ? `${p.points} pts` : null;
        return [tier || p.service_name, pts].filter(Boolean).join(' · ');
      });
      serviceLabelParts.push(`${block.category} (${planLabels.join(', ')})`);
    } else {
      serviceLabelParts.push(block.category);
    }
  }

  const bodyText = truncateForWhatsApp(
    formatTelecallerPricingWhatsApp({
      customerName: input.customerName,
      carModel,
      pincode,
      categories: serviceLabelParts.length ? serviceLabelParts : categories,
      blocks,
      // Periodic (all 4 tiers or selected) → prices + points checklist template
      includePointChecklists: mode === 'plans' || hasPeriodicBlock,
    }),
  );

  const textRes = await sendAgentTextMessage({
    phone,
    message: bodyText,
    source: 'telecaller_send_pricing',
    meta: {
      lead_id: input.leadId || null,
      lead_number: input.leadNumber || null,
      kind: 'pricing_text',
      mode,
      categories,
      service_type_ids: selectedIds,
    },
  });

  if (!textRes.success) {
    return empty(textRes.error || 'whatsapp_send_failed', {
      categories,
      mode,
      details: [
        'WhatsApp session message failed. Customer must have messaged you within 24h (no template used).',
        textRes.error || '',
        ...details,
      ],
    });
  }

  return {
    sent: true,
    phone,
    carModel,
    pincode,
    categories,
    periodicCount,
    otherCategoryCount,
    messagesSent: 1,
    mode,
    details: ['pricing_text', mode],
  };
}
