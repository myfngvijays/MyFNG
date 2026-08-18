'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  MapPin,
  Filter,
  ChevronLeft,
  ChevronRight,
  Bell,
} from 'lucide-react';
import {
  ALL_LEAD_CHANNEL_IDS,
  LEAD_DISTRIBUTION_CHANNELS,
  normalizeAllowedChannels,
  type LeadDistributionChannelId,
} from '@/lib/enquiry/leadChannels';
import {
  normalizeAllowedPincodes,
  normalizePincodeMode,
  type PincodeRoutingMode,
} from '@/lib/enquiry/pincodeAllocation';
import TelecallerPincodeEditor, {
  telecallerPincodeBadge,
} from '@/components/admin/telecaller-distribution/TelecallerPincodeEditor';
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
  allowed_pincodes: string[] | null;
  pincode_mode: PincodeRoutingMode;
};

type TabId = 'allocation' | 'triggers' | 'api' | 'whatsapp';
type TriggerStatusFilter = 'active' | 'inactive' | 'all';

type WaLeadAlertState = {
  settings: { enabled: boolean };
  template_status: {
    templateName: string;
    exists: boolean;
    isApproved: boolean;
    metaStatus: string | null;
    metaCategory?: string | null;
    isUtility?: boolean;
    canSendTemplate: boolean;
  };
  template_preview: {
    template_name: string;
    display_name: string;
    body_text: string;
    header_text?: string;
    category?: string;
    example_values: readonly string[];
  };
};

