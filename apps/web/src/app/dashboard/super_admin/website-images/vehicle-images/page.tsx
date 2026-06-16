'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Upload, X, RefreshCcw, Search, CarFront, Loader2 } from 'lucide-react';

type VehicleImageRow = {
  id: string;
  type: 'model' | 'brand' | 'default';
  make: string;
  model: string | null;
  make_slug: string;
  model_slug: string | null;
  storage_path: string;
  image_url: string;
  updated_at: string | null;
};

export default function VehicleImagesPage() {
  const [rows, setRows] = useState<VehicleImageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'model' | 'brand'>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);

  const [form, setForm] = useState({
    make: '',
    model: '',
    image_type: 'model' as 'model' | 'brand',
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const brandTabs = useMemo(() => {
    const map = new Map<string, { slug: string; label: string; count: number }>();
    for (const row of rows) {
      if (row.type === 'default') continue;
      const slug = row.make_slug;
      const existing = map.get(slug);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(slug, { slug, label: row.make, count: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      if (typeFilter === 'model' && row.type !== 'model') return false;
      if (typeFilter === 'brand' && row.type !== 'brand') return false;
      if (selectedBrand !== 'all' && row.make_slug !== selectedBrand) return false;
      if (!q) return true;
      const haystack = `${row.make} ${row.model || ''} ${row.make_slug} ${row.model_slug || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, searchQuery, typeFilter, selectedBrand]);

  async function fetchRows() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/super_admin/vehicle-images');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = [json?.error, json?.details].filter(Boolean).join(' — ');
        throw new Error(msg || `Failed to load (${res.status})`);
      }
      setRows(json.data || []);
    } catch (e: any) {
      setRows([]);
      setLoadError(e?.message || 'Failed to load vehicle images');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRows();
  }, []);

  function openAdd() {
    setForm({ make: '', model: '', image_type: 'model' });
    setFile(null);
    setPreview('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setFile(null);
    setPreview('');
  }

  function onPickFile(next: File | null) {
    setFile(next);
    if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    setPreview(next ? URL.createObjectURL(next) : '');
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!form.make.trim()) {
      alert('Make is required');
      return;
    }
    if (form.image_type === 'model' && !form.model.trim()) {
      alert('Model is required for vehicle model images');
      return;
    }
    if (!file) {
      alert('Please choose an image file');
      return;
    }

    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('make', form.make.trim());
      fd.append('model', form.model.trim());
      fd.append('image_type', form.image_type);

      const res = await fetch('/api/super_admin/vehicle-images/upload', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = [json?.error, json?.details].filter(Boolean).join('\n');
        throw new Error(msg || `Upload failed (${res.status})`);
      }

      closeModal();
      await fetchRows();
      alert(json.message || 'Image uploaded successfully');
    } catch (err: any) {
      alert(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(row: VehicleImageRow) {
    if (row.type === 'default') {
      alert('Default vehicle image cannot be deleted');
      return;
    }
    const label = row.model ? `${row.make} ${row.model}` : row.make;
    if (!confirm(`Delete image for ${label}?`)) return;

    try {
      setDeletingPath(row.storage_path);
      const res = await fetch('/api/super_admin/vehicle-images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: row.storage_path }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = [json?.error, json?.details].filter(Boolean).join('\n');
        throw new Error(msg || `Delete failed (${res.status})`);
      }
      setRows((prev) => prev.filter((r) => r.storage_path !== row.storage_path));
    } catch (err: any) {
      alert(err?.message || 'Delete failed');
    } finally {
      setDeletingPath(null);
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-blue-600 via-blue-700 to-blue-900 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 rounded-2xl bg-white/10 p-5 shadow-lg backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-2xl font-extrabold text-white">Vehicle Images</div>
              <div className="mt-1 max-w-2xl text-sm font-semibold text-blue-100">
                Manage car model images shown in the mobile app (Your Vehicles section). Uses the same storage paths as the app.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={fetchRows}
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/20"
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </button>
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50"
              >
                <Plus className="h-4 w-4" />
                Add Vehicle Image
              </button>
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-200" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by make or model..."
              className="w-full rounded-xl border border-white/20 bg-white/10 py-2.5 pl-10 pr-4 text-sm font-semibold text-white placeholder:text-blue-200 focus:outline-none focus:ring-2 focus:ring-white/40"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-white/40"
          >
            <option value="all" className="text-gray-900">
              All images
            </option>
            <option value="model" className="text-gray-900">
              Model images only
            </option>
            <option value="brand" className="text-gray-900">
              Brand logos only
            </option>
          </select>
        </div>

        {!loading && brandTabs.length > 0 ? (
          <div className="mb-4 rounded-2xl border border-white/20 bg-white/10 p-4">
            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-blue-100">Filter by brand</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              <button
                type="button"
                onClick={() => setSelectedBrand('all')}
                className={`rounded-lg px-3 py-2 text-center text-xs font-bold transition sm:text-sm ${
                  selectedBrand === 'all'
                    ? 'bg-white text-blue-700 shadow'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                All Brands ({rows.filter((r) => r.type !== 'default').length})
              </button>
              {brandTabs.map((brand) => (
                <button
                  key={brand.slug}
                  type="button"
                  onClick={() => setSelectedBrand(brand.slug)}
                  className={`rounded-lg px-3 py-2 text-center text-xs font-bold transition sm:text-sm ${
                    selectedBrand === brand.slug
                      ? 'bg-white text-blue-700 shadow'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {brand.label} ({brand.count})
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {loadError ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
            <div className="font-bold">Could not load vehicle images</div>
            <div className="mt-1 text-sm">{loadError}</div>
            <button
              type="button"
              onClick={fetchRows}
              className="mt-3 rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800"
            >
              Try again
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-white">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            Loading vehicle images...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-2xl border border-white/20 bg-white/10 p-10 text-center text-blue-100">
            {selectedBrand !== 'all'
              ? 'No vehicle images found for this brand.'
              : 'No vehicle images found. Click "Add Vehicle Image" to upload one.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredRows.map((row) => (
              <div
                key={row.storage_path}
                className="overflow-hidden rounded-2xl border border-white/20 bg-white shadow-lg"
              >
                <div className="flex h-36 items-center justify-center bg-gray-50 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={row.image_url}
                    alt={row.model ? `${row.make} ${row.model}` : row.make}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold text-gray-900">{row.make}</div>
                      {row.model ? (
                        <div className="truncate text-sm font-semibold text-gray-600">{row.model}</div>
                      ) : (
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          {row.type === 'brand' ? 'Brand logo' : row.type === 'default' ? 'Default fallback' : 'No model'}
                        </div>
                      )}
                    </div>
                    {row.type !== 'default' ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        disabled={deletingPath === row.storage_path}
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                        title="Delete"
                      >
                        {deletingPath === row.storage_path ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-2 break-all text-[11px] font-medium text-gray-400">{row.storage_path}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading ? (
          <div className="mt-4 text-sm font-semibold text-blue-100">
            Showing {filteredRows.length} of {rows.length} images
            {selectedBrand !== 'all'
              ? ` · ${brandTabs.find((b) => b.slug === selectedBrand)?.label || 'Brand'}`
              : ''}
          </div>
        ) : null}
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="flex items-center gap-2">
                <CarFront className="h-5 w-5 text-blue-700" />
                <div className="text-lg font-extrabold text-gray-900">Add Vehicle Image</div>
              </div>
              <button type="button" onClick={closeModal} className="rounded-lg p-2 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-sm font-bold text-gray-700">Image type</label>
                <select
                  value={form.image_type}
                  onChange={(e) => setForm((p) => ({ ...p, image_type: e.target.value as 'model' | 'brand' }))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold"
                >
                  <option value="model">Vehicle model image (make + model)</option>
                  <option value="brand">Brand logo only (make)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-gray-700">Make</label>
                <input
                  value={form.make}
                  onChange={(e) => setForm((p) => ({ ...p, make: e.target.value }))}
                  placeholder="e.g. Skoda, Maruti Suzuki"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold"
                />
              </div>

              {form.image_type === 'model' ? (
                <div>
                  <label className="mb-1 block text-sm font-bold text-gray-700">Model</label>
                  <input
                    value={form.model}
                    onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
                    placeholder="e.g. Rapid, Wagon R"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold"
                  />
                </div>
              ) : null}

              <div>
                <label className="mb-1 block text-sm font-bold text-gray-700">Image file</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(e) => onPickFile(e.target.files?.[0] || null)}
                  className="w-full text-sm"
                />
                {preview ? (
                  <div className="mt-3 flex h-32 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="Preview" className="max-h-full max-w-full object-contain" />
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl bg-blue-50 p-3 text-xs font-semibold text-blue-800">
                {form.image_type === 'model'
                  ? 'White background is auto-removed and image is resized to 227×128 transparent PNG — same format as existing fleet images.'
                  : 'White background is auto-removed. Saved as transparent PNG brand logo.'}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
