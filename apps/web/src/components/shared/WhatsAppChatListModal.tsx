'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MessageCircle, RefreshCw, Search, X } from 'lucide-react';
import { isWhatsAppSessionWindowClosed } from '@/lib/whatsapp/sessionWindow';

type ChatRow = {
  phone: string;
  last_message_preview: string;
  last_message_at: string | null;
  last_status: string | null;
  last_direction: string | null;
  last_inbound_at?: string | null;
  unread_count?: number | null;
  customer_name?: string | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onOpenChat: (phone: string, preview?: string) => void;
  title?: string;
  refreshSignal?: number;
  /** Telecallers only see assigned leads; hide the unassigned pool tab. */
  hideLeadPool?: boolean;
};

function formatPhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return phone || '—';
}

function formatTime(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

type FilterTab = 'open' | 'awaiting' | 'closed' | 'all' | 'unread' | 'read';
type ModeTab = 'assigned' | 'unassigned';

const CLOSED_KEY = 'myfng:wa-closed-chats-v1';

function normalizePhoneLocal(phone: string): string {
  const d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  const last10 = d.slice(-10);
  if (last10.length === 10) return `91${last10}`;
  return d.startsWith('91') ? d : `91${d}`;
}

function loadClosedPhonesModal(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(CLOSED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.map((p: string) => normalizePhoneLocal(String(p))) : []);
  } catch {
    return new Set();
  }
}

function isInboxClosedModal(chat: ChatRow, closedPhones: Set<string>): boolean {
  const phone = normalizePhoneLocal(chat.phone);
  if (phone && closedPhones.has(phone)) return true;
  return isWhatsAppSessionWindowClosed(chat);
}

