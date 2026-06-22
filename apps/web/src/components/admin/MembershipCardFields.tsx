'use client';

import {
  HOME_CARD_PLACEMENT_OPTIONS,
  RSA_CARD_PLACEMENT_OPTIONS,
  SEARCH_CARD_PLACEMENT_OPTIONS,
  SERVICES_CARD_PLACEMENT_OPTIONS,
  toggleCardPlacement,
  type CardPlacements,
} from '@/lib/membership-card-placements';
import type { MembershipType } from '@/lib/membership-placements';

type Props = {
  title: string;
  badge: string;
  cardStyle: MembershipType;
  price: number;
  originalPrice: number;
  cardBenefitLine1: string;
  cardBenefitLine2: string;
  cardAnimated: boolean;
  active: boolean;
  placements: CardPlacements;
  onChange: (patch: Record<string, unknown>) => void;
  onChangePlacements: (next: CardPlacements) => void;
};

function CheckboxGroup({
  title: groupTitle,
  screen,
  options,
  placements,
  onChangePlacements,
}: {
  title: string;
  screen: 'home' | 'search' | 'services' | 'rsa';
  options: Array<{ key: string; label: string }>;
  placements: CardPlacements;
  onChangePlacements: (next: CardPlacements) => void;
}) {
  const section = (placements[screen] || {}) as Record<string, boolean>;
  return (
    <div className="space-y-2 pt-2 border-t border-amber-100">
      <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">{groupTitle}</div>
      {options.map((opt) => (
        <label key={opt.key} className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={Boolean(section[opt.key])}
            onChange={(e) => onChangePlacements(toggleCardPlacement(placements, screen, opt.key, e.target.checked))}
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

export default function MembershipCardFields({
  title,
  badge,
  cardStyle,
  price,
  originalPrice,
  cardBenefitLine1,
  cardBenefitLine2,
  cardAnimated,
  active,
  placements,
  onChange,
  onChangePlacements,
}: Props) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-3">
      <div>
        <div className="text-xs font-bold text-amber-900 uppercase tracking-wide">Card details</div>
        <p className="text-[11px] text-amber-800/80 mt-1">
          Independent promo card — not linked to Membership Plans. Pick any screen sections below.
        </p>
      </div>

      <div>
        <label className="text-xs font-bold text-gray-600">Card title</label>
        <input
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          value={title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="MyFNG Prime"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-bold text-gray-600">Badge</label>
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            value={badge}
            onChange={(e) => onChange({ badge: e.target.value })}
            placeholder="PRIME"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-600">Color style</label>
          <select
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            value={cardStyle}
            onChange={(e) => onChange({ card_style: e.target.value })}
          >
            <option value="SERVICE">Blue / Red (Prime)</option>
            <option value="RSA">Red (RSA)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-bold text-gray-600">Original Price (₹)</label>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            value={originalPrice}
            onChange={(e) => onChange({ original_price: Number(e.target.value) || 0 })}
          />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-600">Sale Price (₹)</label>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            value={price}
            onChange={(e) => onChange({ price: Number(e.target.value) || 0 })}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <div>
          <label className="text-xs font-bold text-gray-600">Benefit line 1</label>
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            value={cardBenefitLine1}
            onChange={(e) => onChange({ benefit_line_1: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-600">Benefit line 2</label>
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            value={cardBenefitLine2}
            onChange={(e) => onChange({ benefit_line_2: e.target.value })}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={cardAnimated}
          onChange={(e) => onChange({ card_animated: e.target.checked })}
        />
        Animated color cycle
      </label>

      <label className="flex items-center gap-2 text-sm font-semibold rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2.5">
        <input type="checkbox" checked={active} onChange={(e) => onChange({ active: e.target.checked })} />
        Active — show this card in app
      </label>

      <div className="pt-1">
        <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1">Placements (multi-select)</div>
        <p className="text-[11px] text-gray-500 mb-2">Same slot par multiple cards = horizontal slide carousel</p>
        <CheckboxGroup title="Home screen" screen="home" options={HOME_CARD_PLACEMENT_OPTIONS} placements={placements} onChangePlacements={onChangePlacements} />
        <CheckboxGroup title="Search overlay" screen="search" options={SEARCH_CARD_PLACEMENT_OPTIONS} placements={placements} onChangePlacements={onChangePlacements} />
        <CheckboxGroup title="Services screen" screen="services" options={SERVICES_CARD_PLACEMENT_OPTIONS} placements={placements} onChangePlacements={onChangePlacements} />
        <CheckboxGroup title="RSA screen" screen="rsa" options={RSA_CARD_PLACEMENT_OPTIONS} placements={placements} onChangePlacements={onChangePlacements} />
      </div>
    </div>
  );
}
