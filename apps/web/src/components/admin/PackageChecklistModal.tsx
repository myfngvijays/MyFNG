'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2, Loader2, ListChecks, X } from 'lucide-react';

type ChecklistItem = {
  id: string;
  name: string;
  category?: string;
};

type Props = {
  packageId: string;
  packageNameHint?: string;
  onClose: () => void;
};

export default function PackageChecklistModal({
  packageId,
  packageNameHint,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [packageName, setPackageName] = useState(packageNameHint || '');
  const [title, setTitle] = useState('');
  const [points, setPoints] = useState('15');
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const validItemsCount = useMemo(
    () => items.filter((it) => String(it.name || '').trim().length > 0).length,
    [items],
  );

  useEffect(() => {
    if (!packageId) return;
    void fetchChecklist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packageId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const fetchChecklist = async () => {
    setLoading(true);
    setError(null);
    setSavedMsg(null);
    try {
      const res = await fetch(`/api/admin/inventory/packages/${packageId}/checklist`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load checklist');

      setPackageName(data?.package?.name || packageNameHint || 'Service');
      const tpl = data?.template;
      setTitle(tpl?.title || '');
      setPoints(String(tpl?.points ?? '15'));
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
    setSavedMsg(null);
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

      setSavedMsg('Checklist saved successfully');
      await fetchChecklist();
    } catch (e: any) {
      setError(e?.message || 'Failed to save checklist');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-start gap-3 shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-brand-primary shrink-0" />
              <span className="truncate">Checklist: {packageName || 'Service'}</span>
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Add, edit, remove checklist points for this service package.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="py-16 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-primary" />
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}
              {savedMsg && (
                <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
                  {savedMsg}
                </div>
              )}

              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Checklist Title
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Basic Service (15 Points) - What we will do"
                      className="w-full p-2 border rounded-lg bg-white focus:ring-2 focus:ring-brand-primary/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                    <input
                      type="number"
                      min={1}
                      value={points}
                      onChange={(e) => setPoints(e.target.value)}
                      className="w-full p-2 border rounded-lg bg-white focus:ring-2 focus:ring-brand-primary/20 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
                  <h3 className="font-bold text-gray-900 text-sm">
                    Checklist Items ({validItemsCount})
                  </h3>
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
                  <div className="p-8 text-center text-gray-500 text-sm">
                    No checklist items yet. Click{' '}
                    <span className="font-semibold">Add Item</span>.
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
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-white">
          <button type="button" onClick={onClose} className="btn btn-secondary" disabled={saving}>
            Close
          </button>
          <button
            type="button"
            onClick={saveChecklist}
            disabled={saving || loading}
            className="btn btn-primary flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Checklist'}
          </button>
        </div>
      </div>
    </div>
  );
}
