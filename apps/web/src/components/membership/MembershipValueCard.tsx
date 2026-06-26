'use client';

import React, { useState } from 'react';
import { MembershipIconPreview } from '@/components/admin/MembershipIconField';
import { addPublicMembershipPlanToCart } from '@/lib/membership-cart-web';
import { resolveMembershipWebCta } from '@/lib/membership-web-cta';
import type { PublicMembershipPlan } from '@/lib/public-membership-plan';
import { normalizeMembershipType } from '@/lib/membership-placements';

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

function BenefitValue({
  prefix,
  label,
  accent,
  compact = false,
}: {
  prefix?: string | null;
  label?: string | null;
  accent: string;
  compact?: boolean;
}) {
  if (!label) return <span className={`text-gray-400 ${compact ? 'text-[8px]' : 'text-xs'}`}>—</span>;
  if (prefix) {
    return (
      <div className="text-right leading-tight">
        <div className={`font-semibold text-gray-500 ${compact ? 'text-[7px]' : 'text-[9px]'}`}>{prefix}</div>
        <div className={`font-extrabold ${compact ? 'text-[8px]' : 'text-xs'}`} style={{ color: accent }}>
          {label}
        </div>
      </div>
    );
  }
  return (
    <div className={`font-extrabold ${compact ? 'text-[8px]' : 'text-xs'}`} style={{ color: accent }}>
      {label}
    </div>
  );
}

type Props = {
  plan: PublicMembershipPlan;
  compact?: boolean;
};

