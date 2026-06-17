'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Edit, Trash2, X, Save, Upload, Crown, ChevronUp, ChevronDown } from 'lucide-react';

type BenefitRow = {
  id: string;
  plan_id: string;
  benefit_code: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  icon_url?: string | null;
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
  second_car_addon_price?: number | null;
  second_car_addon_title?: string | null;
  second_car_addon_description?: string | null;
  second_car_addon_icon?: string | null;
  active: boolean;
  benefits?: BenefitRow[];
};

const EMPTY_FORM = {
  code: '',
  name: '',
  description: '',
  price: 699,
  original_price: 999,
  tagline: 'Your Car. Our Responsibility.',
  badge: 'MEMBERSHIP',
  period_label: '/ Year',
  duration_days: 365,
  display_order: 0,
  footer_note: 'Valid 12 months from activation · Linked to registered mobile number',
  second_car_addon_price: 299,
  second_car_addon_title: '2nd Car Add-On',
  second_car_addon_description: "Cover your family's second car — same benefits",
  second_car_addon_icon: 'car-sport',
  active: true,
};

const EMPTY_BENEFIT = {
  title: '',
  description: '',
  icon: 'pricetag',
  icon_url: '',
  display_order: 0,
  active: true,
};

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function PreviewCard({ plan, benefits }: { plan: typeof EMPTY_FORM; benefits: BenefitRow[] }) {
  const activeBenefits = benefits.filter((b) => b.active);
  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden">
      <div className="bg-[#F8FAFC] px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-500">App Preview</div>
      <div className="p-4 space-y-3">
        <div className="rounded-2xl border-2 border-[#004AAD] bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xl font-extrabold text-[#004AAD]">{plan.name || 'MyFNG Prime'}</div>
              <span className="mt-1 inline-block rounded-full bg-[#004AAD] px-2 py-0.5 text-[10px] font-bold text-white">
                {plan.badge || 'MEMBERSHIP'}
              </span>
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            {plan.original_price ? (
              <span className="text-sm text-gray-400 line-through">{inr(Number(plan.original_price))}</span>
            ) : null}
            <span className="text-3xl font-extrabold text-[#004AAD]">{inr(Number(plan.price || 0))}</span>
            <span className="text-sm text-gray-500">{plan.period_label || '/ Year'}</span>
          </div>
          {plan.tagline ? <p className="mt-2 text-sm italic text-[#0088E8]">{plan.tagline}</p> : null}
        </div>

        <div className="rounded-2xl bg-white p-4 border border-gray-100">
          <div className="text-[11px] font-bold tracking-widest text-[#004AAD] mb-3">
            BENEFITS FOR {(plan.name || 'MEMBERSHIP').toUpperCase()}
          </div>
          <div className="space-y-3">
            {activeBenefits.length === 0 ? (
              <p className="text-sm text-gray-400">No benefits added yet</p>
            ) : (
              activeBenefits.map((b) => (
                <div key={b.id || b.title} className="flex gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E6F0FB] overflow-hidden">
                    {b.icon_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.icon_url} alt="" className="h-6 w-6 object-contain" />
                    ) : (
                      <span className="text-xs font-bold text-[#004AAD]">{b.icon?.slice(0, 2) || '★'}</span>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">{b.title}</div>
                    {b.description ? <div className="text-xs text-gray-500 mt-0.5">{b.description}</div> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-[#0088E8] bg-[#F2F6FC] p-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[#E6F0FB] flex items-center justify-center text-[#004AAD] text-xs font-bold">🚗</div>
          <div className="flex-1">
            <div className="text-sm font-bold text-[#004AAD]">{plan.second_car_addon_title || '2nd Car Add-On'}</div>
            <div className="text-xs text-gray-500">{plan.second_car_addon_description || ''}</div>
          </div>
          <div className="text-sm font-extrabold text-[#004AAD]">+{inr(Number(plan.second_car_addon_price || 0))}</div>
        </div>

        {plan.footer_note ? <p className="text-center text-[10px] text-gray-400">{plan.footer_note}</p> : null}
      </div>
    </div>
  );
}

export default function MembershipPlansPage() {
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [benefits, setBenefits] = useState<BenefitRow[]>([]);
  const [benefitDraft, setBenefitDraft] = useState({ ...EMPTY_BENEFIT });
  const [editingBenefitId, setEditingBenefitId] = useState<string | null>(null);
  const [uploadingIcon, setUploadingIcon] = useState(false);

  async function fetchRows() {
    setLoading(true);
    try {
      const res = await fetch('/api/super_admin/membership-plans');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.details || 'Failed to load');
      setRows(json.data || []);
    } catch (e: any) {
      alert(e?.message || 'Failed to load membership plans');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchRows(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, display_order: rows.length + 1 });
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
      second_car_addon_price: Number(r.second_car_addon_price || 299),
      second_car_addon_title: r.second_car_addon_title || '2nd Car Add-On',
      second_car_addon_description: r.second_car_addon_description || '',
      second_car_addon_icon: r.second_car_addon_icon || 'car-sport',
      active: r.active,
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
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.details || 'Save failed');
      setModalOpen(false);
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
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json?.error || 'Delete failed');
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
      alert(json?.error || 'Could not save benefit');
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

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-500" /> Membership Plans
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Create & manage Prime, Prime Plus and future tiers — pricing, tagline, benefits & 2nd car add-on shown in the mobile app.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-white font-semibold shadow hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Add Plan
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>No plans yet.</strong> App uses hardcoded defaults until you add plans here. Run <code className="text-xs bg-amber-100 px-1 rounded">database/149_membership_admin.sql</code> in Supabase first.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((r) => (
            <div key={r.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-lg font-bold text-gray-900">{r.name}</div>
                    <div className="text-xs text-gray-500 font-mono mt-0.5">{r.code}</div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${r.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {r.active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  {r.original_price ? <span className="text-sm text-gray-400 line-through">{inr(Number(r.original_price))}</span> : null}
                  <span className="text-xl font-extrabold text-blue-700">{inr(Number(r.price))}</span>
                  <span className="text-xs text-gray-500">{r.period_label}</span>
                </div>
                {r.tagline ? <p className="text-xs italic text-blue-600 mt-2">{r.tagline}</p> : null}
                <p className="text-xs text-gray-500 mt-2">{r.benefits?.length || 0} benefits · 2nd car +{inr(Number(r.second_car_addon_price || 0))}</p>
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
          ))}
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
                    <label className="text-xs font-bold text-gray-600">Plan Code</label>
                    <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="PRIME" required />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600">Display Order</label>
                    <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })} />
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
                  <label className="text-xs font-bold text-gray-600">Tagline</label>
                  <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm italic" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} placeholder="Your Car. Our Responsibility." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-600">Badge Text</label>
                    <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600">Period Label</label>
                    <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.period_label} onChange={(e) => setForm({ ...form, period_label: e.target.value })} />
                  </div>
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
                      <label className="text-xs font-bold text-gray-600">Icon Name (Ionicons)</label>
                      <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.second_car_addon_icon} onChange={(e) => setForm({ ...form, second_car_addon_icon: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600">Add-On Title</label>
                    <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.second_car_addon_title} onChange={(e) => setForm({ ...form, second_car_addon_title: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600">Add-On Description</label>
                    <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.second_car_addon_description} onChange={(e) => setForm({ ...form, second_car_addon_description: e.target.value })} />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                  Active (visible in app)
                </label>

                <button type="submit" disabled={saving} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-white font-bold hover:bg-blue-700 disabled:opacity-60">
                  <Save className="h-4 w-4" /> {saving ? 'Saving…' : editing ? 'Update Plan' : 'Create Plan'}
                </button>

                {editing ? (
                  <div className="pt-4 border-t space-y-3">
                    <div className="text-sm font-bold text-gray-900">Benefits of {form.name}</div>
                    {sortedBenefits.map((b, idx) => (
                      <div key={b.id} className="rounded-lg border p-3 flex gap-2 items-start">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm">{b.title}</div>
                          <div className="text-xs text-gray-500 truncate">{b.description}</div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <button type="button" onClick={() => moveBenefit(idx, -1)} className="p-1 rounded hover:bg-gray-100"><ChevronUp className="h-4 w-4" /></button>
                          <button type="button" onClick={() => moveBenefit(idx, 1)} className="p-1 rounded hover:bg-gray-100"><ChevronDown className="h-4 w-4" /></button>
                        </div>
                        <button type="button" onClick={() => { setEditingBenefitId(b.id); setBenefitDraft({ title: b.title, description: b.description || '', icon: b.icon || '', icon_url: b.icon_url || '', display_order: b.display_order, active: b.active }); }} className="text-blue-600 text-xs font-bold">Edit</button>
                        <button type="button" onClick={() => deleteBenefit(b.id)} className="text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}

                    <div className="rounded-xl border border-dashed border-gray-300 p-3 space-y-2 bg-gray-50">
                      <div className="text-xs font-bold text-gray-600">{editingBenefitId ? 'Edit Benefit' : 'Add Benefit'}</div>
                      <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Headline" value={benefitDraft.title} onChange={(e) => setBenefitDraft({ ...benefitDraft, title: e.target.value })} />
                      <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Sub text / description" value={benefitDraft.description} onChange={(e) => setBenefitDraft({ ...benefitDraft, description: e.target.value })} />
                      <div className="grid grid-cols-2 gap-2">
                        <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Ionicons name e.g. pricetag" value={benefitDraft.icon} onChange={(e) => setBenefitDraft({ ...benefitDraft, icon: e.target.value })} />
                        <label className="inline-flex items-center justify-center gap-1 rounded-lg border bg-white px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-gray-50">
                          <Upload className="h-3.5 w-3.5" /> {uploadingIcon ? 'Uploading…' : 'Upload Icon'}
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBenefitIcon(f); }} />
                        </label>
                      </div>
                      {benefitDraft.icon_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={benefitDraft.icon_url} alt="" className="h-10 w-10 object-contain rounded border bg-white" />
                      ) : null}
                      <button type="button" onClick={saveBenefit} className="w-full rounded-lg bg-gray-900 text-white py-2 text-sm font-bold">
                        {editingBenefitId ? 'Update Benefit' : 'Add Benefit'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2">Save the plan first, then you can add benefits.</p>
                )}
              </form>

              <div className="p-5 bg-gray-50 max-h-[80vh] overflow-y-auto">
                <PreviewCard plan={form} benefits={sortedBenefits} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
