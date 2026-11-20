'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Brain, Loader2, X } from 'lucide-react';
import CallRecordingPlayer from '@/components/telecaller/CallRecordingPlayer';
import DeepAiCallResult, { type DeepAiCallResultHit } from '@/components/admin/DeepAiCallResult';

type CallRow = {
  id: string;
  created_at?: string | null;
  call_status?: string | null;
  call_duration?: number | null;
  has_call_recording?: boolean;
  analysis?: DeepAiCallResultHit | null;
};

export default function LeadRecordingBrain({
  leadId,
  open,
  onClose,
}: {
  leadId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [calls, setCalls] = useState<CallRow[]>([]);

  useEffect(() => {
    if (!open || !leadId) return;
    let cancelled = false;
    setLoading(true);
    void fetch(`/api/telecaller/calls/${encodeURIComponent(leadId)}`, {
      credentials: 'include',
      cache: 'no-store',
    })
      .then((res) => res.json().catch(() => ({})))
      .then((json) => {
        if (cancelled) return;
        const rows = Array.isArray(json?.call_logs) ? json.call_logs : [];
        setCalls(
          rows.map((row: CallRow) => ({
            id: String(row.id || ''),
            created_at: row.created_at,
            call_status: row.call_status,
            call_duration: row.call_duration,
            has_call_recording: Boolean(row.has_call_recording),
            analysis: row.analysis || null,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setCalls([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, leadId]);

  if (!open || typeof document === 'undefined') return null;

  const recorded = calls.filter((row) => row.has_call_recording || row.analysis);

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div className="flex max-h-[min(88vh,820px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h3 className="flex items-center gap-2 text-base font-black text-[#023D95]">
            <Brain className="h-5 w-5 text-orange-700" />
            Lead recording
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : recorded.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
              <Brain className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-bold text-slate-800">Recording abhi nahi hai</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                Jab is lead ki call recording aayegi, yahan wahi analysis dikhega — player, score, summary, problem aur coaching.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {recorded.map((row) => (
                <div key={row.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <p className="mb-2 text-xs font-bold text-slate-500">
                    {row.created_at
                      ? new Date(row.created_at).toLocaleString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })
                      : 'Call'}
                    {row.call_status ? ` · ${row.call_status}` : ''}
                  </p>
                  {row.has_call_recording ? (
                    <CallRecordingPlayer
                      callLogId={row.id}
                      hasRecording
                      durationSeconds={row.call_duration != null ? Number(row.call_duration) : null}
                      open
                    />
                  ) : null}
                  {row.analysis ? (
                    <DeepAiCallResult hit={row.analysis} />
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">
                      Recording hai. Analysis save hote hi score, summary aur coaching yahan dikhega.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