const TRIGGER_PAGE_SIZE = 10;

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
  const [routingPanel, setRoutingPanel] = useState<Record<number, 'pincodes' | 'sources' | null>>({});
  const [testMessage, setTestMessage] = useState('');
  const [waAlert, setWaAlert] = useState<WaLeadAlertState | null>(null);
  const [waLoading, setWaLoading] = useState(false);
  const [waBusy, setWaBusy] = useState(false);
  const [waMessage, setWaMessage] = useState<string | null>(null);
  const [waError, setWaError] = useState<string | null>(null);
  const [waTestTelecallerId, setWaTestTelecallerId] = useState('');
  const [waTestPhone, setWaTestPhone] = useState('');
  const [waPhoneDrafts, setWaPhoneDrafts] = useState<Record<string, string>>({});
  const [waPhoneSavingId, setWaPhoneSavingId] = useState<string | null>(null);
  const [triggerFilterTelecallerId, setTriggerFilterTelecallerId] = useState('');
  const [triggerFilterStatus, setTriggerFilterStatus] = useState<TriggerStatusFilter>('active');
  const [triggerPage, setTriggerPage] = useState(1);
  const [highlightTriggerId, setHighlightTriggerId] = useState<string | null>(null);
  const newTriggerRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (tab === 'whatsapp') void loadWaAlert();
  }, [tab]);

  async function loadWaAlert() {
    setWaLoading(true);
    setWaError(null);
    try {
      const res = await fetch('/api/super_admin/telecaller-lead-whatsapp');
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error || 'Failed to load WhatsApp alert settings');
      setWaAlert({
        settings: json.settings,
        template_status: json.template_status,
        template_preview: json.template_preview,
      });
      if (!waTestTelecallerId && Array.isArray(telecallers) && telecallers[0]?.id) {
        setWaTestTelecallerId(telecallers[0].id);
      }
    } catch (e: unknown) {
      setWaError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setWaLoading(false);
    }
  }

  async function saveWaEnabled(enabled: boolean) {
    setWaBusy(true);
    setWaMessage(null);
    setWaError(null);
    try {
      const res = await fetch('/api/super_admin/telecaller-lead-whatsapp', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error || 'Save failed');
      setWaAlert((prev) =>
        prev ? { ...prev, settings: json.settings } : { settings: json.settings, template_status: { templateName: '', exists: false, isApproved: false, metaStatus: null, metaCategory: null, isUtility: false, canSendTemplate: false }, template_preview: { template_name: '', display_name: '', body_text: '', example_values: [] } },
      );
      setWaMessage(enabled ? 'WhatsApp new-lead alerts enabled' : 'WhatsApp new-lead alerts disabled');
      void loadWaAlert();
    } catch (e: unknown) {
      setWaError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setWaBusy(false);
    }
  }

  async function runWaAction(action: 'create-template' | 'sync-template' | 'test-send') {
    setWaBusy(true);
    setWaMessage(null);
    setWaError(null);
    try {
      const customPhone = waTestPhone.replace(/\D/g, '').trim();
      if (action === 'test-send' && !customPhone && !waTestTelecallerId) {
        throw new Error('Enter any phone number or select a telecaller');
      }
      const res = await fetch('/api/super_admin/telecaller-lead-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ...(action === 'test-send'
            ? {
                telecaller_id: waTestTelecallerId || undefined,
                phone: customPhone || undefined,
              }
            : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error || json?.message || 'Action failed');
      setWaMessage(json.message || 'Done');
      void loadWaAlert();
    } catch (e: unknown) {
      setWaError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setWaBusy(false);
    }
  }

  async function saveTelecallerPhone(telecallerId: string) {
    const phone = String(waPhoneDrafts[telecallerId] ?? '').replace(/\D/g, '').trim();
    if (!phone || phone.length < 10) {
      setWaError('Enter a valid phone (at least 10 digits)');
      return;
    }
    setWaPhoneSavingId(telecallerId);
    setWaMessage(null);
    setWaError(null);
    try {
      const res = await fetch('/api/super_admin/telecaller-lead-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-telecaller-phone',
          telecaller_id: telecallerId,
          phone,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error || json?.message || 'Failed to save phone');
      setTelecallers((prev) =>
        prev.map((t) => (t.id === telecallerId ? { ...t, phone } : t)),
      );
      setWaPhoneDrafts((prev) => ({ ...prev, [telecallerId]: phone }));
      setWaMessage(json.message || `Phone saved for telecaller`);
    } catch (e: unknown) {
      setWaError(e instanceof Error ? e.message : 'Failed to save phone');
    } finally {
      setWaPhoneSavingId(null);
    }
  }

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
          const allowedPincodes = normalizeAllowedPincodes(r?.meta?.allowed_pincodes);
          const pincodeMode = normalizePincodeMode(r?.meta?.pincode_mode, allowedPincodes);
          return {
            telecaller_id: String(r.telecaller_id),
            allocation_percent: Number(r.allocation_percent || 0),
            allocation_status:
              String(r.allocation_status || 'ACTIVE').toUpperCase() === 'INACTIVE'
                ? ('INACTIVE' as const)
                : ('ACTIVE' as const),
            daily_limit: r.daily_limit == null ? null : Number(r.daily_limit),
            allowed_channels: allowed,
            allowed_pincodes: allowedPincodes,
            pincode_mode: pincodeMode,
          };
        });

      setTelecallers(list);
      setWaPhoneDrafts((prev) => {
        const next = { ...prev };
        for (const t of list) {
          if (next[t.id] === undefined) next[t.id] = t.phone || '';
        }
        return next;
      });
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

  /** Assign dropdown: all login-active telecallers (users_login.is_active). */
  const activeTelecallers = useMemo(
    () => telecallers.filter((t) => t.is_active),
    [telecallers],
  );

  const statusFilteredTriggers = useMemo(() => {
    return triggers
      .map((trigger, index) => ({ trigger, index }))
      .filter(({ trigger }) => {
        if (triggerFilterStatus === 'active') return trigger.is_active;
        if (triggerFilterStatus === 'inactive') return !trigger.is_active;
        return true;
      });
  }, [triggers, triggerFilterStatus]);

  const filteredTriggers = useMemo(() => {
    if (!triggerFilterTelecallerId) return statusFilteredTriggers;
    return statusFilteredTriggers.filter(
      ({ trigger }) => trigger.telecaller_id === triggerFilterTelecallerId,
    );
  }, [statusFilteredTriggers, triggerFilterTelecallerId]);

  const triggerTotalPages = Math.max(1, Math.ceil(filteredTriggers.length / TRIGGER_PAGE_SIZE));

  const pagedTriggers = useMemo(() => {
    const page = Math.min(Math.max(triggerPage, 1), triggerTotalPages);
    const start = (page - 1) * TRIGGER_PAGE_SIZE;
    return filteredTriggers.slice(start, start + TRIGGER_PAGE_SIZE);
  }, [filteredTriggers, triggerPage, triggerTotalPages]);

  const triggerFilterOptions = useMemo(() => {
    const ids = new Set(
      statusFilteredTriggers.map(({ trigger }) => trigger.telecaller_id).filter(Boolean),
    );
    return telecallers.filter((t) => ids.has(t.id) || t.is_active);
  }, [telecallers, statusFilteredTriggers]);

  useEffect(() => {
    setTriggerPage(1);
  }, [triggerFilterTelecallerId, triggerFilterStatus]);

  useEffect(() => {
    if (triggerPage > triggerTotalPages) setTriggerPage(triggerTotalPages);
  }, [triggerPage, triggerTotalPages]);

  useEffect(() => {
    if (!highlightTriggerId || tab !== 'triggers') return;
    const el = newTriggerRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = window.setTimeout(() => setHighlightTriggerId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [highlightTriggerId, tab, triggers.length]);

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
        allowed_pincodes: null,
        pincode_mode: 'all',
      },
    ]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleRoutingPanel(index: number, panel: 'pincodes' | 'sources') {
    setRoutingPanel((prev) => ({
      ...prev,
      [index]: prev[index] === panel ? null : panel,
    }));
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
    const id = newTriggerId();
    const defaultTelecallerId = activeTelecallers[0]?.id || '';
    setTriggers((prev) => [
      {
        id,
        label: '',
        phrase: '',
        match: 'exact',
        telecaller_id: defaultTelecallerId,
        mark_as_meta: true,
        is_active: true,
      },
      ...prev,
    ]);
    setTriggerFilterTelecallerId('');
    setTriggerFilterStatus('active');
    setTriggerPage(1);
    setHighlightTriggerId(id);
    setTab('triggers');
  }

  function telecallerOptionsForTrigger(selectedId: string) {
    const selected = telecallers.find((t) => t.id === selectedId);
    if (selected && !selected.is_active) {
      return [selected, ...activeTelecallers.filter((t) => t.id !== selected.id)];
    }
    return activeTelecallers;
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
            allowed_pincodes: r.allowed_pincodes,
            pincode_mode: r.pincode_mode,
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
            Source filters, pincode mapping, % allocation, daily caps, and Meta WhatsApp message
            triggers (campaign prefill → telecaller).
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
            1) Message trigger → 2) Pincode map → 3) Source filter → 4) % RR
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {(
          [
            { id: 'allocation' as const, label: 'Allocation & Sources', icon: Percent },
            { id: 'triggers' as const, label: 'Message Triggers', icon: MessageSquareText },
            { id: 'whatsapp' as const, label: 'WhatsApp Alerts', icon: Bell },
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
              {item.id === 'whatsapp' && waAlert?.settings.enabled ? (
                <span
                  className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                    active ? 'bg-white/20' : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  ON
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
                Turn sources ON/OFF and map pincodes per telecaller. Example: Thane pincodes → Telecaller
                A; website bookings skip WhatsApp-only rows.
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
              Active rows % total must = 100. Pincode + channel filters apply when no message trigger
              matches.
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
              const pinBadge = telecallerPincodeBadge(row.pincode_mode, row.allowed_pincodes);
              const openPanel = routingPanel[index] || null;
              return (
                <div
                  key={`${row.telecaller_id}-${index}`}
                  className="px-3 sm:px-4 py-4 space-y-3 bg-white even:bg-slate-50/40"
                >
                  <div className="flex flex-col xl:flex-row xl:items-center gap-3">
                    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto min-w-0 flex-1">
                      <select
                        className="border rounded-lg px-2.5 py-2 text-sm min-w-[160px] flex-1 bg-white"
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
                        className="border rounded-lg px-2.5 py-2 text-sm w-[76px] shrink-0 bg-white"
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
                        className="border rounded-lg px-2.5 py-2 text-sm w-[108px] shrink-0 bg-white"
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
                        className="border rounded-lg px-2.5 py-2 text-sm w-[92px] shrink-0 bg-white"
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
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
                        <button
                          type="button"
                          onClick={() => toggleRoutingPanel(index, 'pincodes')}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                            openPanel === 'pincodes'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-gray-700 hover:bg-emerald-50'
                          }`}
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          Pincodes
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                              openPanel === 'pincodes'
                                ? 'bg-white/20 text-white'
                                : pinBadge.tone === 'mapped'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : pinBadge.tone === 'none'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {pinBadge.label}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleRoutingPanel(index, 'sources')}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                            openPanel === 'sources'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-gray-700 hover:bg-blue-50'
                          }`}
                        >
                          Sources
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                              openPanel === 'sources'
                                ? 'bg-white/20 text-white'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {onCount}/{ALL_LEAD_CHANNEL_IDS.length}
                          </span>
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        className="text-rose-600 text-xs font-semibold inline-flex items-center gap-1 shrink-0 px-2 py-2 rounded-lg hover:bg-rose-50"
                        title="Remove row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {openPanel === 'pincodes' ? (
                    <TelecallerPincodeEditor
                      telecallerName={name}
                      pincodeMode={row.pincode_mode}
                      allowedPincodes={row.allowed_pincodes}
                      onChange={(next) =>
                        updateRow(index, {
                          pincode_mode: next.pincode_mode,
                          allowed_pincodes: next.allowed_pincodes,
                        })
                      }
                    />
                  ) : null}

                  {openPanel === 'sources' ? (
                    <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-indigo-50/70 p-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div>
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-800">
                            Lead sources
                          </div>
                          <p className="text-sm font-semibold text-gray-900 mt-2">{name}</p>
                        </div>
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
            <div className="px-4 py-3 border-b flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm sm:text-base">Message → Telecaller rules</div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Longer / Exact matches win if multiple rules match the same message. New triggers
                    appear at the top.
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
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600">
                  <Filter className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  <span className="shrink-0">Status</span>
                  <select
                    className="border rounded-md px-2 py-1.5 text-sm font-normal bg-white"
                    value={triggerFilterStatus}
                    onChange={(e) =>
                      setTriggerFilterStatus(e.target.value as TriggerStatusFilter)
                    }
                  >
                    <option value="active">
                      Active ({triggers.filter((t) => t.is_active).length})
                    </option>
                    <option value="inactive">
                      Inactive ({triggers.filter((t) => !t.is_active).length})
                    </option>
                    <option value="all">All ({triggers.length})</option>
                  </select>
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 min-w-0 flex-1 sm:max-w-xs">
                  <span className="shrink-0">Telecaller</span>
                  <select
                    className="border rounded-md px-2 py-1.5 text-sm font-normal flex-1 min-w-0 bg-white"
                    value={triggerFilterTelecallerId}
                    onChange={(e) => setTriggerFilterTelecallerId(e.target.value)}
                  >
                    <option value="">All telecallers ({statusFilteredTriggers.length})</option>
                    {triggerFilterOptions.map((tc) => {
                      const count = statusFilteredTriggers.filter(
                        ({ trigger }) => trigger.telecaller_id === tc.id,
                      ).length;
                      return (
                        <option key={tc.id} value={tc.id}>
                          {telecallerLabel(tc)}
                          {!tc.is_active ? ' (inactive)' : ''} ({count})
                        </option>
                      );
                    })}
                  </select>
                </label>
                {(triggerFilterTelecallerId || triggerFilterStatus !== 'active') && (
                  <button
                    type="button"
                    onClick={() => {
                      setTriggerFilterTelecallerId('');
                      setTriggerFilterStatus('active');
                    }}
                    className="text-xs font-semibold text-indigo-700 hover:underline self-start sm:self-center"
                  >
                    Reset filters
                  </button>
                )}
                <span className="text-[11px] text-gray-500 sm:ml-auto">
                  {filteredTriggers.length === 0
                    ? 'No matches'
                    : `Showing ${Math.min((Math.min(triggerPage, triggerTotalPages) - 1) * TRIGGER_PAGE_SIZE + 1, filteredTriggers.length)}–${Math.min(triggerPage * TRIGGER_PAGE_SIZE, filteredTriggers.length)} of ${filteredTriggers.length}`}
                </span>
              </div>
            </div>

            <div className="p-3 sm:p-4 space-y-3 bg-slate-50/70">
              {pagedTriggers.map(({ trigger: t, index }) => {
                const assignOptions = telecallerOptionsForTrigger(t.telecaller_id);
                const isNew = highlightTriggerId === t.id;
                return (
                  <div
                    key={t.id}
                    ref={isNew ? newTriggerRef : undefined}
                    className={`rounded-xl border bg-white px-3 sm:px-4 py-3 space-y-2 shadow-sm transition ${
                      isNew
                        ? 'border-indigo-400 ring-2 ring-indigo-200'
                        : t.is_active
                          ? 'border-slate-200'
                          : 'border-dashed border-slate-300 opacity-80'
                    }`}
                  >
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="block text-[11px] font-semibold text-gray-600 min-w-[120px] flex-1 basis-[140px]">
                        Campaign label
                        <input
                          className="mt-0.5 w-full border rounded-md px-2 py-1.5 text-sm font-normal"
                          placeholder="e.g. Campaign A"
                          value={t.label}
                          onChange={(e) => updateTrigger(index, { label: e.target.value })}
                        />
                      </label>
                      <label className="block text-[11px] font-semibold text-gray-600 w-[120px] shrink-0">
                        Match
                        <select
                          className="mt-0.5 w-full border rounded-md px-2 py-1.5 text-sm font-normal"
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
                      <label className="block text-[11px] font-semibold text-gray-600 min-w-[150px] flex-1 basis-[160px]">
                        Assign telecaller
                        <select
                          className="mt-0.5 w-full border rounded-md px-2 py-1.5 text-sm font-normal"
                          value={t.telecaller_id}
                          onChange={(e) => updateTrigger(index, { telecaller_id: e.target.value })}
                        >
                          <option value="">Select telecaller</option>
                          {assignOptions.map((tc) => (
                            <option key={tc.id} value={tc.id}>
                              {telecallerLabel(tc)}
                              {!tc.is_active ? ' (inactive login)' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-700 pb-2 shrink-0"
                        title="Match hone pe lead ko Meta Ads (WHATSAPP_META) source mark karta hai"
                      >
                        <input
                          type="checkbox"
                          checked={t.mark_as_meta}
                          onChange={(e) =>
                            updateTrigger(index, { mark_as_meta: e.target.checked })
                          }
                        />
                        Meta lead
                      </label>
                      <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-700 pb-2 shrink-0">
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
                        className="text-rose-600 text-xs font-semibold inline-flex items-center gap-1 pb-2 shrink-0 ml-auto"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <label className="block text-[11px] font-semibold text-gray-600">
                      Prefill message
                      <textarea
                        className="mt-0.5 w-full border rounded-md px-2 py-1.5 text-sm font-normal min-h-[52px] resize-y"
                        placeholder="Hi! I am interested in service!"
                        value={t.phrase}
                        onChange={(e) => updateTrigger(index, { phrase: e.target.value })}
                        rows={2}
                      />
                    </label>
                  </div>
                );
              })}
              {triggers.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-gray-500 bg-white rounded-xl border border-dashed">
                  No message triggers yet. Add one for each Meta campaign prefill message.
                </div>
              )}
              {triggers.length > 0 && filteredTriggers.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-gray-500 bg-white rounded-xl border border-dashed">
                  No triggers match these filters.{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setTriggerFilterTelecallerId('');
                      setTriggerFilterStatus('all');
                    }}
                    className="text-indigo-700 font-semibold hover:underline"
                  >
                    Show all
                  </button>
                </div>
              )}
              {filteredTriggers.length > TRIGGER_PAGE_SIZE && (
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={triggerPage <= 1}
                    onClick={() => setTriggerPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 rounded-lg border bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Prev
                  </button>
                  <span className="text-xs font-semibold text-gray-600 tabular-nums">
                    Page {Math.min(triggerPage, triggerTotalPages)} / {triggerTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={triggerPage >= triggerTotalPages}
                    onClick={() => setTriggerPage((p) => Math.min(triggerTotalPages, p + 1))}
                    className="inline-flex items-center gap-1 rounded-lg border bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
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
                  No trigger match — falls back to pincode map, source filter, then % allocation.
                </div>
              )
            ) : null}
          </div>
        </div>
      )}

      {tab === 'whatsapp' && (
        <div className="bg-white rounded-xl border shadow-sm p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-sm sm:text-base">WhatsApp — new lead to telecaller</div>
              <p className="text-[11px] text-gray-500 mt-0.5 max-w-2xl">
                When a lead is auto/manual assigned, telecaller already gets app push. Turn this ON to also send a
                WhatsApp UTILITY template to the telecaller&apos;s phone on{' '}
                <code className="text-[10px] bg-gray-100 px-1 rounded">users_login</code>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadWaAlert()}
              disabled={waLoading || waBusy}
              className="btn btn-secondary text-xs flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${waLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {waMessage ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 font-medium">
              {waMessage}
            </div>
          ) : null}
          {waError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 font-medium">
              {waError}
            </div>
          ) : null}

          {waLoading && !waAlert ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : waAlert ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-slate-50 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold">Send WhatsApp on new lead assign</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Requires Meta-approved template{' '}
                    <code className="text-[10px]">{waAlert.template_preview.template_name}</code>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={waBusy}
                  onClick={() => void saveWaEnabled(!waAlert.settings.enabled)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${
                    waAlert.settings.enabled
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  {waAlert.settings.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold">{waAlert.template_preview.display_name}</div>
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        waAlert.template_status.metaCategory === 'UTILITY' ||
                        (!waAlert.template_status.metaCategory &&
                          waAlert.template_preview.category === 'UTILITY')
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {waAlert.template_status.metaCategory ||
                        waAlert.template_preview.category ||
                        'UTILITY'}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        waAlert.template_status.canSendTemplate
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {waAlert.template_status.metaStatus ||
                        (waAlert.template_status.exists ? 'PENDING' : 'NOT CREATED')}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500">
                  Meta template name:{' '}
                  <code className="text-[10px] bg-gray-100 px-1 rounded">
                    {waAlert.template_preview.template_name}
                  </code>
                  . Old <code className="text-[10px]">telecaller_new_lead_alert</code> may stay
                  MARKETING on Meta — ignore it; use this v2 UTILITY name.
                </p>
                {waAlert.template_status.exists &&
                waAlert.template_status.metaCategory &&
                waAlert.template_status.metaCategory !== 'UTILITY' ? (
                  <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
                    Meta classified this as <strong>{waAlert.template_status.metaCategory}</strong>, not
                    UTILITY. Delete it in Meta Business Manager, then click Create / push again (or bump
                    the template name in code).
                  </div>
                ) : null}
                {waAlert.template_preview.header_text ? (
                  <div className="text-[11px] font-semibold text-gray-600">
                    Header: {waAlert.template_preview.header_text}
                  </div>
                ) : null}
                <pre className="text-[11px] bg-gray-50 border rounded-md p-3 overflow-x-auto whitespace-pre-wrap text-gray-700">
                  {waAlert.template_preview.body_text}
                </pre>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={waBusy}
                    onClick={() => void runWaAction('create-template')}
                    className="btn btn-secondary text-xs"
                  >
                    Create / push to Meta
                  </button>
                  <button
                    type="button"
                    disabled={waBusy}
                    onClick={() => void runWaAction('sync-template')}
                    className="btn btn-secondary text-xs"
                  >
                    Sync status from Meta
                  </button>
                </div>
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <div className="text-sm font-semibold">Telecaller WhatsApp numbers</div>
                <p className="text-[11px] text-gray-500">
                  Live alerts go to this phone on the telecaller profile. Edit any number here and save.
                </p>
                <div className="divide-y border rounded-md overflow-hidden">
                  {telecallers.length === 0 ? (
                    <p className="text-xs text-gray-400 px-3 py-4">No telecallers found.</p>
                  ) : (
                    telecallers.map((t) => (
                      <div
                        key={t.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2.5 bg-white"
                      >
                        <div className="sm:w-44 shrink-0 text-sm font-medium text-gray-800 truncate">
                          {telecallerLabel(t)}
                        </div>
                        <input
                          type="tel"
                          inputMode="numeric"
                          placeholder="e.g. 9876543210"
                          className="border rounded-md px-2 py-1.5 text-sm flex-1 min-w-0"
                          value={waPhoneDrafts[t.id] ?? t.phone ?? ''}
                          onChange={(e) =>
                            setWaPhoneDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))
                          }
                        />
                        <button
                          type="button"
                          disabled={waPhoneSavingId === t.id || waBusy}
                          onClick={() => void saveTelecallerPhone(t.id)}
                          className="btn btn-secondary text-xs disabled:opacity-50 shrink-0"
                        >
                          {waPhoneSavingId === t.id ? 'Saving…' : 'Save number'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <div className="text-sm font-semibold">Test send</div>
                <p className="text-[11px] text-gray-500">
                  Enter any phone for a quick test, or pick a telecaller (custom phone wins if both filled).
                </p>
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="Any number to test (e.g. 8291347218)"
                    className="border rounded-md px-2 py-1.5 text-sm"
                    value={waTestPhone}
                    onChange={(e) => setWaTestPhone(e.target.value)}
                  />
                  <select
                    className="border rounded-md px-2 py-1.5 text-sm"
                    value={waTestTelecallerId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setWaTestTelecallerId(id);
                      const tc = telecallers.find((row) => row.id === id);
                      if (tc?.phone && !waTestPhone.trim()) {
                        setWaTestPhone(tc.phone);
                      }
                    }}
                  >
                    <option value="">Optional: pick telecaller…</option>
                    {telecallers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {telecallerLabel(t)}
                        {t.phone ? ` · ${t.phone}` : ' · no phone'}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={
                      waBusy ||
                      (!waTestPhone.replace(/\D/g, '') && !waTestTelecallerId) ||
                      !waAlert.template_status.canSendTemplate
                    }
                    onClick={() => void runWaAction('test-send')}
                    className="btn btn-primary text-xs disabled:opacity-50"
                  >
                    Send test WhatsApp
                  </button>
                </div>
                {!waAlert.template_status.canSendTemplate ? (
                  <p className="text-[11px] text-amber-800">
                    Template must be APPROVED as UTILITY on Meta before test send or live alerts work.
                    {waAlert.template_status.metaCategory &&
                    waAlert.template_status.metaCategory !== 'UTILITY'
                      ? ` Current Meta category: ${waAlert.template_status.metaCategory}.`
                      : ''}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400">Could not load settings.</p>
          )}
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
