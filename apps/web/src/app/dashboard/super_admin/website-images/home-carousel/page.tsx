'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Edit, Trash2, Upload, X, Save } from 'lucide-react';

type BannerRow = {
  id: string;
  title: string | null;
  image_url: string;
  route_name: string;
  route_params: any;
  display_order: number;
  is_active: boolean;
  created_at?: string;
};

const ROUTES = ['PublicHome', 'AIBooking', 'PublicWorkshopLocator', 'PublicServicePackages', 'PublicBookServiceNow', 'Login'] as const;

export default function HomeCarouselImagesPage() {
  const [rows, setRows] = useState<BannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BannerRow | null>(null);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    title: '',
    image_url: '',
    route_name: 'AIBooking',
    route_params_text: '{\"prefill\":\"\"}',
    display_order: 0,
    is_active: true,
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');

  const routeParamsValid = useMemo(() => {
    try {
      JSON.parse(form.route_params_text || '{}');
      return true;
    } catch {
      return false;
    }
  }, [form.route_params_text]);

  async function fetchRows() {
    setLoading(true);
    try {
      const res = await fetch('/api/super_admin/home-carousel');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = [json?.error, json?.details].filter(Boolean).join('\n');
        throw new Error(msg || `Failed to load (${res.status})`);
      }
      setRows(json.data || []);
    } catch (e: any) {
      alert(e?.message || 'Failed to load carousel banners');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRows();
  }, []);

  function openAdd() {
    setEditing(null);
    setForm({
      title: '',
      image_url: '',
      route_name: 'AIBooking',
      route_params_text: '{\"prefill\":\"\"}',
      display_order: rows.length + 1,
      is_active: true,
    });
    setFile(null);
    setPreview('');
    setModalOpen(true);
  }

  function openEdit(r: BannerRow) {
    setEditing(r);
    setForm({
      title: r.title || '',
      image_url: r.image_url || '',
      route_name: r.route_name || 'AIBooking',
      route_params_text: JSON.stringify(r.route_params || {}, null, 2),
      display_order: Number(r.display_order || 0),
      is_active: !!r.is_active,
    });
    setFile(null);
    setPreview(r.image_url);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setFile(null);
    setPreview('');
  }

  async function uploadImage() {
    if (!file) return;
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', form.title || 'banner');
      const res = await fetch('/api/super_admin/home-carousel/upload-image', { method: 'POST', body: fd });
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

      const url = editing ? `/api/super_admin/home-carousel/${editing.id}` : '/api/super_admin/home-carousel';
      const method = editing ? 'PUT' : 'POST';
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
    if (!confirm('Delete this banner?')) return;
    try {
      const res = await fetch(`/api/super_admin/home-carousel/${id}`, { method: 'DELETE' });
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Home Carousel Images</h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload top hero carousel images for the mobile app. On click, the app navigates to the selected route.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Tip: In route params, use <span className="font-mono">\"__CITY__\"</span> to pass the current city automatically.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-white font-semibold shadow hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Add Banner
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs font-semibold text-gray-500 bg-gray-50">
          <div className="col-span-4">Image</div>
          <div className="col-span-2">Route</div>
          <div className="col-span-2">Order</div>
          <div className="col-span-2">Active</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-gray-600">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-gray-600">No banners yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map((r) => (
              <div key={r.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
                <div className="col-span-4 flex items-center gap-3 min-w-0">
                  <div className="h-12 w-20 rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.image_url} alt={r.title || 'banner'} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{r.title || 'Untitled'}</div>
                    <div className="text-xs text-gray-500 truncate">{r.image_url}</div>
                  </div>
                </div>
                <div className="col-span-2 text-sm font-semibold text-gray-800">{r.route_name}</div>
                <div className="col-span-2 text-sm text-gray-800">{r.display_order}</div>
                <div className="col-span-2">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {r.is_active ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="col-span-2 flex justify-end gap-2">
                  <button
                    onClick={() => openEdit(r)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    <Edit className="h-4 w-4" /> Edit
                  </button>
                  <button
                    onClick={() => onDelete(r.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-200">
              <div className="text-lg font-bold text-gray-900">{editing ? 'Edit Banner' : 'Add Banner'}</div>
              <button onClick={closeModal} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Title (optional)</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    placeholder="e.g. Book service in minutes"
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
                  <label className="text-sm font-semibold text-gray-700">Route</label>
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
                <label className="text-sm font-semibold text-gray-700">Route Params (JSON)</label>
                <textarea
                  value={form.route_params_text}
                  onChange={(e) => setForm((p) => ({ ...p, route_params_text: e.target.value }))}
                  className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm font-mono min-h-[110px] ${
                    routeParamsValid ? 'border-gray-200' : 'border-red-300'
                  }`}
                />
                {!routeParamsValid ? <div className="text-xs text-red-600 mt-1">Invalid JSON</div> : null}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Image Upload</label>
                  <div className="mt-1 flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
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
                  <div className="mt-2">
                    <label className="text-xs font-semibold text-gray-500">Or paste Image URL</label>
                    <input
                      value={form.image_url}
                      onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs font-semibold text-gray-600 mb-2">Preview</div>
                  <div className="aspect-[16/9] w-full rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {preview || form.image_url ? (
                      <img src={preview || form.image_url} alt="preview" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-xs text-gray-500">No image</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-70"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}


