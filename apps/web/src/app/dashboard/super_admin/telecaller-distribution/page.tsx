'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Save,
  Plus,
  AlertTriangle,
  Link2,
  Copy,
  RefreshCw,
  MessageSquareText,
  Percent,
  Trash2,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import {
  ALL_LEAD_CHANNEL_IDS,
  LEAD_DISTRIBUTION_CHANNELS,
  normalizeAllowedChannels,
  type LeadDistributionChannelId,
} from '@/lib/enquiry/leadChannels';
import {
  newTriggerId,
  type MessageTrigger,
  type MessageTriggerMatch,
} from '@/lib/enquiry/messageTriggers';

type Telecaller = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
};

type AllocationRow = {
  telecaller_id: string;
  allocation_percent: number;
  allocation_status: 'ACTIVE' | 'INACTIVE';
  daily_limit: number | null;
  allowed_channels: LeadDistributionChannelId[] | null;
};

type TabId = 'allocation' | 'triggers' | 'api';

function telecallerLabel(t: Telecaller | undefined) {
  if (!t) return 'Telecaller';
  return t.full_name || t.email || t.phone || t.id.slice(0, 8);
}

export default function TelecallerDistributionPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [telecallers, setTelecallers] = useState<Telecaller[]>([]);
  const [rows, setRows] = useState<AllocationRow[]>([]);
  const [triggers, setTriggers] = useState<MessageTrigger[]>([]);
  const [tab, setTab] = useState<TabId>('allocation');
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [selectedOptionalFields, setSelectedOptionalFields] = useState<string[]>([]);
  const [selectedSourceSlug, setSelectedSourceSlug] = useState('google-ads');
  const [testMessage, setTestMessage] = useState('');
  const [sourcesOpen, setSourcesOpen] = useState<Record<number, boolean>>({});

  const leadSourceApis = [
    { label: 'Google Ads', slug: 'google-ads' },
    { label: 'Instagram Ads', slug: 'instagram-ads' },
    { label: 'WhatsApp', slug: 'whatsapp' },
    { label: 'Website', slug: 'website' },
    { label: 'App Booking', slug: 'app-booking' },
    { label: 'Banner/Offline', slug: 'banner-offline' },
    { label: 'Reference', slug: 'reference' },
    { label: 'Partner', slug: 'partner' },
    { label: 'Other', slug: 'other' },
  ];
  const optionalFields = [
    'lead_priority',
    'lead_source_other_note',
    'customer_name',
    'customer_alt_phone',
    'customer_email',
    'customer_address',
    'customer_city',
    'customer_pincode',
    'customer_lat',
    'customer_lng',
    'vehicle_number',
    'vehicle_make',
    'vehicle_model',
    'vehicle_variant',
    'vehicle_fuel_type',
    'problem_description',
    'pickup_required',
    'preferred_slot_start',
    'preferred_slot_end',
  ];

  useEffect(() => {
    void fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/telecaller-distribution');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load settings');

      const list = (json.telecallers || []).map((t: any) => ({
        id: String(t.id),
        full_name: t.full_name ? String(t.full_name) : null,
        email: t.email ? String(t.email) : null,
        phone: t.phone ? String(t.phone) : null,
        is_active: Boolean(t.is_active),
      }));
      const allocs = (json.allocations || [])
        .filter((r: any) => r?.is_active !== false)
        .map((r: any) => {
          const allowed = normalizeAllowedChannels(r?.meta?.allowed_channels);
          return {
            telecaller_id: String(r.telecaller_id),
            allocation_percent: Number(r.allocation_percent || 0),
            allocation_status:
              String(r.allocation_status || 'ACTIVE').toUpperCase() === 'INACTIVE'
                ? ('INACTIVE' as const)
                : ('ACTIVE' as const),
            daily_limit: r.daily_limit == null ? null : Number(r.daily_limit),
            allowed_channels: allowed,
          };
        });

      setTelecallers(list);
      // Do not auto-fill every telecaller — only saved allocation rows (empty until Add Row).
      setRows(allocs);
      setTriggers(Array.isArray(json.message_triggers) ? json.message_triggers : []);
    } catch (e) {
      console.error('Failed to load telecaller distribution settings:', e);
    } finally {
      setLoading(false);
    }
  }

  const activeTotal = useMemo(() => {
    return rows
      .filter((r) => r.allocation_status === 'ACTIVE')
      .reduce((sum, r) => sum + Number(r.allocation_percent || 0), 0);
  }, [rows]);

  const activeTriggerCount = useMemo(
    () => triggers.filter((t) => t.is_active).length,
    [triggers],
  );

  const testMatch = useMemo(() => {
    const msg = testMessage.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!msg) return null;
    let best: { trigger: MessageTrigger; score: number } | null = null;
    for (const t of triggers) {
      if (!t.is_active) continue;
      const phrase = t.phrase.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!phrase) continue;
      let ok = false;
      if (t.match === 'exact') ok = msg === phrase;
      else if (t.match === 'starts_with') ok = msg.startsWith(phrase);
      else ok = msg.includes(phrase);
      if (!ok) continue;
      const score =
        phrase.length + (t.match === 'exact' ? 1000 : t.match === 'starts_with' ? 500 : 0);
      if (!best || score > best.score) best = { trigger: t, score };
    }
    return best?.trigger || null;
  }, [testMessage, triggers]);

  function updateRow(index: number, patch: Partial<AllocationRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        telecaller_id: '',
        allocation_percent: 0,
        allocation_status: 'INACTIVE',
        daily_limit: null,
        allowed_channels: null,
      },
    ]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function channelOn(row: AllocationRow, id: LeadDistributionChannelId) {
    if (row.allowed_channels == null) return true;
    return row.allowed_channels.includes(id);
  }

  function toggleChannel(index: number, id: LeadDistributionChannelId) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        const current = r.allowed_channels ? [...r.allowed_channels] : [...ALL_LEAD_CHANNEL_IDS];
        const next = current.includes(id)
          ? current.filter((c) => c !== id)
          : [...current, id];
        if (next.length === ALL_LEAD_CHANNEL_IDS.length) {
          return { ...r, allowed_channels: null };
        }
        return { ...r, allowed_channels: next };
      }),
    );
  }

  function setAllChannels(index: number, on: boolean) {
    updateRow(index, { allowed_channels: on ? null : [] });
  }

  function addTrigger() {
    setTriggers((prev) => [
      ...prev,
      {
        id: newTriggerId(),
        label: '',
        phrase: '',
        match: 'exact',
        telecaller_id: telecallers[0]?.id || '',
        mark_as_meta: true,
        is_active: true,
      },
    ]);
    setTab('triggers');
  }

  function updateTrigger(index: number, patch: Partial<MessageTrigger>) {
    setTriggers((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function removeTrigger(index: number) {
    setTriggers((prev) => prev.filter((_, i) => i !== index));
  }

  function getLeadApiUrl(slug: string) {
    if (typeof window === 'undefined') return `/api/enquiry-leads/by-source/${slug}`;
    return `${window.location.origin}/api/enquiry-leads/by-source/${slug}`;
  }

  async function copyLeadApi(slug: string) {
    const url = getLeadApiUrl(slug);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(null), 1500);
    } catch (e) {
      console.error('Failed to copy API URL:', e);
    }
  }

  function toggleOptionalField(field: string) {
    setSelectedOptionalFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field],
    );
  }

  function buildSamplePayload() {
    const base: Record<string, any> = {
      lead_type: 'NORMAL',
      customer_phone: '9999999999',
    };
    const optional: Record<string, any> = {
      lead_priority: 'NORMAL',
      lead_source_other_note: 'Sample note',
      customer_name: 'Rahul Sharma',
      customer_alt_phone: '8888888888',
      customer_email: 'rahul@example.com',
      customer_address: 'Andheri West',
      customer_city: 'Mumbai',
      customer_pincode: '400053',
      customer_lat: 19.1364,
      customer_lng: 72.8296,
      vehicle_number: 'MH01AB1234',
      vehicle_make: 'Maruti',
      vehicle_model: 'Swift',
      vehicle_variant: 'VXI',
      vehicle_fuel_type: 'Petrol',
      problem_description: 'Engine noise',
      pickup_required: true,
      preferred_slot_start: '2026-01-21T10:00:00.000Z',
      preferred_slot_end: '2026-01-21T12:00:00.000Z',
    };
    for (const key of selectedOptionalFields) {
      base[key] = optional[key];
    }
    return base;
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/telecaller-distribution', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocations: rows.map((r) => ({
            telecaller_id: r.telecaller_id,
            allocation_percent: r.allocation_percent,
            allocation_status: r.allocation_status,
            daily_limit: r.daily_limit,
            allowed_channels: r.allowed_channels,
          })),
          message_triggers: triggers,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to save settings');
      await fetchData();
      alert('Advanced distribution settings saved.');
    } catch (e: any) {
      alert(e?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleBackfill() {
    const confirmed = window.confirm(
      'Backfill unassigned leads now? This will auto-assign existing leads.',
    );
    if (!confirmed) return;

    setBackfilling(true);
    try {
      const res = await fetch('/api/admin/telecaller-distribution/backfill', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to backfill leads');
      alert(`Backfill complete. Assigned: ${json.assignedCount}, Skipped: ${json.skippedCount}`);
    } catch (e: any) {
      alert(e?.message || 'Failed to backfill leads');
    } finally {
      setBackfilling(false);
    }
  }

  if (loading && rows.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-5 sm:py-6 md:py-8 space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 text-indigo-700 px-2.5 py-0.5 text-[11px] font-bold mb-1.5">
            <Sparkles className="w-3 h-3" />
            Advanced routing
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-heading">
            Telecaller Distribution
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1 max-w-2xl">
            Source filters, % allocation, daily caps, and Meta WhatsApp message triggers (campaign
            prefill → telecaller).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void fetchData()}
            disabled={loading}
            className="btn btn-secondary flex items-center gap-2 px-3 py-2 text-sm"
            style={{ backgroundColor: '#5B6CFF', color: '#fff' }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleBackfill}
            disabled={backfilling}
            className="btn btn-secondary flex items-center gap-2 px-3 py-2 text-sm"
          >
            {backfilling ? 'Backfilling...' : 'Backfill Leads'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary flex items-center gap-2 px-3 py-2 text-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-xl border bg-white px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wide text-gray-500 font-bold">Active %</div>
          <div
            className={`text-lg font-bold ${Math.abs(activeTotal - 100) < 0.001 ? 'text-emerald-600' : 'text-rose-600'}`}
          >
            {activeTotal.toFixed(0)}%
          </div>
        </div>
        <div className="rounded-xl border bg-white px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wide text-gray-500 font-bold">
            Active telecallers
          </div>
          <div className="text-lg font-bold text-slate-800">
            {rows.filter((r) => r.allocation_status === 'ACTIVE').length}
          </div>
        </div>
        <div className="rounded-xl border bg-white px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wide text-gray-500 font-bold">
            Message triggers
          </div>
          <div className="text-lg font-bold text-indigo-700">{activeTriggerCount}</div>
        </div>
        <div className="rounded-xl border bg-white px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wide text-gray-500 font-bold">
            Priority order
          </div>
          <div className="text-[11px] font-semibold text-slate-700 leading-snug mt-0.5">
            1) Message trigger → 2) Source filter → 3) % RR
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {(
          [
            { id: 'allocation' as const, label: 'Allocation & Sources', icon: Percent },
            { id: 'triggers' as const, label: 'Message Triggers', icon: MessageSquareText },
            { id: 'api' as const, label: 'Lead Source API', icon: Link2 },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border transition ${
                active
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
              {item.id === 'triggers' ? (
                <span
                  className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                    active ? 'bg-white/20' : 'bg-indigo-50 text-indigo-700'
                  }`}
                >
                  {activeTriggerCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === 'allocation' && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="font-semibold text-sm sm:text-base">Telecaller allocation</div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Turn sources ON/OFF per telecaller. Example: WhatsApp only → website bookings skip
                them.
              </p>
            </div>
            <button
              onClick={addRow}
              className="btn btn-secondary flex items-center gap-1 text-xs sm:text-sm self-start"
            >
              <Plus className="w-4 h-4" />
              Add Row
            </button>
          </div>

          <div className="px-4 py-3 border-b flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between text-xs sm:text-sm bg-slate-50/80">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
              Active rows % total must = 100. Channel filters apply when no message trigger matches.
            </div>
            <div
              className={`font-semibold ${Math.abs(activeTotal - 100) < 0.001 ? 'text-green-600' : 'text-red-600'}`}
            >
              Active Total: {activeTotal.toFixed(2)}%
            </div>
          </div>

          <div className="divide-y">
            {rows.map((row, index) => {
              const onCount =
                row.allowed_channels == null
                  ? ALL_LEAD_CHANNEL_IDS.length
                  : row.allowed_channels.length;
              const name = telecallerLabel(
                telecallers.find((t) => t.id === row.telecaller_id),
              );
              return (
                <div key={`${row.telecaller_id}-${index}`} className="px-3 sm:px-4 py-3 space-y-2">
                  <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
                    <select
                      className="border rounded-md px-2 py-1.5 text-sm min-w-[150px] flex-1"
                      value={row.telecaller_id}
                      onChange={(e) => updateRow(index, { telecaller_id: e.target.value })}
                    >
                      <option value="">Select telecaller</option>
                      {telecallers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {telecallerLabel(t)}
                          {!t.is_active ? ' (inactive login)' : ''}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="border rounded-md px-2 py-1.5 text-sm w-[72px] shrink-0"
                      value={row.allocation_percent}
                      min={0}
                      max={100}
                      step="0.01"
                      title="% Allocation"
                      placeholder="%"
                      onChange={(e) =>
                        updateRow(index, { allocation_percent: Number(e.target.value) })
                      }
                    />
                    <select
                      className="border rounded-md px-2 py-1.5 text-sm w-[104px] shrink-0"
                      value={row.allocation_status}
                      onChange={(e) =>
                        updateRow(index, {
                          allocation_status: e.target.value === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
                        })
                      }
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                    <input
                      type="number"
                      className="border rounded-md px-2 py-1.5 text-sm w-[88px] shrink-0"
                      placeholder="Limit"
                      value={row.daily_limit ?? ''}
                      min={0}
                      title="Daily limit"
                      onChange={(e) =>
                        updateRow(index, {
                          daily_limit: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setSourcesOpen((prev) => ({ ...prev, [index]: !prev[index] }))
                      }
                      className={`inline-flex items-center justify-between gap-1.5 border rounded-md px-2.5 py-1.5 text-xs font-semibold w-[118px] shrink-0 transition ${
                        sourcesOpen[index]
                          ? 'border-blue-300 bg-blue-50 text-blue-800'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span>
                        Sources {onCount}/{ALL_LEAD_CHANNEL_IDS.length}
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 shrink-0 transition ${sourcesOpen[index] ? 'rotate-180' : ''}`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="text-rose-600 text-xs font-semibold inline-flex items-center gap-1 shrink-0 px-1"
                      title="Remove row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Remove</span>
                    </button>
                  </div>

                  {sourcesOpen[index] ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <p className="text-xs font-semibold text-slate-700">
                          Lead sources for {name}
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="text-[11px] font-bold text-blue-700"
                            onClick={() => setAllChannels(index, true)}
                          >
                            All ON
                          </button>
                          <button
                            type="button"
                            className="text-[11px] font-bold text-rose-700"
                            onClick={() => setAllChannels(index, false)}
                          >
                            All OFF
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {LEAD_DISTRIBUTION_CHANNELS.map((ch) => {
                          const on = channelOn(row, ch.id);
                          return (
                            <button
                              key={ch.id}
                              type="button"
                              title={ch.hint}
                              onClick={() => toggleChannel(index, ch.id)}
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold border transition ${
                                on
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-white text-gray-400 border-gray-200 line-through'
                              }`}
                            >
                              <span
                                className={`h-2 w-2 rounded-full ${on ? 'bg-emerald-500' : 'bg-gray-300'}`}
                              />
                              {ch.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {rows.length === 0 && (
              <div className="px-4 py-6 text-center text-gray-500 text-sm">
                No allocation rows. Add a row to begin.
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'triggers' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-950">
            <p className="font-semibold">Meta WhatsApp campaign tracking</p>
            <p className="text-xs sm:text-sm mt-1 text-indigo-900/80">
              Meta ad pe jo prefill message set karte ho (jaise{' '}
              <em>“Hi! I am interested in service!”</em>) — yahan woh exact / contains match set
              karo. Match hone pe lead usi telecaller ko assign hoti hai.
            </p>
          </div>

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="font-semibold text-sm sm:text-base">Message → Telecaller rules</div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Longer / Exact matches win if multiple rules match the same message.
                </p>
              </div>
              <button
                type="button"
                onClick={addTrigger}
                className="btn btn-primary flex items-center gap-1 text-xs sm:text-sm self-start"
                style={{ backgroundColor: '#5B6CFF', color: '#fff' }}
              >
                <Plus className="w-4 h-4" />
                Add Trigger
              </button>
            </div>

            <div className="divide-y">
              {triggers.map((t, index) => (
                <div key={t.id} className="px-4 py-4 space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block text-xs font-semibold text-gray-600">
                      Campaign label
                      <input
                        className="mt-1 w-full border rounded-md px-2 py-1.5 text-sm font-normal"
                        placeholder="e.g. IG Service Interest Jul"
                        value={t.label}
                        onChange={(e) => updateTrigger(index, { label: e.target.value })}
                      />
                    </label>
                    <label className="block text-xs font-semibold text-gray-600">
                      Assign telecaller
                      <select
                        className="mt-1 w-full border rounded-md px-2 py-1.5 text-sm font-normal"
                        value={t.telecaller_id}
                        onChange={(e) => updateTrigger(index, { telecaller_id: e.target.value })}
                      >
                        <option value="">Select telecaller</option>
                        {telecallers.map((tc) => (
                          <option key={tc.id} value={tc.id}>
                            {telecallerLabel(tc)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="block text-xs font-semibold text-gray-600">
                    Prefill / first message (from Meta ad)
                    <textarea
                      className="mt-1 w-full border rounded-md px-2 py-1.5 text-sm font-normal min-h-[64px]"
                      placeholder='Hi! I am interested in service!'
                      value={t.phrase}
                      onChange={(e) => updateTrigger(index, { phrase: e.target.value })}
                    />
                  </label>

                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-xs font-semibold text-gray-600 inline-flex items-center gap-2">
                      Match
                      <select
                        className="border rounded-md px-2 py-1.5 text-sm font-normal"
                        value={t.match}
                        onChange={(e) =>
                          updateTrigger(index, {
                            match: e.target.value as MessageTriggerMatch,
                          })
                        }
                      >
                        <option value="exact">Exact</option>
                        <option value="starts_with">Starts with</option>
                        <option value="contains">Contains</option>
                      </select>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={t.mark_as_meta}
                        onChange={(e) =>
                          updateTrigger(index, { mark_as_meta: e.target.checked })
                        }
                      />
                      Mark as Meta lead
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={t.is_active}
                        onChange={(e) => updateTrigger(index, { is_active: e.target.checked })}
                      />
                      Active
                    </label>
                    <button
                      type="button"
                      onClick={() => removeTrigger(index)}
                      className="ml-auto text-rose-600 text-xs font-semibold inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {triggers.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-gray-500">
                  No message triggers yet. Add one for each Meta campaign prefill message.
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-4 space-y-2">
            <div className="text-sm font-semibold">Test a message</div>
            <p className="text-xs text-gray-500">
              Paste customer first WhatsApp message — see which trigger / telecaller would win
              (after Save, live assignment uses saved rules).
            </p>
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm min-h-[72px]"
              placeholder="Hi! I am interested in service!"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
            />
            {testMessage.trim() ? (
              testMatch ? (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-900">
                  Matched <strong>{testMatch.label || testMatch.phrase}</strong> →{' '}
                  {telecallerLabel(telecallers.find((t) => t.id === testMatch.telecaller_id))}
                  {testMatch.mark_as_meta ? ' · Meta lead' : ''}
                </div>
              ) : (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
                  No trigger match — falls back to source filter + % allocation.
                </div>
              )
            ) : null}
          </div>
        </div>
      )}

      {tab === 'api' && (
        <div className="bg-white rounded-xl border p-4 space-y-4">
          <div>
            <div className="text-sm font-semibold">Lead Source API URLs</div>
            <div className="text-xs text-gray-600 mt-1">
              Use these POST endpoints to create leads with fixed lead_source.
            </div>
          </div>

          <div className="text-xs text-gray-600">
            Base URL:{' '}
            <span className="font-medium text-gray-900">
              {typeof window === 'undefined' ? 'https://your-domain.com' : window.location.origin}
            </span>
          </div>

          <div className="rounded-md border bg-gray-50 p-3 flex flex-col gap-3">
            <div className="grid gap-2 sm:grid-cols-[200px_1fr] sm:items-center">
              <div className="text-sm font-semibold">Lead Source</div>
              <select
                className="border rounded-md px-2 py-1.5 text-sm"
                value={selectedSourceSlug}
                onChange={(e) => setSelectedSourceSlug(e.target.value)}
              >
                {leadSourceApis.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <code className="text-xs sm:text-sm text-gray-700 break-all bg-white border rounded px-2 py-1">
                {getLeadApiUrl(selectedSourceSlug)}
              </code>
              <div className="flex items-center gap-2">
                <a
                  className="btn btn-secondary text-xs flex items-center gap-1"
                  href={getLeadApiUrl(selectedSourceSlug)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  Open
                </a>
                <button
                  onClick={() => copyLeadApi(selectedSourceSlug)}
                  className="btn btn-secondary text-xs flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedSlug === selectedSourceSlug ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-600">
            Required fields: lead_type, customer_phone. For source &quot;Other&quot;, pass
            lead_source_other_note.
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {optionalFields.map((field) => {
              const active = selectedOptionalFields.includes(field);
              return (
                <button
                  key={field}
                  type="button"
                  onClick={() => toggleOptionalField(field)}
                  className={`px-2 py-1 rounded-full border ${active ? 'bg-brand-primary text-white border-brand-primary' : 'bg-gray-100 text-gray-700'}`}
                >
                  {field}
                </button>
              );
            })}
          </div>

          <pre className="text-xs bg-gray-50 border rounded-md p-3 overflow-x-auto">
{`curl -X POST "${getLeadApiUrl(selectedSourceSlug)}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(buildSamplePayload(), null, 2)}'`}
          </pre>
        </div>
      )}
    </div>
  );
}
