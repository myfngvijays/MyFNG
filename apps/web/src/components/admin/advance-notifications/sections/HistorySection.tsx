'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { Clock, Loader2, RefreshCw, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { PUSH_ROLE_OPTIONS, type PushLogEntry } from '@/lib/push/push-admin-constants';

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

function statusLabel(log: PushLogEntry) {
  if (log.status === 'SENT') return `${log.meta?.devices || 0} delivered`;
  if (log.status === 'PARTIAL') return `${log.meta?.devices || 0} delivered (partial)`;
  if (log.status === 'FCM_FAILED') return 'FCM failed';
  if (log.status === 'NO_DEVICES') return 'No devices';
  return log.status;
}

function audienceLabel(log: PushLogEntry) {
  if (log.meta?.batch_id || log.meta?.notification_type === 'WALLET_CREDIT') {
    return 'Wallet bulk credit';
  }
  const role = PUSH_ROLE_OPTIONS.find((r) => r.value === log.recipient);
  return role?.label || log.recipient;
}

export default function PushHistorySection() {
  const [logs, setLogs] = useState<PushLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 25;

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      });
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (roleFilter !== 'ALL') params.set('role', roleFilter);
      if (search.trim()) params.set('q', search.trim());

      const res = await fetch(`/api/super_admin/notifications/history?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs || []);
        setTotal(Number(data.total || 0));
      } else {
        setLogs([]);
        setTotal(0);
        toast.error(data.error || data.details || 'Failed to load notification history');
      }
    } finally {
      setLoading(false);
    }
  }, [offset, roleFilter, search, statusFilter]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Notification History</h2>
          <p className="text-sm text-gray-500 mt-1">Audit log of all admin push broadcasts with delivery status</p>
        </div>
        <button
          type="button"
          onClick={() => void fetchLogs()}
          className="push-btn-secondary inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="push-card p-4 mb-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
              placeholder="Search title, message, role…"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setOffset(0);
            }}
            className="px-3 py-2.5 rounded-lg border text-sm bg-white"
          >
            <option value="ALL">All statuses</option>
            <option value="SENT">Sent</option>
            <option value="PARTIAL">Partial</option>
            <option value="FCM_FAILED">FCM failed</option>
            <option value="NO_DEVICES">No devices</option>
          </select>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setOffset(0);
            }}
            className="px-3 py-2.5 rounded-lg border text-sm bg-white"
          >
            <option value="ALL">All roles</option>
            {PUSH_ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : logs.length === 0 ? (
        <div className="push-card p-12 text-center">
          <h3 className="font-semibold text-gray-900">No notifications yet</h3>
          <p className="text-sm text-gray-500 mt-1">Send your first push from Send Notification tab.</p>
        </div>
      ) : (
        <div className="push-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#f7f3ec]">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Notification</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Audience</th>
                <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Sent</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const expanded = expandedId === log.id;
                return (
                  <Fragment key={log.id}>
                    <tr
                      className="border-t border-[#e6e0da] hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedId(expanded ? null : log.id)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#15110d] truncate max-w-xs">
                          {log.meta?.title || log.message.split(']')[0]?.replace('[', '')}
                        </p>
                        <p className="text-xs text-[#72665e] line-clamp-1 mt-0.5">{log.meta?.body || log.message}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-[#72665e]">
                        {audienceLabel(log)}
                        {log.meta?.target_phone ? (
                          <span className="block text-xs">📱 {log.meta.target_phone}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-[#72665e]">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(log.sent_at)}
                        </span>
                        {log.meta?.sent_by ? (
                          <span className="block text-xs mt-0.5">by {log.meta.sent_by}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                            log.status === 'SENT'
                              ? 'bg-emerald-100 text-emerald-700'
                              : log.status === 'PARTIAL'
                                ? 'bg-amber-100 text-amber-800'
                              : log.status === 'FCM_FAILED'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {statusLabel(log)}
                        </span>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="border-t border-[#e6e0da] bg-[#faf9f7]">
                        <td colSpan={4} className="px-4 py-3 text-xs text-[#72665e] space-y-1">
                          <p>
                            <strong>Priority:</strong> {log.meta?.priority || 'default'}
                          </p>
                          <p>
                            <strong>Attempted:</strong> {log.meta?.devices_attempted ?? '—'} ·{' '}
                            <strong>Delivered:</strong> {log.meta?.devices ?? 0}
                          </p>
                          {(log.meta?.fcm_errors || []).length > 0 ? (
                            <p className="text-rose-700">
                              <strong>FCM errors:</strong> {(log.meta?.fcm_errors || []).join(' · ')}
                            </p>
                          ) : null}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          <div className="px-4 py-3 border-t border-[#e6e0da] flex items-center justify-between text-xs text-[#72665e]">
            <span>
              Showing {offset + 1}–{Math.min(offset + logs.length, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                className="px-3 py-1.5 rounded border disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
                className="px-3 py-1.5 rounded border disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
