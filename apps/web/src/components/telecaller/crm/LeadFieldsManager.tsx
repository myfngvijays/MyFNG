'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, ClipboardList, Loader2, Lock, Pencil, Plus, Trash2, X } from 'lucide-react';

/** Original Bookings columns. Locked. */
const ORIGINAL_FIELDS = [
  'Lead Status',
  'Lead #',
  'Customer',
  'Message',
  'Leads #',
  'Vehicle',
  'City',
  'Service',
  'Discount',
  'Amount',
  'Date',
  'Time',
  'Status',
  'Source',
  'Assignee',
  'Phone',
  'UTM Campaign',
  'Lead Type',
  'Priority',
  'Created From',
  'Email',
  'Address',
  'Pickup Required',
  'Make',
  'Model',
  'Variant',
  'Year',
  'Fuel Type',
  'Odometer',
  'Service Type',
  'Preferred Date',
  'Preferred Time',
  'Preferred Slot',
  'Problem',
  'Notes',
  'UTM Source',
  'UTM Medium',
  'UTM Term',
  'UTM Content',
  'Estimated Amt',
  'Actual Amt',
  'Payment Mode',
  'Payment Status',
];

/** Added from the TeleCRM header list. Same lock, separate so they can be filtered. */
const NEW_FIELDS = [
  'Lost Reason',
  'Rating',
  'Assignee emailid',
  'User Notes Count',
  'Package',
  'Workshop',
  'Next Followup Date',
  'Alternate Phone',
  'LEADTAG',
  'packagerateaccess',
  'PickupAddress',
  'LeadNumber',
  'Review Pending',
  'Service Done',
  'Repeat Customer',
  'REGDATE',
  'FEEDBACK',
  'FOLLOWUP',
  'USERNAME',
  'esttracking',
  'billtracking',
  'custEstimateAction',
  'shortAddress',
  'custplandetailslink',
  'pendingbillslink',
  'Lead Assignee',
  'Remark Cordinator',
  'servicecenterinvoicelink',
  'alternate car no',
  'Send Workshop Address',
  'authotpforwebsitelogin',
  'Disposition',
  'Pincode',
  'DailerID',
  'Recording URL',
  'InterestedDate',
  'LoanAmount',
  'Membership Amount',
  'Created On',
  'Modified On',
  'Assignee Manager name',
  'Assignee Manager emailid',
  'Coupon',
  'Admin Bookings Count',
];

type FieldRow = { id: string; name: string };

function FieldNameGrid({
  title,
  names,
  query,
  isNew = false,
}: {
  title: string;
  names: string[];
  query: string;
  isNew?: boolean;
}) {
  const q = query.trim().toLowerCase();
  const shown = q ? names.filter((name) => name.toLowerCase().includes(q)) : names;
  if (!shown.length) return null;
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">{title}</p>
      <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {shown.map((label) => (
          <li
            key={label}
            className="flex min-w-0 items-center gap-1.5 truncate rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600"
          >
            <span className="min-w-0 truncate">{label}</span>
            {isNew ? (
              <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-700">
                New
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LeadFieldsManager({
  title = 'Lead fields',
  helpSlot,
}: {
  title?: string;
  helpSlot?: React.ReactNode;
}) {
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [listFilter, setListFilter] = useState<'all' | 'original' | 'new'>('all');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/lead-manager/fields');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setFields(Array.isArray(json?.fields) ? json.fields : []);
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/lead-manager/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_field', name: name.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Create failed');
      setName('');
      await load();
    } catch (e: any) {
      alert(e?.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/lead-manager/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_field', id: editingId, name: editName.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Update failed');
      setEditingId(null);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (field: FieldRow) => {
    if (!confirm(`Delete field "${field.name}"?`)) return;
    setSaving(true);
    try {
      const res = await fetch('/api/lead-manager/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_field', id: field.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Delete failed');
      await load();
    } catch (e: any) {
      alert(e?.message || 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black text-[#023D95]">
          <ClipboardList className="h-6 w-6" /> {title}
          {helpSlot}
        </h1>
        <p className="text-sm text-slate-500">
          Built-in columns stay as they are. Extra fields you add here show on the lead and in Bookings columns.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Add field</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Field name e.g. Campaign code"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void create()}
          />
          <button
            type="button"
            disabled={saving || !name.trim()}
            onClick={() => void create()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#004AAD] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </button>
        </div>
      </div>

      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
          Extra fields ({fields.length})
        </p>
        {loading ? (
          <div className="flex justify-center py-8 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : fields.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Abhi koi extra field nahi. Upar se add karo.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {fields.map((field) =>
              editingId === field.id ? (
                <li key={field.id} className="flex gap-2 rounded-xl border border-blue-200 bg-blue-50/40 px-3 py-2">
                  <input
                    className="min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-sm"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void saveEdit()}
                  />
                  <button type="button" onClick={() => void saveEdit()} className="rounded-lg bg-[#004AAD] px-2 text-white">
                    <Check className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border px-2">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ) : (
                <li key={field.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
                  <span className="min-w-0 truncate text-sm font-bold text-slate-800">{field.name}</span>
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(field.id);
                        setEditName(field.name);
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-slate-600"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(field)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </li>
              ),
            )}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            <Lock className="h-3.5 w-3.5" /> Panel fields ({ORIGINAL_FIELDS.length + NEW_FIELDS.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['all', `All ${ORIGINAL_FIELDS.length + NEW_FIELDS.length}`],
                ['original', `Original ${ORIGINAL_FIELDS.length}`],
                ['new', `New ${NEW_FIELDS.length}`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setListFilter(id)}
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  listFilter === id ? 'bg-[#004AAD] text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <input
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          placeholder="Search field name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {listFilter !== 'new' ? (
          <FieldNameGrid title={`Original (${ORIGINAL_FIELDS.length})`} names={ORIGINAL_FIELDS} query={query} />
        ) : null}
        {listFilter !== 'original' ? (
          <FieldNameGrid title={`New (${NEW_FIELDS.length})`} names={NEW_FIELDS} query={query} isNew />
        ) : null}
      </section>
    </div>
  );
}
