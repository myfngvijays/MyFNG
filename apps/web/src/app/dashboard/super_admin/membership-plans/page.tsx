'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Edit, Trash2, X, Save, Crown, ChevronUp, ChevronDown } from 'lucide-react';
import MembershipIconField from '@/components/admin/MembershipIconField';
import MembershipPlacementFields from '@/components/admin/MembershipPlacementFields';
import MembershipValueCardPreview from '@/components/admin/MembershipValueCardPreview';
import {
  defaultPlacementsForType,
  normalizeMembershipType,
  parseAppPlacements,
  countEnabledPlacements,
  type AppPlacements,
  type MembershipType,
} from '@/lib/membership-placements';

type BenefitRow = {
  id: string;
  plan_id: string;
  benefit_code: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  icon_url?: string | null;
  icon_class?: string | null;
  value_label?: string | null;
  value_prefix?: string | null;
  display_order: number;
  active: boolean;
};

type PlanRow = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  price: number;
  original_price?: number | null;
  tagline?: string | null;
  badge?: string | null;
  period_label?: string | null;
  duration_days: number;
  display_order: number;
  footer_note?: string | null;
  total_benefits_value?: number | null;
  value_column_label?: string | null;
  total_benefits_label?: string | null;
  save_label?: string | null;
  price_hero_label?: string | null;
  price_hero_sub?: string | null;
  second_car_addon_price?: number | null;
  second_car_addon_title?: string | null;
  second_car_addon_description?: string | null;
  second_car_addon_icon?: string | null;
  second_car_addon_icon_class?: string | null;
  second_car_addon_icon_url?: string | null;
  active: boolean;
  membership_type?: MembershipType;
  app_visible?: boolean;
  app_placements?: AppPlacements;
  benefits?: BenefitRow[];
  legacy?: boolean;
  accent_color?: string | null;
  accent_text_color?: string | null;
};

const DEFAULT_SERVICE_ACCENT = '#023D95';
const DEFAULT_RSA_ACCENT = '#F97316';
const DEFAULT_ACCENT_TEXT = '#FFFFFF';

function defaultAccentForType(type: MembershipType | string) {
  return normalizeMembershipType(type) === 'RSA' ? DEFAULT_RSA_ACCENT : DEFAULT_SERVICE_ACCENT;
}

const EMPTY_FORM = {
  code: '',
  name: '',
  description: '',
  price: 699,
  original_price: 999,
  tagline: 'Your Car. Our Responsibility.',
  badge: 'MEMBERSHIP',
  period_label: '/ year',
  duration_days: 365,
  display_order: 0,
  footer_note:
    'Valid 12 months from activation · Linked to registered mobile number · Free pickup & drop included as standard',
  total_benefits_value: 6650,
  value_column_label: 'VALUE',
  total_benefits_label: 'Total Benefits Value',
  save_label: 'You Save',
  price_hero_label: 'YOU PAY ONLY',
  price_hero_sub: 'All benefits · One full year · One car',
  second_car_addon_price: 299,
  second_car_addon_title: '2nd Car Add-On',
  second_car_addon_description: 'Same benefits, same membership period as primary car',
  second_car_addon_icon: 'car-sport',
  second_car_addon_icon_class: '',
  second_car_addon_icon_url: '',
  active: true,
  membership_type: 'SERVICE' as MembershipType,
  app_visible: true,
  app_placements: defaultPlacementsForType('SERVICE'),
  accent_color: DEFAULT_SERVICE_ACCENT,
  accent_text_color: DEFAULT_ACCENT_TEXT,
};

const RSA_FORM_DEFAULTS = {
  tagline: 'Perfect for single-car owners',
  badge: 'RSA BASIC',
  period_label: '1 Year · 2 Services',
  duration_days: 365,
  footer_note: 'Valid 12 months · 2 RSA service calls included · Linked to registered mobile',
  total_benefits_value: 2500,
  price_hero_label: 'YOU PAY ONLY',
  price_hero_sub: '',
  second_car_addon_description: 'Same RSA benefits for your second car',
  accent_color: DEFAULT_RSA_ACCENT,
};

