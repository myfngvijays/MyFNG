'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle, Droplets, Loader2, X } from 'lucide-react';
import {
  getPlanBadge,
  getPlanPoints,
  getPlanTierLabel,
  groupPeriodicPlans,
  type PricingPlanItem,
} from '@/lib/whatsappBotFlow/periodicPlansUi';

export type PricingPlan = {
  id: string;
  name: string;
  tier: string;
  oilType: 'semi' | 'full';
  price: number;
  description: string;
  points: string | null;
  badge: string | null;
};

type ChecklistItem = { name: string; category: string };

export function assistantMessageShowsPricingList(text: string): boolean {
  const t = String(text || '');
  const prices = (t.match(/₹\s*[\d,]+/g) || []).length;
  const tiers = /basic service|general service|premium service|platinum service/i.test(t);
  return prices >= 2 && tiers;
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

export function parsePricingPlansFromText(text: string): PricingPlan[] {
  const normalized = String(text || '');
  const chunks = normalized.split(/\*\*\d+️⃣\s*/i).slice(1);
  const plans: PricingPlan[] = [];

  chunks.forEach((chunk, index) => {
    const lines = chunk
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const headerLine = (lines[0] || '').replace(/\*\*/g, '').trim();
    if (!headerLine) return;

    let price = 0;
    let description = '';
    for (const line of lines.slice(1)) {
      const priceMatch = line.match(/₹\s*([\d,]+)/);
      if (priceMatch) price = Number(priceMatch[1].replace(/,/g, ''));
      const cleaned = line.replace(/^📝\s*/, '').replace(/\*\*/g, '').trim();
      if (line.includes('📝') || /^periodic/i.test(cleaned)) {
        description = cleaned;
      } else if (!description && /checkpoint|points|maintenance with/i.test(cleaned)) {
        description = cleaned;
      }
    }

    if (!price) return;

    const oilType: 'semi' | 'full' =
      /fully synthetic|full synthetic|\(fully\)/i.test(headerLine) ? 'full' : 'semi';
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

    plans.push({
      id: `plan-${index}-${oilType}-${tier.toLowerCase()}`,
      name: headerLine,
      tier,
      oilType,
      price,
      description,
      points: getPlanPoints(planItem),
      badge: getPlanBadge(headerLine),
    });
  });

  return plans;
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
        const res = await fetch(
          `/api/chatbot/v2/service-checklist?tier=${encodeURIComponent(plan.tier)}&oil=${plan.oilType}`,
        );
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
  const hasSemi = grouped.semi.length > 0;
  const hasFull = grouped.full.length > 0;
  const showOilToggle = hasSemi && hasFull;

  const [oilType, setOilType] = useState<'semi' | 'full'>(hasSemi ? 'semi' : 'full');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pointsPlan, setPointsPlan] = useState<PricingPlan | null>(null);

  const filteredPlans = useMemo(
    () => (showOilToggle ? plans.filter((p) => p.oilType === oilType) : plans),
    [plans, oilType, showOilToggle],
  );

  useEffect(() => {
    setSelectedId(null);
  }, [oilType]);

  const selected = filteredPlans.find((p) => p.id === selectedId) || null;

  if (plans.length === 0) return null;

  return (
    <>
      <div className="mt-3 space-y-3 rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/80 to-white p-3 shadow-sm sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Periodic Plans</p>
            <p className="mt-0.5 text-sm font-semibold text-brand-secondary">{title || 'Choose your plan'}</p>
          </div>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
            App-style UI
          </span>
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
            const pointsNum = plan.points ? parseInt(plan.points, 10) : null;
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
                  <p className="text-sm font-bold leading-tight text-gray-900">{plan.tier} Service</p>
                  <p className="mt-1 text-lg font-extrabold text-blue-700">{inr(plan.price)}</p>
                  {pointsNum && pointsNum > 0 && (
                    <p className="mt-1 flex items-center gap-1 text-xs font-bold text-brand-primary">
                      <CheckCircle className="h-3 w-3" />
                      {pointsNum} Activity Points
                    </p>
                  )}
                  {plan.description && (
                    <p className="mt-1 line-clamp-2 text-[11px] text-gray-500">{plan.description}</p>
                  )}
                </button>
                {pointsNum && pointsNum > 0 && (
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
            <span className="font-semibold text-gray-900">Selected:</span> {selected.tier} Service ·{' '}
            <span className="font-bold text-blue-700">{inr(selected.price)}</span>
            {oilType === 'semi' ? ' · Semi Synthetic' : ' · Fully Synthetic'}
          </div>
        )}

        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && onSelect(selected)}
          className="w-full rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          {selected
            ? `Continue · ${selected.tier} · ${inr(selected.price)}`
            : 'Select a plan to continue'}
        </button>
      </div>

      {pointsPlan && <PointsModal plan={pointsPlan} onClose={() => setPointsPlan(null)} />}
    </>
  );
}
