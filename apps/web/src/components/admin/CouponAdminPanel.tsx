'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Ticket,
  Search,
  Loader2,
  Download,
  BarChart3,
  Layers,
  RefreshCw,
  History,
  UserPlus,
} from 'lucide-react';

type ChannelId = 'ALL' | 'WEB' | 'MOBILE' | 'MEMBERSHIP' | 'TELECALLER';

type CouponForm = {
  code: string;
  campaign_name: string;
  coupon_kind: 'TOTAL_DISCOUNT' | 'FREE_SERVICE';
  discount_mode: 'AMOUNT' | 'PERCENT' | '';
  discount_value: string;
  min_order_value: string;
  max_discount_amount: string;
  target_custom_label: string;
  start_at: string;
  end_at: string;
  usage_limit_total: string;
  usage_limit_per_customer: string;
  is_active: boolean;
  is_public: boolean;
  first_order_only: boolean;
  description: string;
  applicable_channels: ChannelId[];
  applicable_city_ids: string[];
  applicable_workshop_ids: string[];
  applicable_service_type_ids: string[];
};

type BulkForm = {
  campaign_name: string;
  prefix: string;
  count: string;
  random_length: string;
  coupon_kind: 'TOTAL_DISCOUNT' | 'FREE_SERVICE';
  discount_mode: 'AMOUNT' | 'PERCENT';
  discount_value: string;
  min_order_value: string;
  max_discount_amount: string;
  usage_limit_total: string;
  usage_limit_per_customer: string;
  start_at: string;
  end_at: string;
  description: string;
  is_public: boolean;
  first_order_only: boolean;
  applicable_channels: ChannelId[];
};

const emptyForm: CouponForm = {
  code: '',
  campaign_name: '',
  coupon_kind: 'TOTAL_DISCOUNT',
  discount_mode: 'AMOUNT',
  discount_value: '',
  min_order_value: '',
  max_discount_amount: '',
  target_custom_label: '',
  start_at: '',
  end_at: '',
  usage_limit_total: '',
  usage_limit_per_customer: '1',
  is_active: true,
  is_public: true,
  first_order_only: false,
  description: '',
  applicable_channels: ['ALL'],
  applicable_city_ids: [],
  applicable_workshop_ids: [],
  applicable_service_type_ids: [],
};

const emptyBulk: BulkForm = {
  campaign_name: '',
  prefix: 'MYFNG',
  count: '50',
  random_length: '6',
  coupon_kind: 'TOTAL_DISCOUNT',
  discount_mode: 'PERCENT',
  discount_value: '10',
  min_order_value: '',
  max_discount_amount: '',
  usage_limit_total: '1',
  usage_limit_per_customer: '1',
  start_at: '',
  end_at: '',
  description: '',
  is_public: false,
  first_order_only: false,
  applicable_channels: ['MOBILE'],
};

