'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';
import DashboardLayout from '@/components/DashboardLayout';
import TelecallerAanshBar from '@/components/telecaller/TelecallerAanshBar';
import {
  CRM_DATE_PRESETS,
  resolveCrmDateRange,
  type CrmDatePreset,
} from '@/lib/telecaller/crmDateRange';
import {
  loadTelecallerCrmFilterPrefs,
  saveTelecallerCrmFilterPrefs,
} from '@/lib/telecaller/crmFilterPrefs';
import {
  Phone,
  Calendar,
  ClipboardList,
  MessageCircle,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Check,
  Loader2,
  CalendarDays,
} from 'lucide-react';

type Kpis = {
  new_leads?: number;
  incomplete?: number;
  interested?: number;
  will_visit?: number;
  booking_confirmed?: number;
  in_service?: number;
  service_done?: number;
  lost?: number;
  callbacks?: number;
  followups_today?: number;
  booked?: number;
  rejected?: number;
  today_calls?: number;
  answered_calls?: number;
  answer_rate?: number;
};

type TrendRow = {
  date?: string;
  label?: string;
  calls?: number;
  leads_created?: number;
};

function SimpleBarChart({
  title,
  data,
  color,
}: {
  title: string;
  data: Array<{ label: string; value: number }>;
  color: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
      <h2 className="mb-3 text-[15px] font-bold text-[#023D95]">{title}</h2>
      <div className="flex h-40 items-end gap-2">
        {data.map((t, i) => {
          const h = Math.max(4, (t.value / max) * 100);
          return (
            <div key={`${t.label}-${i}`} className="flex flex-1 flex-col items-center gap-1 min-w-0">
              <span className="text-[10px] font-bold text-slate-600">{t.value}</span>
              <div
                className="w-full max-w-[28px] rounded-t-lg"
                style={{ height: `${h}%`, backgroundColor: color, minHeight: 4 }}
                title={`${t.value}`}
              />
              <span className="text-[10px] font-semibold text-slate-500 truncate w-full text-center">
                {t.label}
              </span>
            </div>
          );
        })}
        {data.length === 0 ? (
          <div className="w-full text-center text-xs text-slate-400 py-10">No data</div>
        ) : null}
      </div>
    </div>
  );
}

