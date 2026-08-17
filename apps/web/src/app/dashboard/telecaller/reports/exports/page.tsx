'use client';

import { useMemo, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { CrmReportsNav, PeriodTabs } from '@/components/telecaller/crm/CrmReportsNav';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';
import { useCrmPermissions } from '@/lib/telecaller/useCrmPermissions';
import { istYmd } from '@/lib/telecaller/crmReportsRange';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';

type HistoryItem = {
  id: string;
  name: string;
  kind: string;
  period: string;
  createdAt: string;
  status: 'COMPLETED' | 'FAILED';
};

const HISTORY_KEY = 'myfng_crm_report_exports_v1';

function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 40) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 40)));
  } catch {
    /* ignore */
  }
}

export default function CrmReportsExportsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { base, layoutRole, isLeadManager } = getCrmDashboardBase(pathname);
  const { permissions, loading: permLoading } = useCrmPermissions();
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('week');
  const [date, setDate] = useState(istYmd());
  const [kind, setKind] = useState<'leads' | 'calls'>('leads');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [tab, setTab] = useState<'all' | 'leads' | 'calls'>('all');

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    if (permLoading) return;
    if (!isLeadManager && !permissions.reports_export) {
      router.replace(`${base}/reports`);
    }
  }, [permLoading, isLeadManager, permissions.reports_export, router, base]);

  if (!isLeadManager && !permissions.reports_export) {
    return (
      <DashboardLayout role={layoutRole}>
        <div className="py-20 text-center text-sm text-slate-500">Redirecting…</div>
      </DashboardLayout>
    );
  }

  const filtered = useMemo(() => {
    if (tab === 'all') return history;
    return history.filter((h) => h.kind === tab);
  }, [history, tab]);

  const download = async () => {
    setBusy(true);
    const stamp = new Date().toISOString();
    const filename = `crm_${kind}_${period}_${date}.csv`;
    try {
      const params = new URLSearchParams({ kind, period, date });
      const res = await fetch(`/api/telecaller/crm/reports/export?${params}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const item: HistoryItem = {
        id: `${Date.now()}`,
        name: filename,
        kind,
        period,
        createdAt: stamp,
        status: 'COMPLETED',
      };
      const next = [item, ...loadHistory()];
      saveHistory(next);
      setHistory(next);
    } catch (e: any) {
      alert(e?.message || 'Export failed');
      const item: HistoryItem = {
        id: `${Date.now()}`,
        name: filename,
        kind,
        period,
        createdAt: stamp,
        status: 'FAILED',
      };
      const next = [item, ...loadHistory()];
      saveHistory(next);
      setHistory(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardLayout role={layoutRole}>
      <div className="mx-auto w-full max-w-6xl space-y-5 pb-10">
        <CrmReportsNav
          title="Exports"
          subtitle="Generate CSV files for offline review. Recent downloads are kept on this browser."
        />

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-extrabold text-[#023D95]">New export</h2>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Dataset</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as 'leads' | 'calls')}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
              >
                <option value="leads">Leads</option>
                <option value="calls">Call logs</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Period</label>
              <PeriodTabs value={period} onChange={setPeriod} />
            </div>
            {period === 'day' ? (
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
                />
              </div>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void download()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#004AAD] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download CSV
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-wrap gap-1 border-b border-slate-100 px-4 pt-3">
            {(
              [
                ['all', 'All'],
                ['leads', 'Leads'],
                ['calls', 'Calls'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`border-b-2 px-3 py-2 text-sm font-bold ${
                  tab === id
                    ? 'border-[#004AAD] text-[#023D95]'
                    : 'border-transparent text-slate-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-slate-500">
              No exports yet on this device. Generate one above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">File</th>
                    <th className="px-4 py-3">Kind</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                          <span className="font-semibold text-slate-900">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-600">{row.kind}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            row.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(row.createdAt).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
