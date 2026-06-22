import React from 'react';
import { ChevronDown, Search, TrendingDown, TrendingUp } from 'lucide-react';

const pcmSelectClass =
  'appearance-none w-full sm:w-auto min-w-[140px] pl-3 pr-9 py-2.5 text-sm rounded-lg border border-[#e6e0da] bg-white text-[#15110d] focus:outline-none focus:ring-2 focus:ring-[#e54800]/20 focus:border-[#e54800] cursor-pointer';

function PcmFilterSelect({
  value,
  onChange,
  options,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  'aria-label'?: string;
}) {
  return (
    <div className="relative w-full sm:w-auto">
      <select
        className={pcmSelectClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
    </div>
  );
}

export function PcmCouponSearchBar({
  searchValue,
  onSearchChange,
  statusValue,
  onStatusChange,
  typeValue,
  onTypeChange,
  typeOptions,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusValue: string;
  onStatusChange: (value: string) => void;
  typeValue: string;
  onTypeChange: (value: string) => void;
  typeOptions?: Array<{ value: string; label: string }>;
}) {
  const types = typeOptions?.length
    ? typeOptions
    : [
        { value: 'all', label: 'All Types' },
        { value: 'flat', label: 'Flat Discount' },
        { value: 'percent', label: 'Percentage Discount' },
        { value: 'free_service', label: 'Free Service' },
      ];

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
        <input
          type="search"
          className="w-full rounded-lg border border-[#e6e0da] bg-white py-2.5 pl-9 pr-3 text-sm text-[#15110d] placeholder:text-[#9ca3af] focus:border-[#e54800] focus:outline-none focus:ring-2 focus:ring-[#e54800]/20"
          placeholder="Search by name or code..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <PcmFilterSelect
        aria-label="Filter by status"
        value={statusValue}
        onChange={onStatusChange}
        options={[
          { value: 'all', label: 'All Status' },
          { value: 'active', label: 'Active' },
          { value: 'paused', label: 'Paused' },
          { value: 'expired', label: 'Expired' },
          { value: 'inactive', label: 'Inactive' },
        ]}
      />
      <PcmFilterSelect
        aria-label="Filter by type"
        value={typeValue}
        onChange={onTypeChange}
        options={types}
      />
    </div>
  );
}

export function PcmPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[#15110d]">{title}</h2>
        {description ? <p className="text-sm text-[#72665e] mt-0.5">{description}</p> : null}
      </div>
      {actions ? <div className="flex gap-2 flex-wrap">{actions}</div> : null}
    </div>
  );
}

const accentMap = {
  primary: 'bg-blue-500/10 text-blue-600',
  emerald: 'bg-emerald-500/10 text-emerald-600',
  amber: 'bg-amber-500/10 text-amber-600',
  violet: 'bg-violet-500/10 text-violet-600',
  rose: 'bg-rose-500/10 text-rose-600',
  sky: 'bg-sky-500/10 text-sky-600',
} as const;

export function PcmStatCard({
  label,
  value,
  subtitle,
  trend,
  trendLabel = 'vs last month',
  icon,
  accent = 'primary',
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  trendLabel?: string;
  icon: React.ReactNode;
  accent?: keyof typeof accentMap;
}) {
  const trendUp = trend != null && trend >= 0;
  return (
    <div className="pcm-card rounded-xl border p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-[#72665e]">{label}</p>
          <p className="text-2xl font-bold mt-1.5 text-[#15110d]">{value}</p>
          {subtitle ? <p className="text-xs text-[#72665e] mt-1">{subtitle}</p> : null}
          {trend != null ? (
            <p className={`text-xs mt-2 flex items-center gap-1 ${trendUp ? 'text-emerald-600' : 'text-rose-600'}`}>
              {trendUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {Math.abs(trend)}% {trendLabel}
            </p>
          ) : null}
        </div>
        <div className={`h-11 w-11 rounded-lg flex items-center justify-center shrink-0 ${accentMap[accent]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export function PcmStatusBadge({ status }: { status: string }) {
  const s = String(status || '').toLowerCase();
  const styles =
    s === 'active' || s === 'sent' || s === 'delivered'
      ? 'bg-emerald-100 text-emerald-700'
      : s === 'inactive' || s === 'paused' || s === 'cancelled'
        ? 'bg-gray-100 text-gray-600'
        : s === 'expired' || s === 'failed'
          ? 'bg-rose-100 text-rose-700'
          : 'bg-amber-100 text-amber-800';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${styles}`}>
      {status}
    </span>
  );
}

export function PcmEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="pcm-card rounded-xl border py-16 px-6 text-center">
      <div className="mx-auto h-14 w-14 rounded-full bg-[#f7f3ec] flex items-center justify-center text-[#72665e] mb-4">
        <span className="text-2xl">◎</span>
      </div>
      <h3 className="font-semibold text-[#15110d]">{title}</h3>
      <p className="text-sm text-[#72665e] mt-1 max-w-md mx-auto">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