function parseChannels(value: unknown): ChannelId[] {
  if (Array.isArray(value) && value.length) return value.map(String) as ChannelId[];
  return ['ALL'];
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function CouponAdminPanel({
  initialTab = 'coupons',
  embedded = false,
  searchQuery = '',
  autoOpenCreate = false,
}: {
  initialTab?: 'coupons' | 'bulk' | 'redemptions' | 'assign' | 'audit';
  embedded?: boolean;
  searchQuery?: string;
  autoOpenCreate?: boolean;
}) {
  const [tab, setTab] = useState<'coupons' | 'bulk' | 'redemptions' | 'assign' | 'audit'>(initialTab);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [redemptionSummary, setRedemptionSummary] = useState<any>(null);
  const [options, setOptions] = useState<any>({ cities: [], workshops: [], service_types: [], channels: [], batches: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any | null>(null);
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const [bulkForm, setBulkForm] = useState<BulkForm>(emptyBulk);
  const [bulkResult, setBulkResult] = useState<string[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [assignForm, setAssignForm] = useState({ phone: '', phones_text: '', coupon_id: '', notes: '', google_sheet_url: '' });
  const [assignMode, setAssignMode] = useState<'single' | 'multiple' | 'file' | 'google_sheet'>('single');
  const [assignResult, setAssignResult] = useState<{ assigned_count: number; not_found_phones: string[] } | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importSource, setImportSource] = useState<string | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (searchQuery) setSearchTerm(searchQuery);
  }, [searchQuery]);

  const fetchOptions = useCallback(async () => {
    const res = await fetch('/api/admin/coupons/options');
    const json = await res.json().catch(() => ({}));
    if (res.ok) setOptions(json);
  }, []);

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/coupons');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load coupons');
      setCoupons(json?.coupons || []);
      setAnalytics(json?.analytics || null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load coupons');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRedemptions = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/coupons/redemptions?limit=200');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load redemptions');
      setRedemptions(json?.redemptions || []);
      setRedemptionSummary(json?.summary || null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load redemptions');
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/coupons/audit-log?limit=200');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load audit logs');
      setAuditLogs(json?.logs || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load audit logs');
    }
  }, []);

  useEffect(() => {
    fetchOptions();
    fetchCoupons();
  }, [fetchCoupons, fetchOptions]);

  useEffect(() => {
    if (tab === 'redemptions') fetchRedemptions();
    if (tab === 'audit') fetchAuditLogs();
  }, [tab, fetchRedemptions, fetchAuditLogs]);

  const filteredCoupons = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return coupons.filter((c) => {
      if (statusFilter === 'active' && !c.is_active) return false;
      if (statusFilter === 'inactive' && c.is_active) return false;
      if (!term) return true;
      return [c.code, c.description, c.campaign_name, c.coupon_kind].filter(Boolean).some((v: string) =>
        String(v).toLowerCase().includes(term),
      );
    });
  }, [coupons, searchTerm, statusFilter]);

  const openCreate = () => {
    setEditingCoupon(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  useEffect(() => {
    if (!autoOpenCreate) return;
    setTab('coupons');
    setEditingCoupon(null);
    setForm(emptyForm);
    setShowModal(true);
  }, [autoOpenCreate]);

  const openEdit = (coupon: any) => {
    setEditingCoupon(coupon);
    setForm({
      code: coupon.code || '',
      campaign_name: coupon.campaign_name || '',
      coupon_kind: coupon.coupon_kind || 'TOTAL_DISCOUNT',
      discount_mode: coupon.discount_mode || '',
      discount_value: coupon.discount_value != null ? String(coupon.discount_value) : '',
      min_order_value: coupon.min_order_value != null ? String(coupon.min_order_value) : '',
      max_discount_amount: coupon.max_discount_amount != null ? String(coupon.max_discount_amount) : '',
      target_custom_label: coupon.target_custom_label || '',
      start_at: coupon.start_at ? String(coupon.start_at).slice(0, 16) : '',
      end_at: coupon.end_at ? String(coupon.end_at).slice(0, 16) : '',
      usage_limit_total: coupon.usage_limit_total != null ? String(coupon.usage_limit_total) : '',
      usage_limit_per_customer: coupon.usage_limit_per_customer != null ? String(coupon.usage_limit_per_customer) : '1',
      is_active: Boolean(coupon.is_active),
      is_public: coupon.is_public !== false,
      first_order_only: Boolean(coupon.first_order_only),
      description: coupon.description || '',
      applicable_channels: parseChannels(coupon.applicable_channels),
      applicable_city_ids: Array.isArray(coupon.applicable_city_ids) ? coupon.applicable_city_ids.map(String) : [],
      applicable_workshop_ids: Array.isArray(coupon.applicable_workshop_ids) ? coupon.applicable_workshop_ids.map(String) : [],
      applicable_service_type_ids: Array.isArray(coupon.applicable_service_type_ids) ? coupon.applicable_service_type_ids.map(String) : [],
    });
    setShowModal(true);
  };

  const buildPayload = (source: CouponForm | BulkForm, isBulk = false) => {
    const base: any = {
      campaign_name: source.campaign_name || null,
      coupon_kind: source.coupon_kind,
      discount_mode: 'discount_mode' in source ? source.discount_mode || null : null,
      discount_value: source.discount_value ? Number(source.discount_value) : null,
      min_order_value: source.min_order_value ? Number(source.min_order_value) : null,
      max_discount_amount: source.max_discount_amount ? Number(source.max_discount_amount) : null,
      start_at: source.start_at ? new Date(source.start_at).toISOString() : null,
      end_at: source.end_at ? new Date(source.end_at).toISOString() : null,
      usage_limit_total: source.usage_limit_total ? Number(source.usage_limit_total) : null,
      usage_limit_per_customer: source.usage_limit_per_customer ? Number(source.usage_limit_per_customer) : null,
      description: source.description || null,
      applicable_channels: source.applicable_channels?.length ? source.applicable_channels : ['ALL'],
      first_order_only: source.first_order_only ?? false,
      is_public: source.is_public ?? true,
    };
    if (!isBulk) {
      base.code = (source as CouponForm).code.trim();
      base.target_custom_label = (source as CouponForm).target_custom_label || null;
      base.is_active = (source as CouponForm).is_active;
      base.applicable_city_ids = (source as CouponForm).applicable_city_ids;
      base.applicable_workshop_ids = (source as CouponForm).applicable_workshop_ids;
      base.applicable_service_type_ids = (source as CouponForm).applicable_service_type_ids;
    }
    return base;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = buildPayload(form);
      const res = await fetch(editingCoupon ? `/api/admin/coupons/${editingCoupon.id}` : '/api/admin/coupons', {
        method: editingCoupon ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to save coupon');
      setShowModal(false);
      setEditingCoupon(null);
      setForm(emptyForm);
      fetchCoupons();
    } catch (err: any) {
      setError(err?.message || 'Failed to save coupon');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setBulkResult([]);
    try {
      const payload = {
        ...buildPayload(bulkForm, true),
        prefix: bulkForm.prefix.trim().toUpperCase(),
        count: Number(bulkForm.count || 0),
        random_length: Number(bulkForm.random_length || 6),
      };
      const res = await fetch('/api/admin/coupons/bulk-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Bulk generation failed');
      setBulkResult(json?.codes || []);
      fetchCoupons();
      fetchOptions();
    } catch (err: any) {
      setError(err?.message || 'Bulk generation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setAssignResult(null);
    try {
      const payload: Record<string, unknown> = {
        coupon_id: assignForm.coupon_id,
        notes: assignForm.notes || null,
      };
      if (assignMode === 'single') {
        payload.phone = assignForm.phone.trim();
      } else if (assignMode === 'google_sheet') {
        if (parsedBulkPhones.length > 0) {
          payload.phones_text = assignForm.phones_text.trim();
        } else {
          payload.google_sheet_url = assignForm.google_sheet_url.trim();
        }
      } else {
        payload.phones_text = assignForm.phones_text.trim();
      }

      const res = await fetch('/api/admin/coupons/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Assign failed');

      setAssignResult({
        assigned_count: Number(json?.assigned_count || 0),
        not_found_phones: Array.isArray(json?.not_found_phones) ? json.not_found_phones : [],
      });

      if (assignMode === 'single') {
        setAssignForm((prev) => ({ ...prev, phone: '' }));
      } else if (assignMode === 'google_sheet') {
        setAssignForm((prev) => ({ ...prev, google_sheet_url: '', phones_text: '' }));
        setImportSource(null);
      } else if (assignMode === 'file') {
        setAssignForm((prev) => ({ ...prev, phones_text: '' }));
        setImportSource(null);
      } else {
        setAssignForm((prev) => ({ ...prev, phones_text: '' }));
      }
      fetchAuditLogs();
    } catch (err: any) {
      setError(err?.message || 'Assign failed');
    } finally {
      setSubmitting(false);
    }
  };

  const parsedBulkPhones = useMemo(() => {
    const raw = assignForm.phones_text.trim();
    if (!raw) return [];
    return [...new Set(
      raw
        .split(/[\n,;|\t]+/)
        .map((part) => part.replace(/\D/g, '').slice(-10))
        .filter((phone) => phone.length === 10),
    )];
  }, [assignForm.phones_text]);

  const applyImportedPhones = (phonesText: string, source: string) => {
    setAssignForm((prev) => ({ ...prev, phones_text: phonesText }));
    setImportSource(source);
    setAssignResult(null);
    setError(null);
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    setImportLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/coupons/assign/import', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Could not read file');
      applyImportedPhones(String(json?.phones_text || ''), `File: ${file.name}`);
    } catch (err: any) {
      setError(err?.message || 'Could not read file');
    } finally {
      setImportLoading(false);
    }
  };

  const handleFetchGoogleSheet = async () => {
    const url = assignForm.google_sheet_url.trim();
    if (!url) {
      setError('Paste a Google Sheet link first.');
      return;
    }
    setImportLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/coupons/assign/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ google_sheet_url: url }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Could not fetch Google Sheet');
      applyImportedPhones(String(json?.phones_text || ''), 'Google Sheet');
    } catch (err: any) {
      setError(err?.message || 'Could not fetch Google Sheet');
    } finally {
      setImportLoading(false);
    }
  };

  const downloadAssignTemplate = () => {
    downloadCsv(`myfng-coupon-assign-template-${Date.now()}.csv`, [
      ['mobile', 'name'],
      ['9876543210', 'Sample Customer 1'],
      ['9123456789', 'Sample Customer 2'],
    ]);
  };

  const canSubmitAssign =
    assignForm.coupon_id &&
    (assignMode === 'single'
      ? assignForm.phone.length === 10
      : assignMode === 'google_sheet'
        ? Boolean(assignForm.google_sheet_url.trim()) || parsedBulkPhones.length > 0
        : parsedBulkPhones.length > 0);

  const exportAllCoupons = () => {
    downloadCsv(
      `myfng-all-coupons-${Date.now()}.csv`,
      [
        ['code', 'campaign', 'type', 'value', 'channels', 'usage', 'status'],
        ...filteredCoupons.map((c) => [
          c.code,
          c.campaign_name || '',
          c.coupon_kind,
          c.discount_mode === 'PERCENT' ? `${c.discount_value}%` : String(c.discount_value || ''),
          (parseChannels(c.applicable_channels) || ['ALL']).join('|'),
          String(c.usage_count || 0),
          c.is_active ? 'active' : 'inactive',
        ]),
      ],
    );
  };

  const toggleActive = async (coupon: any) => {
    try {
      const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !coupon.is_active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to update coupon');
      fetchCoupons();
    } catch (err: any) {
      setError(err?.message || 'Failed to update coupon');
    }
  };

  const toggleChannel = (channels: ChannelId[], channel: ChannelId, setter: (next: ChannelId[]) => void) => {
    if (channel === 'ALL') {
      setter(['ALL']);
      return;
    }
    const withoutAll = channels.filter((c) => c !== 'ALL');
    const next = withoutAll.includes(channel)
      ? withoutAll.filter((c) => c !== channel)
      : [...withoutAll, channel];
    setter(next.length ? next : ['ALL']);
  };

  const ChannelPicker = ({
    value,
    onChange,
  }: {
    value: ChannelId[];
    onChange: (next: ChannelId[]) => void;
  }) => (
    <div className="flex flex-wrap gap-2">
      {(options.channels || []).map((ch: any) => {
        const active = value.includes(ch.id);
        return (
          <button
            key={ch.id}
            type="button"
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${active ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-gray-700 border-gray-300'}`}
            onClick={() => toggleChannel(value, ch.id, onChange)}
          >
            {ch.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={embedded ? 'space-y-4' : 'p-6 space-y-6'}>
      {!embedded ? (
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">MyFNG Coupon Management</h1>
            <p className="text-gray-500">Manage coupons for Website, Android, iOS app, Membership & Telecaller.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-secondary flex items-center gap-2" onClick={() => { fetchCoupons(); fetchOptions(); }}>
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            {tab === 'coupons' ? (
              <button className="btn btn-primary flex items-center gap-2" onClick={openCreate}>
                <Plus className="w-4 h-4" /> Add Coupon
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {embedded ? (
        <>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#15110d]">Coupon Management</h2>
              <p className="text-sm text-[#72665e]">Create, manage, and analyze promotional coupons across segments</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-lg border border-[#e6e0da] text-sm font-semibold text-[#15110d] hover:bg-[#f7f3ec] flex items-center gap-2"
                onClick={() => { fetchCoupons(); fetchOptions(); }}
              >
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-lg border border-[#e6e0da] text-sm font-semibold text-[#15110d] hover:bg-[#f7f3ec] flex items-center gap-2"
                onClick={() => setTab('bulk')}
              >
                <Layers className="w-4 h-4" /> Bulk Generate
              </button>
              {tab === 'coupons' ? (
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
                  style={{ background: '#e54800' }}
                  onClick={openCreate}
                >
                  <Plus className="w-4 h-4" /> Create Coupon
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="pcm-card rounded-xl border p-4">
              <div className="text-xs uppercase tracking-wider text-[#72665e]">Total Coupons</div>
              <div className="text-2xl font-bold mt-1">{analytics?.total_coupons ?? coupons.length}</div>
            </div>
            <div className="pcm-card rounded-xl border p-4">
              <div className="text-xs uppercase tracking-wider text-[#72665e]">Active</div>
              <div className="text-2xl font-bold mt-1 text-emerald-700">{analytics?.active_coupons ?? 0}</div>
            </div>
            <div className="pcm-card rounded-xl border p-4">
              <div className="text-xs uppercase tracking-wider text-[#72665e]">Redemptions</div>
              <div className="text-2xl font-bold mt-1 text-orange-600">{analytics?.total_redemptions ?? 0}</div>
            </div>
            <div className="pcm-card rounded-xl border p-4">
              <div className="text-xs uppercase tracking-wider text-[#72665e]">Inactive</div>
              <div className="text-2xl font-bold mt-1">{coupons.filter((c) => !c.is_active).length}</div>
            </div>
          </div>
        </>
      ) : null}

      {!embedded ? (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-sm text-gray-500">Total Coupons</div>
          <div className="text-2xl font-bold">{analytics?.total_coupons ?? coupons.length}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-sm text-gray-500">Active Coupons</div>
          <div className="text-2xl font-bold text-green-700">{analytics?.active_coupons ?? 0}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-sm text-gray-500">Total Redemptions</div>
          <div className="text-2xl font-bold text-brand-primary">{analytics?.total_redemptions ?? 0}</div>
        </div>
      </div>
      ) : null}

      <div className={`flex gap-2 border-b overflow-x-auto ${embedded ? 'border-[#e6e0da]' : ''}`}>
        {[
          { id: 'coupons', label: 'All Coupons', icon: Ticket },
          { id: 'bulk', label: 'Bulk Generate', icon: Layers },
          { id: 'redemptions', label: 'Redemptions', icon: BarChart3 },
          { id: 'assign', label: 'Assign to Customer', icon: UserPlus },
          { id: 'audit', label: 'Audit Log', icon: History },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap ${
              tab === id
                ? embedded
                  ? 'border-[#e54800] text-[#e54800]'
                  : 'border-brand-primary text-brand-primary'
                : 'border-transparent text-gray-500'
            }`}
            onClick={() => setTab(id as typeof tab)}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{error}</div>
      ) : null}

      {tab === 'coupons' ? (
        <>
          <div className="bg-white rounded-lg border shadow-sm p-4 flex flex-col md:flex-row gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Search className="w-4 h-4 text-gray-400" />
              <input className="w-full text-sm outline-none" placeholder="Search code, campaign, description..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <select className="input max-w-[180px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button className="btn btn-secondary text-xs flex items-center gap-1" onClick={exportAllCoupons}>
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>

          <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Channels</th>
                  <th className="px-4 py-3">Usage</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500"><Loader2 className="w-4 h-4 inline animate-spin mr-2" />Loading...</td></tr>
                ) : null}
                {!loading && filteredCoupons.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No coupons found.</td></tr>
                ) : null}
                {filteredCoupons.map((coupon) => (
                  <tr key={coupon.id} className="border-t">
                    <td className="px-4 py-3 font-semibold">{coupon.code}</td>
                    <td className="px-4 py-3">{coupon.campaign_name || '—'}</td>
                    <td className="px-4 py-3">{coupon.coupon_kind}</td>
                    <td className="px-4 py-3">
                      {coupon.coupon_kind === 'FREE_SERVICE'
                        ? coupon.target_custom_label || 'Free Service'
                        : `${coupon.discount_mode === 'PERCENT' ? `${coupon.discount_value}%` : `₹${coupon.discount_value}`}`}
                    </td>
                    <td className="px-4 py-3">{(parseChannels(coupon.applicable_channels) || ['ALL']).join(', ')}</td>
                    <td className="px-4 py-3">{coupon.usage_count ?? 0}</td>
                    <td className="px-4 py-3"><span className={coupon.is_active ? 'text-green-700' : 'text-gray-500'}>{coupon.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="btn btn-secondary text-xs" onClick={() => openEdit(coupon)}>Edit</button>
                        <button className="btn btn-secondary text-xs" onClick={() => toggleActive(coupon)}>{coupon.is_active ? 'Deactivate' : 'Activate'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {tab === 'bulk' ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <form className="bg-white border rounded-xl p-5 space-y-3" onSubmit={handleBulkGenerate}>
            <h2 className="text-lg font-bold">Bulk Code Generator</h2>
            <p className="text-sm text-gray-500">Generate unique codes for campaigns, influencers, or offline distribution. Max 5000 per batch.</p>
            <input className="input" placeholder="Campaign Name" value={bulkForm.campaign_name} onChange={(e) => setBulkForm({ ...bulkForm, campaign_name: e.target.value })} />
            <div className="grid grid-cols-3 gap-3">
              <input className="input" placeholder="Prefix e.g. SUMMER" value={bulkForm.prefix} onChange={(e) => setBulkForm({ ...bulkForm, prefix: e.target.value.toUpperCase() })} />
              <input className="input" placeholder="Count" value={bulkForm.count} onChange={(e) => setBulkForm({ ...bulkForm, count: e.target.value })} />
              <input className="input" placeholder="Random length" value={bulkForm.random_length} onChange={(e) => setBulkForm({ ...bulkForm, random_length: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <select className="input" value={bulkForm.discount_mode} onChange={(e) => setBulkForm({ ...bulkForm, discount_mode: e.target.value as BulkForm['discount_mode'] })}>
                <option value="PERCENT">Percent</option>
                <option value="AMOUNT">Flat Amount</option>
              </select>
              <input className="input" placeholder="Discount Value" value={bulkForm.discount_value} onChange={(e) => setBulkForm({ ...bulkForm, discount_value: e.target.value })} />
              <input className="input" placeholder="Min Order" value={bulkForm.min_order_value} onChange={(e) => setBulkForm({ ...bulkForm, min_order_value: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input className="input" type="datetime-local" value={bulkForm.start_at} onChange={(e) => setBulkForm({ ...bulkForm, start_at: e.target.value })} />
              <input className="input" type="datetime-local" value={bulkForm.end_at} onChange={(e) => setBulkForm({ ...bulkForm, end_at: e.target.value })} />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-600 mb-2">Applicable Platforms</div>
              <ChannelPicker value={bulkForm.applicable_channels} onChange={(next) => setBulkForm({ ...bulkForm, applicable_channels: next })} />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={bulkForm.first_order_only} onChange={(e) => setBulkForm({ ...bulkForm, first_order_only: e.target.checked })} /> First order only</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={bulkForm.is_public} onChange={(e) => setBulkForm({ ...bulkForm, is_public: e.target.checked })} /> Show in public coupon list</label>
            <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Generating...' : 'Generate Codes'}</button>
          </form>

          <div className="bg-white border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">Generated Codes</h2>
              {bulkResult.length > 0 ? (
                <button
                  className="btn btn-secondary text-xs flex items-center gap-1"
                  onClick={() => downloadCsv(`myfng-coupons-${Date.now()}.csv`, [['code'], ...bulkResult.map((c) => [c])])}
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              ) : null}
            </div>
            {bulkResult.length === 0 ? (
              <p className="text-sm text-gray-500">Generated codes will appear here.</p>
            ) : (
              <div className="max-h-[420px] overflow-y-auto text-sm font-mono space-y-1">
                {bulkResult.map((code) => (<div key={code}>{code}</div>))}
              </div>
            )}
            {options.batches?.length ? (
              <div className="mt-6 border-t pt-4">
                <h3 className="font-semibold mb-2">Recent Batches</h3>
                <div className="space-y-2 text-sm">
                  {options.batches.slice(0, 8).map((batch: any) => (
                    <div key={batch.id} className="flex justify-between gap-3">
                      <span>{batch.campaign_name}</span>
                      <span className="text-gray-500">{batch.code_count} codes · {batch.code_prefix}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === 'redemptions' ? (
        <div className="bg-white border rounded-xl overflow-x-auto">
          <div className="p-4 border-b flex justify-between items-center">
            <div>
              <h2 className="font-bold">Redemption History</h2>
              <p className="text-sm text-gray-500">{redemptionSummary?.count || 0} records · ₹{Number(redemptionSummary?.total_discount || 0).toLocaleString('en-IN')} total discount</p>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-left">Lead #</th>
                <th className="px-4 py-3 text-left">Channel</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Discount</th>
              </tr>
            </thead>
            <tbody>
              {redemptions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No redemption records found.
                  </td>
                </tr>
              ) : null}
              {redemptions.map((row) => {
                const customer = row.customer_display || {
                  name: row.service_lead?.customer_name || row.meta?.customer_name || null,
                  phone: row.service_lead?.customer_phone || row.meta?.customer_phone || null,
                  lead_number: row.service_lead?.lead_number || row.meta?.lead_number || null,
                  channel: row.meta?.channel || row.meta?.type || null,
                };
                return (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3">{new Date(row.created_at).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 font-semibold">{row.coupon?.code || '—'}</td>
                  <td className="px-4 py-3">{customer.name || '—'}</td>
                  <td className="px-4 py-3">{customer.phone || '—'}</td>
                  <td className="px-4 py-3">{customer.lead_number || '—'}</td>
                  <td className="px-4 py-3">{customer.channel || '—'}</td>
                  <td className="px-4 py-3">{row.applied_by_role}</td>
                  <td className="px-4 py-3">₹{Number(row.discount_amount_applied || 0).toLocaleString('en-IN')}</td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === 'assign' ? (
        <form className="bg-white border rounded-xl p-5 space-y-4 max-w-3xl" onSubmit={handleAssignCoupon}>
          <div>
            <h2 className="text-lg font-bold">Assign Personal Coupon</h2>
            <p className="text-sm text-gray-500 mt-1">
              Single number, bulk paste, file upload (CSV / TXT / XLS / XLSX), or live Google Sheet fetch.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { id: 'single' as const, label: 'Single Mobile' },
              { id: 'multiple' as const, label: 'Paste Numbers' },
              { id: 'file' as const, label: 'Upload File' },
              { id: 'google_sheet' as const, label: 'Google Sheet' },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${
                  assignMode === mode.id
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
                onClick={() => {
                  setAssignMode(mode.id);
                  setAssignResult(null);
                  setError(null);
                }}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-700">Supported import formats</p>
            <p>• Paste: one mobile per line, or comma / semicolon separated</p>
            <p>• File: .csv, .txt, .xls, .xlsx — column header <code className="bg-white px-1 rounded">mobile</code> / <code className="bg-white px-1 rounded">phone</code> auto-detected</p>
            <p>• Google Sheet: share as <strong>Anyone with the link → Viewer</strong>, paste sheet URL, click Fetch</p>
            <button type="button" className="text-brand-primary font-semibold mt-1" onClick={downloadAssignTemplate}>
              Download sample CSV template
            </button>
          </div>

          {assignMode === 'single' ? (
            <input
              className="input"
              placeholder="Customer mobile (10 digits)"
              value={assignForm.phone}
              onChange={(e) => setAssignForm({ ...assignForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
            />
          ) : null}

          {assignMode === 'multiple' ? (
            <div className="space-y-2">
              <textarea
                className="input min-h-[140px]"
                placeholder={'Enter mobile numbers — one per line, or comma / semicolon separated\n\nExample:\n9876543210\n9123456789,9988776655'}
                value={assignForm.phones_text}
                onChange={(e) => {
                  setAssignForm({ ...assignForm, phones_text: e.target.value });
                  setImportSource(null);
                }}
              />
              <p className="text-xs text-gray-500">
                {parsedBulkPhones.length} valid number{parsedBulkPhones.length === 1 ? '' : 's'} detected
                {parsedBulkPhones.length > 0 ? `: ${parsedBulkPhones.slice(0, 8).join(', ')}${parsedBulkPhones.length > 8 ? '…' : ''}` : ''}
              </p>
            </div>
          ) : null}

          {assignMode === 'file' ? (
            <div className="space-y-2">
              <input
                type="file"
                accept=".csv,.txt,.xls,.xlsx,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-100 file:font-semibold"
                onChange={(e) => handleImportFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-gray-500">
                Upload CSV, TXT, XLS, or XLSX. First sheet / first column with phone numbers is used.
              </p>
              {importLoading ? <p className="text-xs text-blue-600 font-medium">Reading file...</p> : null}
              {!importLoading && importSource && parsedBulkPhones.length > 0 ? (
                <p className="text-xs text-green-700 font-medium">
                  {importSource} loaded — {parsedBulkPhones.length} valid number{parsedBulkPhones.length === 1 ? '' : 's'} ready.
                </p>
              ) : null}
            </div>
          ) : null}

          {assignMode === 'google_sheet' ? (
            <div className="space-y-2">
              <input
                className="input"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={assignForm.google_sheet_url}
                onChange={(e) => setAssignForm({ ...assignForm, google_sheet_url: e.target.value })}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={importLoading || !assignForm.google_sheet_url.trim()}
                  onClick={handleFetchGoogleSheet}
                >
                  {importLoading ? 'Fetching...' : 'Fetch Numbers from Sheet'}
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Sheet must be shared publicly (Viewer). Use a column named <strong>mobile</strong> or <strong>phone</strong>, or put numbers in the first column.
              </p>
              {!importLoading && importSource === 'Google Sheet' && parsedBulkPhones.length > 0 ? (
                <p className="text-xs text-green-700 font-medium">
                  Google Sheet loaded — {parsedBulkPhones.length} valid number{parsedBulkPhones.length === 1 ? '' : 's'} ready.
                </p>
              ) : null}
              {parsedBulkPhones.length > 0 ? (
                <textarea
                  className="input min-h-[100px] text-xs"
                  readOnly
                  value={assignForm.phones_text}
                />
              ) : null}
            </div>
          ) : null}

          <select className="input" value={assignForm.coupon_id} onChange={(e) => setAssignForm({ ...assignForm, coupon_id: e.target.value })}>
            <option value="">Select coupon</option>
            {coupons.filter((c) => c.is_active).map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}{c.description ? ` · ${c.description}` : ''}
              </option>
            ))}
          </select>
          <input className="input" placeholder="Notes (optional)" value={assignForm.notes} onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })} />

          <button type="submit" className="btn btn-primary" disabled={submitting || importLoading || !canSubmitAssign}>
            {submitting
              ? 'Assigning...'
              : assignMode === 'single'
                ? 'Assign Coupon'
                : assignMode === 'google_sheet' && parsedBulkPhones.length === 0
                  ? 'Assign from Google Sheet'
                  : `Assign to ${parsedBulkPhones.length || '…'} Customer${parsedBulkPhones.length === 1 ? '' : 's'}`}
          </button>

          {assignResult ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 space-y-1">
              <p className="font-semibold">Assigned to {assignResult.assigned_count} customer(s).</p>
              {assignResult.not_found_phones.length > 0 ? (
                <p className="text-amber-800">
                  Not found ({assignResult.not_found_phones.length}): {assignResult.not_found_phones.join(', ')}
                </p>
              ) : null}
            </div>
          ) : null}
        </form>
      ) : null}

      {tab === 'audit' ? (
        <div className="bg-white border rounded-xl overflow-x-auto">
          <div className="p-4 border-b"><h2 className="font-bold">Admin Audit Trail</h2></div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">When</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Coupon / Batch</th>
                <th className="px-4 py-3 text-left">Details</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id} className="border-t">
                  <td className="px-4 py-3">{new Date(log.created_at).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 font-semibold">{log.action}</td>
                  <td className="px-4 py-3">{log.coupon_id || log.batch_id || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{JSON.stringify(log.details || {})}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center gap-2 mb-4">
              <Ticket className="w-5 h-5 text-brand-primary" />
              <h2 className="text-lg font-bold">{editingCoupon ? 'Edit Coupon' : 'Create Coupon'}</h2>
            </div>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="input" placeholder="Coupon Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
                <input className="input" placeholder="Campaign Name" value={form.campaign_name} onChange={(e) => setForm({ ...form, campaign_name: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select className="input" value={form.coupon_kind} onChange={(e) => setForm({ ...form, coupon_kind: e.target.value as CouponForm['coupon_kind'] })}>
                  <option value="TOTAL_DISCOUNT">Total Discount</option>
                  <option value="FREE_SERVICE">Free Service</option>
                </select>
                {form.coupon_kind === 'TOTAL_DISCOUNT' ? (
                  <select className="input" value={form.discount_mode} onChange={(e) => setForm({ ...form, discount_mode: e.target.value as CouponForm['discount_mode'] })}>
                    <option value="AMOUNT">Flat Amount (₹)</option>
                    <option value="PERCENT">Percent (%)</option>
                  </select>
                ) : (
                  <input className="input" placeholder="Free service label" value={form.target_custom_label} onChange={(e) => setForm({ ...form, target_custom_label: e.target.value })} />
                )}
              </div>
              {form.coupon_kind === 'TOTAL_DISCOUNT' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input className="input" placeholder="Discount Value" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} />
                  <input className="input" placeholder="Min Order Value" value={form.min_order_value} onChange={(e) => setForm({ ...form, min_order_value: e.target.value })} />
                  <input className="input" placeholder="Max Discount Cap (for %)" value={form.max_discount_amount} onChange={(e) => setForm({ ...form, max_discount_amount: e.target.value })} />
                </div>
              ) : null}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="input" type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} />
                <input className="input" type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="input" placeholder="Total Usage Limit" value={form.usage_limit_total} onChange={(e) => setForm({ ...form, usage_limit_total: e.target.value })} />
                <input className="input" placeholder="Per Customer Limit" value={form.usage_limit_per_customer} onChange={(e) => setForm({ ...form, usage_limit_per_customer: e.target.value })} />
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-2">Platforms (Website / App / Membership / Telecaller)</div>
                <ChannelPicker value={form.applicable_channels} onChange={(next) => setForm({ ...form, applicable_channels: next })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select multiple className="input min-h-[120px]" value={form.applicable_city_ids} onChange={(e) => setForm({ ...form, applicable_city_ids: Array.from(e.target.selectedOptions).map((o) => o.value) })}>
                  {options.cities?.map((city: any) => (<option key={city.id} value={city.id}>{city.name}</option>))}
                </select>
                <select multiple className="input min-h-[120px]" value={form.applicable_workshop_ids} onChange={(e) => setForm({ ...form, applicable_workshop_ids: Array.from(e.target.selectedOptions).map((o) => o.value) })}>
                  {options.workshops?.map((w: any) => (<option key={w.id} value={w.id}>{w.name}</option>))}
                </select>
                <select multiple className="input min-h-[120px]" value={form.applicable_service_type_ids} onChange={(e) => setForm({ ...form, applicable_service_type_ids: Array.from(e.target.selectedOptions).map((o) => o.value) })}>
                  {options.service_types?.map((s: any) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
              </div>
              <p className="text-xs text-gray-500">Leave city/workshop/service selections empty to allow all.</p>
              <textarea className="input" placeholder="Description shown to customers" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_public} onChange={(e) => setForm({ ...form, is_public: e.target.checked })} /> Show in public list</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.first_order_only} onChange={(e) => setForm({ ...form, first_order_only: e.target.checked })} /> First order only</label>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save Coupon'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