const EMPTY_BENEFIT = {
  title: '',
  description: '',
  icon: 'pricetag',
  icon_url: '',
  icon_class: '',
  value_label: '',
  value_prefix: '',
  display_order: 0,
  active: true,
};

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

export default function MembershipPlansPage() {
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [benefits, setBenefits] = useState<BenefitRow[]>([]);
  const [benefitDraft, setBenefitDraft] = useState({ ...EMPTY_BENEFIT });
  const [editingBenefitId, setEditingBenefitId] = useState<string | null>(null);
  const [uploadingIcon, setUploadingIcon] = useState(false);

  const appRows = useMemo(
    () => rows.filter((r) => !r.legacy && !['BRONZE', 'SILVER', 'GOLD'].includes(String(r.code || '').toUpperCase())),
    [rows],
  );
  const legacyRows = useMemo(
    () => rows.filter((r) => r.legacy || ['BRONZE', 'SILVER', 'GOLD'].includes(String(r.code || '').toUpperCase())),
    [rows],
  );
  const serviceRows = useMemo(
    () => appRows.filter((r) => normalizeMembershipType(r.membership_type) === 'SERVICE'),
    [appRows],
  );
  const rsaRows = useMemo(
    () => appRows.filter((r) => normalizeMembershipType(r.membership_type) === 'RSA'),
    [appRows],
  );

  function formatApiError(json: any, fallback: string) {
    return [json?.details, json?.hint, json?.error].filter(Boolean).join('\n') || fallback;
  }

  async function fetchRows() {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/super_admin/membership-plans');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = [json?.details, json?.hint, json?.error].filter(Boolean).join(' — ') || 'Failed to load';
        throw new Error(msg);
      }
      setRows(json.data || []);
    } catch (e: any) {
      setFetchError(e?.message || 'Failed to load membership plans');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchRows(); }, []);

  useEffect(() => {
    const id = 'flaticon-uicons-admin';
    if (typeof document === 'undefined' || document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://cdn-uicons.flaticon.com/uicons-regular-rounded/css/uicons-regular-rounded.css';
    document.head.appendChild(link);
  }, []);

  const computedSave = useMemo(
    () => Math.max(0, Number(form.total_benefits_value || 0) - Number(form.price || 0)),
    [form.total_benefits_value, form.price],
  );

  const isRsaForm = normalizeMembershipType(form.membership_type) === 'RSA';

  function openAdd(type: MembershipType = 'SERVICE') {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      ...(type === 'RSA'
        ? {
            ...RSA_FORM_DEFAULTS,
            price: 999,
            original_price: 1299,
          }
        : {
            accent_color: DEFAULT_SERVICE_ACCENT,
          }),
      membership_type: type,
      app_placements: defaultPlacementsForType(type),
      display_order: rows.length + 1,
    });
    setBenefits([]);
    setBenefitDraft({ ...EMPTY_BENEFIT });
    setEditingBenefitId(null);
    setModalOpen(true);
  }

  function openEdit(r: PlanRow) {
    setEditing(r);
    setForm({
      code: r.code,
      name: r.name,
      description: r.description || '',
      price: Number(r.price || 0),
      original_price: r.original_price != null ? Number(r.original_price) : 999,
      tagline: r.tagline || '',
      badge: r.badge || 'MEMBERSHIP',
      period_label: r.period_label || '/ Year',
      duration_days: r.duration_days || 365,
      display_order: r.display_order || 0,
      footer_note: r.footer_note || '',
      total_benefits_value: Number(r.total_benefits_value ?? 6650),
      value_column_label: r.value_column_label || 'VALUE',
      total_benefits_label: r.total_benefits_label || 'Total Benefits Value',
      save_label: r.save_label || 'You Save',
      price_hero_label: r.price_hero_label || 'YOU PAY ONLY',
      price_hero_sub:
        normalizeMembershipType(r.membership_type) === 'RSA'
          ? r.price_hero_sub || ''
          : r.price_hero_sub || 'All benefits · One full year · One car',
      second_car_addon_price: Number(r.second_car_addon_price || 299),
      second_car_addon_title: r.second_car_addon_title || '2nd Car Add-On',
      second_car_addon_description: r.second_car_addon_description || '',
      second_car_addon_icon: r.second_car_addon_icon || 'car-sport',
      second_car_addon_icon_class: r.second_car_addon_icon_class || '',
      second_car_addon_icon_url: r.second_car_addon_icon_url || '',
      active: r.active,
      membership_type: normalizeMembershipType(r.membership_type),
      app_visible: r.app_visible !== false,
      app_placements: parseAppPlacements(r.app_placements, normalizeMembershipType(r.membership_type)),
      accent_color: r.accent_color || defaultAccentForType(r.membership_type),
      accent_text_color: r.accent_text_color || DEFAULT_ACCENT_TEXT,
    });
    setBenefits(r.benefits || []);
    setBenefitDraft({ ...EMPTY_BENEFIT, display_order: (r.benefits?.length || 0) + 1 });
    setEditingBenefitId(null);
    setModalOpen(true);
  }

  async function savePlan(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editing ? `/api/super_admin/membership-plans/${editing.id}` : '/api/super_admin/membership-plans';
      const payload = {
        ...form,
        ...(isRsaForm ? { price_hero_sub: '' } : {}),
      };
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiError(json, 'Save failed'));
      if (!editing && json.data) {
        const created = { ...json.data, benefits: [] } as PlanRow;
        setEditing(created);
        setBenefits([]);
        setBenefitDraft({ ...EMPTY_BENEFIT, display_order: 1 });
        setForm({
          code: created.code,
          name: created.name,
          description: created.description || '',
          price: Number(created.price || 0),
          original_price: created.original_price != null ? Number(created.original_price) : 999,
          tagline: created.tagline || '',
          badge: created.badge || 'MEMBERSHIP',
          period_label: created.period_label || '/ Year',
          duration_days: created.duration_days || 365,
          display_order: created.display_order || 0,
          footer_note: created.footer_note || '',
          total_benefits_value: Number(created.total_benefits_value ?? 6650),
          value_column_label: created.value_column_label || 'VALUE',
          total_benefits_label: created.total_benefits_label || 'Total Benefits Value',
          save_label: created.save_label || 'You Save',
          price_hero_label: created.price_hero_label || 'YOU PAY ONLY',
          price_hero_sub:
            normalizeMembershipType(created.membership_type) === 'RSA'
              ? created.price_hero_sub || ''
              : created.price_hero_sub || 'All benefits · One full year · One car',
          second_car_addon_price: Number(created.second_car_addon_price || 299),
          second_car_addon_title: created.second_car_addon_title || '2nd Car Add-On',
          second_car_addon_description: created.second_car_addon_description || '',
          second_car_addon_icon: created.second_car_addon_icon || 'car-sport',
          second_car_addon_icon_class: created.second_car_addon_icon_class || '',
          second_car_addon_icon_url: created.second_car_addon_icon_url || '',
          active: created.active,
          membership_type: normalizeMembershipType(created.membership_type),
          app_visible: created.app_visible !== false,
          app_placements: parseAppPlacements(created.app_placements, normalizeMembershipType(created.membership_type)),
          accent_color: created.accent_color || defaultAccentForType(created.membership_type),
          accent_text_color: created.accent_text_color || DEFAULT_ACCENT_TEXT,
        });
      } else {
        setModalOpen(false);
      }
      await fetchRows();
    } catch (err: any) {
      alert(err?.message || 'Could not save plan');
    } finally {
      setSaving(false);
    }
  }

  async function deletePlan(id: string) {
    if (!confirm('Delete this membership plan and all its benefits?')) return;
    const res = await fetch(`/api/super_admin/membership-plans/${id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(formatApiError(json, 'Delete failed'));
      return;
    }
    await fetchRows();
  }

  async function uploadBenefitIcon(file: File) {
    setUploadingIcon(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/super_admin/membership-plans/upload-benefit-icon', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Upload failed');
      setBenefitDraft((d) => ({ ...d, icon_url: json.icon_url }));
    } catch (err: any) {
      alert(err?.message || 'Icon upload failed');
    } finally {
      setUploadingIcon(false);
    }
  }

  async function saveBenefit() {
    if (!editing?.id) {
      alert('Save the plan first, then add benefits.');
      return;
    }
    if (!benefitDraft.title.trim()) {
      alert('Benefit title is required');
      return;
    }
    const url = editingBenefitId
      ? `/api/super_admin/membership-benefits/${editingBenefitId}`
      : '/api/super_admin/membership-benefits';
    const res = await fetch(url, {
      method: editingBenefitId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...benefitDraft, plan_id: editing.id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(formatApiError(json, 'Could not save benefit'));
      return;
    }
    setBenefitDraft({ ...EMPTY_BENEFIT, display_order: benefits.length + 1 });
    setEditingBenefitId(null);
    await fetchRows();
    const updated = rows.find((r) => r.id === editing.id);
    if (updated) openEdit({ ...updated, benefits: [...(updated.benefits || []), json.data].filter(Boolean) });
    else await fetchRows();
    const fresh = await fetch('/api/super_admin/membership-plans').then((r) => r.json());
    const plan = (fresh.data || []).find((p: PlanRow) => p.id === editing.id);
    if (plan) {
      setBenefits(plan.benefits || []);
      setEditing(plan);
    }
  }

  async function deleteBenefit(id: string) {
    if (!confirm('Delete this benefit?')) return;
    const res = await fetch(`/api/super_admin/membership-benefits/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('Delete failed');
      return;
    }
    setBenefits((prev) => prev.filter((b) => b.id !== id));
    await fetchRows();
  }

  async function moveBenefit(idx: number, dir: -1 | 1) {
    const next = [...benefits].sort((a, b) => a.display_order - b.display_order);
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    const a = next[idx];
    const b = next[j];
    await Promise.all([
      fetch(`/api/super_admin/membership-benefits/${a.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_order: b.display_order }),
      }),
      fetch(`/api/super_admin/membership-benefits/${b.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_order: a.display_order }),
      }),
    ]);
    await fetchRows();
    if (editing) {
      const fresh = await fetch('/api/super_admin/membership-plans').then((r) => r.json());
      const plan = (fresh.data || []).find((p: PlanRow) => p.id === editing.id);
      if (plan) setBenefits(plan.benefits || []);
    }
  }

  const sortedBenefits = useMemo(
    () => [...benefits].sort((a, b) => a.display_order - b.display_order),
    [benefits],
  );

  function renderPlanCard(r: PlanRow, legacy = false) {
    const isRsa = normalizeMembershipType(r.membership_type) === 'RSA';
    const accent = r.accent_color || defaultAccentForType(r.membership_type);
    return (
      <div key={r.id} className={`rounded-2xl border bg-white shadow-sm overflow-hidden flex flex-col ${legacy ? 'border-gray-100 opacity-90' : 'border-gray-200'}`}>
        <div className="p-4 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-lg font-bold text-gray-900">{r.name}</div>
              <div className="text-xs text-gray-500 font-mono mt-0.5">{r.code}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              {legacy ? (
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-500">LEGACY</span>
              ) : (
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${normalizeMembershipType(r.membership_type) === 'RSA' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                  {normalizeMembershipType(r.membership_type) === 'RSA' ? 'RSA' : 'SERVICE'}
                </span>
              )}
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${r.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {r.active ? 'ACTIVE' : 'INACTIVE'}
              </span>
              {!legacy ? (
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${r.app_visible !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                  {r.app_visible !== false ? 'IN APP' : 'HIDDEN IN APP'}
                </span>
              ) : null}
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2 flex-wrap">
            {r.original_price ? <span className="text-sm text-gray-400 line-through">{inr(Number(r.original_price))}</span> : null}
            <span className="text-xl font-extrabold" style={{ color: accent }}>
              {inr(Number(r.price))}
            </span>
            <span className="text-xs text-gray-500">
              {isRsa ? String(r.period_label || '').replace(/^\s*\/?\s*/, '') : r.period_label || '/ Year'}
            </span>
            {r.accent_color ? (
              <span
                className="inline-block h-3 w-3 rounded-full border border-gray-200"
                style={{ backgroundColor: accent }}
                title={`Accent ${accent}`}
              />
            ) : null}
          </div>
          {r.tagline ? <p className="text-xs italic text-blue-600 mt-2">{r.tagline}</p> : null}
          <p className="text-xs text-gray-500 mt-2">
            {r.benefits?.length || 0} benefits · value {inr(Number(r.total_benefits_value || 0))} · pay {inr(Number(r.price))}
            {!legacy ? ` · 2nd car +${inr(Number(r.second_car_addon_price || 0))}` : ' · not shown in app'}
            {!legacy ? ` · ${countEnabledPlacements(parseAppPlacements(r.app_placements, normalizeMembershipType(r.membership_type)))} value slots` : ''}
          </p>
        </div>
        <div className="border-t border-gray-100 p-3 flex gap-2">
          <button onClick={() => openEdit(r)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-blue-50 text-blue-700 py-2 text-sm font-semibold hover:bg-blue-100">
            <Edit className="h-4 w-4" /> Edit
          </button>
          <button onClick={() => deletePlan(r.id)} className="inline-flex items-center justify-center rounded-lg bg-red-50 text-red-600 px-3 hover:bg-red-100">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-500" /> Membership Plans
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage <strong>Service</strong> (MyFNG Prime) and <strong>RSA</strong> memberships separately. Control screen placement and hide/show in Android &amp; iOS apps.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => openAdd('SERVICE')}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-white font-semibold shadow hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> Add Service Plan
          </button>
          <button
            onClick={() => openAdd('RSA')}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-white font-semibold shadow hover:bg-red-700"
          >
            <Plus className="h-4 w-4" /> Add RSA Plan
          </button>
        </div>
      </div>

      {fetchError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 mb-4">
          <strong>Could not load plans.</strong> {fetchError}
        </div>
      ) : null}

      {!loading && !fetchError && appRows.some((r) => !(r.benefits?.length)) ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 mb-4">
          <strong>Benefits or value fields missing?</strong> Run{' '}
          <code className="text-xs bg-amber-100 px-1 rounded">database/149_membership_admin.sql</code> then{' '}
          <code className="text-xs bg-amber-100 px-1 rounded">database/152_membership_value_card_cms.sql</code> and{' '}
          <code className="text-xs bg-amber-100 px-1 rounded">database/153_membership_app_placements.sql</code> in Supabase.
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">Loading…</div>
      ) : rows.length === 0 && !fetchError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>No plans in database.</strong> Add a plan here, or run{' '}
          <code className="text-xs bg-amber-100 px-1 rounded">database/149_membership_admin.sql</code> in Supabase to unlock tagline, benefits &amp; 2nd-car CMS fields for existing plans.
        </div>
      ) : (
        <div className="space-y-8">
          <div>
            <h2 className="text-sm font-bold text-gray-700 mb-1">Service memberships (MyFNG Prime)</h2>
            <p className="text-xs text-gray-500 mb-3">Shown on Home, Services, Search &amp; Settings — placement per plan.</p>
            {serviceRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                No service plans yet. Click <strong>Add Service Plan</strong>.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {serviceRows.map((r) => renderPlanCard(r))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-sm font-bold text-gray-700 mb-1">RSA memberships</h2>
            <p className="text-xs text-gray-500 mb-3">Roadside Assistance screen slots — before pricing, reviews, FAQs, etc.</p>
            {rsaRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-red-100 bg-red-50/40 px-4 py-6 text-sm text-gray-600">
                No RSA plans yet. Click <strong>Add RSA Plan</strong>.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {rsaRows.map((r) => renderPlanCard(r))}
              </div>
            )}
          </div>

          {legacyRows.length > 0 ? (
            <div>
              <h2 className="text-sm font-bold text-gray-500 mb-1">Legacy plans (database only — hidden from app)</h2>
              <p className="text-xs text-gray-400 mb-3">Bronze / Silver / Gold are old tiers. Deactivate or delete only if no customers are subscribed.</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {legacyRows.map((r) => renderPlanCard(r, true))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-6xl rounded-2xl bg-white shadow-2xl my-4">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-lg font-bold">{editing ? 'Edit Membership Plan' : 'New Membership Plan'}</h2>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-2 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x divide-gray-200">
              <form onSubmit={savePlan} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-600">Membership Type</label>
                    <select
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      value={form.membership_type}
                      onChange={(e) => {
                        const membership_type = normalizeMembershipType(e.target.value);
                        const switchingToRsa = membership_type === 'RSA';
                        setForm({
                          ...form,
                          membership_type,
                          app_placements: defaultPlacementsForType(membership_type),
                          ...(switchingToRsa
                            ? {
                                ...RSA_FORM_DEFAULTS,
                                price_hero_sub: '',
                                period_label: form.period_label?.replace(/^\s*\/?\s*/, '') || RSA_FORM_DEFAULTS.period_label,
                              }
                            : {
                                price_hero_sub: form.price_hero_sub || 'All benefits · One full year · One car',
                                period_label: form.period_label?.startsWith('/') ? form.period_label : `/ ${form.period_label || 'year'}`,
                                accent_color: form.accent_color || DEFAULT_SERVICE_ACCENT,
                              }),
                        });
                      }}
                    >
                      <option value="SERVICE">Service (MyFNG Prime)</option>
                      <option value="RSA">RSA (Roadside Assistance)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600">Display Order</label>
                    <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-600">Plan Code</label>
                    <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="PRIME" required />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm font-semibold pb-2">
                      <input type="checkbox" checked={form.app_visible} onChange={(e) => setForm({ ...form, app_visible: e.target.checked })} />
                      Show in app (Android &amp; iOS)
                    </label>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600">Membership Name</label>
                  <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="MyFNG Prime" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-600">Original Price (₹) — strikethrough</label>
                    <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.original_price} onChange={(e) => setForm({ ...form, original_price: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600">Sale Price (₹)</label>
                    <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} required />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600">Tagline (header subtitle)</label>
                  <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm italic" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} placeholder="Your Car. Our Responsibility." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-600">Duration (days)</label>
                    <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600">
                      {isRsaForm ? 'Period · Services Label' : 'Period Label'}
                    </label>
                    <input
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      value={form.period_label}
                      onChange={(e) => setForm({ ...form, period_label: e.target.value })}
                      placeholder={isRsaForm ? '15 Years · 30 Services' : '/ year'}
                    />
                    {isRsaForm ? (
                      <p className="mt-1 text-[11px] text-gray-500">
                        Shown below price in the app (e.g. <strong>15 Years · 30 Services</strong>). No leading slash.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-3">
                  <div className="text-xs font-bold text-indigo-900 uppercase tracking-wide">Card Colors</div>
                  <div>
                    <label className="text-xs font-bold text-gray-600">Accent Color (header, price box &amp; CTA)</label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="color"
                        className="h-10 w-14 rounded-lg border cursor-pointer"
                        value={form.accent_color || defaultAccentForType(form.membership_type)}
                        onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                      />
                      <input
                        className="flex-1 rounded-lg border px-3 py-2 text-sm font-mono"
                        value={form.accent_color}
                        onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                        placeholder={defaultAccentForType(form.membership_type)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600">Text on Accent (header, price, buttons)</label>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <input
                        type="color"
                        className="h-10 w-14 rounded-lg border cursor-pointer"
                        value={form.accent_text_color || DEFAULT_ACCENT_TEXT}
                        onChange={(e) => setForm({ ...form, accent_text_color: e.target.value })}
                      />
                      <input
                        className="flex-1 min-w-[120px] rounded-lg border px-3 py-2 text-sm font-mono"
                        value={form.accent_text_color}
                        onChange={(e) => setForm({ ...form, accent_text_color: e.target.value })}
                        placeholder={DEFAULT_ACCENT_TEXT}
                      />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, accent_text_color: '#FFFFFF' })}
                        className="rounded-lg border bg-white px-3 py-2 text-xs font-bold text-gray-800 hover:bg-gray-50"
                      >
                        White
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, accent_text_color: '#111827' })}
                        className="rounded-lg border bg-gray-900 px-3 py-2 text-xs font-bold text-white hover:bg-gray-800"
                      >
                        Dark
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500">
                      Light accent background? Use <strong>Dark</strong> text. Dark accent? Use <strong>White</strong>.
                    </p>
                  </div>
                  <div
                    className="rounded-xl px-4 py-3 text-center"
                    style={{
                      backgroundColor: form.accent_color || defaultAccentForType(form.membership_type),
                      color: form.accent_text_color || DEFAULT_ACCENT_TEXT,
                    }}
                  >
                    <div className="text-[10px] font-bold tracking-wider opacity-90">YOU PAY ONLY</div>
                    <div className="text-2xl font-extrabold mt-1">₹999</div>
                    <div className="text-xs font-semibold mt-1 opacity-90">Preview text on accent</div>
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 space-y-3">
                  <div className="text-xs font-bold text-emerald-900 uppercase tracking-wide">Value Card — Pricing Band</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-600">Total Benefits Value (₹)</label>
                      <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.total_benefits_value} onChange={(e) => setForm({ ...form, total_benefits_value: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600">You Save (auto)</label>
                      <input readOnly className="mt-1 w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm font-bold text-emerald-700" value={inr(computedSave)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-600">Value Column Label</label>
                      <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.value_column_label} onChange={(e) => setForm({ ...form, value_column_label: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600">Total Benefits Label</label>
                      <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.total_benefits_label} onChange={(e) => setForm({ ...form, total_benefits_label: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-600">Save Label</label>
                      <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.save_label} onChange={(e) => setForm({ ...form, save_label: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600">Price Hero Label</label>
                      <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.price_hero_label} onChange={(e) => setForm({ ...form, price_hero_label: e.target.value })} />
                    </div>
                  </div>
                  {isRsaForm ? (
                    <p className="text-[11px] text-violet-800 bg-violet-50 rounded-lg px-3 py-2 border border-violet-100">
                      RSA app layout: <strong>{form.price_hero_label || 'YOU PAY ONLY'}</strong> → price →{' '}
                      <strong>{form.period_label?.replace(/^\s*\/?\s*/, '') || '15 Years · 30 Services'}</strong>.
                      The extra subtext line is not shown in the app for RSA plans.
                    </p>
                  ) : (
                    <div>
                      <label className="text-xs font-bold text-gray-600">Price Hero Subtext</label>
                      <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.price_hero_sub} onChange={(e) => setForm({ ...form, price_hero_sub: e.target.value })} />
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-600">Footer Note</label>
                  <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.footer_note} onChange={(e) => setForm({ ...form, footer_note: e.target.value })} />
                </div>

                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 space-y-3">
                  <div className="text-xs font-bold text-blue-800 uppercase tracking-wide">2nd Car Add-On</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-600">Add-On Price (₹)</label>
                      <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.second_car_addon_price} onChange={(e) => setForm({ ...form, second_car_addon_price: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600">Add-On Title</label>
                      <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.second_car_addon_title} onChange={(e) => setForm({ ...form, second_car_addon_title: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600">Add-On Description</label>
                    <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.second_car_addon_description} onChange={(e) => setForm({ ...form, second_car_addon_description: e.target.value })} />
                  </div>
                  <MembershipIconField
                    value={{
                      icon: form.second_car_addon_icon || '',
                      icon_url: form.second_car_addon_icon_url || '',
                      icon_class: form.second_car_addon_icon_class || '',
                    }}
                    onChange={(patch) =>
                      setForm({
                        ...form,
                        second_car_addon_icon: patch.icon ?? form.second_car_addon_icon,
                        second_car_addon_icon_url: patch.icon_url ?? form.second_car_addon_icon_url,
                        second_car_addon_icon_class: patch.icon_class ?? form.second_car_addon_icon_class,
                      })
                    }
                    ioniconsPlaceholder="car-sport"
                    flaticonPlaceholder="fi fi-rr-cars"
                  />
                </div>

                <MembershipPlacementFields
                  membershipType={form.membership_type}
                  placements={form.app_placements}
                  onChange={(app_placements) => setForm({ ...form, app_placements })}
                />

                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                  Active (backend — purchases &amp; existing members stay valid)
                </label>

                <button type="submit" disabled={saving} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-white font-bold hover:bg-blue-700 disabled:opacity-60">
                  <Save className="h-4 w-4" /> {saving ? 'Saving…' : editing ? 'Update Plan' : 'Create Plan'}
                </button>

                {editing ? (
                  <div className="pt-4 border-t space-y-3">
                    <div className="text-sm font-bold text-gray-900">Benefits of {form.name}</div>
                    {sortedBenefits.map((b, idx) => (
                      <div key={b.id} className="rounded-lg border p-3 flex gap-2 items-start">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E6F0FB] overflow-hidden">
                          {b.icon_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={b.icon_url} alt="" className="h-5 w-5 object-contain" />
                          ) : b.icon_class ? (
                            <i className={b.icon_class} style={{ fontSize: 16, color: '#023D95' }} />
                          ) : (
                            <span className="text-[10px] font-bold text-[#023D95]">{b.icon?.slice(0, 2)}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm">{b.title}</div>
                          <div className="text-xs text-gray-500 truncate">{b.description}</div>
                          {b.value_label ? (
                            <div className="text-[10px] font-bold text-emerald-700 mt-0.5">
                              {b.value_prefix ? `${b.value_prefix} ` : ''}{b.value_label}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-col gap-1">
                          <button type="button" onClick={() => moveBenefit(idx, -1)} className="p-1 rounded hover:bg-gray-100"><ChevronUp className="h-4 w-4" /></button>
                          <button type="button" onClick={() => moveBenefit(idx, 1)} className="p-1 rounded hover:bg-gray-100"><ChevronDown className="h-4 w-4" /></button>
                        </div>
                        <button type="button" onClick={() => { setEditingBenefitId(b.id); setBenefitDraft({ title: b.title, description: b.description || '', icon: b.icon || '', icon_url: b.icon_url || '', icon_class: b.icon_class || '', value_label: b.value_label || '', value_prefix: b.value_prefix || '', display_order: b.display_order, active: b.active }); }} className="text-blue-600 text-xs font-bold">Edit</button>
                        <button type="button" onClick={() => deleteBenefit(b.id)} className="text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}

                    <div className="rounded-xl border border-dashed border-gray-300 p-3 space-y-2 bg-gray-50">
                      <div className="text-xs font-bold text-gray-600">{editingBenefitId ? 'Edit Benefit' : 'Add Benefit'}</div>
                      <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Benefit title" value={benefitDraft.title} onChange={(e) => setBenefitDraft({ ...benefitDraft, title: e.target.value })} />
                      <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Sub text / description" value={benefitDraft.description} onChange={(e) => setBenefitDraft({ ...benefitDraft, description: e.target.value })} />
                      <div className="grid grid-cols-2 gap-2">
                        <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Value prefix e.g. Up to" value={benefitDraft.value_prefix} onChange={(e) => setBenefitDraft({ ...benefitDraft, value_prefix: e.target.value })} />
                        <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Value e.g. ₹1,000" value={benefitDraft.value_label} onChange={(e) => setBenefitDraft({ ...benefitDraft, value_label: e.target.value })} />
                      </div>
                      <MembershipIconField
                        value={{
                          icon: benefitDraft.icon,
                          icon_url: benefitDraft.icon_url,
                          icon_class: benefitDraft.icon_class,
                        }}
                        onChange={(patch) =>
                          setBenefitDraft({
                            ...benefitDraft,
                            icon: patch.icon ?? benefitDraft.icon,
                            icon_url: patch.icon_url ?? benefitDraft.icon_url,
                            icon_class: patch.icon_class ?? benefitDraft.icon_class,
                          })
                        }
                        uploading={uploadingIcon}
                        onUpload={uploadBenefitIcon}
                      />
                      <button type="button" onClick={saveBenefit} className="w-full rounded-lg bg-gray-900 text-white py-2 text-sm font-bold">
                        {editingBenefitId ? 'Update Benefit' : 'Add Benefit'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2">Save the plan first, then you can add benefits.</p>
                )}
              </form>

              <div className="p-5 bg-gray-50 max-h-[80vh] overflow-y-auto sticky top-0">
                <MembershipValueCardPreview plan={form} benefits={sortedBenefits} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
