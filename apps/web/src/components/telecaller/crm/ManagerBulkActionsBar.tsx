'use client';

import { useEffect, useState } from 'react';
import { Loader2, MessageCircle, UserPlus, X } from 'lucide-react';

type Telecaller = { id: string; full_name: string | null };

type Props = {
  selectedIds: string[];
  telecallers: Telecaller[];
  /** Bulk WhatsApp — only for Lead Manager / Admin (never telecaller) */
  allowBulkWhatsApp: boolean;
  onClear: () => void;
  onDone: () => void;
};

export default function ManagerBulkActionsBar({
  selectedIds,
  telecallers,
  allowBulkWhatsApp,
  onClear,
  onDone,
}: Props) {
  const [bulkTcId, setBulkTcId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [waMode, setWaMode] = useState<'text' | 'template'>('text');
  const [waText, setWaText] = useState('');
  const [waTemplate, setWaTemplate] = useState('');
  const [templates, setTemplates] = useState<Array<{ template_name: string; display_name?: string }>>(
    [],
  );
  const [sendingWa, setSendingWa] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!waOpen || !allowBulkWhatsApp) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/whatsapp/templates');
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        const list = Array.isArray(json?.templates) ? json.templates : [];
        setTemplates(
          list
            .filter((t: any) => t?.is_active !== false)
            .map((t: any) => ({
              template_name: String(t.template_name || ''),
              display_name: t.display_name ? String(t.display_name) : undefined,
            }))
            .filter((t: any) => t.template_name),
        );
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [waOpen, allowBulkWhatsApp]);

  if (!selectedIds.length) return null;

  const runAssign = async (clear = false) => {
    if (!clear && !bulkTcId) {
      setMsg('Pick a telecaller');
      return;
    }
    setAssigning(true);
    setMsg(null);
    try {
      const res = await fetch('/api/lead-manager/bulk-assign-telecaller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_ids: selectedIds,
          telecaller_id: clear ? undefined : bulkTcId,
          clear,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Assign failed');
      setMsg(json?.message || `Updated ${json?.updated || selectedIds.length}`);
      onDone();
      onClear();
    } catch (e: any) {
      setMsg(e?.message || 'Assign failed');
    } finally {
      setAssigning(false);
    }
  };

  const runBulkWa = async () => {
    if (!allowBulkWhatsApp) return;
    if (waMode === 'text' && !waText.trim()) {
      setMsg('Enter message text');
      return;
    }
    if (waMode === 'template' && !waTemplate) {
      setMsg('Pick a template');
      return;
    }
    if (selectedIds.length > 100) {
      setMsg('Max 100 leads per bulk WhatsApp');
      return;
    }
    if (!window.confirm(`Send WhatsApp to up to ${selectedIds.length} leads? DND numbers will be skipped.`)) {
      return;
    }
    setSendingWa(true);
    setMsg(null);
    try {
      const res = await fetch('/api/lead-manager/bulk-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_ids: selectedIds,
          message_type: waMode,
          text: waMode === 'text' ? waText.trim() : undefined,
          template_name: waMode === 'template' ? waTemplate : undefined,
          language_code: 'en',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Bulk WhatsApp failed');
      setMsg(
        `Sent ${json.sent || 0} · DND skipped ${json.dnd_skipped || 0} · Failed ${json.failed || 0}`,
      );
      setWaOpen(false);
      onDone();
    } catch (e: any) {
      setMsg(e?.message || 'Bulk WhatsApp failed');
    } finally {
      setSendingWa(false);
    }
  };

  return (
    <>
      <div className="sticky top-2 z-20 rounded-2xl bg-gradient-to-r from-[#023D95] to-[#004AAD] text-white px-4 py-3 shadow-lg flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold shrink-0">
            {selectedIds.length} selected
          </span>
          {msg ? <span className="text-xs text-blue-100 truncate">{msg}</span> : null}
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
          <select
            className="rounded-lg border-0 bg-white/15 px-3 py-2 text-xs font-semibold text-white min-w-[160px]"
            value={bulkTcId}
            onChange={(e) => setBulkTcId(e.target.value)}
          >
            <option value="" className="text-slate-900">
              Assign telecaller…
            </option>
            {telecallers.map((t) => (
              <option key={t.id} value={t.id} className="text-slate-900">
                {t.full_name || t.id.slice(0, 8)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={assigning}
            onClick={() => void runAssign(false)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#023D95] disabled:opacity-60"
          >
            {assigning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
            Assign
          </button>
          <button
            type="button"
            disabled={assigning}
            onClick={() => void runAssign(true)}
            className="rounded-lg border border-white/40 px-3 py-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-60"
          >
            Unassign
          </button>
          {allowBulkWhatsApp ? (
            <button
              type="button"
              onClick={() => setWaOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-bold text-white"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Bulk WA
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-white/40 px-3 py-2 text-xs font-semibold hover:bg-white/10"
          >
            Clear
          </button>
        </div>
      </div>

      {waOpen && allowBulkWhatsApp ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl max-h-[90vh] overflow-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-[#023D95]">
                Bulk WhatsApp · {selectedIds.length}
              </h3>
              <button type="button" onClick={() => setWaOpen(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Lead Manager / Admin only. Numbers on DND list are skipped automatically.
            </p>
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                onClick={() => setWaMode('text')}
                className={`flex-1 rounded-xl py-2 text-xs font-bold ${
                  waMode === 'text' ? 'bg-[#004AAD] text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Text
              </button>
              <button
                type="button"
                onClick={() => setWaMode('template')}
                className={`flex-1 rounded-xl py-2 text-xs font-bold ${
                  waMode === 'template' ? 'bg-[#004AAD] text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Template
              </button>
            </div>
            {waMode === 'text' ? (
              <textarea
                className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                rows={4}
                placeholder="Message…"
                value={waText}
                onChange={(e) => setWaText(e.target.value)}
              />
            ) : (
              <select
                className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
                value={waTemplate}
                onChange={(e) => setWaTemplate(e.target.value)}
              >
                <option value="">Select template…</option>
                {templates.map((t) => (
                  <option key={t.template_name} value={t.template_name}>
                    {t.display_name || t.template_name}
                  </option>
                ))}
              </select>
            )}
            {msg ? <p className="mb-2 text-xs font-semibold text-slate-600">{msg}</p> : null}
            <button
              type="button"
              disabled={sendingWa}
              onClick={() => void runBulkWa()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {sendingWa ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
              {sendingWa ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
