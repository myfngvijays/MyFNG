'use client';

import React, { useEffect, useState } from 'react';
import {
  Bell,
  Send,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  History,
  Smartphone,
} from 'lucide-react';
import toast from 'react-hot-toast';

const ROLE_OPTIONS = [
  { value: 'ALL', label: 'All Users', description: 'Send to everyone (customers + staff)' },
  { value: 'CUSTOMER', label: 'Customers', description: 'All mobile app customers' },
  { value: 'SUPER_ADMIN', label: 'Super Admin', description: 'Super admin users' },
  { value: 'SUB_ADMIN', label: 'Sub Admin', description: 'Sub admin users' },
  { value: 'TELECALLER', label: 'Telecaller', description: 'Telecaller agents' },
  { value: 'WORKSHOP_ADMIN', label: 'Workshop Owner', description: 'Workshop owners/admins' },
  { value: 'WORKSHOP_SUPERVISOR', label: 'Workshop Adviser', description: 'Workshop advisers/supervisors' },
  { value: 'WORKSHOP_MECHANIC', label: 'Workshop Mechanic', description: 'Workshop mechanics' },
  { value: 'PICKUP_BOY', label: 'Pickup Boy', description: 'Pickup/delivery drivers' },
  { value: 'LEAD_MANAGER', label: 'Lead Manager', description: 'Lead managers' },
];

type LogEntry = {
  id: string;
  recipient: string;
  message: string;
  status: string;
  sent_at: string;
  meta?: {
    title?: string;
    body?: string;
    target_role?: string;
    sent_by?: string;
    devices?: number;
    priority?: string;
  };
};

export default function SendNotificationPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetRole, setTargetRole] = useState('ALL');
  const [priority, setPriority] = useState<'default' | 'high'>('default');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; sent?: number; error?: string } | null>(null);
  const [history, setHistory] = useState<LogEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await fetch('/api/super_admin/notifications/history');
      const data = await res.json();
      if (data.logs) setHistory(data.logs);
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required');
      return;
    }

    const role = ROLE_OPTIONS.find((r) => r.value === targetRole);
    if (!confirm(`Send notification to "${role?.label}"?\n\nTitle: ${title}\nMessage: ${message}\nPriority: ${priority === 'high' ? 'High' : 'Normal'}`)) {
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const res = await fetch('/api/super_admin/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          target_role: targetRole,
          priority,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({ success: false, error: data.error || 'Failed to send' });
        toast.error(data.error || 'Failed to send notification');
      } else {
        setResult({ success: true, sent: data.sent });
        toast.success(`Notification sent to ${data.sent} device(s)`);
        setTitle('');
        setMessage('');
        fetchHistory();
      }
    } catch (err: any) {
      setResult({ success: false, error: err?.message || 'Network error' });
      toast.error('Network error. Try again.');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (iso: string) => {
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
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
          <Bell className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Send Notification</h1>
          <p className="text-sm text-gray-600">Broadcast push notifications to users by role (iOS + Android)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Compose */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-600" />
            Compose
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Diwali Mega Service Sale"
                maxLength={100}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">{title.length}/100</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write the notification body..."
                maxLength={500}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">{message.length}/500</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Users className="w-4 h-4 inline mr-1" />
                Target Audience
              </label>
              <select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} — {opt.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setPriority('default')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border-2 transition ${
                    priority === 'default'
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  Normal
                </button>
                <button
                  onClick={() => setPriority('high')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border-2 transition ${
                    priority === 'high'
                      ? 'bg-red-50 border-red-500 text-red-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  High (urgent)
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                High priority shows even on locked screens; use sparingly.
              </p>
            </div>

            <button
              onClick={handleSend}
              disabled={sending || !title.trim() || !message.trim()}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Send Notification
                </>
              )}
            </button>

            {result && (
              <div
                className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                  result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}
              >
                {result.success ? (
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  {result.success ? (
                    <p>Sent to <strong>{result.sent}</strong> device(s) successfully.</p>
                  ) : (
                    <p>{result.error}</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg text-xs text-blue-800">
              <Smartphone className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                Sends to all <strong>iOS + Android</strong> devices that have the MyFNG mobile app installed and have
                granted notification permission.
              </div>
            </div>
          </div>
        </div>

        {/* Right: History */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              History
            </h2>
            <button
              onClick={fetchHistory}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Refresh
            </button>
          </div>

          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">
              No notifications sent yet.
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {history.map((log) => {
                const role = ROLE_OPTIONS.find((r) => r.value === log.recipient);
                return (
                  <div
                    key={log.id}
                    className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-gray-900 truncate">
                          {log.meta?.title || log.message.split(']')[0].replace('[', '')}
                        </p>
                        <p className="text-xs text-gray-600 line-clamp-2 mt-1">
                          {log.meta?.body || log.message}
                        </p>
                      </div>
                      <span
                        className={`flex-shrink-0 text-xs font-bold px-2 py-1 rounded-full ${
                          log.status === 'SENT'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {log.status === 'SENT' ? `${log.meta?.devices || 0} sent` : 'No devices'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {role?.label || log.recipient}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(log.sent_at)}
                      </span>
                      {log.meta?.priority === 'high' && (
                        <span className="text-red-600 font-bold">HIGH</span>
                      )}
                      {log.meta?.sent_by && (
                        <span className="ml-auto truncate">by {log.meta.sent_by}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
