/**
 * Time-limited public pricing share links: https://myfng.in/pricing/{slug}
 * (also available at /p/{slug} via rewrite)
 * Default TTL: 3 hours. Used by telecaller Send Pricing for all categories.
 */

import { randomBytes } from 'crypto';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { getServicePlansByPincode } from '@/lib/chatbot_v2/database-queries';
import { SITE_URL } from '@/lib/seo/metadata';
import {
  getPlanTierLabel,
  isPeriodicPricing,
  type PricingPlanItem,
} from '@/lib/whatsappBotFlow/periodicPlansUi';
import { getPeriodicChecklistFallback } from '@/lib/services/periodicChecklistFallbacks';
import { normalizePhoneNumber, sendTemplateMessage } from '@/lib/services/whatsappService';
import { sendAgentTextMessage } from '@/lib/whatsappAgents/shared/outbound';
import { parseServiceIdList } from '@/lib/telecaller/crmQuote';
import {
  expandPeriodicSelectionToBothOilTypes,
  normalizePricingCategories,
} from '@/lib/telecaller/sendLeadPricingWhatsApp';

const DEFAULT_TTL_HOURS = 3;
const SHARE_TEMPLATE = 'pricing_share_link';

const TIER_POINTS: Record<string, number> = {
  Basic: 15,
  General: 30,
  Premium: 50,
  Platinum: 60,
};

export type PricingShareLinkRow = {
  id: string;
  slug: string;
  lead_id?: string | null;
  lead_number?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  car_model: string;
  pincode: string;
  city?: string | null;
  categories: string[];
  service_type_ids: string[];
  expires_at: string;
  view_count?: number;
  created_at?: string;
  meta?: Record<string, unknown>;
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

function makeSlug(len = 10): string {
  return randomBytes(Math.ceil(len * 0.75))
    .toString('base64url')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, len)
    .toLowerCase();
}

export function pricingSharePublicUrl(slug: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || SITE_URL).replace(/\/$/, '');
  // Prefer /pricing/… (clearer path). /p/… still works via next.config rewrite.
  return `${base}/pricing/${String(slug || '').trim()}`;
}

function firstName(full: string | null | undefined): string {
  const t = String(full || '').trim();
  if (!t) return 'Customer';
  return t.split(/\s+/)[0] || 'Customer';
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v || '').trim()).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v || '').trim()).filter(Boolean);
    } catch {
      /* ignore */
    }
  }
  return [];
}

export async function createPricingShareLink(input: {
  leadId?: string | null;
  leadNumber?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  carModel: string;
  pincode: string;
  city?: string | null;
  categories: string[];
  serviceTypeIds?: string[] | null;
  createdBy?: string | null;
  ttlHours?: number;
}): Promise<{ row: PricingShareLinkRow; url: string } | { error: string }> {
  const carModel = String(input.carModel || '').trim();
  const pincode = String(input.pincode || '').replace(/\D/g, '').slice(0, 6);
  const categories = normalizePricingCategories(input.categories || []);
  const serviceTypeIds = parseServiceIdList(input.serviceTypeIds);

  if (!carModel) return { error: 'car_model_required' };
  if (!/^\d{6}$/.test(pincode)) return { error: 'pincode_required' };
  if (!categories.length && !serviceTypeIds.length) return { error: 'services_required' };

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { error: 'db_unavailable' };

  const ttl = Math.min(24, Math.max(1, Number(input.ttlHours || DEFAULT_TTL_HOURS) || DEFAULT_TTL_HOURS));
  const expiresAt = new Date(Date.now() + ttl * 60 * 60 * 1000).toISOString();

  let slug = makeSlug(10);
  for (let i = 0; i < 5; i++) {
    const { data: clash } = await supabaseAdmin
      .from('pricing_share_links')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!clash) break;
    slug = makeSlug(10);
  }

  const insert = {
    slug,
    lead_id: input.leadId || null,
    lead_number: input.leadNumber || null,
    customer_name: input.customerName || null,
    customer_phone: input.customerPhone ? normalizePhoneNumber(input.customerPhone) : null,
    car_model: carModel,
    pincode,
    city: input.city || null,
    categories: categories.length ? categories : ['Car Periodic Service'],
    service_type_ids: serviceTypeIds,
    expires_at: expiresAt,
    created_by: input.createdBy || null,
    meta: { ttl_hours: ttl, source: 'telecaller_send_pricing' },
  };

  const { data, error } = await supabaseAdmin
    .from('pricing_share_links')
    .insert([insert])
    .select('*')
    .single();

  if (error || !data) {
    console.error('[pricingShareLinks] insert failed', error?.message);
    return { error: error?.message || 'create_failed' };
  }

  const row: PricingShareLinkRow = {
    ...data,
    categories: parseJsonArray(data.categories),
    service_type_ids: parseJsonArray(data.service_type_ids),
  };

  return { row, url: pricingSharePublicUrl(row.slug) };
}

