import { supabase } from './supabase';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { getPeriodicChecklistFallback } from '@/lib/services/periodicChecklistFallbacks';

function dbClient() {
  const { supabaseAdmin } = getSupabaseAdmin();
  return (supabaseAdmin || supabase) as typeof supabase;
}

export function normalizeChecklistItems(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export type ServiceChecklistResult = {
  items: any[];
  points: number | null;
  serviceTypeId: string | null;
  serviceName: string | null;
  title?: string | null;
};

const EMPTY: ServiceChecklistResult = {
  items: [],
  points: null,
  serviceTypeId: null,
  serviceName: null,
  title: null,
};

function matchesOilType(name: string, oil: string): boolean {
  const text = name.toLowerCase();
  const wantsFull = oil === 'full';
  const hasFull =
    text.includes('fully synthetic') ||
    text.includes('full synthetic') ||
    text.includes('(fully)') ||
    text.includes('(full)');
  const hasSemi =
    text.includes('semi synthetic') ||
    text.includes('semi-synthetic') ||
    text.includes('(semi)') ||
    /\bsemi\b/.test(text);

  if (wantsFull) return hasFull || (!hasSemi && !hasFull);
  if (oil === 'semi') return hasSemi || (!hasSemi && !hasFull);
  return true;
}

function tierRank(name: string, tier: string): number {
  const n = name.toLowerCase();
  const t = tier.toLowerCase();
  if (n === t) return 0;
  if (n.includes(t)) return 1;
  if (t.includes(n)) return 2;
  if (t === 'general' && n.includes('standard')) return 3;
  return 4;
}

function detectTier(name: string): string | null {
  const n = String(name || '').toLowerCase();
  if (n.includes('platinum')) return 'Platinum';
  if (n.includes('premium')) return 'Premium';
  if (n.includes('general') || n.includes('standard')) return 'General';
  if (n.includes('basic')) return 'Basic';
  return null;
}

function detectOil(name: string): 'semi' | 'full' | null {
  const n = String(name || '').toLowerCase();
  if (
    n.includes('fully synthetic') ||
    n.includes('full synthetic') ||
    n.includes('(fully)') ||
    n.includes('(full)')
  ) {
    return 'full';
  }
  if (n.includes('semi synthetic') || n.includes('semi-synthetic') || n.includes('(semi)') || /\bsemi\b/.test(n)) {
    return 'semi';
  }
  return null;
}

function detectPointsHint(text: string): number | null {
  const m = String(text || '').match(/\b(15|30|50|60)\b/);
  return m ? Number(m[1]) : null;
}

/**
 * Get checklist by service_type UUID (preferred for View plans selection).
 */
export async function getServiceChecklistByServiceTypeId(
  serviceTypeId: string,
): Promise<ServiceChecklistResult> {
  const id = String(serviceTypeId || '').trim();
  if (!id) return { ...EMPTY };
  const db = dbClient();
  if (!db) return { ...EMPTY };

  try {
    const [{ data: serviceType }, { data: checklist }] = await Promise.all([
      db.from('service_types').select('id, name').eq('id', id).maybeSingle(),
      db
        .from('service_type_checklist_templates')
        .select('checklist_items, points, title')
        .eq('service_type_id', id)
        .maybeSingle(),
    ]);

    const items = normalizeChecklistItems(checklist?.checklist_items);
    const points =
      typeof checklist?.points === 'number' && checklist.points > 0
        ? checklist.points
        : items.length > 0
          ? items.length
          : null;

    return {
      items,
      points,
      serviceTypeId: serviceType?.id || id,
      serviceName: serviceType?.name || null,
      title: checklist?.title || null,
    };
  } catch (err) {
    console.error('[CHECKLIST] Error by id:', err);
    return { ...EMPTY };
  }
}

async function getChecklistByTierOilPoints(input: {
  tier?: string | null;
  oil?: 'semi' | 'full' | null;
  pointsHint?: number | null;
}): Promise<ServiceChecklistResult> {
  const tier = String(input.tier || '').trim();
  const oil = input.oil || null;
  const pointsHint = input.pointsHint || null;
  if (!tier && !pointsHint) return { ...EMPTY };

  const db = dbClient();
  if (!db) return { ...EMPTY };

  try {
    // Prefer templates that already have the right points count (15/30/50/60)
    if (pointsHint) {
      const { data: byPoints } = await db
        .from('service_type_checklist_templates')
        .select('service_type_id, checklist_items, points, title')
        .eq('points', pointsHint)
        .limit(30);

      const rows = byPoints || [];
      if (rows.length) {
        const stIds = rows.map((r: any) => r.service_type_id).filter(Boolean);
        const { data: stRows } = stIds.length
          ? await db.from('service_types').select('id, name').in('id', stIds)
          : { data: [] as any[] };
        const nameById = new Map(
          (stRows || []).map((s: any) => [String(s.id), String(s.name || '')]),
        );

        const scored = rows
          .map((row: any) => {
            const name = nameById.get(String(row.service_type_id)) || String(row.title || '');
            let score = 0;
            if (tier && name.toLowerCase().includes(tier.toLowerCase())) score += 2;
            if (tier && String(row.title || '').toLowerCase().includes(tier.toLowerCase())) {
              score += 2;
            }
            if (oil && matchesOilType(name, oil)) score += 1;
            return { row, name, score };
          })
          .sort((a, b) => b.score - a.score);

        const best = scored[0];
        if (best) {
          const items = normalizeChecklistItems(best.row.checklist_items);
          if (items.length) {
            return {
              items,
              points:
                typeof best.row.points === 'number' && best.row.points > 0
                  ? best.row.points
                  : items.length,
              serviceTypeId: best.row.service_type_id || null,
              serviceName: best.name || null,
              title: best.row.title || null,
            };
          }
        }
      }
    }

    if (!tier) return { ...EMPTY };

    const { data: serviceTypes } = await db
      .from('service_types')
      .select('id, name')
      .ilike('name', `%${tier}%`)
      .limit(40);

    const matched =
      (serviceTypes || [])
        .filter((row) => (oil ? matchesOilType(String(row.name || ''), oil) : true))
        .sort(
          (a, b) =>
            tierRank(String(a.name || ''), tier) - tierRank(String(b.name || ''), tier),
        )[0] || (serviceTypes || [])[0];

    if (!matched?.id) return { ...EMPTY };

    const byId = await getServiceChecklistByServiceTypeId(String(matched.id));
    if (byId.items.length) return byId;

    // Last resort: classic "Basic Service (15 Points)" style templates
    const pointPatterns: Record<string, string> = {
      Basic: '%BASIC%15%POINT%',
      General: '%GENERAL%30%POINT%',
      Premium: '%PREMIUM%50%POINT%',
      Platinum: '%PLATINUM%60%POINT%',
    };
    const pattern = pointPatterns[tier];
    if (pattern) {
      const { data: classic } = await db
        .from('service_types')
        .select('id, name')
        .ilike('name', pattern)
        .limit(1)
        .maybeSingle();
      if (classic?.id) {
        return getServiceChecklistByServiceTypeId(String(classic.id));
      }
    }

    return byId;
  } catch (err) {
    console.error('[CHECKLIST] Error by tier/oil:', err);
    return { ...EMPTY };
  }
}

/**
 * Get checklist for a specific service by name
 */
export async function getServiceChecklist(serviceName: string): Promise<any[]> {
  const resolved = await resolveServiceChecklist({ serviceName });
  return resolved.items;
}

function pointsMatch(got: number | null | undefined, hint: number | null): boolean {
  if (!hint || hint <= 0) return true;
  const g = Number(got || 0);
  if (!g) return false;
  return g === hint;
}

/** Resolve checklist by points/tier first (strict), then DB id/name, then hardcoded fallback. */
export async function resolveServiceChecklist(input: {
  serviceTypeId?: string | null;
  serviceName?: string | null;
  tier?: string | null;
  oil?: 'semi' | 'full' | null;
  pointsHint?: number | null;
}): Promise<ServiceChecklistResult> {
  const name = String(input.serviceName || '').trim();
  const tier = String(input.tier || detectTier(name) || '').trim() || null;
  const oil = input.oil || detectOil(name);
  const pointsHint =
    input.pointsHint ||
    detectPointsHint(name) ||
    (tier === 'Basic'
      ? 15
      : tier === 'General'
        ? 30
        : tier === 'Premium'
          ? 50
          : tier === 'Platinum'
            ? 60
            : null);

  // 1) Prefer DB templates that match the selected points (15/30/50/60)
  if (pointsHint) {
    const byPoints = await getChecklistByTierOilPoints({ tier, oil, pointsHint });
    if (byPoints.items.length && pointsMatch(byPoints.points, pointsHint)) {
      return { ...byPoints, serviceName: name || byPoints.serviceName };
    }
  }

  // 2) Exact service_type_id — only accept if points match hint (avoid Basic-15 on Platinum)
  const byId = await getServiceChecklistByServiceTypeId(String(input.serviceTypeId || ''));
  if (byId.items.length && pointsMatch(byId.points ?? byId.items.length, pointsHint)) {
    return byId;
  }

  // 3) Name search — only accept matching points
  if (name) {
    const db = dbClient();
    if (db) {
      try {
        const { data: serviceTypes } = await db
          .from('service_types')
          .select('id, name')
          .ilike('name', `%${getPlanSearchToken(name, tier)}%`)
          .limit(20);

        for (const st of serviceTypes || []) {
          const got = await getServiceChecklistByServiceTypeId(String(st.id));
          if (got.items.length && pointsMatch(got.points ?? got.items.length, pointsHint)) {
            return { ...got, serviceName: name || got.serviceName || st.name };
          }
        }
      } catch (err) {
        console.error('[CHECKLIST] Error by name:', err);
      }
    }
  }

  // 4) Hardcoded periodic fallback — always returns full point list for 15/30/50/60
  const fallback = getPeriodicChecklistFallback({
    points: pointsHint,
    tier,
    serviceName: name || tier,
  });
  if (fallback?.items?.length) {
    return {
      items: fallback.items,
      points: fallback.points,
      serviceTypeId: byId.serviceTypeId || null,
      serviceName: name || fallback.title,
      title: fallback.title,
    };
  }

  // 5) Last resort: whatever DB had (even if points mismatch)
  if (byId.items.length) return byId;
  return { ...EMPTY };
}

function getPlanSearchToken(name: string, tier: string | null): string {
  if (tier) return tier;
  const t = detectTier(name);
  if (t) return t;
  return name.split(/\s+/)[0] || name;
}
