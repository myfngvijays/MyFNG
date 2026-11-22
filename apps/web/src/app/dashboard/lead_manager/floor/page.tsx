'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import PageHelpIcon from '@/components/PageHelpIcon';
import { Loader2, RefreshCw, Users } from 'lucide-react';

type Agent = {
  id: string;
  name: string;
  phone: string | null;
  punched_in: boolean;
  punch_in_at: string | null;
  punch_out_at: string | null;
  last_login: string | null;
  last_login_platform: string | null;
  app_last_seen: string | null;
  assigned_today: number;
  calls_today: number;
  updates_today: number;
  overdue_followups: number;
  status: string;
};

const STATUS_UI: Record<string, { label: string; cls: string }> = {
  on_floor: { label: 'On floor', cls: 'bg-emerald-100 text-emerald-800' },
  punched_out: { label: 'Punched out', cls: 'bg-sky-100 text-sky-800' },
  online: { label: 'Working, no punch-in', cls: 'bg-amber-100 text-amber-800' },
  off_duty: { label: 'Off duty', cls: 'bg-slate-100 text-slate-600' },
};

function timeOnly(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Today → time only; older → "21 Nov, 11:18 am". */
function whenShort(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const ymd = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (ymd(d) === ymd(new Date())) return timeOnly(iso);
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LeadManagerFloorPage() {
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [onFloor, setOnFloor] = useState(0);
  const [offDuty, setOffDuty] = useState(0);
  const [punchedOut, setPunchedOut] = useState(0);
  const [noPunch, setNoPunch] = useState(0);
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/lead-manager/floor');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load floor');
      setAgents(json.agents || []);
      setOnFloor(json.on_floor || 0);
      setOffDuty(json.off_duty || 0);
      setPunchedOut(json.punched_out || 0);
      setNoPunch(json.online_no_punch || 0);
      setDate(json.date || '');
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <DashboardLayout role="LEAD_MANAGER">
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-[#023D95] flex items-center gap-2">
              <Users className="h-6 w-6" /> Live floor
              <PageHelpIcon href="/dashboard/lead_manager/floor" label="Live floor" />
            </h1>
            <p className="text-sm text-slate-500">
              Punch-in + today&apos;s activity · {date || '—'} (auto-refresh 1m)
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-bold uppercase text-emerald-700">On floor</p>
            <p className="text-2xl font-black text-emerald-900">{onFloor}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-bold uppercase text-amber-700">Working, no punch-in</p>
            <p className="text-2xl font-black text-amber-900">{noPunch}</p>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <p className="text-xs font-bold uppercase text-sky-700">Punched out</p>
            <p className="text-2xl font-black text-sky-900">{punchedOut}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase text-slate-500">Off duty</p>
            <p className="text-2xl font-black text-slate-800">{offDuty}</p>
          </div>
          <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-1">
            <p className="text-xs font-bold uppercase text-slate-500">Telecallers</p>
            <p className="text-2xl font-black text-[#023D95]">{agents.length}</p>
          </div>
        </div>

        {error ? (
          <p className="text-sm font-semibold text-red-600">{error}</p>
        ) : null}

        {loading && !agents.length ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Telecaller</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Punch in / out</th>
                    <th className="px-4 py-3">Last login</th>
                    <th className="px-4 py-3">App opened</th>
                    <th className="px-4 py-3">Assigned today</th>
                    <th className="px-4 py-3">Calls today</th>
                    <th className="px-4 py-3">Updates today</th>
                    <th className="px-4 py-3">Overdue FU</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {agents.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">{a.name}</p>
                        {a.phone ? <p className="text-xs text-slate-500">{a.phone}</p> : null}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            (STATUS_UI[a.status] || STATUS_UI.off_duty).cls
                          }`}
                        >
                          {(STATUS_UI[a.status] || STATUS_UI.off_duty).label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {a.punch_in_at ? timeOnly(a.punch_in_at) : '—'}
                        {a.punch_out_at ? ` → ${timeOnly(a.punch_out_at)}` : ''}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {whenShort(a.last_login)}
                        {a.last_login_platform ? (
                          <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500">
                            {a.last_login_platform}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {whenShort(a.app_last_seen)}
                      </td>
                      <td className="px-4 py-3 font-semibold">{a.assigned_today}</td>
                      <td className="px-4 py-3 font-semibold">{a.calls_today}</td>
                      <td className="px-4 py-3 font-semibold">{a.updates_today}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            a.overdue_followups > 0
                              ? 'font-bold text-red-600'
                              : 'text-slate-500'
                          }
                        >
                          {a.overdue_followups}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
