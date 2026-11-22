'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Search } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import PageHelpIcon from '@/components/PageHelpIcon';
import { formatDateTime } from '@/lib/utils';

type Filter = 'active' | 'all' | 'resolved';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'all', label: 'All' },
  { id: 'resolved', label: 'Resolved' },
];

function escalationReason(lead: any) {
  if (lead.sla_state === 'BREACHED') return 'SLA breached';
  if (lead.status === 'REJECTED') return 'Workshop rejected';
  if (!lead.workshop_id && lead.reopen_count > 0) return 'Reopened lead';
  if (lead.lead_priority === 'URGENT') return 'Urgent priority';
  return 'Customer complaint';
}

export default function LeadManagerEscalationsPage() {
  const [escalations, setEscalations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('active');
  const [search, setSearch] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/lead-manager/escalations?filter=${encodeURIComponent(filter)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEscalations([]);
        setLoadError(json.error || 'Could not load escalations');
        return;
      }
      setEscalations(Array.isArray(json.escalations) ? json.escalations : []);
    } catch {
      setEscalations([]);
      setLoadError('Could not load escalations');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (leadId: string) => {
    if (!confirm('Mark this escalation as resolved?')) return;
    setResolvingId(leadId);
    try {
      const res = await fetch('/api/lead-manager/escalations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) await load();
      else alert(json.error || 'Failed to resolve escalation');
    } catch {
      alert('Failed to resolve escalation');
    } finally {
      setResolvingId(null);
    }
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return escalations;
    return escalations.filter((e) =>
      [e.lead_number, e.customer_name, e.customer_phone, e.vehicle_number, e.city]
        .some((v) => String(v || '').toLowerCase().includes(q)),
    );
  }, [escalations, search]);

  const counts = useMemo(
    () => ({
      escalated: escalations.filter((e) => e.escalation === 'ESCALATED').length,
      breached: escalations.filter((e) => e.sla_state === 'BREACHED').length,
      urgent: escalations.filter((e) => e.lead_priority === 'URGENT').length,
    }),
    [escalations],
  );

  return (
    <DashboardLayout role="LEAD_MANAGER">
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black text-[#023D95]">
              <AlertTriangle className="h-6 w-6" /> Escalations
              <PageHelpIcon href="/dashboard/lead_manager/escalations" label="Escalations" />
            </h1>
            <p className="text-sm text-slate-500">SLA breach, workshop reject, reopened aur urgent leads</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-bold uppercase text-slate-500">Shown</p>
            <p className="text-2xl font-black text-[#023D95]">{escalations.length}</p>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-[11px] font-bold uppercase text-red-700">Escalated</p>
            <p className="text-2xl font-black text-red-900">{counts.escalated}</p>
          </div>
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
            <p className="text-[11px] font-bold uppercase text-orange-700">SLA breached</p>
            <p className="text-2xl font-black text-orange-900">{counts.breached}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-[11px] font-bold uppercase text-amber-700">Urgent</p>
            <p className="text-2xl font-black text-amber-900">{counts.urgent}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  filter === f.id ? 'bg-[#023D95] text-white' : 'text-slate-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lead #, name, phone, car, city"
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm"
            />
          </label>
        </div>

        {loadError ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            {loadError}
          </p>
        ) : null}

        {loading && !escalations.length ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-14 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <p className="mt-3 text-base font-black text-slate-800">No escalations</p>
            <p className="text-sm text-slate-500">
              {search
                ? 'Is search se koi escalation nahi mila.'
                : filter === 'resolved'
                  ? 'Koi resolved escalation nahi.'
                  : 'Abhi koi active escalation nahi.'}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Lead</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-4 py-3">Location / Workshop</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((e) => (
                    <tr key={e.id} className="align-top hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">#{e.lead_number}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              e.escalation === 'ESCALATED'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {e.escalation === 'ESCALATED' ? 'Escalated' : 'Resolved'}
                          </span>
                          {e.lead_priority === 'URGENT' ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                              Urgent
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-orange-800">{escalationReason(e)}</p>
                        {e.sla_state ? (
                          <p
                            className={`text-xs font-semibold ${
                              e.sla_state === 'BREACHED' ? 'text-red-600' : 'text-orange-600'
                            }`}
                          >
                            SLA {String(e.sla_state).replace(/_/g, ' ').toLowerCase()}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{e.customer_name || '—'}</p>
                        <p className="text-xs text-slate-500">{e.customer_phone || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{e.vehicle_model || '—'}</p>
                        <p className="text-xs text-slate-500">{e.vehicle_number || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{e.city || '—'}</p>
                        <p className="text-xs text-slate-500">{e.workshop?.name || 'No workshop'}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                        {e.updated_at ? formatDateTime(e.updated_at) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/dashboard/lead_manager/leads/${e.id}`}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-[#023D95] hover:bg-blue-50"
                          >
                            View
                          </Link>
                          {e.escalation === 'ESCALATED' ? (
                            <button
                              type="button"
                              disabled={resolvingId === e.id}
                              onClick={() => void resolve(e.id)}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                              {resolvingId === e.id ? 'Saving…' : 'Resolve'}
                            </button>
                          ) : null}
                        </div>
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
