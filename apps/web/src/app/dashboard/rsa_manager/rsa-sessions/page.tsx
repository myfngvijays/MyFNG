'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';

type SessionRow = {
  id: string;
  aansh_id: number;
  user_id: string;
  assignee_role: string;
  expires_at: string;
  user_name?: string | null;
  user_email?: string | null;
};

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-IN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export default function RSAManagerAanshSessionsPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState('');

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super_admin/sarv-aansh-sessions');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load sessions');
      setSessions(Array.isArray(json?.sessions) ? json.sessions : []);
    } catch (e: any) {
      alert(e?.message || 'Failed to load sessions');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const removeSession = async (sessionId: string) => {
    if (!sessionId) return;
    if (!confirm('Is session ko manually release karna hai?')) return;
    setRemovingId(sessionId);
    try {
      const res = await fetch('/api/super_admin/sarv-aansh-sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to remove session');
      await loadSessions();
    } catch (e: any) {
      alert(e?.message || 'Failed to remove session');
    } finally {
      setRemovingId('');
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  return (
    <DashboardLayout role="rsa_manager">
      <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6 space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Active Aansh Sessions</h1>
          <p className="text-sm text-gray-600 mt-1">
            Sabhi claimed Aansh sessions yahan se view aur manual remove kar sakte ho.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-2 pr-3">Aansh ID</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Expires</th>
                  <th className="py-2 pr-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="py-3 text-gray-500" colSpan={5}>Loading...</td>
                  </tr>
                ) : sessions.length === 0 ? (
                  <tr>
                    <td className="py-3 text-gray-500" colSpan={5}>No active sessions.</td>
                  </tr>
                ) : (
                  sessions.map((s) => (
                    <tr key={s.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-3 font-semibold">{s.aansh_id}</td>
                      <td className="py-2 pr-3">{s.assignee_role}</td>
                      <td className="py-2 pr-3">{s.user_name || s.user_email || s.user_id}</td>
                      <td className="py-2 pr-3">{formatDateTime(s.expires_at)}</td>
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          className="text-red-600 hover:text-red-700 font-semibold disabled:text-gray-400"
                          onClick={() => removeSession(s.id)}
                          disabled={removingId === s.id}
                        >
                          {removingId === s.id ? 'Removing...' : 'Remove'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <button type="button" className="mt-3 btn btn-outline text-sm" onClick={loadSessions}>
            Refresh
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
