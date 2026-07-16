'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle, Droplets, Loader2, X } from 'lucide-react';
import {
  getPlanBadge,
  getPlanPoints,
  getPlanTierLabel,
  groupPeriodicPlans,
  isPeriodicPricing,
  type PricingPlanItem,
} from '@/lib/whatsappBotFlow/periodicPlansUi';

export type PricingPlan = {
  id: string;
  name: string;
  tier: string;
  oilType: 'semi' | 'full' | 'unknown';
  price: number;
  description: string;
  points: string | null;
  badge: string | null;
  isPeriodic: boolean;
  serviceTypeId?: string | null;
  checklistCount?: number;
};

type ChecklistItem = { name: string; category: string };

type ChecklistMeta = {
  points: number | null;
  itemCount: number;
  loading: boolean;
};

function checklistTierParam(plan: PricingPlan): string {
  if (plan.isPeriodic) return plan.tier;
  return plan.name || plan.tier;
}

function checklistFetchUrl(plan: PricingPlan): string {
  const oilParam = plan.oilType === 'unknown' ? 'semi' : plan.oilType;
  if (plan.serviceTypeId) {
    return `/api/chatbot/v2/service-checklist?service_type_id=${encodeURIComponent(plan.serviceTypeId)}&oil=${oilParam}`;
  }
  return `/api/chatbot/v2/service-checklist?tier=${encodeURIComponent(checklistTierParam(plan))}&oil=${oilParam}`;
}

async function fetchPlanChecklistMeta(plan: PricingPlan): Promise<Omit<ChecklistMeta, 'loading'>> {
  try {
    const res = await fetch(checklistFetchUrl(plan));
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) return { points: null, itemCount: 0 };
    const items = Array.isArray(json.items) ? json.items : [];
    const points =
      typeof json.points === 'number' ? json.points : items.length > 0 ? items.length : null;
    return { points, itemCount: items.length };
  } catch {
    return { points: null, itemCount: 0 };
  }
}

export function assistantMessageShowsPricingList(text: string): boolean {
  const t = String(text || '');
  const prices = (t.match(/₹\s*[\d,]+/g) || []).length;
  if (prices >= 1 && /service for your|for your/i.test(t)) return true;
  if (prices >= 2) return true;
  const tiers = /basic service|general service|premium service|platinum service/i.test(t);
  return prices >= 1 && tiers;
}

function cleanPlanName(raw: string): string {
  return String(raw || '')
    .replace(/\*\*/g, '')
    .replace(/[✨━─📝]/g, '')
    .replace(/^[\d️⃣]+[\s.)-]*/i, '')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/\s*[-–—:]\s*₹.*$/i, '')
    .replace(/\s*₹.*$/i, '')
    .trim();
}

function buildPlanFromHeader(
  headerLine: string,
  price: number,
  description: string,
  index: number,
  isPeriodic: boolean,
): PricingPlan | null {
  if (!headerLine || !price) return null;

  const oilType: 'semi' | 'full' | 'unknown' =
    /fully synthetic|full synthetic|\(fully\)/i.test(headerLine)
      ? 'full'
      : /semi synthetic|semi-synthetic|\(semi\)/i.test(headerLine)
        ? 'semi'
        : 'unknown';

  const tierMatch = headerLine.match(/(basic|general|premium|platinum)/i);
  const tier = tierMatch
    ? tierMatch[1].charAt(0).toUpperCase() + tierMatch[1].slice(1).toLowerCase()
    : getPlanTierLabel(headerLine);

  const planItem: PricingPlanItem = {
    service_name: headerLine,
    min_price: price,
    max_price: price,
    description,
  };

  return {
    id: `plan-${index}-${oilType}-${tier.toLowerCase().replace(/\s+/g, '-')}`,
    name: headerLine,
    tier: isPeriodic ? tier : headerLine,
    oilType,
    price,
    description,
    points: getPlanPoints(planItem),
    badge: getPlanBadge(headerLine),
    isPeriodic,
  };
}

function isPeriodicPlanName(name: string): boolean {
  return /basic|general|premium|platinum/i.test(String(name || ''));
}

