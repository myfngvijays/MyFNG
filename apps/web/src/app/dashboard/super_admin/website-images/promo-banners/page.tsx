'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Edit, Trash2, Upload, X, Save, RefreshCcw, ImageIcon } from 'lucide-react';

type BannerRow = {
  id: string;
  title: string | null;
  image_url: string;
  route_name: string;
  route_params: any;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  is_default?: boolean;
};

const ROUTES = [
  'PublicHome',
  'AIBooking',
  'PublicWorkshopLocator',
  'PublicServicePackages',
  'PublicBookServiceNow',
  'Login',
] as const;

// These mirror the hardcoded PROMO_BANNERS in the mobile app
// (PublicHomeScreen + PublicServicePackagesScreen).
const DEFAULT_BANNERS: BannerRow[] = [
  {
    id: 'default-loan',
    title: 'Get a Loan Against Car',
    image_url:
      'https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/App/Mobile%20Screen%20-%20Home%20Page%20-%20Other%20Cards/My%20FNG%20-%20Banner%20-%20Get%20A%20Loan%20Against%20Car.PNG',
    route_name: 'PublicHome',
    route_params: {},
    display_order: 1,
    is_active: true,
    is_default: true,
  },
  {
    id: 'default-echallan',
    title: "Check Your Car's E-Challan",
    image_url:
      'https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/App/Mobile%20Screen%20-%20Home%20Page%20-%20Other%20Cards/My%20FNG%20-%20Banner%20-%20Check%20Your%20Cars%20E-Challan.PNG',
    route_name: 'PublicHome',
    route_params: {},
    display_order: 2,
    is_active: true,
    is_default: true,
  },
  {
    id: 'default-fuel',
    title: 'Get Nearest Fuel Station',
    image_url:
      'https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/App/Mobile%20Screen%20-%20Home%20Page%20-%20Other%20Cards/My%20FNG%20-%20Banner%20-%20Get%20Nearest%20Fuel%20Station.PNG',
    route_name: 'PublicHome',
    route_params: {},
    display_order: 3,
    is_active: true,
    is_default: true,
  },
  {
    id: 'default-sell',
    title: 'Sell Your Car Stress-Free',
    image_url:
      'https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/App/Mobile%20Screen%20-%20Home%20Page%20-%20Other%20Cards/My%20FNG%20-%20Banner%20-%20Sell%20Your%20Car%20Stress%20Free.PNG',
    route_name: 'PublicHome',
    route_params: {},
    display_order: 4,
    is_active: true,
    is_default: true,
  },
];