export default function WhatsAppChatListModal({ isOpen, onClose, onOpenChat, title, refreshSignal, hideLeadPool = false }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [filter, setFilter] = useState<FilterTab>('open');
  const [mode, setMode] = useState<ModeTab>('assigned');
  const [unassignedRows, setUnassignedRows] = useState<ChatRow[]>([]);
  const [unassignedLoading, setUnassignedLoading] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [closedPhones, setClosedPhones] = useState<Set<string>>(() => new Set());
  const prevRefreshRef = useRef(refreshSignal);

  useEffect(() => {
    setClosedPhones(loadClosedPhonesModal());
  }, []);

  const debouncedSearch = useMemo(() => search.trim(), [search]);

  const activeRows = mode === 'unassigned' ? unassignedRows : rows;

  const filteredRows = useMemo(() => {
    return activeRows.filter((r) => {
      const closed = isInboxClosedModal(r, closedPhones);
      const awaiting = String(r.last_direction || '').toUpperCase() === 'INBOUND';
      const unreadN =
        typeof r.unread_count === 'number' && Number.isFinite(r.unread_count)
          ? r.unread_count
          : awaiting
            ? 1
            : 0;

      if (filter === 'closed') return closed;
      if (filter === 'open') return !closed && !awaiting;
      if (filter === 'awaiting') return !closed && awaiting;
      if (filter === 'unread') return !closed && unreadN > 0;
      if (filter === 'read') return !closed && unreadN <= 0;
      return !closed;
    });
  }, [activeRows, filter, closedPhones]);

  const inboxCounts = useMemo(() => {
    let open = 0;
    let awaiting = 0;
    let closed = 0;
    for (const r of activeRows) {
      if (isInboxClosedModal(r, closedPhones)) {
        closed += 1;
        continue;
      }
      if (String(r.last_direction || '').toUpperCase() === 'INBOUND') awaiting += 1;
      else open += 1;
    }
    return { open, awaiting, closed };
  }, [activeRows, closedPhones]);

  const unreadCount = useMemo(
    () =>
      activeRows.filter((r) => {
        if (isInboxClosedModal(r, closedPhones)) return false;
        const n =
          typeof r.unread_count === 'number' && Number.isFinite(r.unread_count)
            ? r.unread_count
            : (r.last_direction || '').toUpperCase() === 'INBOUND'
              ? 1
              : 0;
        return n > 0;
      }).length,
    [activeRows, closedPhones],
  );

  const fetchChats = useCallback(async (fetchMode: ModeTab, searchText: string, signal?: AbortSignal) => {
    const params = new URLSearchParams({ limit: '120', scan: '500', mode: fetchMode });
    if (searchText) params.set('search', searchText);
    const res = await fetch(`/api/whatsapp/chats?${params.toString()}`, { cache: 'no-store', signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to load chats');
    return Array.isArray(data?.chats) ? (data.chats as ChatRow[]) : [];
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 12000);
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const chats = await fetchChats('assigned', debouncedSearch, ac.signal);
        if (cancelled) return;
        setRows(chats);
      } catch (e: any) {
        if (cancelled) return;
        setRows([]);
        if (e?.name === 'AbortError') setLoadError('Timed out — try Refresh');
        else setLoadError(e?.message || 'Could not load chats');
      } finally {
        clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      ac.abort();
    };
  }, [isOpen, debouncedSearch, fetchChats]);

  useEffect(() => {
    if (!isOpen || hideLeadPool) {
      setUnassignedRows([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setUnassignedLoading(true);
      try {
        const chats = await fetchChats('unassigned', debouncedSearch);
        if (cancelled) return;
        setUnassignedRows(chats);
      } catch {
        if (!cancelled) setUnassignedRows([]);
      } finally {
        if (!cancelled) setUnassignedLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [isOpen, debouncedSearch, fetchChats, hideLeadPool]);

  useEffect(() => {
    if (refreshSignal != null && prevRefreshRef.current != null && refreshSignal !== prevRefreshRef.current && isOpen) {
      setHasNewMessages(true);
      const refreshAll = async () => {
        try {
          const assigned = await fetchChats('assigned', debouncedSearch);
          setRows(assigned);
          if (!hideLeadPool) {
            const unassigned = await fetchChats('unassigned', debouncedSearch);
            setUnassignedRows(unassigned);
          }
        } catch { /* ignore */ }
      };
      void refreshAll();
      const t = setTimeout(() => setHasNewMessages(false), 3000);
      prevRefreshRef.current = refreshSignal;
      return () => clearTimeout(t);
    }
    prevRefreshRef.current = refreshSignal;
  }, [refreshSignal, isOpen, debouncedSearch, fetchChats, hideLeadPool]);

  const unassignedInboundCount = useMemo(
    () =>
      unassignedRows.filter((r) => {
        const n =
          typeof r.unread_count === 'number' && Number.isFinite(r.unread_count)
            ? r.unread_count
            : (r.last_direction || '').toUpperCase() === 'INBOUND'
              ? 1
              : 0;
        return n > 0;
      }).length,
    [unassignedRows]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[6900] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-black/10 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-black/10 bg-[#075e54] px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            <p className="text-sm font-semibold">{title || 'WhatsApp Chats'}</p>
          </div>
          <button type="button" className="rounded-md p-1 hover:bg-white/10" onClick={onClose} aria-label="Close chats list">
            <X className="h-4 w-4" />
          </button>
        </div>

        {hasNewMessages && (
          <div className="flex items-center justify-center gap-1.5 bg-[#25D366] px-3 py-1.5 text-xs font-medium text-white animate-pulse">
            <RefreshCw className="h-3 w-3 animate-spin" />
            New message received
          </div>
        )}

        <div className="border-b border-black/10 p-3 space-y-2">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-2">
            <Search className="h-4 w-4 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by phone..."
              className="w-full bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
            />
          </div>

          <div className={`flex gap-1 rounded-lg bg-gray-100 p-0.5 ${hideLeadPool ? 'hidden' : ''}`}>
            <button
              type="button"
              onClick={() => setMode('assigned')}
              className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                mode === 'assigned' ? 'bg-white text-[#075e54] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Assigned
            </button>
            {!hideLeadPool ? (
            <button
              type="button"
              onClick={() => setMode('unassigned')}
              className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                mode === 'unassigned' ? 'bg-white text-[#075e54] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Unassigned
              {unassignedInboundCount > 0 && (
                <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
                  {unassignedInboundCount}
                </span>
              )}
            </button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['open', 'Open', inboxCounts.open],
                ['awaiting', 'Awaiting', inboxCounts.awaiting],
                ['closed', 'Closed', inboxCounts.closed],
                ['unread', 'Unread', unreadCount],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filter === key
                    ? 'bg-[#075e54] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
                {count > 0 ? (
                  <span
                    className={`ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                      filter === key ? 'bg-white/20 text-white' : 'bg-[#25D366] text-white'
                    }`}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {(mode === 'assigned' ? loading : unassignedLoading) ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading {mode === 'unassigned' ? 'unassigned' : ''} chats...
            </div>
          ) : loadError && mode === 'assigned' ? (
            <div className="px-4 py-10 text-center text-sm text-red-600">
              <p className="font-semibold">{loadError}</p>
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#075e54] px-3 py-1.5 text-xs font-bold text-white"
                onClick={() => {
                  setSearch((s) => s);
                  setLoadError(null);
                  setLoading(true);
                  void fetchChats('assigned', debouncedSearch)
                    .then((chats) => setRows(chats))
                    .catch((e: any) => setLoadError(e?.message || 'Failed'))
                    .finally(() => setLoading(false));
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </button>
            </div>
          ) : activeRows.length === 0 && !debouncedSearch ? (
            <div className="px-4 py-10 text-center text-sm text-gray-500">
              {mode === 'unassigned' ? 'No unassigned chats found.' : 'No assigned leads / chats yet.'}
            </div>
          ) : filteredRows.length === 0 && filter !== 'all' ? (
            <div className="px-4 py-10 text-center text-sm text-gray-500">
              No {filter} chats.
            </div>
          ) : (
            <>
              {filteredRows.map((chat) => {
                const unreadCount = Math.max(
                  0,
                  typeof chat.unread_count === 'number' && Number.isFinite(chat.unread_count)
                    ? chat.unread_count
                    : (chat.last_direction || '').toUpperCase() === 'INBOUND'
                      ? 1
                      : 0,
                );
                const isUnread = unreadCount > 0;
                const titleLine = String(chat.customer_name || '').trim() || formatPhone(chat.phone);
                const subLine = chat.customer_name
                  ? `${formatPhone(chat.phone)} · ${chat.last_message_preview || 'No preview'}`
                  : chat.last_message_preview || 'No preview';
                return (
                  <button
                    key={chat.phone}
                    type="button"
                    className={`w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50 ${isUnread ? 'bg-[#25D366]/[0.04]' : ''}`}
                    onClick={() => {
                      const phone = String(chat.phone || '');
                      void fetch('/api/whatsapp/chats/read', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone }),
                      }).catch(() => {
                        /* ignore */
                      });
                      onOpenChat(chat.phone, chat.last_message_preview);
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`truncate text-sm ${isUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-900'}`}>
                            {titleLine}
                          </p>
                          <span
                            className={`shrink-0 text-[11px] font-medium ${isUnread ? 'text-[#25D366]' : 'text-gray-500'}`}
                          >
                            {formatTime(chat.last_message_at)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <p className={`min-w-0 flex-1 truncate text-xs ${isUnread ? 'font-medium text-gray-800' : 'text-gray-600'}`}>
                            {subLine}
                          </p>
                          {isUnread ? (
                            <span className="inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[#25D366] px-1.5 text-[11px] font-bold leading-none text-white">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {debouncedSearch && debouncedSearch.replace(/\D/g, '').length >= 10 && !filteredRows.some((r) => r.phone.includes(debouncedSearch.replace(/\D/g, ''))) ? (
                <button
                  type="button"
                  className="w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-green-50"
                  onClick={() => {
                    const digits = debouncedSearch.replace(/\D/g, '');
                    const normalized = digits.startsWith('91') ? digits : `91${digits}`;
                    onOpenChat(normalized);
                  }}
                >
                  <p className="text-sm font-semibold text-[#075e54]">Open chat with {formatPhone(debouncedSearch.replace(/\D/g, ''))}</p>
                  <p className="mt-0.5 text-xs text-gray-500">Not in your assigned list</p>
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