function parseNumberedEmojiBlocks(text: string): PricingPlan[] {
  const plans: PricingPlan[] = [];
  const normalized = String(text || '');
  const blockRe = /\*\*[\d]+️⃣\s*([\s\S]*?)\*\*/g;
  let match: RegExpExecArray | null;

  while ((match = blockRe.exec(normalized)) !== null) {
    const headerLine = cleanPlanName(match[1] || '');
    if (!headerLine) continue;

    const after = normalized.slice(match.index + match[0].length, match.index + match[0].length + 280);
    const priceMatch = after.match(/₹\s*([\d,]+)/);
    if (!priceMatch) continue;

    const price = Number(priceMatch[1].replace(/,/g, ''));
    const isPeriodic = isPeriodicPlanName(headerLine) || isPeriodicPlanName(normalized);
    const plan = buildPlanFromHeader(headerLine, price, '', plans.length, isPeriodic);
    if (plan) plans.push(plan);
  }

  return plans;
}

function parseGenericPricingLines(text: string): PricingPlan[] {
  const plans: PricingPlan[] = [];
  const lines = String(text || '').split('\n');

  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line || !/₹\s*[\d,]+/.test(line)) return;

    const priceMatch = line.match(/₹\s*([\d,]+)/);
    if (!priceMatch) return;
    const price = Number(priceMatch[1].replace(/,/g, ''));
    if (!price) return;

    let headerLine = cleanPlanName((line.split(/₹/)[0] || line).replace(/^💰\s*/, ''));

    if (!headerLine || headerLine.length < 3 || /^💰/.test(line)) {
      for (let i = index - 1; i >= 0; i -= 1) {
        const prev = lines[i]?.trim();
        if (!prev || /^[━─_\-=]+$/.test(prev)) continue;
        if (/₹\s*[\d,]+/.test(prev)) break;
        const candidate = cleanPlanName(prev);
        if (candidate.length >= 3 && !/service for your|would you like|proceed with booking/i.test(candidate)) {
          headerLine = candidate;
          break;
        }
      }
    }

    if (!headerLine || headerLine.length < 3) return;

    const descMatch = lines[index + 1]?.trim();
    const description =
      descMatch && !/₹\s*[\d,]+/.test(descMatch) && !/^[\d️⃣1-9.)]/.test(descMatch)
        ? cleanPlanName(descMatch)
        : '';

    const plan = buildPlanFromHeader(
      headerLine,
      price,
      description,
      plans.length,
      isPeriodicPlanName(headerLine),
    );
    if (plan) plans.push(plan);
  });

  return plans;
}

export function parsePricingPlansFromText(text: string): PricingPlan[] {
  const normalized = String(text || '');
  const emojiPlans = parseNumberedEmojiBlocks(normalized);
  if (emojiPlans.length >= 1) return emojiPlans;
  return parseGenericPricingLines(normalized);
}

export function buildPricingPlansFromApi(
  rows: Array<{
    service_name: string;
    min_price: number;
    max_price?: number;
    description?: string | null;
    service_type_id?: string | null;
    points?: number | null;
    checklist_count?: number;
  }>,
): PricingPlan[] {
  return rows.map((p, index) => {
    const planItem: PricingPlanItem = {
      service_name: p.service_name,
      min_price: p.min_price,
      max_price: p.max_price ?? p.min_price,
      description: p.description,
    };
    const periodic = isPeriodicPlanName(p.service_name);
    const parsedPoints = getPlanPoints(planItem);
    const pointsValue =
      typeof p.points === 'number' && p.points > 0
        ? p.points
        : parsedPoints
          ? parseInt(parsedPoints, 10)
          : (p.checklist_count ?? 0) > 0
            ? p.checklist_count!
            : null;

    return {
      id: `api-${index}-${p.service_type_id || p.service_name}`,
      name: p.service_name,
      tier: periodic ? getPlanTierLabel(p.service_name) : p.service_name,
      oilType: 'unknown' as const,
      price: p.min_price,
      description: p.description || '',
      points: pointsValue ? String(pointsValue) : null,
      badge: getPlanBadge(p.service_name),
      isPeriodic: periodic,
      serviceTypeId: p.service_type_id || null,
      checklistCount: p.checklist_count ?? 0,
    };
  });
}

