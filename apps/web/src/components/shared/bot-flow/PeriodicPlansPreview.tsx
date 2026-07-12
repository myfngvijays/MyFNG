'use client';

import { useMemo, useState } from 'react';
import {
  getPlanBadge,
  groupPeriodicPlans,
  isPeriodicPricing,
  type OilType,
  type PricingPlanItem,
} from '@/lib/whatsappBotFlow/periodicPlansUi';

type PeriodicPlansPreviewProps = {
  plans: PricingPlanItem[];
  carLabel?: string;
};

function inr(value: number) {
  return `₹${Math.round(Number(value || 0)).toLocaleString('en-IN')}`;
}

export default function PeriodicPlansPreview({ plans, carLabel }: PeriodicPlansPreviewProps) {
  const grouped = useMemo(() => groupPeriodicPlans(plans), [plans]);
  const hasSemi = grouped.semi.length > 0;
  const hasFull = grouped.full.length > 0;

  const [oilType, setOilType] = useState<OilType>(hasSemi ? 'semi' : 'full');
  const [selectedIdx, setSelectedIdx] = useState(0);

  const visiblePlans = useMemo(() => {
    if (oilType === 'semi') return grouped.semi;
    return grouped.full;
  }, [oilType, grouped]);

  const safeSelectedIdx = Math.min(selectedIdx, Math.max(visiblePlans.length - 1, 0));
  const selectedPlan = visiblePlans[safeSelectedIdx] || null;

  if (!isPeriodicPricing(plans)) return null;

  return (
    <div className="space-y-3 rounded-xl border border-blue-100 bg-gradient-to-b from-blue-50/80 to-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Periodic Plans Preview</p>
          {carLabel ? <p className="text-[11px] text-gray-500">for {carLabel}</p> : null}
        </div>
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
          App-style UI
        </span>
      </div>

      {(hasSemi || hasFull) && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-600">Engine Oil:</span>
          <div className="inline-flex rounded-lg border bg-white p-0.5">
            {hasSemi ? (
              <button
                type="button"
                onClick={() => {
                  setOilType('semi');
                  setSelectedIdx(0);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                  oilType === 'semi' ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-700 hover:bg-blue-50'
                }`}
              >
                Semi Synthetic
              </button>
            ) : null}
            {hasFull ? (
              <button
                type="button"
                onClick={() => {
                  setOilType('full');
                  setSelectedIdx(0);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                  oilType === 'full' ? 'bg-orange-500 text-white shadow-sm' : 'text-orange-600 hover:bg-orange-50'
                }`}
              >
                Fully Synthetic
              </button>
            ) : null}
          </div>
        </div>
      )}

      {visiblePlans.length === 0 ? (
        <p className="text-xs text-gray-500">No plans for this oil type.</p>
      ) : (
        <>
          <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory">
            {visiblePlans.map((plan, index) => {
              const active = index === safeSelectedIdx;
              const badge = getPlanBadge(plan.service_name);
              return (
                <button
                  key={`${plan.service_name}-${index}`}
                  type="button"
                  onClick={() => setSelectedIdx(index)}
                  className={`min-w-[170px] max-w-[190px] shrink-0 snap-start rounded-xl border p-3 text-left transition ${
                    active
                      ? 'border-blue-500 bg-white shadow-md ring-2 ring-blue-200'
                      : 'border-gray-200 bg-white hover:border-blue-300'
                  }`}
                >
                  {badge ? (
                    <span className="mb-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      {badge}
                    </span>
                  ) : null}
                  <p className="text-sm font-bold text-gray-900 leading-tight">{plan.service_name}</p>
                  <p className="mt-1 text-lg font-extrabold text-blue-700">{inr(plan.min_price)}</p>
                  {plan.description ? (
                    <p className="mt-1 line-clamp-2 text-[11px] text-gray-500">{plan.description}</p>
                  ) : null}
                </button>
              );
            })}
          </div>

          {selectedPlan ? (
            <div className="rounded-lg border border-dashed border-blue-200 bg-white/80 p-2.5 text-xs text-gray-700">
              <span className="font-semibold text-gray-900">Selected:</span> {selectedPlan.service_name} ·{' '}
              <span className="font-bold text-blue-700">{inr(selectedPlan.min_price)}</span>
              {oilType === 'semi' ? ' · Semi Synthetic' : ' · Fully Synthetic'}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