export default function MembershipValueCard({ plan, compact = false }: Props) {
  const [addSecondCar, setAddSecondCar] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRsa = normalizeMembershipType(plan.membershipType) === 'RSA';
  const accent = plan.accentColor || (isRsa ? '#F97316' : '#023D95');
  const onAccent = plan.accentTextColor || '#FFFFFF';
  const iconBg = hexWithAlpha(accent, '18');
  const totalBandBg = hexWithAlpha(accent, '0C');
  const totalBandBorder = hexWithAlpha(accent, '40');
  const headerSub = hexWithAlpha(onAccent, '99');
  const rsaPeriod = formatPeriodForRsa(plan.periodLabel);
  const saveAmount = Math.max(0, plan.totalBenefitsValue - plan.price);
  const showSecondCarAddon = plan.showSecondCarAddonWeb === true;
  const totalPay = plan.price + (showSecondCarAddon && addSecondCar ? plan.secondCarAddonPrice : 0);
  const benefitsHead = `BENEFITS FOR ${String(plan.name || 'MYFNG PRIME').toUpperCase()}`;
  const webCta = resolveMembershipWebCta(plan, totalPay);
  const ctaClass = `w-full rounded-lg font-extrabold text-white no-underline text-center ${
    compact ? 'py-2 text-[9px] leading-tight' : 'rounded-xl py-3.5 text-sm'
  }`;

  const handleAdd = async () => {
    setAdding(true);
    setError(null);
    const result = await addPublicMembershipPlanToCart(plan, {
      addSecondCar: showSecondCarAddon && addSecondCar,
    });
    if (!result.ok) setError(result.error || 'Could not add to cart.');
    setAdding(false);
  };

  const iconSize = compact ? 12 : 16;
  const addonIconSize = compact ? 14 : 18;

  return (
    <div
      className={`bg-white shadow-xl overflow-hidden border border-gray-100 h-full flex flex-col ${
        compact ? 'rounded-2xl shadow-md' : 'rounded-3xl'
      }`}
    >
      <div
        className={`flex items-center justify-between ${compact ? 'px-2.5 py-2' : 'px-5 py-3.5'}`}
        style={{ backgroundColor: accent, color: onAccent }}
      >
        <div className="min-w-0 pr-1">
          <div className={`font-extrabold leading-tight ${compact ? 'text-sm' : 'text-xl'}`}>{plan.name}</div>
          {plan.tagline ? (
            <div
              className={`italic mt-0.5 leading-snug ${compact ? 'text-[9px] line-clamp-2' : 'text-xs'}`}
              style={{ color: headerSub }}
            >
              {plan.tagline}
            </div>
          ) : null}
        </div>
        <div
          className={`rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0 ${
            compact ? 'h-7 w-7' : 'h-10 w-10'
          }`}
        >
          {plan.headerIconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={plan.headerIconUrl} alt="" className={`object-contain ${compact ? 'h-4 w-4' : 'h-6 w-6'}`} />
          ) : plan.headerIconClass ? (
            <i
              className={plan.headerIconClass}
              style={{ fontSize: compact ? 14 : 20, color: onAccent, lineHeight: 1 }}
              aria-hidden
            />
          ) : plan.headerIcon ? (
            <span className="text-[8px] font-bold uppercase" style={{ color: onAccent }}>
              {plan.headerIcon.slice(0, 4)}
            </span>
          ) : (
            <span className={compact ? 'text-sm' : 'text-xl'}>{isRsa ? '🛟' : '👑'}</span>
          )}
        </div>
      </div>

      <div className={`flex-1 ${compact ? 'px-2.5 pt-2 pb-1' : 'px-5 pt-4 pb-2'}`}>
        <div
          className={`flex items-center justify-between font-extrabold tracking-wide ${
            compact ? 'text-[7px] mb-1.5 gap-1 leading-tight' : 'text-[11px] mb-3'
          }`}
          style={{ color: accent }}
        >
          <span className={`flex-1 pr-1 ${compact ? 'line-clamp-2' : ''}`}>{benefitsHead}</span>
          <span className="shrink-0">{plan.valueColumnLabel}</span>
        </div>
        <div className="space-y-0">
          {plan.benefits.length === 0 ? (
            <p className={`text-gray-400 ${compact ? 'text-[10px] py-2' : 'text-sm py-4'}`}>No benefits listed</p>
          ) : (
            plan.benefits.map((b, idx) => (
              <div
                key={b.id || `${b.title}-${idx}`}
                className={`flex items-start gap-1.5 ${
                  compact ? 'py-1.5' : 'gap-3 py-3'
                } ${idx < plan.benefits.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <div
                  className={`flex shrink-0 items-center justify-center rounded-md overflow-hidden ${
                    compact ? 'h-5 w-5' : 'h-8 w-8 rounded-lg'
                  }`}
                  style={{ backgroundColor: iconBg }}
                >
                  <MembershipIconPreview icon={b.icon} icon_url={b.iconUrl} icon_class={b.iconClass} size={iconSize} />
                </div>
                <div className="flex-1 min-w-0 pr-1">
                  <div
                    className={`font-bold text-gray-900 leading-snug ${
                      compact ? 'text-[9px] line-clamp-2' : 'text-[13px]'
                    }`}
                  >
                    {b.title}
                  </div>
                  {b.description ? (
                    <div
                      className={`text-gray-500 mt-0.5 leading-snug ${
                        compact ? 'text-[7px] line-clamp-2' : 'text-[11px]'
                      }`}
                    >
                      {b.description}
                    </div>
                  ) : null}
                </div>
                <div className={`shrink-0 ${compact ? 'min-w-[42px]' : 'min-w-[72px]'}`}>
                  <BenefitValue prefix={b.valuePrefix} label={b.valueLabel} accent={accent} compact={compact} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div
        className={`rounded-lg border space-y-1 ${compact ? 'mx-2.5 px-2 py-1.5' : 'mx-5 rounded-xl px-4 py-3 space-y-1.5'}`}
        style={{ backgroundColor: totalBandBg, borderColor: totalBandBorder }}
      >
        <div className="flex justify-between items-center gap-1">
          <span className={`font-bold text-gray-700 ${compact ? 'text-[8px] leading-tight' : 'text-xs'}`}>
            {compact ? 'Total Value' : plan.totalBenefitsLabel}
          </span>
          <span className={`font-extrabold line-through ${compact ? 'text-[10px]' : 'text-sm'}`} style={{ color: accent }}>
            {inr(plan.totalBenefitsValue)}
          </span>
        </div>
        <div className="flex justify-between items-center gap-1">
          <span className={`font-bold text-emerald-700 ${compact ? 'text-[8px]' : 'text-xs'}`}>
            {plan.saveLabel}
          </span>
          <span className={`font-extrabold text-emerald-600 ${compact ? 'text-[10px]' : 'text-sm'}`}>
            {inr(saveAmount)}
          </span>
        </div>
      </div>

      <div className={compact ? 'px-2 py-2' : 'px-4 py-4'}>
        <div
          className={`rounded-lg text-center ${compact ? 'px-2 py-2' : 'rounded-xl px-3 py-3'}`}
          style={{ backgroundColor: accent, color: onAccent }}
        >
          <div
            className={`font-semibold tracking-wide opacity-90 ${
              compact ? 'text-[7px]' : isRsa ? 'text-[9px]' : 'text-[10px]'
            }`}
          >
            {plan.priceHeroLabel}
          </div>
          {isRsa ? (
            <>
              <div className={`font-extrabold leading-tight mt-0.5 ${compact ? 'text-base' : 'text-[22px]'}`}>
                {inr(plan.price)}
              </div>
              {rsaPeriod ? (
                <div className={`font-semibold opacity-90 ${compact ? 'text-[8px] mt-0.5 leading-tight' : 'text-[11px] mt-1'}`}>
                  {rsaPeriod}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="flex items-baseline justify-center gap-1 mt-1">
                <span className={`font-extrabold leading-none ${compact ? 'text-lg' : 'text-[28px]'}`}>
                  {inr(plan.price)}
                </span>
                <span className={`font-medium opacity-90 ${compact ? 'text-[10px]' : 'text-sm'}`}>
                  {plan.periodLabel}
                </span>
              </div>
              {plan.priceHeroSub ? (
                <div className={`opacity-75 ${compact ? 'text-[8px] mt-1' : 'text-[11px] mt-1.5'}`}>
                  {plan.priceHeroSub}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {showSecondCarAddon ? (
      <button
        type="button"
        className={`rounded-lg border border-dashed flex items-center text-left ${
          compact
            ? 'mx-2.5 mb-2 p-1.5 gap-1.5 w-[calc(100%-1.25rem)]'
            : 'mx-5 mb-3 rounded-xl p-3 gap-3 w-[calc(100%-2.5rem)]'
        }`}
        style={{ borderColor: totalBandBorder, backgroundColor: addSecondCar ? hexWithAlpha(accent, '0C') : '#F8FAFC' }}
        onClick={() => setAddSecondCar((v) => !v)}
      >
        <span className={`leading-none ${compact ? 'text-sm' : 'text-lg'}`}>{addSecondCar ? '☑' : '☐'}</span>
        <div
          className={`rounded-md flex items-center justify-center overflow-hidden shrink-0 ${
            compact ? 'h-6 w-6' : 'h-9 w-9 rounded-lg'
          }`}
          style={{ backgroundColor: iconBg }}
        >
          <MembershipIconPreview
            icon={plan.secondCarAddonIcon}
            icon_url={plan.secondCarAddonIconUrl}
            icon_class={plan.secondCarAddonIconClass}
            size={addonIconSize}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-bold leading-tight ${compact ? 'text-[9px]' : 'text-sm'}`} style={{ color: accent }}>
            {plan.secondCarAddonTitle}
          </div>
          {!compact ? (
            <div className="text-[11px] text-gray-500 truncate">{plan.secondCarAddonDescription}</div>
          ) : null}
        </div>
        <div className={`font-extrabold shrink-0 ${compact ? 'text-[9px]' : 'text-sm'}`} style={{ color: accent }}>
          +{inr(plan.secondCarAddonPrice)}
        </div>
      </button>
      ) : null}

      <div className={`mt-auto ${compact ? 'px-2.5 pb-2.5' : 'px-5 pb-4'}`}>
        {webCta.kind === 'link' ? (
          <a
            href={webCta.href}
            target={webCta.external ? '_blank' : undefined}
            rel={webCta.external ? 'noopener noreferrer' : undefined}
            className={`block ${ctaClass}`}
            style={{ backgroundColor: accent }}
          >
            {webCta.label}
          </a>
        ) : (
          <button
            type="button"
            disabled={adding}
            onClick={handleAdd}
            className={`${ctaClass} disabled:opacity-60`}
            style={{ backgroundColor: accent }}
          >
            {adding ? 'Adding…' : webCta.label}
          </button>
        )}
        {error ? <p className="mt-1 text-center text-[9px] text-red-600">{error}</p> : null}
      </div>

      {plan.footerNote ? (
        <p
          className={`text-center text-gray-400 leading-snug ${
            compact ? 'text-[7px] px-2 pb-2' : 'text-[10px] px-5 pb-4 leading-relaxed'
          }`}
        >
          {plan.footerNote}
        </p>
      ) : null}
    </div>
  );
}
