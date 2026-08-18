'use client';

import { useCallback, useEffect, useState, Suspense, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';
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
  Share2,
  Bell,
  Loader2,
  X,
  MessageCircle,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';

function openLeadWhatsApp(lead: { customer_phone?: string | null; message_preview?: string | null }) {
  const phone = String(lead?.customer_phone || '').replace(/\D/g, '');
  if (!phone) return;
  window.dispatchEvent(
    new CustomEvent('myfng:open-wa-chat', {
      detail: {
        phone,
        preview: lead?.message_preview || undefined,
      },
    }),
  );
}

const PRIORITY_OPTIONS = [
  { value: '', label: 'All priorities' },
  { value: 'NORMAL', label: 'NORMAL' },
  { value: 'HIGH', label: 'HIGH' },
  { value: 'URGENT', label: 'URGENT' },
];

function TelecallerCrmLeadsContent() {
  const pathname = usePathname();
  const { base, layoutRole, isLeadManager } = getCrmDashboardBase(pathname);
  const searchParams = useSearchParams();
  const router = useRouter();
  const filterParam = searchParams?.get('filter');
  const initialPrefs = loadTelecallerCrmFilterPrefs();

  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const bootedRef = useRef(false);
  const [q, setQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [filter, setFilter] = useState(filterParam || initialPrefs.statusFilter || 'all');
  const [lostReason, setLostReason] = useState('');
  const [city, setCity] = useState('');
  const [priority, setPriority] = useState('');
  const [telecallerId, setTelecallerId] = useState('');
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [telecallers, setTelecallers] = useState<Array<{ id: string; full_name: string | null }>>([]);
  const [datePreset, setDatePreset] = useState<CrmDatePreset>(initialPrefs.datePreset);
  const [customStart, setCustomStart] = useState(initialPrefs.customStart);
  const [customEnd, setCustomEnd] = useState(initialPrefs.customEnd);
  const [cities, setCities] = useState<string[]>([]);
  const [shareLead, setShareLead] = useState<any>(null);
  const [peers, setPeers] = useState<any[]>([]);
  const [sharing, setSharing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advIncomplete, setAdvIncomplete] = useState(false);
  const [advFollowUp, setAdvFollowUp] = useState(false);
  const [advHasVehicle, setAdvHasVehicle] = useState(false);
  const [advHasCoupon, setAdvHasCoupon] = useState(false);
  const [advNoAssignee, setAdvNoAssignee] = useState(false);
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const [drawerMounted, setDrawerMounted] = useState(false);

  useEffect(() => {
    setDrawerMounted(true);
  }, []);

  const openLeadDrawer = (leadId: string) => {
    setDrawerLeadId(leadId);
  };

  const closeLeadDrawer = () => setDrawerLeadId(null);

  const displayedLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (advIncomplete && !lead.is_incomplete) return false;
      if (advFollowUp && !lead.follow_up_required && !lead.next_follow_up_at && !lead.reminder?.at) {
        return false;
      }
      if (advHasVehicle) {
        const reg = String(lead.vehicle_number || '')
          .trim()
          .toUpperCase();
        if (!reg || reg === 'NA' || reg === '—') return false;
      }
      if (advHasCoupon) {
        const code = String(lead.coupon_code || lead.coupon_meta?.coupon_code || '').trim();
        if (!code) return false;
      }
      if (advNoAssignee && lead.assigned_telecaller_id) return false;
      return true;
    });
  }, [leads, advIncomplete, advFollowUp, advHasVehicle, advHasCoupon, advNoAssignee]);

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

  useEffect(() => {
    if (!isLeadManager) return;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('users_login')
          .select('id, full_name, roles!role_id(role_code)')
          .eq('is_active', true)
          .order('full_name');
        setTelecallers(
          (data || [])
            .filter((t: any) => String(t?.roles?.role_code || '').toUpperCase() === 'TELECALLER')
            .map((t: any) => ({ id: String(t.id), full_name: t.full_name ? String(t.full_name) : null })),
        );
      } catch {
        setTelecallers([]);
      }
    })();
  }, [isLeadManager]);

  const load = useCallback(async () => {
    if (bootedRef.current) setRefreshing(true);
    else setLoading(true);
    try {
      const range = resolveCrmDateRange(datePreset, customStart, customEnd);
      const params = new URLSearchParams({ limit: '50' });
      if (filter && filter !== 'all') params.set('filter', filter);
      if (filter === 'lost' && lostReason.trim()) params.set('lost_reason', lostReason.trim());
      if (appliedQ.trim()) params.set('q', appliedQ.trim());
      if (city.trim()) params.set('city', city.trim());
      if (priority.trim()) params.set('priority', priority.trim());
      if (isLeadManager && telecallerId.trim()) params.set('telecaller_id', telecallerId.trim());
      if (isLeadManager && unassignedOnly) params.set('unassigned', '1');
      params.set('from', range.start);
      params.set('to', range.end);
      const res = await fetch(`/api/telecaller/crm/leads?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed');
      setLeads(Array.isArray(data?.leads) ? data.leads : []);
    } catch (e) {
      console.error(e);
      if (!bootedRef.current) setLeads([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      bootedRef.current = true;
    }
  }, [filter, lostReason, appliedQ, city, priority, datePreset, customStart, customEnd, isLeadManager, telecallerId, unassignedOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const runSearch = () => {
    setAppliedQ(q.trim());
  };

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
    router.replace(`${base}/leads${next.toString() ? `?${next}` : ''}`);
  };

  return (
    <DashboardLayout role={layoutRole}>
      <div className="w-full max-w-7xl mx-auto space-y-5 pb-24">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-500">Advanced CRM</p>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#023D95]">Leads</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {isLeadManager
                ? 'Click a lead to open full Service Lead Details (side panel). Assign / filter by telecaller.'
                : 'Sirf aapke assigned (ya aapke banaye) leads — WhatsApp · 6161 sticky pe niche.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('myfng:open-wa-inbox'))}
              className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white shadow-sm"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </button>
            <Link
              href={`${base}/book`}
              className="rounded-xl bg-[#004AAD] px-4 py-2.5 text-sm font-bold text-white shadow-sm"
            >
              + New Booking
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
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
              }}
            >
              {CRM_DATE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-bold text-slate-500">City</label>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800"
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
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-bold text-slate-500">Priority</label>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800"
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
          {isLeadManager ? (
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-bold text-slate-500">Telecaller</label>
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800"
                value={unassignedOnly ? '__unassigned__' : telecallerId}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '__unassigned__') {
                    setUnassignedOnly(true);
                    setTelecallerId('');
                  } else {
                    setUnassignedOnly(false);
                    setTelecallerId(v);
                  }
                }}
              >
                <option value="">All telecallers</option>
                <option value="__unassigned__">Unassigned only</option>
                {telecallers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name || t.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {filter === 'lost' ? (
            <div className="min-w-0">
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
          {datePreset === 'custom' ? (
            <>
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-bold text-slate-500">From</label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={customStart}
                  onChange={(e) => persistDate({ customStart: e.target.value, datePreset: 'custom' })}
                />
              </div>
              <div className="min-w-0">
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
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50"
          >
            <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-800">
              <SlidersHorizontal className="h-4 w-4 text-[#023D95]" />
              Advanced filters
              {(advIncomplete || advFollowUp || advHasVehicle || advHasCoupon || advNoAssignee) && (
                <span className="rounded-full bg-[#023D95] px-2 py-0.5 text-[10px] font-bold text-white">
                  ON
                </span>
              )}
            </span>
            <ChevronDown
              className={`h-4 w-4 text-slate-500 transition ${showAdvanced ? 'rotate-180' : ''}`}
            />
          </button>
          {showAdvanced ? (
            <div className="border-t border-slate-100 px-4 py-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
              {[
                {
                  id: 'incomplete',
                  label: 'Incomplete only',
                  checked: advIncomplete,
                  set: setAdvIncomplete,
                },
                {
                  id: 'followup',
                  label: 'Follow-up / reminder',
                  checked: advFollowUp,
                  set: setAdvFollowUp,
                },
                {
                  id: 'vehicle',
                  label: 'Has reg. number',
                  checked: advHasVehicle,
                  set: setAdvHasVehicle,
                },
                {
                  id: 'coupon',
                  label: 'Has coupon',
                  checked: advHasCoupon,
                  set: setAdvHasCoupon,
                },
                ...(isLeadManager
                  ? [
                      {
                        id: 'noassignee',
                        label: 'Unassigned only',
                        checked: advNoAssignee,
                        set: setAdvNoAssignee,
                      },
                    ]
                  : []),
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold cursor-pointer ${
                    opt.checked
                      ? 'border-[#023D95] bg-blue-50 text-[#023D95]'
                      : 'border-slate-200 text-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={opt.checked}
                    onChange={(e) => opt.set(e.target.checked)}
                  />
                  {opt.label}
                </label>
              ))}
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
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setFilterAndUrl('all');
                setCity('');
                setPriority('');
                setTelecallerId('');
                setUnassignedOnly(false);
                setLostReason('');
                setQ('');
                setAppliedQ('');
                setAdvIncomplete(false);
                setAdvFollowUp(false);
                setAdvHasVehicle(false);
                setAdvHasCoupon(false);
                setAdvNoAssignee(false);
              }}
              className="inline-flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              <X className="h-4 w-4" /> Clear
            </button>
            <button
              type="button"
              onClick={runSearch}
              className="flex-1 sm:flex-none rounded-xl bg-[#004AAD] px-4 py-2 text-sm font-bold text-white"
            >
              Search
            </button>
          </div>
        </div>

        {/* quick status chips */}
        <div className="flex flex-wrap gap-2">
          {LEAD_STATUS_FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterAndUrl(f.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold border transition ${
                  active
                    ? 'bg-[#004AAD] text-white border-[#004AAD]'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {refreshing ? (
          <p className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating…
          </p>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading leads…
          </div>
        ) : displayedLeads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
            No leads in this filter / date range
          </div>
        ) : (
          <>
            {/* Desktop table — SA-style, no lead source column */}
            <div className="hidden lg:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 whitespace-nowrap">Lead #</th>
                      <th className="px-4 py-3 whitespace-nowrap">Status</th>
                      <th className="px-4 py-3 whitespace-nowrap">Customer</th>
                      <th className="px-4 py-3 whitespace-nowrap">Phone</th>
                      <th className="px-4 py-3 whitespace-nowrap">Message</th>
                      <th className="px-4 py-3 whitespace-nowrap">Reg. No</th>
                      <th className="px-4 py-3 whitespace-nowrap">Make / Model</th>
                      {isLeadManager ? (
                        <th className="px-4 py-3 whitespace-nowrap">Assignee</th>
                      ) : null}
                      <th className="px-4 py-3 whitespace-nowrap">Date</th>
                      <th className="px-4 py-3 whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedLeads.map((lead) => {
                      const tint = leadStatusCardColors(lead);
                      const statusLabel = leadDisplayStatus(lead);
                      const msg =
                        lead.message_preview ||
                        lead.coupon_meta?.last_inbound_message ||
                        lead.problem_description ||
                        '—';
                      const regNo = String(lead.vehicle_number || '')
                        .trim()
                        .toUpperCase();
                      const regDisplay = regNo && regNo !== 'NA' ? regNo : '—';
                      const makeModel =
                        [lead.vehicle_make, lead.vehicle_model]
                          .map((v) => String(v || '').trim())
                          .filter((v) => v && v.toUpperCase() !== 'NA')
                          .join(' ') || '—';
                      return (
                        <tr
                          key={lead.id}
                          className="hover:bg-slate-50/80 cursor-pointer"
                          onClick={() => openLeadDrawer(String(lead.id))}
                        >
                          <td className="px-4 py-3 font-extrabold text-[#023D95] whitespace-nowrap">
                            {lead.lead_number || lead.id?.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                              style={{ backgroundColor: tint.badgeBg, color: tint.badgeText }}
                            >
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                            {lead.customer_name || 'Unknown'}
                          </td>
                          <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                            {lead.customer_phone || '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-600 max-w-[220px] truncate" title={String(msg)}>
                            {String(msg)}
                          </td>
                          <td
                            className="px-4 py-3 text-slate-800 font-semibold whitespace-nowrap uppercase"
                            title={regDisplay}
                          >
                            {regDisplay}
                          </td>
                          <td
                            className="px-4 py-3 text-slate-700 max-w-[180px] truncate"
                            title={makeModel}
                          >
                            {makeModel}
                          </td>
                          {isLeadManager ? (
                            <td className="px-4 py-3 text-indigo-700 font-semibold text-xs whitespace-nowrap">
                              {lead.assigned_telecaller?.full_name || 'Unassigned'}
                            </td>
                          ) : null}
                          <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                            {lead.created_at
                              ? new Date(lead.created_at).toLocaleString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </td>
                          <td
                            className="px-4 py-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-2">
                              {lead.customer_phone ? (
                                <a
                                  href={`tel:${lead.customer_phone}`}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200"
                                >
                                  <Phone className="h-3.5 w-3.5" /> Call
                                </a>
                              ) : null}
                              {lead.customer_phone ? (
                                <button
                                  type="button"
                                  onClick={() => openLeadWhatsApp(lead)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-[#25D366]/15 px-2.5 py-1.5 text-xs font-bold text-[#128C7E] ring-1 ring-[#25D366]/40"
                                  title="WhatsApp · 6161"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" /> WA
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => openShare(lead)}
                                className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200"
                              >
                                <Share2 className="h-3.5 w-3.5" /> Share
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile / tablet cards */}
            <div className="grid grid-cols-1 gap-3 lg:hidden">
              {displayedLeads.map((lead) => {
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
                    role="link"
                    tabIndex={0}
                    onClick={() => openLeadDrawer(String(lead.id))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openLeadDrawer(String(lead.id));
                      }
                    }}
                    className="rounded-2xl border p-4 shadow-sm transition hover:shadow-md cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004AAD]"
                    style={{ backgroundColor: tint.cardBg, borderColor: tint.border }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-extrabold text-[#023D95]">
                            {lead.lead_number || lead.id?.slice(0, 8)}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                              style={{ backgroundColor: tint.badgeBg, color: tint.badgeText }}
                            >
                              {statusLabel}
                            </span>
                            {lead.is_incomplete ? (
                              <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white">
                                Incomplete
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                              Customer
                            </p>
                            <p className="font-bold text-slate-900">
                              {lead.customer_name || 'Unknown'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                              Phone
                            </p>
                            <p className="font-semibold text-slate-800">
                              {lead.customer_phone || '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                              Reg. No
                            </p>
                            <p className="font-semibold uppercase text-slate-800">
                              {lead.vehicle_number &&
                              String(lead.vehicle_number).trim().toUpperCase() !== 'NA'
                                ? String(lead.vehicle_number).trim().toUpperCase()
                                : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                              Make / Model
                            </p>
                            <p className="font-semibold text-slate-800">
                              {[lead.vehicle_make, lead.vehicle_model]
                                .map((v) => String(v || '').trim())
                                .filter((v) => v && v.toUpperCase() !== 'NA')
                                .join(' ') || '—'}
                            </p>
                          </div>
                        </div>
                        {lead.city ? (
                          <p className="mt-2 text-xs text-slate-500">{lead.city}</p>
                        ) : null}
                        {isLeadManager ? (
                          <p className="text-[11px] font-semibold text-indigo-700 mt-0.5">
                            {lead.assigned_telecaller?.full_name
                              ? `Telecaller: ${lead.assigned_telecaller.full_name}`
                              : 'Telecaller: Unassigned'}
                          </p>
                        ) : null}
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
                                {reminder?.type
                                  ? ` · ${String(reminder.type).replace(/_/g, ' ')}`
                                  : ''}
                              </span>
                              <span className="block text-[10px] font-medium opacity-90">
                                {new Date(reminderAt).toLocaleString('en-IN')}
                                {reminder?.reason ? ` — ${reminder.reason}` : ''}
                              </span>
                            </span>
                          </div>
                        ) : null}
                      </div>
                      <div
                        className="flex flex-wrap gap-2 sm:justify-end shrink-0"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        {lead.customer_phone ? (
                          <a
                            href={`tel:${lead.customer_phone}`}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-white/80 px-3 py-2 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200"
                          >
                            <Phone className="h-3.5 w-3.5" /> Call
                          </a>
                        ) : null}
                        {lead.customer_phone ? (
                          <button
                            type="button"
                            onClick={() => openLeadWhatsApp(lead)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2 text-xs font-bold text-white shadow-sm"
                          >
                            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                          </button>
                        ) : null}
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
          </>
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

      {drawerMounted &&
        drawerLeadId &&
        createPortal(
          <div className="fixed inset-0 z-[90] flex justify-end">
            <button
              type="button"
              aria-label="Close lead details"
              className="flex-1 min-w-0 bg-black/40"
              onClick={closeLeadDrawer}
            />
            <aside
              role="dialog"
              aria-modal="true"
              aria-label="Service Lead Details"
              className="relative z-10 flex h-full w-full sm:w-[min(96vw,1280px)] flex-col bg-white shadow-2xl border-l border-slate-200"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 shrink-0 bg-white">
                <p className="text-sm font-extrabold text-[#023D95] truncate">Service Lead Details</p>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`${base}/leads/${drawerLeadId}?edit=1`}
                    className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50"
                    onClick={closeLeadDrawer}
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={closeLeadDrawer}
                    className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <iframe
                title="Lead details"
                src={`${base}/leads/${drawerLeadId}?embed=1`}
                className="flex-1 min-h-0 w-full border-0 bg-slate-50"
              />
            </aside>
          </div>,
          document.body,
        )}
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
