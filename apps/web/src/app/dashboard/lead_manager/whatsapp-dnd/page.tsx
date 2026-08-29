'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import PageHelpIcon from '@/components/PageHelpIcon';
import { Loader2, Plus, ShieldOff, Trash2 } from 'lucide-react';

type DndRow = {
  id: string;
  phone_e164: string;
  phone_last10: string;
  reason: string | null;
  source: string;
  created_at: string;
};

export default function LeadManagerWhatsAppDndPage() {
  const [rows, setRows] = useState<DndRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/lead-manager/whatsapp-dnd?${params}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setRows(json.numbers || []);
      setWarning(json.warning || null);
    } catch (e: any) {
      setMsg(e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/lead-manager/whatsapp-dnd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, reason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Add failed');
      setPhone('');
      setReason('');
      setMsg('Added to DND');
      await load();
    } catch (e: any) {
      setMsg(e?.message || 'Add failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Remove from DND?')) return;
    const res = await fetch(`/api/lead-manager/whatsapp-dnd?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setMsg(json?.error || 'Delete failed');
      return;
    }
    await load();
  };

  return (
    <DashboardLayout role="LEAD_MANAGER">
      <div className="mx-auto w-full min-w-0 max-w-3xl space-y-4">
        <div>
          <h1 className="text-2xl font-black text-[#023D95] flex items-center gap-2">
            <ShieldOff className="h-6 w-6" /> WhatsApp DND
            <PageHelpIcon href="/dashboard/lead_manager/whatsapp-dnd" label="WA DND" />
          </h1>
          <p className="text-sm text-slate-500">
            Opt-out list — bulk WhatsApp skips these numbers automatically.
          </p>
        </div>

        {warning ? (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            {warning}
          </p>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Phone (10 digit)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <button
            type="button"
            disabled={saving || !phone.trim()}
            onClick={() => void add()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#004AAD] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add to DND
          </button>
          {msg ? <p className="text-xs font-semibold text-slate-600">{msg}</p> : null}
        </div>

        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Search phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void load()}
          />
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold"
          >
            Search
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-10">No DND numbers yet</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">{r.phone_last10}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {r.reason || r.source} ·{' '}
                    {new Date(r.created_at).toLocaleString('en-IN')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void remove(r.id)}
                  className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardLayout>
  );
}
