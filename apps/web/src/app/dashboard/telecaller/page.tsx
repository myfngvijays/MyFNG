'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import TelecallerAanshBar from '@/components/telecaller/TelecallerAanshBar';
import {
  CRM_DATE_PRESETS,
  resolveCrmDateRange,
  type CrmDatePreset,
  istYmd,
} from '@/lib/telecaller/crmDateRange';
import {
  Phone,
  Calendar,
  ClipboardList,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Check,
  Loader2,
  CalendarDays,
} from 'lucide-react';

type Kpis = {
  new_leads?: number;
  callbacks?: number;
  followups_today?: number;
  booked?: number;
  incomplete?: number;
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kpis, setKpis] = useState<Kpis>({});
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [profileName, setProfileName] = useState('Telecaller');
  const [punchedIn, setPunchedIn] = useState(false);
  const [datePreset, setDatePreset] = useState<CrmDatePreset>('today');
  const [customStart, setCustomStart] = useState(istYmd());
  const [customEnd, setCustomEnd] = useState(istYmd());
  const [dateOpen, setDateOpen] = useState(false);

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

  const kpiCards = [
    { label: 'New', value: kpis.new_leads, color: '#004AAD', filter: 'new' },
    { label: 'Callbacks', value: kpis.callbacks, color: '#F59E0B', filter: 'callback' },
    { label: 'Follow-ups', value: kpis.followups_today, color: '#6366F1', filter: 'follow_up' },
    { label: 'Booked', value: kpis.booked, color: '#10B981', filter: 'booked' },
    { label: 'Incomplete', value: kpis.incomplete, color: '#F59E0B', filter: 'incomplete' },
    { label: 'Rejected', value: kpis.rejected, color: '#EF4444', filter: 'rejected' },
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
    <DashboardLayout role="telecaller">
      <div className="mx-auto max-w-lg space-y-3 pb-8">
        {/* Header — exact mobile hero */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-slate-500">Advanced CRM</p>
            <h1 className="text-[22px] font-extrabold text-[#023D95] leading-tight mt-0.5">
              {profileName}
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

        {/* Date dropdown — mobile style */}
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
                    setDatePreset(p.value);
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
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                  <span className="text-xs text-slate-400">→</span>
                  <input
                    type="date"
                    className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => {
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

        {/* Aansh dialer — same as mobile */}
        <TelecallerAanshBar
          onClaimed={() => {
            setRefreshing(true);
            void load();
          }}
        />

        {loading && !refreshing ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-[#004AAD]" />
            <span className="text-sm">Loading MyFNG CRM...</span>
          </div>
        ) : (
          <>
            {/* KPI grid 2×3 */}
            <div className="grid grid-cols-3 gap-2">
              {kpiCards.map((k) => (
                <Link
                  key={k.label}
                  href={`/dashboard/telecaller/leads?filter=${k.filter}`}
                  className="rounded-xl bg-white py-3 text-center shadow-sm border border-slate-100 hover:border-blue-200 transition"
                >
                  <div className="text-xl font-extrabold" style={{ color: k.color }}>
                    {k.value ?? 0}
                  </div>
                  <div className="mt-0.5 text-[11px] font-semibold text-slate-500">{k.label}</div>
                </Link>
              ))}
            </div>

            {/* Calls in range — single card */}
            <div className="rounded-2xl bg-white p-3.5 shadow-sm border border-slate-100">
              <h2 className="text-[15px] font-bold text-[#023D95] mb-2.5">Calls in range</h2>
              <div className="grid grid-cols-3">
                <div className="text-center">
                  <div className="text-xl font-extrabold text-[#004AAD]">{kpis.today_calls ?? 0}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-extrabold text-[#004AAD]">
                    {kpis.answered_calls ?? 0}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Answered</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-extrabold text-emerald-600">
                    {kpis.answer_rate ?? 0}%
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Answer Rate</div>
                </div>
              </div>
            </div>

            <SimpleBarChart title="7-Day Call Trend" data={callTrend} color="#004AAD" />
            <SimpleBarChart title="7-Day Bookings Created" data={bookingTrend} color="#10B981" />

            <h2 className="text-[15px] font-bold text-[#023D95] pt-1">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                {
                  href: '/dashboard/telecaller/book',
                  label: 'New Booking',
                  icon: Phone,
                  color: '#10B981',
                },
                {
                  href: '/dashboard/telecaller/leads',
                  label: 'Open Leads',
                  icon: ClipboardList,
                  color: '#004AAD',
                },
                {
                  href: '/dashboard/telecaller/engage',
                  label: 'Follow-ups',
                  icon: Calendar,
                  color: '#F59E0B',
                },
                {
                  href: '/dashboard/telecaller/rsa',
                  label: 'WhatsApp / RSA',
                  icon: MessageCircle,
                  color: '#25D366',
                },
              ].map((a) => (
                <Link
                  key={a.href}
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
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
