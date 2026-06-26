'use client';

import React, { useRef, useState } from 'react';
import { Download, Edit, Trash2, Upload, X } from 'lucide-react';

type VisibilityPatch = {
  visible_android?: boolean;
  visible_ios?: boolean;
  visible_web?: boolean;
};

type ContentBulkPanelProps = {
  entityLabel: string;
  apiBase: string;
  uploadContext: Record<string, unknown>;
  csvTemplate: string;
  editCsvTemplate: string;
  parseUploadCsv: (text: string) => { rows: unknown[]; errors: string[] };
  parseEditCsv: (text: string) => { rows: unknown[]; errors: string[] };
  uploadPayloadKey: string;
  selectedIds: string[];
  onClearSelection: () => void;
  onComplete: () => Promise<void> | void;
};

type TriState = 'unchanged' | 'on' | 'off';

function triToPatch(value: TriState): boolean | undefined {
  if (value === 'on') return true;
  if (value === 'off') return false;
  return undefined;
}

export default function ContentBulkPanel({
  entityLabel,
  apiBase,
  uploadContext,
  csvTemplate,
  editCsvTemplate,
  parseUploadCsv,
  parseEditCsv,
  uploadPayloadKey,
  selectedIds,
  onClearSelection,
  onComplete,
}: ContentBulkPanelProps) {
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkEditing, setBulkEditing] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkCsv, setBulkCsv] = useState(csvTemplate);
  const [editCsv, setEditCsv] = useState(editCsvTemplate);
  const [editTab, setEditTab] = useState<'visibility' | 'csv'>('visibility');
  const [androidState, setAndroidState] = useState<TriState>('unchanged');
  const [iosState, setIosState] = useState<TriState>('unchanged');
  const [webState, setWebState] = useState<TriState>('unchanged');
  const uploadFileRef = useRef<HTMLInputElement | null>(null);
  const editFileRef = useRef<HTMLInputElement | null>(null);

  function downloadTemplate(text: string, filename: string) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function onUploadFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBulkCsv(String(reader.result || ''));
    reader.readAsText(file);
    e.target.value = '';
  }

  function onEditFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setEditCsv(String(reader.result || ''));
    reader.readAsText(file);
    e.target.value = '';
  }

  function openUploadModal() {
    setBulkCsv(csvTemplate);
    setBulkUploadOpen(true);
  }

  function openEditModal() {
    setEditTab('visibility');
    setAndroidState('unchanged');
    setIosState('unchanged');
    setWebState('unchanged');
    setEditCsv(editCsvTemplate);
    setBulkEditOpen(true);
  }

  async function onBulkUpload() {
    const parsed = parseUploadCsv(bulkCsv);
    if (parsed.rows.length === 0) {
      alert(parsed.errors[0] || 'No valid rows found in CSV');
      return;
    }

    try {
      setBulkUploading(true);
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...uploadContext,
          [uploadPayloadKey]: parsed.rows,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = [json?.error, ...(Array.isArray(json?.errors) ? json.errors : []), json?.details]
          .filter(Boolean)
          .join('\n');
        throw new Error(msg || `Bulk upload failed (${res.status})`);
      }

      const skippedMsg =
        parsed.errors.length > 0 ? `\nSkipped invalid rows:\n${parsed.errors.join('\n')}` : '';
      alert(`${json.message || `Imported ${json.imported || parsed.rows.length} row(s)`}${skippedMsg}`);
      setBulkUploadOpen(false);
      await onComplete();
    } catch (e: any) {
      alert(e?.message || 'Bulk upload failed');
    } finally {
      setBulkUploading(false);
    }
  }

  async function onBulkEditVisibility() {
    if (selectedIds.length === 0) {
      alert(`Select at least one ${entityLabel} to edit.`);
      return;
    }

    const patch: VisibilityPatch = {};
    const android = triToPatch(androidState);
    const ios = triToPatch(iosState);
    const web = triToPatch(webState);
    if (android !== undefined) patch.visible_android = android;
    if (ios !== undefined) patch.visible_ios = ios;
    if (web !== undefined) patch.visible_web = web;

    if (Object.keys(patch).length === 0) {
      alert('Choose at least one visibility change (ON or OFF).');
      return;
    }

    try {
      setBulkEditing(true);
      const res = await fetch(apiBase, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, patch }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = [json?.error, json?.details].filter(Boolean).join('\n');
        throw new Error(msg || `Bulk edit failed (${res.status})`);
      }
      alert(json.message || `Updated ${json.updated || selectedIds.length} row(s)`);
      setBulkEditOpen(false);
      onClearSelection();
      await onComplete();
    } catch (e: any) {
      alert(e?.message || 'Bulk edit failed');
    } finally {
      setBulkEditing(false);
    }
  }

  async function onBulkEditCsv() {
    const parsed = parseEditCsv(editCsv);
    if (parsed.rows.length === 0) {
      alert(parsed.errors[0] || 'No valid rows found in CSV');
      return;
    }

    try {
      setBulkEditing(true);
      const res = await fetch(apiBase, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: parsed.rows }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = [json?.error, ...(Array.isArray(json?.errors) ? json.errors : []), json?.details]
          .filter(Boolean)
          .join('\n');
        throw new Error(msg || `Bulk edit failed (${res.status})`);
      }
      const skippedMsg =
        parsed.errors.length > 0 ? `\nSkipped invalid rows:\n${parsed.errors.join('\n')}` : '';
      alert(`${json.message || `Updated ${json.updated || parsed.rows.length} row(s)`}${skippedMsg}`);
      setBulkEditOpen(false);
      onClearSelection();
      await onComplete();
    } catch (e: any) {
      alert(e?.message || 'Bulk edit failed');
    } finally {
      setBulkEditing(false);
    }
  }

  async function onBulkDelete() {
    if (selectedIds.length === 0) {
      alert(`Select at least one ${entityLabel} to delete.`);
      return;
    }
    if (!confirm(`Delete ${selectedIds.length} selected ${entityLabel}(s)? This cannot be undone.`)) return;

    try {
      setBulkDeleting(true);
      const res = await fetch(apiBase, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = [json?.error, json?.details].filter(Boolean).join('\n');
        throw new Error(msg || `Bulk delete failed (${res.status})`);
      }
      alert(json.message || `Deleted ${json.deleted || selectedIds.length} row(s)`);
      onClearSelection();
      await onComplete();
    } catch (e: any) {
      alert(e?.message || 'Bulk delete failed');
    } finally {
      setBulkDeleting(false);
    }
  }

  function TriToggle({
    label,
    value,
    onChange,
    onClass,
  }: {
    label: string;
    value: TriState;
    onChange: (v: TriState) => void;
    onClass: string;
  }) {
    return (
      <div className="rounded-xl border border-gray-200 p-3 space-y-2">
        <div className="text-sm font-bold text-gray-800">{label}</div>
        <div className="flex flex-wrap gap-2">
          {(['unchanged', 'on', 'off'] as TriState[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold border ${
                value === option
                  ? option === 'on'
                    ? `${onClass} text-white border-transparent`
                    : option === 'off'
                      ? 'bg-gray-700 text-white border-gray-700'
                      : 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {option === 'unchanged' ? 'No change' : option === 'on' ? 'Turn ON' : 'Turn OFF'}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={openUploadModal}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <Upload className="h-4 w-4" />
          Bulk Upload
        </button>
        <button
          type="button"
          onClick={openEditModal}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <Edit className="h-4 w-4" />
          Bulk Edit{selectedIds.length ? ` (${selectedIds.length})` : ''}
        </button>
        <button
          type="button"
          onClick={onBulkDelete}
          disabled={selectedIds.length === 0 || bulkDeleting}
          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          {bulkDeleting ? 'Deleting…' : `Bulk Delete${selectedIds.length ? ` (${selectedIds.length})` : ''}`}
        </button>
      </div>

      {bulkUploadOpen ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <div>
                <div className="text-lg font-bold text-gray-900">Bulk Upload {entityLabel}</div>
                <div className="text-xs text-gray-500 mt-0.5">Paste CSV or upload a file. Max 200 rows.</div>
              </div>
              <button type="button" onClick={() => setBulkUploadOpen(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => downloadTemplate(csvTemplate, `${entityLabel.toLowerCase().replace(/\s+/g, '-')}-template.csv`)}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <Download className="h-4 w-4" /> Download Template
                </button>
                <button
                  type="button"
                  onClick={() => uploadFileRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <Upload className="h-4 w-4" /> Choose CSV File
                </button>
                <input ref={uploadFileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onUploadFileChange} />
              </div>
              <textarea
                value={bulkCsv}
                onChange={(e) => setBulkCsv(e.target.value)}
                rows={12}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono"
              />
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 -mx-5 px-5 -mb-5 pb-5 bg-gray-50">
                <button
                  type="button"
                  onClick={() => setBulkUploadOpen(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 bg-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onBulkUpload}
                  disabled={bulkUploading}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
                >
                  <Upload className="h-4 w-4" />
                  {bulkUploading ? 'Uploading…' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {bulkEditOpen ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <div>
                <div className="text-lg font-bold text-gray-900">Bulk Edit {entityLabel}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {selectedIds.length
                    ? `${selectedIds.length} selected — change visibility or update via CSV (with id).`
                    : 'Update existing rows via CSV using id column.'}
                </div>
              </div>
              <button type="button" onClick={() => setBulkEditOpen(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="inline-flex rounded-xl border border-gray-200 bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => setEditTab('visibility')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                    editTab === 'visibility' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                  }`}
                >
                  Visibility
                </button>
                <button
                  type="button"
                  onClick={() => setEditTab('csv')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                    editTab === 'csv' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                  }`}
                >
                  CSV Update
                </button>
              </div>

              {editTab === 'visibility' ? (
                <div className="space-y-3">
                  <TriToggle
                    label="Android"
                    value={androidState}
                    onChange={setAndroidState}
                    onClass="bg-emerald-600"
                  />
                  <TriToggle label="iOS" value={iosState} onChange={setIosState} onClass="bg-violet-600" />
                  <TriToggle label="Website" value={webState} onChange={setWebState} onClass="bg-sky-600" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        downloadTemplate(
                          editCsvTemplate,
                          `${entityLabel.toLowerCase().replace(/\s+/g, '-')}-edit-template.csv`,
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <Download className="h-4 w-4" /> Download Edit Template
                    </button>
                    <button
                      type="button"
                      onClick={() => editFileRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <Upload className="h-4 w-4" /> Choose CSV File
                    </button>
                    <input ref={editFileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onEditFileChange} />
                  </div>
                  <textarea
                    value={editCsv}
                    onChange={(e) => setEditCsv(e.target.value)}
                    rows={12}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 -mx-5 px-5 -mb-5 pb-5 bg-gray-50">
                <button
                  type="button"
                  onClick={() => setBulkEditOpen(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 bg-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={editTab === 'visibility' ? onBulkEditVisibility : onBulkEditCsv}
                  disabled={bulkEditing}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
                >
                  <Edit className="h-4 w-4" />
                  {bulkEditing ? 'Saving…' : 'Apply Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
