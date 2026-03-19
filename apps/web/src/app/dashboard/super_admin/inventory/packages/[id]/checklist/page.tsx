'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Save, Trash2, Loader2, ListChecks } from 'lucide-react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type ChecklistItem = {
  id: string;
  name: string;
  category?: string;
};

export default function PackageChecklistPage() {
  const params = useParams();
  const packageId = params?.id ? String(params.id) : '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [packageName, setPackageName] = useState('');

  const [title, setTitle] = useState('');
  const [points, setPoints] = useState('15');
  const [items, setItems] = useState<ChecklistItem[]>([]);

  const validItemsCount = useMemo(
    () => items.filter((it) => String(it.name || '').trim().length > 0).length,
    [items]
  );

  useEffect(() => {
    if (!packageId) return;
    void fetchChecklist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packageId]);

  const fetchChecklist = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/inventory/packages/${packageId}/checklist`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load checklist');

      setPackageName(data?.package?.name || 'Service');
      const tpl = data?.template;
      setTitle(tpl?.title || '');
      setPoints(String(tpl?.points || '15'));
      setItems(Array.isArray(tpl?.checklist_items) ? tpl.checklist_items : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load checklist');
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (index: number, patch: Partial<ChecklistItem>) => {
    setItems((prev) => prev.map((it, idx) => (idx === index ? { ...it, ...patch } : it)));
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: String(prev.length + 1),
        name: '',
        category: '',
      },
    ]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const saveChecklist = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        points: Number(points),
        checklist_items: items.map((it, idx) => ({
          id: String(it.id || idx + 1),
          name: String(it.name || ''),
          category: String(it.category || ''),
        })),
      };

      const res = await fetch(`/api/admin/inventory/packages/${packageId}/checklist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save checklist');

      alert('Checklist saved successfully');
      await fetchChecklist();
    } catch (e: any) {
      setError(e?.message || 'Failed to save checklist');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/super_admin/inventory/packages" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ListChecks className="w-6 h-6 text-brand-primary" />
            Checklist: {packageName}
          </h1>
          <p className="text-gray-500">Add, edit, remove checklist points for this service package.</p>
        </div>
        <button
          type="button"
          onClick={saveChecklist}
          disabled={saving}
          className="btn btn-primary flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Checklist'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Checklist Title</label>
            <input
              id="checklist-title"
              name="checklist-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Basic Service (15 Points) - What we will do"
              className="w-full p-2 border rounded-lg bg-gray-50 focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
            <input
              id="checklist-points"
              name="checklist-points"
              type="number"
              min={1}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className="w-full p-2 border rounded-lg bg-gray-50 focus:bg-white"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
          <h3 className="font-bold text-gray-900">Checklist Items ({validItemsCount})</h3>
          <button
            type="button"
            onClick={addItem}
            className="btn btn-sm bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>

        {items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No checklist items yet. Click <span className="font-semibold">Add Item</span>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-3 text-left font-medium w-20">#</th>
                  <th className="p-3 text-left font-medium">Item Name</th>
                  <th className="p-3 text-left font-medium">Category</th>
                  <th className="p-3 text-right font-medium w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, idx) => (
                  <tr key={`${item.id}-${idx}`} className="hover:bg-gray-50">
                    <td className="p-3">
                      <input
                        type="text"
                        value={item.id || String(idx + 1)}
                        onChange={(e) => updateItem(idx, { id: e.target.value })}
                        className="w-14 p-1.5 border rounded bg-white text-center"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        value={item.name || ''}
                        onChange={(e) => updateItem(idx, { name: e.target.value })}
                        placeholder="Checklist item name"
                        className="w-full p-2 border rounded bg-white"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        value={item.category || ''}
                        onChange={(e) => updateItem(idx, { category: e.target.value })}
                        placeholder="Engine Compartment / Cabin / Others"
                        className="w-full p-2 border rounded bg-white"
                      />
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors"
                        title="Remove Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

