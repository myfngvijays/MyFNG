'use client';

import {
  HOME_PLACEMENT_OPTIONS,
  RSA_PLACEMENT_OPTIONS,
  SERVICES_PLACEMENT_OPTIONS,
  clearHomeSlot,
  clearRsaSlot,
  clearServicesSlot,
  getActiveHomeSlot,
  getActiveRsaSlot,
  getActiveServicesSlot,
  moveHomeSlot,
  moveRsaSlot,
  moveServicesSlot,
  selectHomeSlot,
  selectRsaSlot,
  selectServicesSlot,
  type AppPlacements,
  type HomePlacementSlot,
  type MembershipType,
  type RsaPlacementSlot,
  type ServicesPlacementSlot,
} from '@/lib/membership-placements';

type Props = {
  membershipType: MembershipType;
  placements: AppPlacements;
  onChange: (next: AppPlacements) => void;
};

type PlacementOption = { key: string; label: string };

function PlacementRadioGroup({
  title,
  hint,
  name,
  options,
  activeSlot,
  onSelectNone,
  onSelect,
  onMoveUp,
  onMoveDown,
}: {
  title: string;
  hint?: string;
  name: string;
  options: PlacementOption[];
  activeSlot: string | null;
  onSelectNone: () => void;
  onSelect: (key: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="space-y-2 pt-2 border-t border-violet-100">
      <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">{title}</div>
      {hint ? <p className="text-[11px] text-gray-500">{hint}</p> : null}
      <label className="flex items-start gap-2 text-sm">
        <input
          type="radio"
          name={name}
          className="mt-0.5"
          checked={!activeSlot}
          onChange={onSelectNone}
        />
        <span className="text-gray-600">Don&apos;t show on this screen</span>
      </label>
      {options.map((opt, idx) => {
        const checked = activeSlot === opt.key;
        return (
          <div key={opt.key} className="flex items-center gap-2">
            <label className="flex flex-1 items-start gap-2 text-sm">
              <input
                type="radio"
                name={name}
                className="mt-0.5"
                checked={checked}
                onChange={() => onSelect(opt.key)}
              />
              <span>{opt.label}</span>
            </label>
            {checked ? (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  className="px-2 py-1 text-xs rounded border border-violet-200 bg-white disabled:opacity-40"
                  disabled={idx === 0}
                  onClick={onMoveUp}
                  title="Move block up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="px-2 py-1 text-xs rounded border border-violet-200 bg-white disabled:opacity-40"
                  disabled={idx === options.length - 1}
                  onClick={onMoveDown}
                  title="Move block down"
                >
                  ↓
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function MembershipPlacementFields({ membershipType, placements, onChange }: Props) {
  const activeRsaSlot = membershipType === 'RSA' ? getActiveRsaSlot(placements) : null;
  const activeHomeSlot = membershipType === 'SERVICE' ? getActiveHomeSlot(placements) : null;
  const activeServicesSlot = membershipType === 'SERVICE' ? getActiveServicesSlot(placements) : null;

  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3 space-y-3">
      <div>
        <div className="text-xs font-bold text-violet-900 uppercase tracking-wide">App placement (Android &amp; iOS)</div>
        <p className="text-[11px] text-violet-700/80 mt-1">
          {membershipType === 'RSA'
            ? 'Membership page and/or one position on the RSA screen. Use arrows to move the block up or down.'
            : 'Membership page and/or one position each on Home and Services screens. Use arrows to move the banner up or down.'}
        </p>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">Membership page</div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={Boolean(placements.settings_page)}
            onChange={(e) => onChange({ ...placements, settings_page: e.target.checked })}
          />
          <span>Settings → Membership page (full value card)</span>
        </label>
      </div>

      {membershipType === 'RSA' ? (
        <PlacementRadioGroup
          title="RSA screen"
          hint="Pick where this RSA plan appears on the Roadside Assistance screen."
          name="rsa-placement"
          options={RSA_PLACEMENT_OPTIONS}
          activeSlot={activeRsaSlot}
          onSelectNone={() => onChange(clearRsaSlot(placements))}
          onSelect={(key) => onChange(selectRsaSlot(placements, key as RsaPlacementSlot))}
          onMoveUp={() => onChange(moveRsaSlot(placements, 'up'))}
          onMoveDown={() => onChange(moveRsaSlot(placements, 'down'))}
        />
      ) : (
        <>
          <PlacementRadioGroup
            title="Home screen"
            hint="Pick where the MyFNG Prime card appears on the Home screen."
            name="home-placement"
            options={HOME_PLACEMENT_OPTIONS}
            activeSlot={activeHomeSlot}
            onSelectNone={() => onChange(clearHomeSlot(placements))}
            onSelect={(key) => onChange(selectHomeSlot(placements, key as HomePlacementSlot))}
            onMoveUp={() => onChange(moveHomeSlot(placements, 'up'))}
            onMoveDown={() => onChange(moveHomeSlot(placements, 'down'))}
          />
          <PlacementRadioGroup
            title="Services screen"
            hint="Pick where the MyFNG Prime card appears on the Services screen."
            name="services-placement"
            options={SERVICES_PLACEMENT_OPTIONS}
            activeSlot={activeServicesSlot}
            onSelectNone={() => onChange(clearServicesSlot(placements))}
            onSelect={(key) => onChange(selectServicesSlot(placements, key as ServicesPlacementSlot))}
            onMoveUp={() => onChange(moveServicesSlot(placements, 'up'))}
            onMoveDown={() => onChange(moveServicesSlot(placements, 'down'))}
          />
        </>
      )}
    </div>
  );
}
