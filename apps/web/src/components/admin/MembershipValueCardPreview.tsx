'use client';

import React from 'react';
import { MembershipIconPreview } from './MembershipIconField';
import { normalizeMembershipType } from '@/lib/membership-placements';

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
  show_claim_button?: boolean;
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
  show_second_car_addon_app?: boolean;
  show_second_car_addon_web?: boolean;
  header_icon?: string | null;
  header_icon_class?: string | null;
  header_icon_url?: string | null;
  membership_type?: string;
  accent_color?: string | null;
  accent_text_color?: string | null;
};

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function hexWithAlpha(hex: string, alphaHex: string) {
  const clean = hex.replace('#', '');
  if (clean.length === 6) return `#${clean}${alphaHex}`;
  return hex;
}

function formatPeriodForRsa(raw?: string | null) {
  return String(raw || '')
    .replace(/^\s*\/?\s*/, '')
    .trim();
}

function BenefitValue({ prefix, label, accent }: { prefix?: string | null; label?: string | null; accent: string }) {
  if (!label) return <span className="text-xs text-gray-400">—</span>;
  if (prefix) {
    return (
      <div className="text-right leading-tight">
        <div className="text-[9px] font-semibold text-gray-500">{prefix}</div>
        <div className="text-xs font-extrabold" style={{ color: accent }}>
          {label}
        </div>
      </div>
    );
  }
  return (
    <div className="text-xs font-extrabold" style={{ color: accent }}>
      {label}
    </div>
  );
}