export function extractPricingTitle(text: string): string {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    const cleaned = line.replace(/\*\*/g, '').replace(/[✨━─]/g, '').trim();
    if (/service for your|for your/i.test(cleaned)) return cleaned;
  }
  const m = String(text || '').match(/\*\*(.+?)\*\*/);
  return m?.[1]?.trim() || 'Choose your service plan';
}

function inr(value: number) {
  return `₹${Math.round(Number(value || 0)).toLocaleString('en-IN')}`;
}

function PointsModal({
  plan,
  onClose,
}: {
  plan: PricingPlan;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [title, setTitle] = useState(plan.tier + ' Service');
  const [points, setPoints] = useState<number | null>(
    plan.points ? parseInt(plan.points, 10) : null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(checklistFetchUrl(plan));
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) throw new Error(json?.error || 'Could not load points');
        if (cancelled) return;
        setItems(Array.isArray(json.items) ? json.items : []);
        if (typeof json.points === 'number') setPoints(json.points);
        if (json.title) setTitle(String(json.title));
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load checklist');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [plan]);

  const grouped = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>();
    items.forEach((item) => {
      const key = item.category || 'General';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    return map;
  }, [items]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <div>
            <p className="text-base font-bold text-gray-900">{title}</p>
            <p className="mt-0.5 text-sm font-semibold text-brand-primary">
              {points ? `${points} Activity Points` : 'Service checklist'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading checklist…
            </div>
          ) : error ? (
            <p className="py-6 text-center text-sm text-red-600">{error}</p>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">
              Detailed checklist will be shared by our team at booking.
            </p>
          ) : (
            <div className="space-y-4">
              {Array.from(grouped.entries()).map(([category, categoryItems]) => (
                <div key={category}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">{category}</p>
                  <ul className="space-y-1.5">
                    {categoryItems.map((item, idx) => (
                      <li key={`${category}-${idx}`} className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                        <span>{item.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 p-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

type Props = {
  plans: PricingPlan[];
  title?: string;
  onSelect: (plan: PricingPlan) => void;
};

export function MisaPricingPicker({ plans, title, onSelect }: Props) {
  const planItems: PricingPlanItem[] = useMemo(
    () =>
      plans.map((p) => ({
        service_name: p.name,
        min_price: p.price,
        max_price: p.price,
        description: p.description,
      })),
    [plans],
  );

  const grouped = useMemo(() => groupPeriodicPlans(planItems), [planItems]);
  const isPeriodic = useMemo(
    () => plans.some((p) => p.isPeriodic) || isPeriodicPricing(planItems),
    [plans, planItems],
  );
  const hasSemi = grouped.semi.length > 0;
  const hasFull = grouped.full.length > 0;
  const showOilToggle = isPeriodic && hasSemi && hasFull;

  const [oilType, setOilType] = useState<'semi' | 'full'>(hasSemi ? 'semi' : 'full');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pointsPlan, setPointsPlan] = useState<PricingPlan | null>(null);
  const [checklistMeta, setChecklistMeta] = useState<Record<string, ChecklistMeta>>({});

  useEffect(() => {
    let cancelled = false;
    const loadingState: Record<string, ChecklistMeta> = {};
    plans.forEach((plan) => {
      loadingState[plan.id] = { points: null, itemCount: 0, loading: true };
    });
    setChecklistMeta(loadingState);

    void Promise.all(
      plans.map(async (plan) => {
        const meta = await fetchPlanChecklistMeta(plan);
        return { id: plan.id, meta: { ...meta, loading: false } satisfies ChecklistMeta };
      }),
    ).then((results) => {
      if (cancelled) return;
      setChecklistMeta((prev) => {
        const next = { ...prev };
        results.forEach(({ id, meta }) => {
          next[id] = meta;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [plans]);

  const filteredPlans = useMemo(() => {
    if (!showOilToggle) return plans;
    return plans.filter((p) => p.oilType === oilType || p.oilType === 'unknown');
  }, [plans, oilType, showOilToggle]);

  useEffect(() => {
    setSelectedId(null);
  }, [oilType]);

  useEffect(() => {
    if (filteredPlans.length === 1) {
      setSelectedId(filteredPlans[0].id);
    }
  }, [filteredPlans]);

  const selected = filteredPlans.find((p) => p.id === selectedId) || null;

  if (plans.length === 0) return null;

  return (
    <>
      <div className="mt-3 space-y-3 rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/80 to-white p-3 shadow-sm sm:p-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
            {isPeriodic ? 'Periodic Plans' : 'Service Plans'}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-brand-secondary">{title || 'Choose your plan'}</p>
        </div>

        {showOilToggle && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-600">Engine Oil:</span>
            <div className="inline-flex rounded-lg border bg-white p-0.5">
              <button
                type="button"
                onClick={() => setOilType('semi')}
                className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                  oilType === 'semi' ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-700 hover:bg-blue-50'
                }`}
              >
                Semi Synthetic
              </button>
              <button
                type="button"
                onClick={() => setOilType('full')}
                className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                  oilType === 'full' ? 'bg-orange-500 text-white shadow-sm' : 'text-orange-600 hover:bg-orange-50'
                }`}
              >
                Fully Synthetic
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory">
          {filteredPlans.map((plan) => {
            const isSelected = selectedId === plan.id;
            const meta = checklistMeta[plan.id];
            const parsedPoints = plan.points ? parseInt(plan.points, 10) : null;
            const pointsNum =
              meta && !meta.loading && meta.points != null ? meta.points : parsedPoints;
            const hasChecklist = (meta?.itemCount ?? plan.checklistCount ?? 0) > 0;
            const showPointsUi = hasChecklist || Boolean(pointsNum && pointsNum > 0);
            const showViewAll =
              (meta?.loading ? (plan.checklistCount ?? 0) > 0 : showPointsUi) && showPointsUi;
            return (
              <div
                key={plan.id}
                className={`relative min-w-[168px] max-w-[190px] shrink-0 snap-start rounded-xl border p-3 transition ${
                  isSelected
                    ? 'border-blue-500 bg-white shadow-md ring-2 ring-blue-200'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
              >
                {plan.badge && (
                  <span className="mb-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                    {plan.badge}
                  </span>
                )}
                <button type="button" onClick={() => setSelectedId(plan.id)} className="w-full text-left">
                  <p className="text-sm font-bold leading-tight text-gray-900">
                    {plan.isPeriodic ? `${plan.tier} Service` : plan.tier}
                  </p>
                  <p className="mt-1 text-lg font-extrabold text-blue-700">{inr(plan.price)}</p>
                  {meta?.loading && (
                    <p className="mt-1 text-[11px] text-gray-400">Loading points…</p>
                  )}
                  {!meta?.loading && showPointsUi && pointsNum && pointsNum > 0 && (
                    <p className="mt-1 flex items-center gap-1 text-xs font-bold text-brand-primary">
                      <CheckCircle className="h-3 w-3" />
                      {pointsNum} Activity Points
                    </p>
                  )}
                  {plan.description && (
                    <p className="mt-1 line-clamp-2 text-[11px] text-gray-500">{plan.description}</p>
                  )}
                </button>
                {!meta?.loading && showViewAll && (
                  <button
                    type="button"
                    onClick={() => setPointsPlan(plan)}
                    className="mt-2 text-[11px] font-bold text-brand-primary underline-offset-2 hover:underline"
                  >
                    View all points
                  </button>
                )}
                {isSelected && (
                  <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand-primary text-white">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {selected && (
          <div className="rounded-lg border border-dashed border-blue-200 bg-white/80 p-2.5 text-xs text-gray-700">
            <span className="font-semibold text-gray-900">Selected:</span>{' '}
            {selected.isPeriodic ? `${selected.tier} Service` : selected.tier} ·{' '}
            <span className="font-bold text-blue-700">{inr(selected.price)}</span>
            {showOilToggle &&
              (oilType === 'semi' ? ' · Semi Synthetic' : ' · Fully Synthetic')}
          </div>
        )}

        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && onSelect(selected)}
          className="w-full rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          {selected
            ? `Continue · ${selected.isPeriodic ? selected.tier : selected.tier.split(' ')[0]} · ${inr(selected.price)}`
            : 'Select a plan to continue'}
        </button>
      </div>

      {pointsPlan && <PointsModal plan={pointsPlan} onClose={() => setPointsPlan(null)} />}
    </>
  );
}
