'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { GripVertical, Loader2, Pencil, Plus, CircleDot, Trash2, Check, X } from 'lucide-react';

export type StatusRow = {
  id: string;
  code: string;
  name: string;
  color: string;
  sort_order?: number;
  is_system?: boolean;
  is_active?: boolean;
  requires_follow_up?: boolean;
  requires_lost_reason?: boolean;
  stage_group?: 'active' | 'won' | 'lost' | string;
};

type LostReasonRow = {
  id: string;
  name: string;
  sort_order?: number;
  is_active?: boolean;
};

const COLORS = [
  '#DDD6FE',
  '#BFDBFE',
  '#FECACA',
  '#BBF7D0',
  '#FED7AA',
  '#FBCFE8',
  '#A5F3FC',
  '#FEF08A',
  '#C7D2FE',
  '#99F6E4',
  '#FDE68A',
  '#E9D5FF',
];

type Props = {
  title?: string;
  subtitle?: string;
  helpSlot?: React.ReactNode;
};

function StageChevron({ label }: { label: string }) {
  return (
    <div className="relative mb-3 flex h-10 items-center justify-center overflow-hidden rounded-md bg-[#E8F5E9] text-sm font-bold text-[#1B5E20]">
      <span className="relative z-[1]">{label}</span>
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-[#E8F5E9]"
        style={{
          clipPath: 'polygon(0 0, 100% 50%, 0 100%)',
          transform: 'translateX(40%)',
        }}
      />
    </div>
  );
}

export default function LeadStatusesManager({
  title = 'Lead status',
  subtitle = 'TeleCRM-style stages — Active / Closed. Lost reasons alag manage.',
  helpSlot,
}: Props) {
  const [statuses, setStatuses] = useState<StatusRow[]>([]);
  const [lostReasons, setLostReasons] = useState<LostReasonRow[]>([]);
  const [maxLost, setMaxLost] = useState(25);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addGroup, setAddGroup] = useState<'active' | 'won' | 'lost'>('active');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(COLORS[0]);

  const [lostAddOpen, setLostAddOpen] = useState(false);
  const [lostName, setLostName] = useState('');
  const [editingLostId, setEditingLostId] = useState<string | null>(null);
  const [editLostName, setEditLostName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/lead-manager/statuses?all=1');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setStatuses(Array.isArray(json?.statuses) ? json.statuses : []);
      setLostReasons(Array.isArray(json?.lost_reasons) ? json.lost_reasons : []);
      if (json?.max_lost_reasons) setMaxLost(Number(json.max_lost_reasons) || 25);
      setWarning(json?.warning ? String(json.warning) : null);
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeStatuses = useMemo(
    () =>
      statuses.filter(
        (s) =>
          s.is_active !== false &&
          (s.stage_group || 'active') === 'active' &&
          String(s.code).toUpperCase() !== 'LOST' &&
          String(s.code).toUpperCase() !== 'SERVICE_DONE',
      ),
    [statuses],
  );
  const wonStatuses = useMemo(
    () =>
      statuses.filter(
        (s) =>
          s.is_active !== false &&
          ((s.stage_group || '') === 'won' || String(s.code).toUpperCase() === 'SERVICE_DONE'),
      ),
    [statuses],
  );
  const lostStatuses = useMemo(
    () =>
      statuses.filter(
        (s) =>
          s.is_active !== false &&
          ((s.stage_group || '') === 'lost' || String(s.code).toUpperCase() === 'LOST'),
      ),
    [statuses],
  );
  const inactiveStatuses = useMemo(
    () => statuses.filter((s) => s.is_active === false),
    [statuses],
  );

  const createStatus = async () => {
    if (!addName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/lead-manager/statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_status',
          name: addName.trim(),
          stage_group: addGroup,
          requires_lost_reason: addGroup === 'lost',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Create failed');
      setAddName('');
      setAddOpen(false);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (s: StatusRow) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditColor(s.color || COLORS[0]);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/lead-manager/statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_status',
          id: editingId,
          name: editName.trim(),
          color: editColor,
        }),
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

  const removeStatus = async (s: StatusRow) => {
    const msg = s.is_system
      ? `"${s.name}" system status hai — delete pe hide/deactivate ho jayega. Continue?`
      : `Delete status "${s.name}"?`;
    if (!confirm(msg)) return;
    setSaving(true);
    try {
      const res = await fetch('/api/lead-manager/statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_status', id: s.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Delete failed');
      if (editingId === s.id) setEditingId(null);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  const reactivate = async (s: StatusRow) => {
    setSaving(true);
    try {
      const res = await fetch('/api/lead-manager/statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_status', id: s.id, is_active: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed');
      await load();
    } catch (e: any) {
      alert(e?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const createLost = async () => {
    if (!lostName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/lead-manager/statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_lost_reason', name: lostName.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Create failed');
      setLostName('');
      setLostAddOpen(false);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const saveLostEdit = async () => {
    if (!editingLostId || !editLostName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/lead-manager/statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_lost_reason',
          id: editingLostId,
          name: editLostName.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Update failed');
      setEditingLostId(null);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const removeLost = async (r: LostReasonRow) => {
    if (!confirm(`Delete lost reason "${r.name}"?`)) return;
    setSaving(true);
    try {
      const res = await fetch('/api/lead-manager/statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_lost_reason', id: r.id }),
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

  const renderStatusRow = (s: StatusRow) => {
    if (editingId === s.id) {
      return (
        <li key={s.id} className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setEditColor(c)}
                className={`h-6 w-6 rounded ring-2 ${editColor === c ? 'ring-[#004AAD]' : 'ring-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <input
            className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void saveEdit()}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving || !editName.trim()}
              onClick={() => void saveEdit()}
              className="inline-flex items-center gap-1 rounded-md bg-[#004AAD] px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> Save
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-bold"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          </div>
        </li>
      );
    }

    return (
      <li
        key={s.id}
        className="flex items-center gap-2 rounded-lg px-2.5 py-2.5 text-sm font-semibold text-slate-800"
        style={{ backgroundColor: s.color || '#E5E7EB' }}
      >
        <GripVertical className="h-4 w-4 shrink-0 text-slate-500/70" aria-hidden />
        <span className="min-w-0 flex-1 truncate">
          {s.name}
          {String(s.code || '').toUpperCase() === 'FRESH' ? (
            <span className="ml-1.5 text-[10px] font-normal text-slate-500">(default)</span>
          ) : null}
        </span>
        <button
          type="button"
          onClick={() => startEdit(s)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/70 text-slate-700 hover:bg-white"
          title="Edit"
          aria-label={`Edit ${s.name}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void removeStatus(s)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/70 text-rose-600 hover:bg-white disabled:opacity-50"
          title="Delete"
          aria-label={`Delete ${s.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-4">
      <div>
        <h1 className="text-2xl font-black text-[#023D95] flex items-center gap-2">
          <CircleDot className="h-6 w-6" /> {title}
          {helpSlot}
        </h1>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>

      {warning && !/database\/|\.sql/i.test(warning) ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {warning}
        </p>
      ) : null}
      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

      {loading ? (
        <div className="flex justify-center py-16 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Active stage */}
          <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
            <StageChevron label="Active stage" />
            <button
              type="button"
              onClick={() => {
                setAddGroup('active');
                setAddOpen(true);
              }}
              className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
            {addOpen && addGroup === 'active' ? (
              <div className="mb-3 flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Status name"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void createStatus()}
                  autoFocus
                />
                <button
                  type="button"
                  disabled={saving || !addName.trim()}
                  onClick={() => void createStatus()}
                  className="rounded-lg bg-[#004AAD] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="rounded-lg border px-3 py-2 text-sm font-bold"
                >
                  Cancel
                </button>
              </div>
            ) : null}
            <ul className="space-y-2">{activeStatuses.map(renderStatusRow)}</ul>
          </section>

          {/* Closed stage */}
          <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm space-y-4">
            <StageChevron label="Closed stage" />

            {/* Won */}
            <div className="rounded-lg border-2 border-emerald-300 overflow-hidden">
              <div className="bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">Won</div>
              <div className="bg-white p-2 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setAddGroup('won');
                    setAddOpen(true);
                  }}
                  className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-emerald-300 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
                {addOpen && addGroup === 'won' ? (
                  <div className="flex gap-2">
                    <input
                      className="flex-1 rounded-md border px-2 py-1.5 text-sm"
                      placeholder="Won status"
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void createStatus()}
                      autoFocus
                    />
                    <button
                      type="button"
                      disabled={saving || !addName.trim()}
                      onClick={() => void createStatus()}
                      className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white"
                    >
                      Save
                    </button>
                  </div>
                ) : null}
                <ul className="space-y-2">{wonStatuses.map(renderStatusRow)}</ul>
              </div>
            </div>

            {/* Lost */}
            <div className="rounded-lg border-2 border-rose-300 overflow-hidden">
              <div className="bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800">Lost</div>
              <div className="bg-white p-2 space-y-3">
                <ul className="space-y-2">{lostStatuses.map(renderStatusRow)}</ul>

                <div className="border-t border-slate-100 pt-2">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-600">
                      Reason for Lost leads ({lostReasons.length}/{maxLost})
                    </p>
                    <button
                      type="button"
                      onClick={() => setLostAddOpen(true)}
                      disabled={lostReasons.length >= maxLost}
                      className="text-xs font-bold text-[#2563EB] hover:underline disabled:opacity-40"
                    >
                      + Add
                    </button>
                  </div>
                  {lostAddOpen ? (
                    <div className="mb-2 flex gap-2">
                      <input
                        className="flex-1 rounded-md border px-2 py-1.5 text-sm"
                        placeholder="Lost reason"
                        value={lostName}
                        onChange={(e) => setLostName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && void createLost()}
                        autoFocus
                      />
                      <button
                        type="button"
                        disabled={saving || !lostName.trim()}
                        onClick={() => void createLost()}
                        className="rounded-md bg-[#004AAD] px-2.5 py-1.5 text-xs font-bold text-white"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setLostAddOpen(false)}
                        className="rounded-md border px-2 py-1.5 text-xs font-bold"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : null}
                  <ul className="divide-y divide-slate-100 rounded-md border border-slate-100">
                    {lostReasons.map((r) =>
                      editingLostId === r.id ? (
                        <li key={r.id} className="flex gap-2 p-2 bg-blue-50/40">
                          <input
                            className="min-w-0 flex-1 rounded border px-2 py-1 text-sm"
                            value={editLostName}
                            onChange={(e) => setEditLostName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && void saveLostEdit()}
                          />
                          <button
                            type="button"
                            onClick={() => void saveLostEdit()}
                            className="rounded bg-[#004AAD] px-2 py-1 text-xs font-bold text-white"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingLostId(null)}
                            className="rounded border px-2 py-1 text-xs font-bold"
                          >
                            Cancel
                          </button>
                        </li>
                      ) : (
                        <li key={r.id} className="flex items-center gap-2 px-2 py-2 text-sm">
                          <GripVertical className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                          <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
                            {r.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingLostId(r.id);
                              setEditLostName(r.name);
                            }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-600 hover:bg-slate-100"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeLost(r)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded text-rose-600 hover:bg-rose-50"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ),
                    )}
                    {lostReasons.length === 0 ? (
                      <li className="px-3 py-4 text-center text-xs text-slate-400">
                        No lost reasons yet
                      </li>
                    ) : null}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {inactiveStatuses.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            Hidden / deactivated
          </p>
          <ul className="space-y-2">
            {inactiveStatuses.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm border border-slate-100"
              >
                <span className="font-semibold text-slate-600">{s.name}</span>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void reactivate(s)}
                  className="text-xs font-bold text-[#004AAD] hover:underline"
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
