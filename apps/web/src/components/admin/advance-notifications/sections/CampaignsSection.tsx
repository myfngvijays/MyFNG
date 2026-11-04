'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Loader2, Pencil, RefreshCw, Send, XCircle, MousePointerClick, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { campaignCategory, type CampaignCategory } from '@/lib/push/campaignCategory';

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
  payload?: { title?: string; message?: string; category?: string };
  variant_b?: { title?: string; message?: string } | null;
};

function shortWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function statusTone(status: string) {
  if (status === 'sent') return 'bg-emerald-50 text-emerald-700';
  if (status === 'scheduled') return 'bg-blue-50 text-blue-700';
  if (status === 'failed') return 'bg-rose-50 text-rose-700';
  if (status === 'cancelled') return 'bg-gray-100 text-gray-500';
  return 'bg-amber-50 text-amber-800';
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PushCampaignsSection() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [editWhen, setEditWhen] = useState('');
  const [editTitleB, setEditTitleB] = useState('');
  const [editMessageB, setEditMessageB] = useState('');
  const [tab, setTab] = useState<'all' | CampaignCategory>('all');

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

  const patch = async (body: Record<string, unknown>, success: string) => {
    const id = String(body.id || '');
    setBusyId(id);
    try {
      const res = await fetch('/api/super_admin/notifications/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Request failed');
        return;
      }
      toast.success(success);
      setEditingId(null);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (id: string) => {
    if (!confirm('Cancel this scheduled campaign?')) return;
    await patch({ id, action: 'cancel' }, 'Campaign cancelled');
  };

  const sendNow = async (campaign: Campaign) => {
    const title = campaign.payload?.title || campaign.name || 'this campaign';
    if (!confirm(`Send "${title}" right now?`)) return;
    await patch({ id: campaign.id, action: 'send_now' }, 'Campaign sent');
  };

  const startEdit = (campaign: Campaign) => {
    setEditingId(campaign.id);
    setEditTitle(campaign.payload?.title || campaign.name || '');
    setEditMessage(campaign.payload?.message || '');
    setEditWhen(toLocalInput(campaign.scheduled_at));
    setEditTitleB(campaign.variant_b?.title || '');
    setEditMessageB(campaign.variant_b?.message || '');
  };

  const saveEdit = async (campaign: Campaign) => {
    if (!editTitle.trim() || !editMessage.trim()) {
      toast.error('Title and message are required');
      return;
    }
    if (!editWhen) {
      toast.error('Pick a schedule time');
      return;
    }
    await patch(
      {
        id: campaign.id,
        action: 'update',
        name: editTitle.trim(),
        title: editTitle.trim(),
        message: editMessage.trim(),
        scheduled_at: new Date(editWhen).toISOString(),
        variant_b: campaign.ab_enabled
          ? { title: editTitleB.trim(), message: editMessageB.trim() }
          : undefined,
      },
      'Campaign updated',
    );
  };

  const overdueCount = campaigns.filter(
    (c) => c.status === 'scheduled' && new Date(c.scheduled_at).getTime() < Date.now(),
  ).length;

  return (
    <div>
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-blue-600" />
              Campaigns
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Pick a group. New campaigns ask for Festival or Normal when you schedule them.
            </p>
          </div>
          <button type="button" onClick={() => void load()} className="push-btn-secondary inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            { id: 'all' as const, label: 'All', count: campaigns.length },
            { id: 'festival' as const, label: 'Festival', count: campaigns.filter((c) => campaignCategory(c) === 'festival').length },
            { id: 'normal' as const, label: 'Normal', count: campaigns.filter((c) => campaignCategory(c) === 'normal').length },
          ]).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold border ${
                tab === item.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {item.label}
              <span className={`text-[11px] ${tab === item.id ? 'text-blue-100' : 'text-gray-400'}`}>{item.count}</span>
            </button>
          ))}
        </div>
      </div>

      {missingTable ? (
        <div className="push-card p-4 mb-4 text-sm text-amber-800 bg-amber-50">
          Campaign table is missing. Run database/294_push_campaigns_segments_schedule.sql
        </div>
      ) : null}

      {overdueCount > 0 ? (
        <div className="push-card p-4 mb-4 text-sm text-amber-900 bg-amber-50 border border-amber-200">
          {overdueCount} campaign{overdueCount === 1 ? '' : 's'} passed their time and stayed Scheduled.
          The 5-minute sender never called them, so they were not delivered. Use <strong>Send now</strong> or{' '}
          <strong>Edit</strong> the time. Automatic send only covers campaigns due in the last 6 hours.
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 items-stretch">
          {campaigns.filter((c) => tab === 'all' || campaignCategory(c) === tab).map((c) => {
            const category = campaignCategory(c);
            const sent =
              c.result?.sent ??
              (Number(c.result?.a?.sent || 0) + Number(c.result?.b?.sent || 0) || undefined);
            const overdue = c.status === 'scheduled' && new Date(c.scheduled_at).getTime() < Date.now();
            const editing = editingId === c.id;
            const busy = busyId === c.id;
            return (
              <div key={c.id} className={`push-card p-3 h-full flex flex-col ${editing ? 'md:col-span-2' : ''}`}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="font-semibold text-sm text-gray-900 truncate min-w-0">
                        {c.name || c.payload?.title || 'Campaign'}
                      </h3>
                      <span className={`ml-auto shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${statusTone(c.status)}`}>
                        {c.status}
                      </span>
                      {overdue ? (
                        <span className="shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                          Late
                        </span>
                      ) : null}
                      {c.ab_enabled ? (
                        <span className="shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
                          A/B
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1 min-h-[1rem]">
                      {editing ? '' : c.payload?.message || '—'}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1.5 truncate">
                      {shortWhen(c.scheduled_at)}
                      {c.sent_at ? ` → ${shortWhen(c.sent_at)}` : ''}
                    </p>
                    {c.error_message ? <p className="text-[11px] text-red-600 mt-1 line-clamp-1">{c.error_message}</p> : null}
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-600">
                      <span className="font-semibold text-gray-800">{sent != null ? sent : '—'} delivered</span>
                      <span className="inline-flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {c.engagement?.opens ?? 0}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MousePointerClick className="w-3 h-3" /> {c.engagement?.clicks ?? 0}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        className="ml-auto text-[11px] font-semibold text-blue-700 hover:underline disabled:opacity-50"
                        onClick={() =>
                          void patch(
                            {
                              id: c.id,
                              action: 'set_category',
                              category: category === 'festival' ? 'normal' : 'festival',
                            },
                            category === 'festival' ? 'Moved to Normal' : 'Moved to Festival',
                          )
                        }
                      >
                        {category === 'festival' ? 'Move to Normal' : 'Move to Festival'}
                      </button>
                    </div>
                  </div>
                  {c.status === 'scheduled' && !editing ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => startEdit(c)}
                        className="push-btn-secondary inline-flex items-center gap-1"
                      >
                        <Pencil className="w-4 h-4" /> Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void sendNow(c)}
                        className="push-btn-primary inline-flex items-center gap-1"
                      >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Send now
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void cancel(c.id)}
                        className="push-btn-ghost inline-flex items-center gap-1 text-red-600"
                      >
                        <XCircle className="w-4 h-4" /> Cancel
                      </button>
                    </div>
                  ) : null}
                </div>

                {editing ? (
                  <div className="mt-4 grid gap-3 max-w-xl">
                    <label className="block text-xs font-semibold text-gray-600">
                      Title
                      <input
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                      />
                    </label>
                    <label className="block text-xs font-semibold text-gray-600">
                      Message
                      <textarea
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                        rows={3}
                        value={editMessage}
                        onChange={(e) => setEditMessage(e.target.value)}
                      />
                    </label>
                    <label className="block text-xs font-semibold text-gray-600">
                      Schedule
                      <input
                        type="datetime-local"
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                        value={editWhen}
                        onChange={(e) => setEditWhen(e.target.value)}
                      />
                    </label>
                    {c.ab_enabled ? (
                      <>
                        <label className="block text-xs font-semibold text-gray-600">
                          Variant B title
                          <input
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                            value={editTitleB}
                            onChange={(e) => setEditTitleB(e.target.value)}
                          />
                        </label>
                        <label className="block text-xs font-semibold text-gray-600">
                          Variant B message
                          <textarea
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                            rows={2}
                            value={editMessageB}
                            onChange={(e) => setEditMessageB(e.target.value)}
                          />
                        </label>
                      </>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void saveEdit(c)}
                        className="push-btn-primary inline-flex items-center gap-1"
                      >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Save
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setEditingId(null)}
                        className="push-btn-secondary"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
