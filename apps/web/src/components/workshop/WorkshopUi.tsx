'use client';

import type { ReactNode } from 'react';
import { AdvisorCard, AdvisorPageHeader } from '@/components/advisor/AdvisorPageHeader';

export { AdvisorCard as WorkshopCard, AdvisorPageHeader as WorkshopPageHeader };

export const WORKSHOP_ROLE_LABEL = {
  owner: 'Workshop Owner',
  mechanic: 'Workshop Mechanic',
  pickup: 'Pickupboy / Driver',
} as const;

export function WorkshopPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-3 overflow-x-hidden pb-8 sm:space-y-4">
      {children}
    </div>
  );
}

export function WorkshopStatTile({
  label,
  value,
  icon,
  tone,
  loading,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: string;
  loading?: boolean;
}) {
  const tint =
    tone?.includes('yellow') || tone?.includes('amber')
      ? 'bg-[#FFFBEB]'
      : tone?.includes('green')
        ? 'bg-[#ECFDF5]'
        : tone?.includes('red') || tone?.includes('orange')
          ? 'bg-[#FEF2F2]'
          : tone?.includes('purple')
            ? 'bg-[#F5F3FF]'
            : tone?.includes('blue')
              ? 'bg-[#EFF6FF]'
              : 'bg-white';

  return (
    <div className={`rounded-2xl border border-slate-200 ${tint} p-3 shadow-sm sm:p-3.5`}>
      <div className="flex items-center gap-2">
        {icon}
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:text-[11px]">{label}</p>
          <p className="text-xl font-extrabold text-[#023D95] sm:text-2xl">{loading ? '—' : value}</p>
        </div>
      </div>
    </div>
  );
}

export function WorkshopFilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition sm:px-4 sm:py-2 sm:text-sm ${
        active
          ? 'bg-[#023D95] text-white shadow-sm'
          : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
      }`}
    >
      {children}
    </button>
  );
}

export function WorkshopEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

export function WorkshopStatusPill({
  tone = 'blue',
  children,
}: {
  tone?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'slate';
  children: ReactNode;
}) {
  const tones = {
    blue: 'bg-[#EFF6FF] text-[#1D4ED8]',
    green: 'bg-[#ECFDF5] text-[#047857]',
    yellow: 'bg-[#FFFBEB] text-[#B45309]',
    red: 'bg-[#FEF2F2] text-[#B91C1C]',
    purple: 'bg-[#F5F3FF] text-[#6D28D9]',
    slate: 'bg-slate-100 text-slate-700',
  };
  return (
    <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}