export default function TelecallerCrmHomePage() {
  const pathname = usePathname();
  const { base, layoutRole, isLeadManager } = getCrmDashboardBase(pathname);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kpis, setKpis] = useState<Kpis>({});
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [profileName, setProfileName] = useState('Telecaller');
  const [punchedIn, setPunchedIn] = useState(false);
  const [datePreset, setDatePreset] = useState<CrmDatePreset>(
    () => loadTelecallerCrmFilterPrefs().datePreset,
  );
  const [customStart, setCustomStart] = useState(
    () => loadTelecallerCrmFilterPrefs().customStart,
  );
  const [customEnd, setCustomEnd] = useState(() => loadTelecallerCrmFilterPrefs().customEnd);
  const [dateOpen, setDateOpen] = useState(false);

  const persistDate = (next: {
    datePreset?: CrmDatePreset;
    customStart?: string;
    customEnd?: string;
  }) => {
    if (next.datePreset) setDatePreset(next.datePreset);
    if (next.customStart) setCustomStart(next.customStart);
    if (next.customEnd) setCustomEnd(next.customEnd);
    saveTelecallerCrmFilterPrefs(next);
  };

  const dateRange = useMemo(
    () => resolveCrmDateRange(datePreset, customStart, customEnd),
    [datePreset, customStart, customEnd],
  );
  const dateLabel =
    CRM_DATE_PRESETS.find((p) => p.value === datePreset)?.label || dateRange.label;

  const load = useCallback(async () => {
    try {
      const range = resolveCrmDateRange(datePreset, customStart, customEnd);
      const params = new URLSearchParams();
      params.set('from', range.start);
      params.set('to', range.end);
      const res = await fetch(`/api/telecaller/crm/dashboard?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setKpis(json.kpis || {});
      setTrend(Array.isArray(json.trend) ? json.trend : []);
      setProfileName(json?.profile?.name || 'Telecaller');
      setPunchedIn(Boolean(json?.attendance?.is_punched_in));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [datePreset, customStart, customEnd]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // Same labels / filters as Leads status dropdown (no "Rejected")
  const kpiCards = [
    { label: 'New', value: kpis.new_leads, color: '#475569', filter: 'new' },
    { label: 'Incomplete', value: kpis.incomplete, color: '#B45309', filter: 'incomplete' },
    { label: 'Interested', value: kpis.interested, color: '#C2410C', filter: 'interested' },
    { label: 'He will visit', value: kpis.will_visit, color: '#6D28D9', filter: 'will_visit' },
    { label: 'Booking confirmed', value: kpis.booking_confirmed ?? kpis.booked, color: '#047857', filter: 'booking_confirmed' },
    { label: 'In Service', value: kpis.in_service, color: '#1D4ED8', filter: 'in_service' },
    { label: 'Service Done', value: kpis.service_done, color: '#059669', filter: 'service_done' },
    { label: 'Lost', value: kpis.lost ?? kpis.rejected, color: '#B91C1C', filter: 'lost' },
  ];

  const callTrend = trend.map((t) => ({
    label: t.label || String(t.date || '').slice(5) || '',
    value: Number(t.calls || 0),
  }));
  const bookingTrend = trend.map((t) => ({
    label: t.label || String(t.date || '').slice(5) || '',
    value: Number(t.leads_created || 0),
  }));

  return (
    <DashboardLayout role={layoutRole}>
      <div className="w-full max-w-7xl mx-auto space-y-3 sm:space-y-4 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-slate-500">
              {isLeadManager ? 'Lead Manager Advanced CRM' : 'Advanced CRM'}
            </p>
            <h1 className="text-[22px] sm:text-2xl md:text-3xl font-extrabold text-[#023D95] leading-tight mt-0.5">
              {isLeadManager ? 'Lead Manager Control Panel' : profileName}
            </h1>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-bold ${
              punchedIn ? 'bg-emerald-500/10 text-slate-800' : 'bg-orange-500/10 text-slate-800'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${punchedIn ? 'bg-emerald-500' : 'bg-orange-500'}`}
            />
            {punchedIn ? 'On Floor' : 'Off Duty'}
          </span>
        </div>

        {/* Date + Aansh row on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,280px)_1fr] gap-3 items-start">
        <div className="relative z-20">
          <button
            type="button"
            onClick={() => setDateOpen((v) => !v)}
            className="w-full flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
          >
            <CalendarDays className="w-4 h-4 text-[#004AAD] shrink-0" />
            <span className="flex-1 text-left text-[13px] font-bold text-slate-800 truncate">
              {datePreset === 'custom' ? dateRange.label : dateLabel}
            </span>
            {dateOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
          {dateOpen ? (
            <div className="absolute left-0 right-0 mt-1.5 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
              {CRM_DATE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => {
                    persistDate({ datePreset: p.value });
                    if (p.value !== 'custom') setDateOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-3 text-[13px] font-semibold border-b border-slate-100 last:border-0 ${
                    datePreset === p.value ? 'bg-blue-50 text-[#004AAD]' : 'text-slate-800'
                  }`}
                >
                  {p.label}
                  {datePreset === p.value ? <Check className="w-4 h-4" /> : null}
                </button>
              ))}
              {datePreset === 'custom' ? (
                <div className="flex items-center gap-2 p-2.5 bg-slate-50">
                  <input
                    type="date"
                    className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                    value={customStart}
                    onChange={(e) => persistDate({ customStart: e.target.value, datePreset: 'custom' })}
                  />
                  <span className="text-xs text-slate-400">→</span>
                  <input
                    type="date"
                    className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                    value={customEnd}
                    onChange={(e) => persistDate({ customEnd: e.target.value, datePreset: 'custom' })}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      persistDate({ datePreset: 'custom', customStart, customEnd });
                      setDateOpen(false);
                      setRefreshing(true);
                      void load();
                    }}
                    className="rounded-lg bg-[#004AAD] px-3 py-1.5 text-xs font-bold text-white"
                  >
                    Apply
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <TelecallerAanshBar
          onClaimed={() => {
            setRefreshing(true);
            void load();
          }}
        />
        </div>

        {loading && !refreshing ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-[#004AAD]" />
            <span className="text-sm">Loading MyFNG CRM...</span>
          </div>
        ) : (
          <>
            {/* KPI grid — matches CRM lead statuses */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2 sm:gap-3">
              {kpiCards.map((k) => (
                <Link
                  key={k.label}
                  href={`${base}/leads?filter=${k.filter}`}
                  onClick={() => saveTelecallerCrmFilterPrefs({ statusFilter: k.filter })}
                  className="rounded-xl bg-white py-3 sm:py-4 text-center shadow-sm border border-slate-100 hover:border-blue-200 transition"
                >
                  <div className="text-xl sm:text-2xl font-extrabold" style={{ color: k.color }}>
                    {k.value ?? 0}
                  </div>
                  <div className="mt-0.5 text-[11px] sm:text-xs font-semibold text-slate-500 leading-tight px-1">
                    {k.label}
                  </div>
                </Link>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
              {/* Calls in range */}
              <div className="rounded-2xl bg-white p-3.5 sm:p-5 shadow-sm border border-slate-100">
                <h2 className="text-[15px] font-bold text-[#023D95] mb-2.5">Calls in range</h2>
                <div className="grid grid-cols-3">
                  <div className="text-center">
                    <div className="text-xl sm:text-2xl font-extrabold text-[#004AAD]">
                      {kpis.today_calls ?? 0}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl sm:text-2xl font-extrabold text-[#004AAD]">
                      {kpis.answered_calls ?? 0}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Answered</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl sm:text-2xl font-extrabold text-emerald-600">
                      {kpis.answer_rate ?? 0}%
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Answer Rate</div>
                  </div>
                </div>
              </div>

              <SimpleBarChart title="7-Day Call Trend" data={callTrend} color="#004AAD" />
              <SimpleBarChart title="7-Day Bookings Created" data={bookingTrend} color="#10B981" />
            </div>

            <h2 className="text-[15px] font-bold text-[#023D95] pt-1">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 sm:gap-3">
              {[
                {
                  href: `${base}/book?mode=book`,
                  label: 'Booking',
                  icon: Calendar,
                  color: '#10B981',
                },
                {
                  href: `${base}/book?mode=lead`,
                  label: 'Add Lead',
                  icon: Phone,
                  color: '#004AAD',
                },
                {
                  href: `${base}/leads`,
                  label: 'Open Leads',
                  icon: ClipboardList,
                  color: '#F59E0B',
                },
                {
                  href: '#whatsapp',
                  label: 'WhatsApp',
                  icon: MessageCircle,
                  color: '#25D366',
                  action: 'open-wa-inbox' as const,
                },
                {
                  href: isLeadManager ? `${base}/assignment` : `${base}/reports`,
                  label: isLeadManager ? 'Assignment' : 'Reports',
                  icon: isLeadManager ? MessageCircle : BarChart3,
                  color: isLeadManager ? '#7C3AED' : '#023D95',
                },
              ].map((a) =>
                a.action === 'open-wa-inbox' ? (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('myfng:open-wa-inbox'))}
                    className="rounded-2xl bg-white py-4 px-3 shadow-sm border border-slate-100 flex flex-col items-center gap-2 hover:border-emerald-200 transition"
                  >
                    <span
                      className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${a.color}18` }}
                    >
                      <a.icon className="w-[22px] h-[22px]" style={{ color: a.color }} />
                    </span>
                    <span className="text-[13px] font-bold text-slate-800 text-center">{a.label}</span>
                  </button>
                ) : (
                  <Link
                    key={a.href + a.label}
                    href={a.href}
                    className="rounded-2xl bg-white py-4 px-3 shadow-sm border border-slate-100 flex flex-col items-center gap-2 hover:border-blue-200 transition"
                  >
                    <span
                      className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${a.color}18` }}
                    >
                      <a.icon className="w-[22px] h-[22px]" style={{ color: a.color }} />
                    </span>
                    <span className="text-[13px] font-bold text-slate-800 text-center">{a.label}</span>
                  </Link>
                ),
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
