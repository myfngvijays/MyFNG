'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, X, Save, Star } from 'lucide-react';

type ReviewRow = {
  id: string;
  name: string;
  car: string;
  stars: number;
  text: string;
  date: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
};

export default function CustomerReviewsPage() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ReviewRow | null>(null);

  const [form, setForm] = useState({
    name: '',
    car: '',
    stars: 5,
    text: '',
    date: '',
    display_order: 0,
    is_active: true,
  });

  async function fetchRows() {
    setLoading(true);
    try {
      const res = await fetch('/api/super_admin/customer-reviews');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = [json?.error, json?.details].filter(Boolean).join('\n');
        throw new Error(msg || `Failed to load (${res.status})`);
      }
      setRows(json.data || []);
    } catch (e: any) {
      alert(e?.message || 'Failed to load reviews');
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
      name: '',
      car: '',
      stars: 5,
      text: '',
      date: '',
      display_order: rows.length + 1,
      is_active: true,
    });
    setModalOpen(true);
  }

  function openEdit(r: ReviewRow) {
    setEditing(r);
    setForm({
      name: r.name,
      car: r.car,
      stars: r.stars,
      text: r.text,
      date: r.date,
      display_order: r.display_order,
      is_active: r.is_active,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.car || !form.text || !form.date) {
      alert('Please fill all required fields');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: form.name,
        car: form.car,
        stars: form.stars,
        text: form.text,
        date: form.date,
        display_order: Number(form.display_order || 0),
        is_active: form.is_active,
      };

      const url = editing
        ? `/api/super_admin/customer-reviews/${editing.id}`
        : '/api/super_admin/customer-reviews';
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
    if (!confirm('Delete this review?')) return;
    try {
      const res = await fetch(`/api/super_admin/customer-reviews/${id}`, { method: 'DELETE' });
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
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Customer Reviews</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage reviews shown on the mobile app home screen. These appear in the &quot;What Our Customers Say&quot; section.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-white font-semibold shadow hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Add Review
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>No reviews yet.</strong> The mobile app is showing hardcoded default reviews. Add reviews here to override them.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col"
            >
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i < r.stars ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`}
                    />
                  ))}
                  <span className={`ml-auto text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                    r.is_active
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                  }`}>
                    {r.is_active ? 'Active' : 'Hidden'}
                  </span>
                </div>
                <p className="text-sm text-gray-700 flex-1 line-clamp-3">&quot;{r.text}&quot;</p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700">
                    {r.name[0]}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{r.name}</div>
                    <div className="text-xs text-gray-500">{r.car} • {r.date}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
                  <span className="text-xs text-gray-400">Order: {r.display_order}</span>
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={() => openEdit(r)}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                    >
                      <Edit className="h-3 w-3" /> Edit
                    </button>
                    <button
                      onClick={() => onDelete(r.id)}
                      className="inline-flex items-center justify-center rounded-lg border border-red-200 p-1.5 text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <div className="text-lg font-bold text-gray-900">
                {editing ? 'Edit Review' : 'Add Review'}
              </div>
              <button onClick={closeModal} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Customer Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    placeholder="e.g. Rahul Sharma"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Car Model *</label>
                  <input
                    value={form.car}
                    onChange={(e) => setForm((p) => ({ ...p, car: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    placeholder="e.g. Hyundai Creta"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Review Text *</label>
                <textarea
                  value={form.text}
                  onChange={(e) => setForm((p) => ({ ...p, text: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm min-h-[80px]"
                  placeholder="e.g. Excellent service! My car feels brand new..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Stars (1-5) *</label>
                  <div className="mt-1 flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, stars: i + 1 }))}
                        className="p-0.5"
                      >
                        <Star
                          className={`h-6 w-6 cursor-pointer ${
                            i < form.stars ? 'text-amber-400 fill-amber-400' : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Date *</label>
                  <input
                    value={form.date}
                    onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    placeholder="e.g. Jan 2025"
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

              <div className="flex items-center gap-3">
                <input
                  id="is_active"
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                />
                <label htmlFor="is_active" className="text-sm font-semibold text-gray-700">
                  Active (visible in app)
                </label>
              </div>

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
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
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