export default function MembershipValueCardPreview({
  plan,
  benefits,
}: {
  plan: PreviewPlanForm;
  benefits: PreviewBenefit[];
}) {
  const activeBenefits = benefits.filter((b) => b.active !== false);
  const hasClaimButtons = activeBenefits.some((b) => b.show_claim_button === true);
  const totalValue = Number(plan.total_benefits_value || 0);
  const price = Number(plan.price || 0);
  const saveAmount = Math.max(0, totalValue - price);
  const benefitsHead = `BENEFITS FOR ${String(plan.name || 'MYFNG PRIME').toUpperCase()}`;
  const isRsa = normalizeMembershipType(plan.membership_type) === 'RSA';
  const accent = plan.accent_color || (isRsa ? '#F97316' : '#023D95');
  const onAccent = plan.accent_text_color || '#FFFFFF';
  const iconBg = hexWithAlpha(accent, '18');
  const totalBandBg = hexWithAlpha(accent, '0C');
  const totalBandBorder = hexWithAlpha(accent, '40');
  const headerSub = hexWithAlpha(onAccent, '99');
  const rsaPeriod = formatPeriodForRsa(plan.period_label);

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
        App Preview ({isRsa ? 'RSA Value Card' : 'Service Value Card'})
      </div>
      <div className="rounded-3xl bg-white shadow-xl overflow-hidden border border-gray-100">
        <div className="px-5 py-3.5 flex items-center justify-between" style={{ backgroundColor: accent, color: onAccent }}>
          <div>
            <div className="text-xl font-extrabold">{plan.name || 'MyFNG Prime'}</div>
            {plan.tagline ? (
              <div className="text-xs italic mt-0.5" style={{ color: headerSub }}>
                {plan.tagline}
              </div>
            ) : null}
          </div>
          <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
            {plan.header_icon_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={plan.header_icon_url} alt="" className="h-6 w-6 object-contain" />
            ) : plan.header_icon_class ? (
              <i className={plan.header_icon_class} style={{ fontSize: 20, color: onAccent, lineHeight: 1 }} aria-hidden />
            ) : plan.header_icon ? (
              <span className="text-[10px] font-bold uppercase" style={{ color: onAccent }}>
                {plan.header_icon.slice(0, 4)}
              </span>
            ) : (
              <span className="text-xl">{isRsa ? '🛟' : '👑'}</span>
            )}
          </div>
        </div>

        {hasClaimButtons ? (
          <div className="mx-5 mt-3 mb-1 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <span className="text-sm leading-none">✓</span>
            <span className="text-[11px] font-semibold text-emerald-800">
              Active members see Claim buttons on highlighted benefits
            </span>
          </div>
        ) : null}

        <div className="px-5 pt-4 pb-2">
          <div className="flex items-center justify-between text-[11px] font-extrabold tracking-wide mb-3" style={{ color: accent }}>
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
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg overflow-hidden"
                    style={{ backgroundColor: iconBg }}
                  >
                    <MembershipIconPreview icon={b.icon} icon_url={b.icon_url} icon_class={b.icon_class} size={16} />
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="text-[13px] font-bold text-gray-900 leading-snug">{b.title}</div>
                    {b.description ? (
                      <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">{b.description}</div>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0 min-w-[72px]">
                    <BenefitValue prefix={b.value_prefix} label={b.value_label} accent={accent} />
                    {b.show_claim_button ? (
                      <span className="rounded-full bg-[#004AAD] px-2.5 py-1 text-[10px] font-extrabold text-white">
                        Claim
                      </span>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div
          className="mx-5 rounded-xl px-4 py-3 space-y-1.5 border"
          style={{ backgroundColor: totalBandBg, borderColor: totalBandBorder }}
        >
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-700">{plan.total_benefits_label || 'Total Benefits Value'}</span>
            <span className="text-sm font-extrabold line-through" style={{ color: accent }}>
              {inr(totalValue)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-emerald-700">{plan.save_label || 'You Save'}</span>
            <span className="text-sm font-extrabold text-emerald-600">{inr(saveAmount)}</span>
          </div>
        </div>

        <div className="px-4 py-4">
          <div
            className="rounded-xl px-3 py-3 text-center"
            style={{ backgroundColor: accent, color: onAccent }}
          >
            <div className={`font-semibold tracking-wide opacity-90 ${isRsa ? 'text-[9px]' : 'text-[10px]'}`}>
              {plan.price_hero_label || 'YOU PAY ONLY'}
            </div>
            {isRsa ? (
              <>
                <div className="text-[22px] font-extrabold leading-tight mt-1">{inr(price)}</div>
                {rsaPeriod ? (
                  <div className="text-[11px] font-semibold mt-1 opacity-90">{rsaPeriod}</div>
                ) : null}
              </>
            ) : (
              <>
                <div className="flex items-baseline justify-center gap-1 mt-1">
                  <span className="text-[28px] font-extrabold leading-none">{inr(price)}</span>
                  <span className="text-sm font-medium opacity-90">{plan.period_label || '/ year'}</span>
                </div>
                {plan.price_hero_sub ? (
                  <div className="text-[11px] opacity-75 mt-1.5">{plan.price_hero_sub}</div>
                ) : null}
              </>
            )}
          </div>
        </div>

        {plan.show_second_car_addon_app !== false ? (
        <div
          className="mx-5 mb-4 rounded-xl border border-dashed p-3 flex items-center gap-3"
          style={{ borderColor: totalBandBorder, backgroundColor: '#F8FAFC' }}
        >
          <div className="h-9 w-9 rounded-lg flex items-center justify-center overflow-hidden shrink-0" style={{ backgroundColor: iconBg }}>
            <MembershipIconPreview
              icon={plan.second_car_addon_icon}
              icon_url={plan.second_car_addon_icon_url}
              icon_class={plan.second_car_addon_icon_class}
              size={18}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold" style={{ color: accent }}>
              {plan.second_car_addon_title || '2nd Car Add-On'}
            </div>
            <div className="text-[11px] text-gray-500 truncate">{plan.second_car_addon_description || ''}</div>
          </div>
          <div className="text-sm font-extrabold shrink-0" style={{ color: accent }}>
            +{inr(Number(plan.second_car_addon_price || 0))}
          </div>
        </div>
        ) : (
          <p className="mx-5 mb-4 text-center text-[10px] text-gray-400">2nd car add-on hidden in mobile app</p>
        )}

        {plan.footer_note ? (
          <p className="text-center text-[10px] text-gray-400 px-5 pb-4 leading-relaxed">{plan.footer_note}</p>
        ) : null}
      </div>
    </div>
  );
}
