'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Headset, Loader2, X } from 'lucide-react';

const AANSH_SESSION_KEY = 'myfng:aansh_session';
const AANSH_SKIP_KEY = 'myfng:aansh_optional_skip';

type AanshItem = { aansh_id: number; system_name: string | null };
type AanshSession = { session_token: string; aansh_id: number; expires_at: string };

function getStoredSession(): AanshSession | null {
  try {
    const raw = localStorage.getItem(AANSH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AanshSession;
    if (!parsed?.session_token || parsed?.aansh_id == null) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setStoredSession(session: AanshSession | null) {
  if (!session) {
    localStorage.removeItem(AANSH_SESSION_KEY);
    return;
  }
  localStorage.setItem(AANSH_SESSION_KEY, JSON.stringify(session));
}

export default function TelecallerAanshBar({
  onSessionChange,
  onClaimed,
}: {
  onSessionChange?: (session: AanshSession | null) => void;
  onClaimed?: () => void;
} = {}) {
  const [session, setSession] = useState<AanshSession | null>(null);
  const [available, setAvailable] = useState<AanshItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshAvailable = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sarv-aansh/session/available');
      const data = await res.json().catch(() => ({}));
      setAvailable(Array.isArray(data.available) ? data.available : []);
      if (data.currentSession?.session_token) {
        const next = {
          session_token: String(data.currentSession.session_token),
          aansh_id: Number(data.currentSession.aansh_id),
          expires_at: String(data.currentSession.expires_at || ''),
        };
        setSession(next);
        setStoredSession(next);
        onSessionChange?.(next);
      }
    } catch (e) {
      console.error('Aansh available failed', e);
    } finally {
      setLoading(false);
    }
  }, [onSessionChange]);

  useEffect(() => {
    const stored = getStoredSession();
    if (stored) {
      setSession(stored);
      onSessionChange?.(stored);
    }
    void refreshAvailable();
  }, [refreshAvailable, onSessionChange]);

  useEffect(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (!session?.session_token) return;

    const beat = async () => {
      try {
        await fetch('/api/sarv-aansh/session/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_token: session.session_token }),
        });
      } catch (e) {
        console.error('Aansh heartbeat failed', e);
      }
    };
    void beat();
    heartbeatRef.current = setInterval(beat, 60_000);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [session?.session_token]);

  const claim = async (aanshId: number) => {
    setClaiming(true);
    try {
      const res = await fetch('/api/sarv-aansh/session/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aansh_id: aanshId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to claim dialer');
      const next = {
        session_token: String(data.session_token),
        aansh_id: Number(data.aansh_id),
        expires_at: String(data.expires_at || ''),
      };
      setSession(next);
      setStoredSession(next);
      localStorage.removeItem(AANSH_SKIP_KEY);
      onSessionChange?.(next);
      try {
        await fetch('/api/telecaller/crm/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'punch_in', notes: `Aansh ${aanshId}` }),
        });
      } catch {
        /* optional */
      }
      onClaimed?.();
      setModalOpen(false);
      setAvailable((prev) => prev.filter((i) => i.aansh_id !== aanshId));
    } catch (e: any) {
      alert(e?.message || 'Failed to claim dialer');
    } finally {
      setClaiming(false);
    }
  };

  const release = async () => {
    if (!session?.session_token) return;
    try {
      await fetch('/api/sarv-aansh/session/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: session.session_token }),
      });
    } catch {
      /* ignore */
    }
    setSession(null);
    setStoredSession(null);
    onSessionChange?.(null);
    await refreshAvailable();
  };

  const skip = () => {
    localStorage.setItem(AANSH_SKIP_KEY, '1');
    setModalOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void refreshAvailable();
          setModalOpen(true);
        }}
        className={`w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold border shadow-sm transition ${
          session
            ? 'bg-[#004AAD] text-white border-[#004AAD]'
            : 'bg-white text-[#004AAD] border-[#004AAD]/4a'
        }`}
      >
        <Headset className="w-4 h-4 shrink-0" />
        <span className="flex-1 text-left truncate">
          {session ? `Aansh ${session.aansh_id}` : 'Select Aansh Dialer'}
        </span>
        <ChevronDown className="w-4 h-4 shrink-0" />
      </button>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="font-bold text-[#023D95]">SARV Aansh Dialer</div>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="px-4 pt-3 text-xs text-slate-500">
              Claim a dialer ID for outbound calls. Keep this session active while calling.
            </p>

            <div className="px-4 py-3 overflow-y-auto flex-1 space-y-3">
              {session ? (
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Current session</div>
                  <div className="text-lg font-extrabold text-[#004AAD]">Aansh {session.aansh_id}</div>
                  <button
                    type="button"
                    onClick={() => void release()}
                    className="mt-2 text-xs font-bold text-rose-600"
                  >
                    Release Dialer
                  </button>
                </div>
              ) : null}

              {loading ? (
                <div className="flex justify-center py-8 text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : available.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">
                  No free Aansh IDs available right now.
                </p>
              ) : (
                available.map((item) => (
                  <button
                    key={item.aansh_id}
                    type="button"
                    disabled={claiming}
                    onClick={() => void claim(item.aansh_id)}
                    className="w-full flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3 hover:bg-slate-50 disabled:opacity-60"
                  >
                    <div className="text-left">
                      <div className="text-sm font-bold text-slate-800">
                        {item.system_name || `Aansh ${item.aansh_id}`}
                      </div>
                      <div className="text-xs text-slate-500">ID: {item.aansh_id}</div>
                    </div>
                    <span className="text-xs font-bold text-[#004AAD]">
                      {claiming ? '...' : 'Claim'}
                    </span>
                  </button>
                ))
              )}
            </div>

            {!session ? (
              <button
                type="button"
                onClick={skip}
                className="px-4 py-3 text-sm font-semibold text-slate-500 border-t"
              >
                Skip for now
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
