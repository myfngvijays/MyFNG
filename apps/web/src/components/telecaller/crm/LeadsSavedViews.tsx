'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export type CrmLeadsViewSnapshot = {
  kind: 'crm_leads';
  v: 1;
  filter: string;
  lostReason: string;
  city: string;
  priority: string;
  q: string;
  datePreset: string;
  dateField: 'created' | 'modified';
  customStart: string;
  customEnd: string;
  telecallerId: string;
  unassignedOnly: boolean;
  source: string;
  coupon: string;
  trigger: string;
  /** "+ Add condition" filters (serialized JSON); missing on older views. */
  conditions?: string;
  advIncomplete: boolean;
  advFollowUp: boolean;
  advHasVehicle: boolean;
  advHasRecording: boolean;
  advHasCoupon: boolean;
  advNoAssignee: boolean;
  advHasPhone: boolean;
  advOverdueReminder: boolean;
};

type SavedViewRow = {
  id: string;
  name: string;
  owner_id: string;
  is_shared: boolean;
  filters: CrmLeadsViewSnapshot;
};

function asView(raw: unknown): CrmLeadsViewSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  if (src.kind !== 'crm_leads') return null;
  return {
    kind: 'crm_leads',
    v: 1,
    filter: String(src.filter || 'all'),
    lostReason: String(src.lostReason || ''),
    city: String(src.city || ''),
    priority: String(src.priority || ''),
    q: String(src.q || ''),
    datePreset: String(src.datePreset || 'all_time'),
    dateField: src.dateField === 'modified' ? 'modified' : 'created',
    customStart: String(src.customStart || ''),
    customEnd: String(src.customEnd || ''),
    telecallerId: String(src.telecallerId || ''),
    unassignedOnly: Boolean(src.unassignedOnly),
    source: String(src.source || 'ALL'),
    coupon: String(src.coupon || 'ALL'),
    trigger: String(src.trigger || ''),
    advIncomplete: Boolean(src.advIncomplete),
    advFollowUp: Boolean(src.advFollowUp),
    advHasVehicle: Boolean(src.advHasVehicle),
    advHasRecording: Boolean(src.advHasRecording),
    advHasCoupon: Boolean(src.advHasCoupon),
    advNoAssignee: Boolean(src.advNoAssignee),
    advHasPhone: Boolean(src.advHasPhone),
    advOverdueReminder: Boolean(src.advOverdueReminder),
  };
}

export default function LeadsSavedViews({
  snapshot,
  onApply,
  onHeader = false,
}: {
  snapshot: CrmLeadsViewSnapshot;
  onApply: (next: CrmLeadsViewSnapshot) => void;
  onHeader?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState<SavedViewRow[]>([]);
  const [me, setMe] = useState('');
  const [canShare, setCanShare] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [share, setShare] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/lead-manager/saved-views', { credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not load views');
      const rows = (Array.isArray(json.views) ? json.views : [])
        .map((row: any) => {
          const filters = asView(row?.filters);
          if (!filters) return null;
          return {
            id: String(row.id),
            name: String(row.name || 'View'),
            owner_id: String(row.owner_id || ''),
            is_shared: Boolean(row.is_shared),
            filters,
          } as SavedViewRow;
        })
        .filter(Boolean) as SavedViewRow[];
      setViews(rows);
      setMe(String(json.me || ''));
      setCanShare(Boolean(json.can_share));
    } catch (err: any) {
      toast.error(err?.message || 'Could not load saved views');
      setViews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const save = async () => {
    const label = name.trim();
    if (!label) {
      toast.error('View ka naam likho');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/lead-manager/saved-views', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedId || undefined,
          name: label,
          is_shared: share,
          filters: snapshot,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not save view');
      toast.success('View save ho gaya');
      setSelectedId(String(json?.view?.id || selectedId || ''));
      setName('');
      window.dispatchEvent(new CustomEvent('myfng:crm-views-changed'));
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Could not save view');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/lead-manager/saved-views?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not delete view');
      if (selectedId === id) setSelectedId(null);
      setViews((prev) => prev.filter((row) => row.id !== id));
      window.dispatchEvent(new CustomEvent('myfng:crm-views-changed'));
    } catch (err: any) {
      toast.error(err?.message || 'Could not delete view');
    }
  };

  const selected = views.find((row) => row.id === selectedId);

  return (
    <div className="flex flex-nowrap items-center gap-1.5">
      <input
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (selected && e.target.value.trim() !== selected.name) setSelectedId(null);
        }}
        placeholder="Save view"
        className={
          onHeader
            ? 'h-7 w-48 rounded-md border border-white/25 bg-[#003580] px-2.5 text-xs font-semibold text-white placeholder:text-white/60 focus:border-white/50 focus:outline-none'
            : 'h-8 w-48 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:border-[#004AAD] focus:outline-none'
        }
      />
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className={
          onHeader
            ? 'inline-flex h-7 items-center gap-1 rounded-md bg-white px-2.5 text-xs font-bold text-[#004AAD] disabled:opacity-60'
            : 'inline-flex h-8 items-center gap-1 rounded-lg bg-[#004AAD] px-2.5 text-xs font-bold text-white disabled:opacity-60'
        }
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        Save
      </button>
      {canShare ? (
        <label className={`inline-flex items-center gap-1.5 text-xs font-semibold ${onHeader ? 'text-white/90' : 'text-sm text-slate-700'}`}>
          <input
            type="checkbox"
            className="rounded border-slate-300"
            checked={share}
            onChange={(e) => setShare(e.target.checked)}
          />
          Share
        </label>
      ) : null}
    </div>
  );
}
