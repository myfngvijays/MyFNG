'use client';

import React from 'react';
import { MembershipIconPreview } from './MembershipIconField';

export type PreviewBenefit = {
  id?: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  icon_url?: string | null;
  icon_class?: string | null;
  value_label?: string | null;
  value_prefix?: string | null;
  active?: boolean;
};

export type PreviewPlanForm = {
  name: string;
  tagline?: string;
  price: number;
  original_price?: number;
  period_label?: string;
  footer_note?: string;
  total_benefits_value?: number;
  value_column_label?: string;
  total_benefits_label?: string;
  save_label?: string;
  price_hero_label?: string;
  price_hero_sub?: string;
  second_car_addon_price?: number;
  second_car_addon_title?: string;
  second_car_addon_description?: string;
  second_car_addon_icon?: string | null;
  second_car_addon_icon_class?: string | null;
  second_car_addon_icon_url?: string | null;
};

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function BenefitValue({ prefix, label }: { prefix?: string | null; label?: string | null }) {
  if (!label) return <span className="text-xs text-gray-400">—</span>;
  if (prefix) {
    return (
      <div className="text-right leading-tight">
        <div className="text-[9px] font-semibold text-gray-500">{prefix}</div>
        <div className="text-xs font-extrabold text-[#023D95]">{label}</div>
      </div>
    );
  }
  return <div className="text-xs font-extrabold text-[#023D95]">{label}</div>;
}

export default function MembershipValueCardPreview({
  plan,
  benefits,
}: {
  plan: PreviewPlanForm;
  benefits: PreviewBenefit[];
}) {
  const activeBenefits = benefits.filter((b) => b.active !== false);
  const totalValue = Number(plan.total_benefits_value || 0);
  const price = Number(plan.price || 0);
  const saveAmount = Math.max(0, totalValue - price);
  const benefitsHead = `BENEFITS FOR ${String(plan.name || 'MYFNG PRIME').toUpperCase()}`;

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">App Preview (Value Card)</div>
      <div className="rounded-3xl bg-white shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-[#023D95] px-5 py-3.5 flex items-center justify-between">
          <div>
            <div className="text-white text-xl font-extrabold">{plan.name || 'MyFNG Prime'}</div>
            {plan.tagline ? (
              <div className="text-[#9ec3f0] text-xs italic mt-0.5">{plan.tagline}</div>
            ) : null}
          </div>
          <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-xl">👑</div>
        </div>

        <div className="px-5 pt-4 pb-2">
          <div className="flex items-center justify-between text-[11px] font-extrabold tracking-wide text-[#023D95] mb-3">
            <span className="flex-1 pr-2">{benefitsHead}</span>
            <span>{plan.value_column_label || 'VALUE'}</span>
          </div>
          <div className="space-y-0">
            {activeBenefits.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">No benefits yet</p>
            ) : (
              activeBenefits.map((b, idx) => (
                <div
                  key={b.id || `${b.title}-${idx}`}
                  className={`flex items-start gap-3 py-3 ${idx < activeBenefits.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E6F0FB] overflow-hidden">
                    <MembershipIconPreview icon={b.icon} icon_url={b.icon_url} icon_class={b.icon_class} size={16} />
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="text-[13px] font-bold text-gray-900 leading-snug">{b.title}</div>
                    {b.description ? (
                      <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">{b.description}</div>
                    ) : null}
                  </div>
                  <BenefitValue prefix={b.value_prefix} label={b.value_label} />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mx-5 rounded-xl bg-[#F0F7FF] border border-[#BFDBFE] px-4 py-3 space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-700">{plan.total_benefits_label || 'Total Benefits Value'}</span>
            <span className="text-sm font-extrabold text-gray-400 line-through">{inr(totalValue)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-emerald-700">{plan.save_label || 'You Save'}</span>
            <span className="text-sm font-extrabold text-emerald-600">{inr(saveAmount)}</span>
          </div>
        </div>

        <div className="px-5 py-4 text-center">
          <div className="text-[10px] font-bold tracking-[0.2em] text-gray-500">
            {plan.price_hero_label || 'YOU PAY ONLY'}
          </div>
          <div className="text-3xl font-extrabold text-[#023D95] mt-1">
            {inr(price)}
            <span className="text-sm font-semibold text-gray-500 ml-1">{plan.period_label || '/ year'}</span>
          </div>
          {plan.price_hero_sub ? (
            <div className="text-[11px] text-gray-500 mt-1">{plan.price_hero_sub}</div>
          ) : null}
        </div>

        <div className="mx-5 mb-4 rounded-xl border border-dashed border-[#BFDBFE] bg-[#F8FAFC] p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[#E6F0FB] flex items-center justify-center overflow-hidden shrink-0">
            <MembershipIconPreview
              icon={plan.second_car_addon_icon}
              icon_url={plan.second_car_addon_icon_url}
              icon_class={plan.second_car_addon_icon_class}
              size={18}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-[#023D95]">{plan.second_car_addon_title || '2nd Car Add-On'}</div>
            <div className="text-[11px] text-gray-500 truncate">{plan.second_car_addon_description || ''}</div>
          </div>
          <div className="text-sm font-extrabold text-[#023D95] shrink-0">
            +{inr(Number(plan.second_car_addon_price || 0))}
          </div>
        </div>

        {plan.footer_note ? (
          <p className="text-center text-[10px] text-gray-400 px-5 pb-4 leading-relaxed">{plan.footer_note}</p>
        ) : null}
      </div>
    </div>
  );
}