export async function getPricingShareLinkBySlug(
  slug: string,
): Promise<
  | { ok: true; row: PricingShareLinkRow; expired: boolean }
  | { ok: false; error: 'not_found' | 'db_unavailable' }
> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { ok: false, error: 'db_unavailable' };

  const code = String(slug || '').trim().toLowerCase();
  if (!code) return { ok: false, error: 'not_found' };

  const { data, error } = await supabaseAdmin
    .from('pricing_share_links')
    .select('*')
    .eq('slug', code)
    .maybeSingle();

  if (error || !data) return { ok: false, error: 'not_found' };

  const row: PricingShareLinkRow = {
    ...data,
    categories: parseJsonArray(data.categories),
    service_type_ids: parseJsonArray(data.service_type_ids),
  };

  const expired = new Date(row.expires_at).getTime() <= Date.now();

  if (!expired) {
    try {
      await supabaseAdmin
        .from('pricing_share_links')
        .update({
          view_count: Number(row.view_count || 0) + 1,
          last_viewed_at: new Date().toISOString(),
        })
        .eq('id', row.id);
    } catch {
      /* optional */
    }
  }

  return { ok: true, row, expired };
}

export type PricingShareBlock = {
  category: string;
  plans: PricingPlanItem[];
  isPeriodic: boolean;
};

/** Load live prices for a share link (same pricing engine as telecaller). */
export async function loadPricingForShareLink(
  row: PricingShareLinkRow,
): Promise<{ blocks: PricingShareBlock[]; error?: string }> {
  const categories = normalizePricingCategories(row.categories?.length ? row.categories : []);
  const selectedIds = parseServiceIdList(row.service_type_ids);
  const carModel = String(row.car_model || '').trim();
  const pincode = String(row.pincode || '').replace(/\D/g, '').slice(0, 6);
  const cats = categories.length ? categories : ['Car Periodic Service'];
  const blocks: PricingShareBlock[] = [];

  for (const category of cats) {
    let raw: any[] = [];
    try {
      raw = (await getServicePlansByPincode({ category, carModel, pincode })) as any[];
    } catch {
      continue;
    }
    if (raw?.[0] && isPlanError(raw[0])) continue;
    let plans = asPlans(raw);
    if (!plans.length) continue;

    const isPeriodic =
      /periodic/i.test(category) || isPeriodicPricing(plans);

    if (selectedIds.length) {
      plans = isPeriodic
        ? expandPeriodicSelectionToBothOilTypes(plans, selectedIds)
        : plans.filter((p) => p.service_type_id && selectedIds.includes(String(p.service_type_id)));
      if (!plans.length) continue;
    }

    if (isPeriodic) {
      plans = plans.map((plan) => {
        const tier = getPlanTierLabel(plan.service_name);
        const fallback = getPeriodicChecklistFallback({
          points: plan.points,
          tier,
          serviceName: plan.service_name,
        });
        if (!fallback?.items?.length) return plan;
        return {
          ...plan,
          points: fallback.points || plan.points,
          checklist_items: fallback.items,
        };
      });
    }

    blocks.push({ category, plans, isPeriodic });
  }

  if (!blocks.length) return { blocks: [], error: 'no_prices' };
  return { blocks };
}

