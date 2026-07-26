'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import {
  CRM_DATE_PRESETS,
  resolveCrmDateRange,
  type CrmDatePreset,
  istYmd,
} from '@/lib/telecaller/crmDateRange';
import { createClient } from '@/lib/supabase/client';
import {
  Phone,
  Search,
  Filter,
  Eye,
  Share2,
  Loader2,
  X,
} from 'lucide-react';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'callback', label: 'Callback' },
  { id: 'follow_up', label: 'Follow-up' },
  { id: 'incomplete', label: 'Incomplete' },
  { id: 'booked', label: 'Booked' },
  { id: 'rejected', label: 'Rejected' },
];

const SOURCE_OPTIONS = [
  { value: '', label: 'All sources' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'WHATSAPP_META', label: 'Meta Ads (WA)' },
  { value: 'MOBILE_APP', label: 'App' },
  { value: 'WEB', label: 'Website' },
  { value: 'TELECALLER_CRM', label: 'CRM Book' },
  { value: 'TELECALLER', label: 'Telecaller' },
  { value: 'ENQUIRY', label: 'Enquiry' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All priorities' },
  { value: 'NORMAL', label: 'NORMAL' },
  { value: 'HIGH', label: 'HIGH' },
  { value: 'URGENT', label: 'URGENT' },
];

function TelecallerCrmLeadsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const filterParam = searchParams?.get('filter') || 'all';

  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(filterParam);
  const [showFilters, setShowFilters] = useState(false);
  const [city, setCity] = useState('');
  const [source, setSource] = useState('');
  const [priority, setPriority] = useState('');
  const [datePreset, setDatePreset] = useState<CrmDatePreset>('today');
  const [customStart, setCustomStart] = useState(istYmd());
  const [customEnd, setCustomEnd] = useState(istYmd());
  const [cities, setCities] = useState<string[]>([]);
  const [shareLead, setShareLead] = useState<any>(null);
  const [peers, setPeers] = useState<any[]>([]);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    setFilter(filterParam);
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
      if (q.trim()) params.set('q', q.trim());
      if (city.trim()) params.set('city', city.trim());
      if (source.trim()) params.set('source', source.trim());
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
  }, [filter, q, city, source, priority, datePreset, customStart, customEnd]);

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
    const next = new URLSearchParams(searchParams?.toString() || '');
    if (id === 'all') next.delete('filter');
    else next.set('filter', id);
    router.replace(`/dashboard/telecaller/leads${next.toString() ? `?${next}` : ''}`);
  };

  return (
    <DashboardLayout role="telecaller">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-500">Advanced CRM</p>
            <h1 className="text-2xl font-extrabold text-[#023D95]">Leads</h1>
          </div>
          <Link
            href="/dashboard/telecaller/book"
            className="rounded-xl bg-[#004AAD] px-4 py-2.5 text-sm font-bold text-white shadow-sm"
          >
            + New Booking
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterAndUrl(f.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                filter === f.id
                  ? 'bg-[#004AAD] text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm"
              placeholder="Search name, phone, lead #"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
          >
            <Filter className="h-4 w-4" /> Filters
          </button>
          <button
            type="button"
            onClick={load}
            className="rounded-xl bg-[#004AAD] px-4 py-2 text-sm font-bold text-white"
          >
            Search
          </button>
        </div>

        {showFilters ? (
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Date</label>
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
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
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">To</label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
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
              <label className="mb-1 block text-xs font-bold text-slate-500">Source</label>
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                {SOURCE_OPTIONS.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>
                    {o.label}
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
          <div className="space-y-3">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:border-blue-100"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-[#023D95]">
                        {lead.lead_number || lead.id?.slice(0, 8)}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                        {lead.status || '—'}
                      </span>
                      {lead.lead_priority ? (
                        <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                          {lead.lead_priority}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-base font-bold text-slate-900">
                      {lead.customer_name || 'Unknown'}
                    </p>
                    <p className="text-sm text-slate-500">
                      {[lead.vehicle_make, lead.vehicle_model, lead.city]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {lead.created_from || lead.lead_source || '—'}
                      {lead.created_at
                        ? ` · ${new Date(lead.created_at).toLocaleString('en-IN')}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {lead.customer_phone ? (
                      <a
                        href={`tel:${lead.customer_phone}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"
                      >
                        <Phone className="h-3.5 w-3.5" /> Call
                      </a>
                    ) : null}
                    <Link
                      href={`/dashboard/telecaller/leads/${lead.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-[#004AAD]"
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </Link>
                    <button
                      type="button"
                      onClick={() => openShare(lead)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"
                    >
                      <Share2 className="h-3.5 w-3.5" /> Share
                    </button>
                  </div>
                </div>
              </div>
            ))}
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
