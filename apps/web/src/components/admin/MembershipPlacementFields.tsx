'use client';

import {
  GLOBAL_PLACEMENT_OPTIONS,
  HOME_PLACEMENT_OPTIONS,
  RSA_PLACEMENT_OPTIONS,
  SERVICES_PLACEMENT_OPTIONS,
  type AppPlacements,
  type MembershipType,
} from '@/lib/membership-placements';

type Props = {
  membershipType: MembershipType;
  placements: AppPlacements;
  onChange: (next: AppPlacements) => void;
};

function toggleGlobal(placements: AppPlacements, key: keyof AppPlacements, checked: boolean): AppPlacements {
  return { ...placements, [key]: checked };
}

function toggleNested(
  placements: AppPlacements,
  screen: 'home' | 'rsa' | 'services',
  key: string,
  checked: boolean,
): AppPlacements {
  return {
    ...placements,
    [screen]: {
      ...(placements[screen] || {}),
      [key]: checked,
    },
  };
}

export default function MembershipPlacementFields({ membershipType, placements, onChange }: Props) {
  const screenOptions =
    membershipType === 'RSA'
      ? [{ title: 'RSA Screen', options: RSA_PLACEMENT_OPTIONS, screen: 'rsa' as const }]
      : [
          { title: 'Home Screen', options: HOME_PLACEMENT_OPTIONS, screen: 'home' as const },
          { title: 'Services Screen', options: SERVICES_PLACEMENT_OPTIONS, screen: 'services' as const },
        ];

  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3 space-y-3">
      <div>
        <div className="text-xs font-bold text-violet-900 uppercase tracking-wide">App placement (Android &amp; iOS)</div>
        <p className="text-[11px] text-violet-700/80 mt-1">
          Choose where this membership appears. Hide from app UI using &quot;Show in app&quot; below — plan stays active for existing members.
        </p>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">All screens</div>
        {GLOBAL_PLACEMENT_OPTIONS.map((opt) => (
          <label key={String(opt.key)} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={Boolean(placements[opt.key])}
              onChange={(e) => onChange(toggleGlobal(placements, opt.key, e.target.checked))}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>

      {screenOptions.map(({ title, options, screen }) => (
        <div key={title} className="space-y-2 pt-2 border-t border-violet-100">
          <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">{title}</div>
          {options.map((opt) => (
            <label key={opt.key} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={Boolean(placements[screen]?.[opt.key as keyof typeof placements[typeof screen]])}
                onChange={(e) => onChange(toggleNested(placements, screen, opt.key, e.target.checked))}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}