export async function sendPricingShareWhatsApp(input: {
  phone: string;
  customerName?: string | null;
  carModel: string;
  url: string;
  expiresAt: string;
  leadId?: string | null;
  leadNumber?: string | null;
  categories?: string[];
}): Promise<{ sent: boolean; channel?: string; error?: string }> {
  const phone = normalizePhoneNumber(input.phone);
  if (!phone) return { sent: false, error: 'missing_phone' };

  const name = firstName(input.customerName);
  const car = String(input.carModel || '').trim() || 'your car';
  const url = String(input.url || '').trim();
  const expiresLabel = (() => {
    try {
      return new Date(input.expiresAt).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return 'a few hours';
    }
  })();
  const cats = (input.categories || []).filter(Boolean).join(', ') || 'Service';

  const sessionMsg = [
    `Hi ${name},`,
    '',
    `Sharing MyFNG *${cats}* pricing for *${car}*.`,
    '',
    `View full plans here (valid until ${expiresLabel}):`,
    url,
    '',
    'Reply *BOOK* when ready to proceed. — Team MyFNG',
  ].join('\n');

  const textRes = await sendAgentTextMessage({
    phone,
    message: sessionMsg,
    source: 'telecaller_pricing_share',
    meta: {
      lead_id: input.leadId || null,
      lead_number: input.leadNumber || null,
      kind: 'pricing_share_link',
      url,
    },
  });
  if (textRes.success) return { sent: true, channel: 'session_text' };

  const tplRes = await sendTemplateMessage({
    phoneNumber: phone,
    templateName: SHARE_TEMPLATE,
    templateParams: [name, car, url],
    languageCode: 'en',
  });
  if (tplRes.success) return { sent: true, channel: 'pricing_share_link_template' };

  return {
    sent: false,
    error: tplRes.error || textRes.error || 'whatsapp_send_failed',
  };
}

/** Create share link + WhatsApp send (primary Send Pricing path). */
export async function createAndSendPricingShare(input: {
  phone: string;
  customerName?: string | null;
  carModel: string;
  pincode: string;
  city?: string | null;
  categories: string[];
  serviceTypeIds?: string[] | null;
  leadId?: string | null;
  leadNumber?: string | null;
  createdBy?: string | null;
  ttlHours?: number;
}): Promise<{
  sent: boolean;
  url?: string;
  slug?: string;
  expiresAt?: string;
  channel?: string;
  error?: string;
  details?: string[];
}> {
  const created = await createPricingShareLink(input);
  if ('error' in created) {
    return { sent: false, error: created.error };
  }

  const wa = await sendPricingShareWhatsApp({
    phone: input.phone,
    customerName: input.customerName,
    carModel: input.carModel,
    url: created.url,
    expiresAt: created.row.expires_at,
    leadId: input.leadId,
    leadNumber: input.leadNumber,
    categories: created.row.categories,
  });

  if (!wa.sent) {
    // Link still created — telecaller can share manually
    return {
      sent: false,
      url: created.url,
      slug: created.row.slug,
      expiresAt: created.row.expires_at,
      error: wa.error || 'whatsapp_send_failed',
      details: [
        'Pricing page created but WhatsApp send failed.',
        'Share this link manually, or ensure customer has an open chat / approve pricing_share_link template.',
        created.url,
      ],
    };
  }

  return {
    sent: true,
    url: created.url,
    slug: created.row.slug,
    expiresAt: created.row.expires_at,
    channel: wa.channel,
  };
}
