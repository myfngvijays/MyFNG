'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Loader2, RefreshCw, XCircle, MousePointerClick, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

type Campaign = {
  id: string;
  name: string;
  status: string;
  scheduled_at: string;
  sent_at?: string | null;
  ab_enabled?: boolean;
  error_message?: string | null;
  result?: { sent?: number; a?: { sent?: number }; b?: { sent?: number } };
  engagement?: { opens: number; clicks: number };
  payload?: { title?: string; message?: string };
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function PushCampaignsSection() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super_admin/notifications/campaigns');
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed to load campaigns');
        return;
      }
      setMissingTable(Boolean(json.missing_table));
      setCampaigns(json.campaigns || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cancel = async (id: string) => {
    if (!confirm('Cancel this scheduled campaign?')) return;
    const res = await fetch('/api/super_admin/notifications/campaigns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'cancel' }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || 'Cancel failed');
      return;
    }
    toast.success('Campaign cancelled');
    void load();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-blue-600" />
            Campaigns
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Scheduled sends, A/B tests, and open/click engagement
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="push-btn-secondary inline-flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {missingTable ? (
        <div className="push-card p-4 text-sm text-amber-800 bg-amber-50 border border-amber-200">
          Run <code className="font-mono text-xs">database/294_push_campaigns_segments_schedule.sql</code> to enable
          campaigns.
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center min-h-[30vh] text-gray-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading campaigns…
        </div>
      ) : campaigns.length === 0 ? (
        <div className="push-card p-8 text-center text-sm text-gray-500">
          No campaigns yet. Use <strong>Send</strong> or <strong>Advanced Send</strong> and choose “Schedule for later”
          or enable A/B.
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const sent =
              c.result?.sent ??
              (Number(c.result?.a?.sent || 0) + Number(c.result?.b?.sent || 0) || undefined);
            return (
              <div key={c.id} className="push-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-gray-900 truncate">{c.name || c.payload?.title || 'Campaign'}</h3>
                      <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                        {c.status}
                      </span>
                      {c.ab_enabled ? (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                          A/B
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Scheduled: {formatDate(c.scheduled_at)}
                      {c.sent_at ? ` · Sent: ${formatDate(c.sent_at)}` : ''}
                      {sent != null ? ` · Delivered: ${sent}` : ''}
                    </p>
                    {c.payload?.message ? (
                      <p className="text-sm text-gray-700 mt-2 line-clamp-2">{c.payload.message}</p>
                    ) : null}
                    {c.error_message ? (
                      <p className="text-xs text-red-600 mt-2">{c.error_message}</p>
                    ) : null}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" /> {c.engagement?.opens ?? 0} opens
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MousePointerClick className="w-3.5 h-3.5" /> {c.engagement?.clicks ?? 0} clicks
                      </span>
                    </div>
                  </div>
                  {c.status === 'scheduled' ? (
                    <button
                      type="button"
                      onClick={() => void cancel(c.id)}
                      className="push-btn-ghost inline-flex items-center gap-1 text-red-600"
                    >
                      <XCircle className="w-4 h-4" /> Cancel
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
