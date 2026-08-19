'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Trophy,
  Phone,
  Download,
  GitMerge,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';
import { useCrmPermissions } from '@/lib/telecaller/useCrmPermissions';

export function CrmReportsNav({
  title,
  subtitle,
  onRefresh,
  refreshing,
  actions,
}: {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const { base, isLeadManager } = getCrmDashboardBase(pathname);
  const { permissions, loading: permLoading } = useCrmPermissions();

  const tabs = [
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy, show: permissions.reports },
    { id: 'calls', label: 'Calls', icon: Phone, show: permissions.reports },
    {
      id: 'exports',
      label: 'Exports',
      icon: Download,
      show: Boolean(isLeadManager || (!permLoading && permissions.reports_export)),
    },
    {
      id: 'duplicates',
      label: 'Duplicates',
      icon: GitMerge,
      show: Boolean(isLeadManager || (!permLoading && permissions.reports_duplicates)),
    },
    {
      id: 'pipeline',
      label: 'Pipeline',
      icon: BarChart3,
      show: isLeadManager,
    },
  ].filter((t) => t.show);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[#023D95] flex items-center gap-2">
            {title}
            {onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#004AAD]"
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            ) : null}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-snug">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2 w-full sm:w-auto">{actions}</div> : null}
      </div>

      <div className="-mx-1 px-1 flex gap-1 overflow-x-auto border-b border-slate-200 pb-px scrollbar-thin">
        {tabs.map((tab) => {
          const href = `${base}/reports/${tab.id}`;
          const active = pathname?.includes(`/reports/${tab.id}`);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              href={href}
              className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-bold transition ${
                active
                  ? 'border-[#004AAD] text-[#023D95]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function PeriodTabs({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: 'day' | 'week' | 'month' | 'year') => void;
}) {
  const items: Array<{ id: 'day' | 'week' | 'month' | 'year'; label: string }> = [
    { id: 'day', label: 'Day' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'year', label: 'Year' },
  ];
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`shrink-0 rounded-lg px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wide transition ${
            value === item.id
              ? 'bg-[#023D95] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
