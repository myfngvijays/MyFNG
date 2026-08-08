'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
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
  LEAD_STATUS_FILTERS,
  LOST_REASON_FILTERS,
  leadDisplayStatus,
  leadStatusCardColors,
} from '@/lib/telecaller/leadDisplayStatus';
import { createClient } from '@/lib/supabase/client';
import {
  Phone,
  Search,
  Filter,
  Eye,
  Share2,
  Pencil,
  Bell,
  Loader2,
  X,
} from 'lucide-react';

const PRIORITY_OPTIONS = [
  { value: '', label: 'All priorities' },
  { value: 'NORMAL', label: 'NORMAL' },
  { value: 'HIGH', label: 'HIGH' },
  { value: 'URGENT', label: 'URGENT' },
];

function TelecallerCrmLeadsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const filterParam = searchParams?.get('filter');
  const initialPrefs = loadTelecallerCrmFilterPrefs();

  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(filterParam || initialPrefs.statusFilter || 'all');
  const [lostReason, setLostReason] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [city, setCity] = useState('');
  const [priority, setPriority] = useState('');
  const [datePreset, setDatePreset] = useState<CrmDatePreset>(initialPrefs.datePreset);
  const [customStart, setCustomStart] = useState(initialPrefs.customStart);
  const [customEnd, setCustomEnd] = useState(initialPrefs.customEnd);
  const [cities, setCities] = useState<string[]>([]);
  const [shareLead, setShareLead] = useState<any>(null);
  const [peers, setPeers] = useState<any[]>([]);
  const [sharing, setSharing] = useState(false);

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

  useEffect(() => {
    if (filterParam) {
      setFilter(filterParam);
      saveTelecallerCrmFilterPrefs({ statusFilter: filterParam });
      return;
    }
    const saved = loadTelecallerCrmFilterPrefs().statusFilter || 'all';
    setFilter(saved);
  }, [filterParam]);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('cities')
          .select('name')
          .eq('is_active', true)
          .order('name');
        setCities(
          Array.from(
            new Set((data || []).map((c: any) => String(c.name || '').trim()).filter(Boolean)),
          ),
        );
      } catch {
        setCities([]);
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const range = resolveCrmDateRange(datePreset, customStart, customEnd);
      const params = new URLSearchParams({ limit: '80' });
      if (filter && filter !== 'all') params.set('filter', filter);
      if (filter === 'lost' && lostReason.trim()) params.set('lost_reason', lostReason.trim());
      if (q.trim()) params.set('q', q.trim());
      if (city.trim()) params.set('city', city.trim());
      if (priority.trim()) params.set('priority', priority.trim());
      params.set('from', range.start);
      params.set('to', range.end);
      const res = await fetch(`/api/telecaller/crm/leads?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed');
      setLeads(Array.isArray(data?.leads) ? data.leads : []);
    } catch (e) {
      console.error(e);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [filter, lostReason, q, city, priority, datePreset, customStart, customEnd]);

  useEffect(() => {
    load();
  }, [load]);

  const openShare = async (lead: any) => {
    setShareLead(lead);
    try {
      const res = await fetch('/api/telecaller/crm/transfer?peers=1');
      const data = await res.json();
      setPeers(Array.isArray(data?.peers) ? data.peers : []);
    } catch {
      setPeers([]);
    }
  };

  const doTransfer = async (toId: string, type: 'TRANSFER' | 'SHARE') => {
    if (!shareLead) return;
    setSharing(true);
    try {
      const res = await fetch('/api/telecaller/crm/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: shareLead.id,
          to_telecaller_id: toId,
          transfer_type: type,
          reason: type === 'SHARE' ? 'Shared from Advanced CRM' : 'Transferred from Advanced CRM',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed');
      setShareLead(null);
      load();
    } catch (e: any) {
      alert(e?.message || 'Failed');
    } finally {
      setSharing(false);
    }
  };

  const setFilterAndUrl = (id: string) => {
    setFilter(id);
    saveTelecallerCrmFilterPrefs({ statusFilter: id });
    if (id !== 'lost') setLostReason('');
    const next = new URLSearchParams(searchParams?.toString() || '');
    if (id === 'all') next.delete('filter');
    else next.set('filter', id);
    router.replace(`/dashboard/telecaller/leads${next.toString() ? `?${next}` : ''}`);
  };

  return (
    <DashboardLayout role="telecaller">
      <div className="w-full max-w-7xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-500">Advanced CRM</p>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#023D95]">Leads</h1>
          </div>
          <Link
            href="/dashboard/telecaller/book"
            className="rounded-xl bg-[#004AAD] px-4 py-2.5 text-sm font-bold text-white shadow-sm"
          >
            + New Booking
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-bold text-slate-500">Status</label>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800"
              value={filter}
              onChange={(e) => setFilterAndUrl(e.target.value)}
            >
              {LEAD_STATUS_FILTERS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-bold text-slate-500">Date</label>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800"
              value={datePreset}
              onChange={(e) => {
                const v = e.target.value as CrmDatePreset;
                persistDate({ datePreset: v });
                if (v === 'custom') setShowFilters(true);
              }}
            >
              {CRM_DATE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          {filter === 'lost' ? (
            <div className="min-w-0 sm:col-span-2 lg:col-span-1">
              <label className="mb-1 block text-xs font-bold text-slate-500">Lost reason</label>
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800"
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
              >
                {LOST_REASON_FILTERS.map((f) => (
                  <option key={f.id || 'all-lost'} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
          <div className="relative min-w-0 flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm"
              placeholder="Search name, phone, lead #"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="inline-flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              <Filter className="h-4 w-4" /> Filters
            </button>
            <button
              type="button"
              onClick={load}
              className="flex-1 sm:flex-none rounded-xl bg-[#004AAD] px-4 py-2 text-sm font-bold text-white"
            >
              Search
            </button>
          </div>
        </div>

        {showFilters ? (
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
            {datePreset === 'custom' ? (
              <>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">From</label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={customStart}
                    onChange={(e) => persistDate({ customStart: e.target.value, datePreset: 'custom' })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">To</label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={customEnd}
                    onChange={(e) => persistDate({ customEnd: e.target.value, datePreset: 'custom' })}
                  />
                </div>
              </>
            ) : null}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">City</label>
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              >
                <option value="">All cities</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Priority</label>
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading leads…
          </div>
        ) : leads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
            No leads in this filter / date range
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {leads.map((lead) => {
              const tint = leadStatusCardColors(lead);
              const statusLabel = leadDisplayStatus(lead);
              const reminder = lead.reminder || null;
              const reminderAt = reminder?.at || lead.next_follow_up_at || null;
              const reminderOverdue =
                Boolean(reminder?.overdue) ||
                (reminderAt ? new Date(reminderAt).getTime() < Date.now() : false);
              return (
              <div
                key={lead.id}
                className="rounded-2xl border p-4 shadow-sm transition hover:shadow-md"
                style={{ backgroundColor: tint.cardBg, borderColor: tint.border }}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-[#023D95]">
                        {lead.lead_number || lead.id?.slice(0, 8)}
                      </span>
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                        style={{ backgroundColor: tint.badgeBg, color: tint.badgeText }}
                      >
                        {statusLabel}
                      </span>
                      {lead.lead_priority ? (
                        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold text-orange-700 ring-1 ring-orange-200">
                          {lead.lead_priority}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-base font-bold text-slate-900">
                      {lead.customer_name || 'Unknown'}
                    </p>
                    <p className="text-sm text-slate-600">
                      {[lead.vehicle_make, lead.vehicle_model, lead.city]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {lead.created_at
                        ? new Date(lead.created_at).toLocaleString('en-IN')
                        : '—'}
                    </p>
                    {reminderAt ? (
                      <div
                        className={`mt-2 inline-flex max-w-full items-start gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold ring-1 ${
                          reminderOverdue
                            ? 'bg-red-50 text-red-700 ring-red-200'
                            : 'bg-violet-50 text-violet-800 ring-violet-200'
                        }`}
                      >
                        <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0">
                          <span className="font-bold">
                            {reminderOverdue ? 'Overdue reminder' : 'Reminder'}
                            {reminder?.type ? ` · ${String(reminder.type).replace(/_/g, ' ')}` : ''}
                          </span>
                          <span className="block text-[10px] font-medium opacity-90">
                            {new Date(reminderAt).toLocaleString('en-IN')}
                            {reminder?.reason ? ` — ${reminder.reason}` : ''}
                          </span>
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end shrink-0">
                    {lead.customer_phone ? (
                      <a
                        href={`tel:${lead.customer_phone}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white/80 px-3 py-2 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200"
                      >
                        <Phone className="h-3.5 w-3.5" /> Call
                      </a>
                    ) : null}
                    <Link
                      href={`/dashboard/telecaller/leads/${lead.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-white/80 px-3 py-2 text-xs font-bold text-[#004AAD] ring-1 ring-blue-200"
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </Link>
                    <Link
                      href={`/dashboard/telecaller/leads/${lead.id}/edit`}
                      title="Edit lead"
                      className="inline-flex items-center justify-center rounded-xl bg-white/80 p-2 text-[#004AAD] ring-1 ring-blue-200"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => openShare(lead)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-white/80 px-3 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200"
                    >
                      <Share2 className="h-3.5 w-3.5" /> Share
                    </button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {shareLead ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[80vh] w-full max-w-md overflow-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-[#023D95]">Share / Transfer</h3>
              <button type="button" onClick={() => setShareLead(null)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <p className="mb-3 text-sm text-slate-600">
              {shareLead.customer_name} · {shareLead.lead_number}
            </p>
            {peers.length === 0 ? (
              <p className="text-sm text-slate-500">No peer telecallers found</p>
            ) : (
              <div className="space-y-2">
                {peers.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 p-3"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-800">{p.name || p.email}</p>
                      <p className="text-xs text-slate-500">{p.email}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        disabled={sharing}
                        onClick={() => doTransfer(p.id, 'SHARE')}
                        className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-[#004AAD]"
                      >
                        Share
                      </button>
                      <button
                        type="button"
                        disabled={sharing}
                        onClick={() => doTransfer(p.id, 'TRANSFER')}
                        className="rounded-lg bg-orange-50 px-2.5 py-1.5 text-[11px] font-bold text-orange-700"
                      >
                        Transfer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}

export default function TelecallerCrmLeadsPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout role="telecaller">
          <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        </DashboardLayout>
      }
    >
      <TelecallerCrmLeadsContent />
    </Suspense>
  );
}
