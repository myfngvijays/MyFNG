'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
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
  ChevronRight,
  Loader2,
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

export default function TelecallerCrmHomePage() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<Kpis>({});
  const [trend, setTrend] = useState<any[]>([]);
  const [profileName, setProfileName] = useState('Telecaller');
  const [punchedIn, setPunchedIn] = useState(false);
  const [datePreset, setDatePreset] = useState<CrmDatePreset>('today');
  const [customStart, setCustomStart] = useState(istYmd());
  const [customEnd, setCustomEnd] = useState(istYmd());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const range = resolveCrmDateRange(datePreset, customStart, customEnd);
      const res = await fetch(
        `/api/telecaller/crm/dashboard?from=${encodeURIComponent(range.startYmd)}&to=${encodeURIComponent(range.endYmd)}`,
      );
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
    }
  }, [datePreset, customStart, customEnd]);

  useEffect(() => {
    load();
  }, [load]);

  const kpiCards = [
    { label: 'New', value: kpis.new_leads, color: 'text-blue-700', filter: 'new' },
    { label: 'Callbacks', value: kpis.callbacks, color: 'text-orange-600', filter: 'callback' },
    { label: 'Follow-ups', value: kpis.followups_today, color: 'text-indigo-600', filter: 'follow_up' },
    { label: 'Booking confirmed', value: kpis.booked, color: 'text-emerald-600', filter: 'booked' },
    { label: 'Incomplete', value: kpis.incomplete, color: 'text-amber-600', filter: 'incomplete' },
    { label: 'Lost', value: kpis.rejected, color: 'text-red-600', filter: 'lost' },
  ];

  const maxCalls = Math.max(1, ...trend.map((t) => Number(t.calls || 0)));

  return (
    <DashboardLayout role="telecaller">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-500">Advanced CRM</p>
            <h1 className="text-2xl font-extrabold text-[#023D95]">{profileName}</h1>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${
              punchedIn ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${punchedIn ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {punchedIn ? 'On Floor' : 'Off Duty'}
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="min-w-[180px]">
            <label className="mb-1 block text-xs font-bold text-slate-500">Date filter</label>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as CrmDatePreset)}
            >
              {CRM_DATE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          {datePreset === 'custom' ? (
            <>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">From</label>
                <input
                  type="date"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">To</label>
                <input
                  type="date"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
            </>
          ) : null}
          <button
            type="button"
            onClick={load}
            className="rounded-xl bg-[#004AAD] px-4 py-2 text-sm font-bold text-white"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading CRM…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {kpiCards.map((k) => (
                <Link
                  key={k.label}
                  href={`/dashboard/telecaller/leads?filter=${k.filter}`}
                  className="rounded-2xl border border-slate-100 bg-white p-4 text-center shadow-sm transition hover:border-blue-200 hover:shadow"
                >
                  <div className={`text-2xl font-extrabold ${k.color}`}>{k.value ?? 0}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">{k.label}</div>
                </Link>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-100 bg-white p-4 text-center shadow-sm">
                <div className="text-2xl font-extrabold text-[#004AAD]">{kpis.today_calls ?? 0}</div>
                <div className="text-xs font-semibold text-slate-500">Calls in range</div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white p-4 text-center shadow-sm">
                <div className="text-2xl font-extrabold text-[#004AAD]">{kpis.answered_calls ?? 0}</div>
                <div className="text-xs font-semibold text-slate-500">Answered</div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white p-4 text-center shadow-sm">
                <div className="text-2xl font-extrabold text-emerald-600">{kpis.answer_rate ?? 0}%</div>
                <div className="text-xs font-semibold text-slate-500">Answer rate</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-bold text-[#023D95]">7-Day Call Trend</h2>
              <div className="flex h-36 items-end gap-2">
                {trend.map((t) => (
                  <div key={t.date || t.label} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t-md bg-[#004AAD]"
                      style={{ height: `${(Number(t.calls || 0) / maxCalls) * 100}%`, minHeight: 4 }}
                      title={`${t.calls || 0} calls`}
                    />
                    <span className="text-[10px] font-semibold text-slate-500">{t.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-sm font-bold text-[#023D95]">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  { href: '/dashboard/telecaller/book', label: 'New Booking', icon: Phone, color: 'text-emerald-600 bg-emerald-50' },
                  { href: '/dashboard/telecaller/leads', label: 'Open Leads', icon: ClipboardList, color: 'text-blue-700 bg-blue-50' },
                  { href: '/dashboard/telecaller/engage', label: 'Follow-ups', icon: Calendar, color: 'text-orange-600 bg-orange-50' },
                  { href: '/dashboard/telecaller/engage?tab=rsa', label: 'RSA / Pay', icon: MessageCircle, color: 'text-green-600 bg-green-50' },
                ].map((a) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:border-blue-200"
                  >
                    <span className={`rounded-xl p-2.5 ${a.color}`}>
                      <a.icon className="h-5 w-5" />
                    </span>
                    <span className="flex-1 text-sm font-bold text-slate-800">{a.label}</span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