export default function PromoBannersPage() {
  const [rows, setRows] = useState<BannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BannerRow | null>(null);
  const [uploading, setUploading] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);

  const [form, setForm] = useState({
    title: '',
    image_url: '',
    route_name: 'PublicHome',
    route_params_text: '{}',
    display_order: 0,
    is_active: true,
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const routeParamsValid = useMemo(() => {
    try {
      JSON.parse(form.route_params_text || '{}');
      return true;
    } catch {
      return false;
    }
  }, [form.route_params_text]);

  const visibleRows: BannerRow[] = useMemo(() => {
    if (rows.length > 0) return rows;
    return DEFAULT_BANNERS;
  }, [rows]);

  async function fetchRows() {
    setLoading(true);
    try {
      const res = await fetch('/api/super_admin/promo-banners');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = [json?.error, json?.details].filter(Boolean).join('\n');
        throw new Error(msg || `Failed to load (${res.status})`);
      }
      setRows(json.data || []);
    } catch (e: any) {
      alert(e?.message || 'Failed to load promo banners');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRows();
  }, []);

  function openAdd() {
    setEditing(null);
    setReplaceMode(false);
    setForm({
      title: '',
      image_url: '',
      route_name: 'PublicHome',
      route_params_text: '{}',
      display_order: rows.length + 1,
      is_active: true,
    });
    setFile(null);
    setPreview('');
    setModalOpen(true);
  }

  function openEdit(r: BannerRow, opts: { replaceImageOnly?: boolean } = {}) {
    setEditing(r);
    setReplaceMode(!!opts.replaceImageOnly);
    setForm({
      title: r.title || '',
      image_url: opts.replaceImageOnly ? '' : r.image_url || '',
      route_name: r.route_name || 'PublicHome',
      route_params_text: JSON.stringify(r.route_params || {}, null, 2),
      display_order: Number(r.display_order || 0),
      is_active: !!r.is_active,
    });
    setFile(null);
    setPreview(opts.replaceImageOnly ? '' : r.image_url);
    setModalOpen(true);
    if (opts.replaceImageOnly) {
      setTimeout(() => fileInputRef.current?.click(), 200);
    }
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setReplaceMode(false);
    setFile(null);
    setPreview('');
  }

  async function uploadImage() {
    if (!file) return;
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', form.title || 'promo');
      const res = await fetch('/api/super_admin/promo-banners/upload-image', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = [json?.error, json?.details].filter(Boolean).join('\n');
        throw new Error(msg || `Upload failed (${res.status})`);
      }
      setForm((p) => ({ ...p, image_url: json.image_url }));
      setPreview(json.image_url);
      return json.image_url as string;
    } catch (e: any) {
      alert(e?.message || 'Upload failed');
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!routeParamsValid) {
      alert('Route params JSON is invalid');
      return;
    }

    try {
      setSaving(true);
      let imageUrl = form.image_url;
      if (file && !imageUrl) {
        const up = await uploadImage();
        if (up) imageUrl = up;
      }
      if (!imageUrl) {
        alert('Please upload/select an image');
        return;
      }

      const payload = {
        title: form.title || null,
        image_url: imageUrl,
        route_name: form.route_name,
        route_params: JSON.parse(form.route_params_text || '{}'),
        display_order: Number(form.display_order || 0),
        is_active: !!form.is_active,
      };

      const isDefaultPlaceholder = !!editing?.is_default;
      const url =
        editing && !isDefaultPlaceholder
          ? `/api/super_admin/promo-banners/${editing.id}`
          : '/api/super_admin/promo-banners';
      const method = editing && !isDefaultPlaceholder ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = [json?.error, json?.details].filter(Boolean).join('\n');
        throw new Error(msg || `Save failed (${res.status})`);
      }

      await fetchRows();
      closeModal();
    } catch (e: any) {
      alert(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Delete this promo banner?')) return;
    try {
      const res = await fetch(`/api/super_admin/promo-banners/${id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = [json?.error, json?.details].filter(Boolean).join('\n');
        throw new Error(msg || `Delete failed (${res.status})`);
      }
      await fetchRows();
    } catch (e: any) {
      alert(e?.message || 'Delete failed');
    }
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Promo Banners</h1>
          <p className="text-sm text-gray-500 mt-1">
            Promotional cards on the mobile Home & Service Packages screens (Loan, E-Challan, Fuel, Sell Car etc).
            Replace any image instantly &mdash; the new banner appears in the app within seconds.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-white font-semibold shadow hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Add Banner
        </button>
      </div>

      {rows.length === 0 && !loading ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Heads up:</strong> No custom promo banners uploaded yet. The mobile app is showing the{' '}
          {DEFAULT_BANNERS.length} <em>default</em> banners below. Click <strong>Replace Image</strong> on any to upload
          a new version.
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleRows.map((r) => (
            <div
              key={r.id}
              className="group rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col"
            >
              <div className="relative aspect-[16/8] bg-gray-100 overflow-hidden">
                {r.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image_url} alt={r.title || 'promo'} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
                {r.is_default ? (
                  <div className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/95 backdrop-blur px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 border border-amber-200">
                    Default
                  </div>
                ) : (
                  <div
                    className={`absolute top-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                      r.is_active
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}
                  >
                    {r.is_active ? 'Active' : 'Hidden'}
                  </div>
                )}
                <div className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/60 backdrop-blur px-2 py-1 text-[10px] font-bold text-white">
                  Order: {r.display_order}
                </div>
                <button
                  type="button"
                  onClick={() => openEdit(r, { replaceImageOnly: true })}
                  className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent text-white py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <RefreshCcw className="h-4 w-4" /> Replace Image
                </button>
              </div>
              <div className="p-3 flex-1 flex flex-col">
                <div className="text-sm font-semibold text-gray-900 truncate">{r.title || 'Untitled'}</div>
                <div className="text-xs text-gray-500 truncate">→ {r.route_name}</div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => openEdit(r, { replaceImageOnly: true })}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <RefreshCcw className="h-3 w-3" /> Replace Image
                  </button>
                  <button
                    onClick={() => openEdit(r)}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                    title="Edit all fields"
                  >
                    <Edit className="h-3 w-3" /> Edit
                  </button>
                  {!r.is_default ? (
                    <button
                      onClick={() => onDelete(r.id)}
                      className="inline-flex items-center justify-center rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <div className="text-lg font-bold text-gray-900">
                {replaceMode
                  ? `Replace Image — ${editing?.title || 'Banner'}`
                  : editing
                  ? 'Edit Promo Banner'
                  : 'Add Promo Banner'}
              </div>
              <button onClick={closeModal} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Image Upload</label>
                  <div className="mt-1 flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setFile(f);
                        if (f) {
                          const url = URL.createObjectURL(f);
                          setPreview(url);
                        }
                      }}
                      className="text-sm"
                    />
                    <button
                      type="button"
                      onClick={uploadImage}
                      disabled={!file || uploading}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
                    >
                      <Upload className="h-4 w-4" />
                      {uploading ? 'Uploading…' : 'Upload'}
                    </button>
                  </div>
                  {!replaceMode ? (
                    <div className="mt-2">
                      <label className="text-xs font-semibold text-gray-500">Or paste Image URL</label>
                      <input
                        value={form.image_url}
                        onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                        placeholder="https://..."
                      />
                    </div>
                  ) : null}
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs font-semibold text-gray-600 mb-2">Preview</div>
                  <div className="aspect-[16/9] w-full rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                    {preview || form.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={preview || form.image_url} alt="preview" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-xs text-gray-500">No image</div>
                    )}
                  </div>
                </div>
              </div>

              {!replaceMode ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Title (optional)</label>
                      <input
                        value={form.title}
                        onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                        placeholder="e.g. Get a Loan Against Car"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Display Order</label>
                      <input
                        type="number"
                        value={form.display_order}
                        onChange={(e) => setForm((p) => ({ ...p, display_order: Number(e.target.value || 0) }))}
                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Route (optional)</label>
                      <select
                        value={form.route_name}
                        onChange={(e) => setForm((p) => ({ ...p, route_name: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                      >
                        {ROUTES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-3 pt-6">
                      <input
                        id="is_active"
                        type="checkbox"
                        checked={form.is_active}
                        onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                      />
                      <label htmlFor="is_active" className="text-sm font-semibold text-gray-700">
                        Active
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700">Route Params (JSON, optional)</label>
                    <textarea
                      value={form.route_params_text}
                      onChange={(e) => setForm((p) => ({ ...p, route_params_text: e.target.value }))}
                      className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm font-mono min-h-[110px] ${
                        routeParamsValid ? 'border-gray-200' : 'border-red-300'
                      }`}
                    />
                    {!routeParamsValid ? <div className="text-xs text-red-600 mt-1">Invalid JSON</div> : null}
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  <strong>Replace mode:</strong> Pick a new image and click <em>Save</em>. Title, route, and order
                  remain unchanged. To change those, close this dialog and use <em>Edit</em> instead.
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 -mx-5 px-5 -mb-5 pb-5 bg-gray-50">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || (!file && !form.image_url)}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving…' : replaceMode ? 'Save New Image' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
