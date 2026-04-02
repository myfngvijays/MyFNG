'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MessageCircle, RefreshCw, Search, X } from 'lucide-react';

type ChatRow = {
  phone: string;
  last_message_preview: string;
  last_message_at: string | null;
  last_status: string | null;
  last_direction: string | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onOpenChat: (phone: string, preview?: string) => void;
  title?: string;
  refreshSignal?: number;
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

type FilterTab = 'all' | 'unread' | 'read';
type ModeTab = 'assigned' | 'unassigned';

export default function WhatsAppChatListModal({ isOpen, onClose, onOpenChat, title, refreshSignal }: Props) {
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [mode, setMode] = useState<ModeTab>('assigned');
  const [unassignedRows, setUnassignedRows] = useState<ChatRow[]>([]);
  const [unassignedLoading, setUnassignedLoading] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const prevRefreshRef = useRef(refreshSignal);

  const debouncedSearch = useMemo(() => search.trim(), [search]);

  const activeRows = mode === 'unassigned' ? unassignedRows : rows;

  const filteredRows = useMemo(() => {
    if (filter === 'all') return activeRows;
    if (filter === 'unread') return activeRows.filter((r) => (r.last_direction || '').toUpperCase() === 'INBOUND');
    return activeRows.filter((r) => (r.last_direction || '').toUpperCase() !== 'INBOUND');
  }, [activeRows, filter]);

  const unreadCount = useMemo(() => activeRows.filter((r) => (r.last_direction || '').toUpperCase() === 'INBOUND').length, [activeRows]);

  const fetchChats = useCallback(async (fetchMode: ModeTab, searchText: string, signal?: AbortSignal) => {
    const params = new URLSearchParams({ limit: '250', scan: '50000', mode: fetchMode });
    if (searchText) params.set('search', searchText);
    const res = await fetch(`/api/whatsapp/chats?${params.toString()}`, { cache: 'no-store', signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to load chats');
    return Array.isArray(data?.chats) ? data.chats : [];
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const chats = await fetchChats('assigned', debouncedSearch);
        if (cancelled) return;
        setRows(chats);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [isOpen, debouncedSearch, fetchChats]);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen, debouncedSearch, fetchChats]);

  useEffect(() => {
    if (refreshSignal != null && prevRefreshRef.current != null && refreshSignal !== prevRefreshRef.current && isOpen) {
      setHasNewMessages(true);
      const refreshAll = async () => {
        try {
          const [assigned, unassigned] = await Promise.all([
            fetchChats('assigned', debouncedSearch),
            fetchChats('unassigned', debouncedSearch),
          ]);
          setRows(assigned);
          setUnassignedRows(unassigned);
        } catch { /* ignore */ }
      };
      void refreshAll();
      const t = setTimeout(() => setHasNewMessages(false), 3000);
      prevRefreshRef.current = refreshSignal;
      return () => clearTimeout(t);
    }
    prevRefreshRef.current = refreshSignal;
  }, [refreshSignal, isOpen, debouncedSearch, fetchChats]);

  const unassignedInboundCount = useMemo(
    () => unassignedRows.filter((r) => (r.last_direction || '').toUpperCase() === 'INBOUND').length,
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

          <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
            <button
              type="button"
              onClick={() => setMode('assigned')}
              className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                mode === 'assigned' ? 'bg-white text-[#075e54] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Assigned
            </button>
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
          </div>

          <div className="flex gap-1.5">
            {([['all', 'All'], ['unread', 'Unread'], ['read', 'Read']] as const).map(([key, label]) => (
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
                {key === 'unread' && unreadCount > 0 && (
                  <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#25D366] px-1 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
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
          ) : activeRows.length === 0 && !debouncedSearch ? (
            <div className="px-4 py-10 text-center text-sm text-gray-500">
              {mode === 'unassigned' ? 'No unassigned chats found.' : 'No assigned chats found for this employee.'}
            </div>
          ) : filteredRows.length === 0 && filter !== 'all' ? (
            <div className="px-4 py-10 text-center text-sm text-gray-500">
              No {filter} chats.
            </div>
          ) : (
            <>
              {filteredRows.map((chat) => {
                const isUnread = (chat.last_direction || '').toUpperCase() === 'INBOUND';
                return (
                  <button
                    key={chat.phone}
                    type="button"
                    className={`w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50 ${isUnread ? 'bg-[#25D366]/[0.04]' : ''}`}
                    onClick={() => onOpenChat(chat.phone, chat.last_message_preview)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        {isUnread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#25D366]" />}
                        <div className="min-w-0">
                          <p className={`truncate text-sm ${isUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-900'}`}>{formatPhone(chat.phone)}</p>
                          <p className={`mt-0.5 truncate text-xs ${isUnread ? 'font-medium text-gray-800' : 'text-gray-600'}`}>{chat.last_message_preview || 'No preview'}</p>
                        </div>
                      </div>
                      <span className="shrink-0 text-[10px] text-gray-500">{formatTime(chat.last_message_at)}</span>
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
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366]/10">
                      <MessageCircle className="h-5 w-5 text-[#25D366]" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#075e54]">
                        Start new chat with {formatPhone(debouncedSearch)}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Send a WhatsApp message to this number
                      </p>
                    </div>
                  </div>
                </button>
              ) : null}
              {filteredRows.length === 0 && debouncedSearch && debouncedSearch.replace(/\D/g, '').length < 10 ? (
                <div className="px-4 py-10 text-center text-sm text-gray-500">
                  No chats found. Enter a full phone number to start a new chat.
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
