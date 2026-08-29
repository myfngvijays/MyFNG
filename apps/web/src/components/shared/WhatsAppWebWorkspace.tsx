'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, MessageCircle, Moon, RefreshCw, Search, Sun, X } from 'lucide-react';
import WhatsAppMobilePreviewModal from '@/components/shared/WhatsAppMobilePreviewModal';
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
  assigned_telecaller_id?: string | null;
  assigned_telecaller_name?: string | null;
};

type PeerRow = { id: string; full_name?: string | null; phone?: string | null };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  initialPhone?: string;
  initialPreview?: string;
  hideLeadPool?: boolean;
  /** Lead Manager / admin: show assignee filter dropdown */
  showAssigneeFilter?: boolean;
  refreshSignal?: number;
  title?: string;
};

export type WaTheme = 'light' | 'dark';

const THEME_KEY = 'myfng:wa-workspace-theme-v2';
const READ_KEY = 'myfng:wa-chat-reads-v1';
const CLOSED_KEY = 'myfng:wa-closed-chats-v1';

type InboxTab = 'open' | 'awaiting' | 'closed';

function loadClosedPhones(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(CLOSED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.map((p: string) => normalizePhone(String(p))) : []);
  } catch {
    return new Set();
  }
}

function saveClosedPhones(phones: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CLOSED_KEY, JSON.stringify(Array.from(phones).slice(0, 800)));
  } catch {
    /* ignore */
  }
}

function isAwaitingReply(chat: ChatRow): boolean {
  return String(chat.last_direction || '').toUpperCase() === 'INBOUND';
}

/** Closed tab = WhatsApp 24h window closed (template-only), or manually archived. */
function isInboxClosed(chat: ChatRow, closedPhones: Set<string>): boolean {
  const phone = normalizePhone(chat.phone);
  if (phone && closedPhones.has(phone)) return true;
  return isWhatsAppSessionWindowClosed(chat);
}

function formatPhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
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

function normalizePhone(phone: string): string {
  const d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  const last10 = d.slice(-10);
  if (last10.length === 10) return `91${last10}`;
  return d.startsWith('91') ? d : `91${d}`;
}

function loadLocalReads(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(READ_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveLocalRead(phone: string, atIso?: string) {
  if (typeof window === 'undefined' || !phone) return;
  try {
    const map = loadLocalReads();
    map[phone] = atIso || new Date().toISOString();
    // Cap map size
    const entries = Object.entries(map).sort((a, b) => String(b[1]).localeCompare(String(a[1])));
    const trimmed = Object.fromEntries(entries.slice(0, 500));
    localStorage.setItem(READ_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
}

/** Prefer explicit unread_count (including 0). Only fall back to last_direction when unset. */
function resolveUnreadCount(chat: ChatRow): number {
  if (typeof chat.unread_count === 'number' && Number.isFinite(chat.unread_count)) {
    return Math.max(0, chat.unread_count);
  }
  return (chat.last_direction || '').toUpperCase() === 'INBOUND' ? 1 : 0;
}

/** Clear unread for chats already opened, until a newer inbound arrives. */
function applyLocalReads(chats: ChatRow[]): ChatRow[] {
  const reads = loadLocalReads();
  return chats.map((chat) => {
    const phone = normalizePhone(chat.phone);
    const readAt = reads[phone];
    if (!readAt) return chat;
    const lastMs = chat.last_message_at ? new Date(chat.last_message_at).getTime() : 0;
    const readMs = new Date(readAt).getTime();
    if (!Number.isFinite(readMs)) return chat;
    // Message at/before open time → stay read. Newer message → show API unread again.
    if (!lastMs || lastMs <= readMs) {
      return { ...chat, unread_count: 0 };
    }
    return chat;
  });
}

function themePalette(theme: WaTheme) {
  if (theme === 'light') {
    return {
      shell: '#d1d7db',
      panel: '#ffffff',
      listBg: '#ffffff',
      listHeader: '#f0f2f5',
      listBorder: '#e9edef',
      listHover: '#f5f6f6',
      listActive: '#f0f2f5',
      text: '#111b21',
      muted: '#667781',
      searchBg: '#f0f2f5',
      chatEmpty: '#f0f2f5',
      avatar: '#dfe5e7',
      unread: '#004AAD',
    };
  }
  return {
    shell: '#0b141a',
    panel: '#111b21',
    listBg: '#111b21',
    listHeader: '#202c33',
    listBorder: '#222d34',
    listHover: '#202c33',
    listActive: '#2a3942',
    text: '#e9edef',
    muted: 'rgba(233,237,239,0.55)',
    searchBg: '#202c33',
    chatEmpty: '#222e35',
    avatar: '#6a7175',
    unread: '#004AAD',
  };
}

/**
 * Full-screen WhatsApp Web workspace (list left + chat right).
 * Portaled to document.body so dashboard overflow/transform cannot clip it.
 */
export default function WhatsAppWebWorkspace({
  isOpen,
  onClose,
  initialPhone = '',
  initialPreview = '',
  hideLeadPool = true,
  showAssigneeFilter = false,
  refreshSignal,
  title = 'WhatsApp · 6161',
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedPhone, setSelectedPhone] = useState('');
  const [selectedPreview, setSelectedPreview] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [isNarrow, setIsNarrow] = useState(false);
  const [theme, setTheme] = useState<WaTheme>('light');
  const [assigneeFilter, setAssigneeFilter] = useState(''); // '' | 'unassigned' | telecaller uuid
  const [peers, setPeers] = useState<PeerRow[]>([]);
  const [inboxTab, setInboxTab] = useState<InboxTab>('open');
  const [closedPhones, setClosedPhones] = useState<Set<string>>(() => new Set());
  const rowsRef = useRef<ChatRow[]>([]);
  rowsRef.current = rows;

  const debouncedSearch = useMemo(() => search.trim(), [search]);
  const colors = themePalette(theme);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') setTheme(saved);
    } catch {
      /* ignore */
    }
    setClosedPhones(loadClosedPhones());
  }, []);

  const markChatClosed = useCallback((phone: string, closed: boolean) => {
    const key = normalizePhone(phone);
    if (!key) return;
    setClosedPhones((prev) => {
      const next = new Set(prev);
      if (closed) next.add(key);
      else next.delete(key);
      saveClosedPhones(next);
      return next;
    });
  }, []);

  /** New inbound on a manually-closed chat → auto-reopen (DoubleTick-style). */
  useEffect(() => {
    if (!rows.length) return;
    let changed = false;
    const next = new Set(closedPhones);
    for (const chat of rows) {
      const phone = normalizePhone(chat.phone);
      if (!phone || !next.has(phone)) continue;
      if (isAwaitingReply(chat) && resolveUnreadCount(chat) > 0) {
        next.delete(phone);
        changed = true;
      }
    }
    if (changed) {
      setClosedPhones(next);
      saveClosedPhones(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const inboxCounts = useMemo(() => {
    let open = 0;
    let awaiting = 0;
    let closed = 0;
    for (const chat of rows) {
      if (isInboxClosed(chat, closedPhones)) {
        closed += 1;
        continue;
      }
      if (isAwaitingReply(chat)) awaiting += 1;
      else open += 1;
    }
    return { open, awaiting, closed };
  }, [rows, closedPhones]);

  const filteredRows = useMemo(() => {
    return rows.filter((chat) => {
      const closed = isInboxClosed(chat, closedPhones);
      const awaiting = isAwaitingReply(chat);
      if (inboxTab === 'closed') return closed;
      if (closed) return false;
      if (inboxTab === 'awaiting') return awaiting;
      // open = session open and not awaiting
      return !awaiting;
    });
  }, [rows, closedPhones, inboxTab]);

  const selectedIsClosed = selectedPhone
    ? (() => {
        const row = rows.find((r) => normalizePhone(r.phone) === normalizePhone(selectedPhone));
        if (row) return isInboxClosed(row, closedPhones);
        return closedPhones.has(normalizePhone(selectedPhone));
      })()
    : false;

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [mounted]);

  const fetchChats = useCallback(
    async (searchText: string, signal?: AbortSignal) => {
      const params = new URLSearchParams({ limit: '120', scan: '500', mode: 'assigned' });
      if (searchText) params.set('search', searchText);
      if (showAssigneeFilter) {
        if (assigneeFilter === 'unassigned') params.set('unassigned', '1');
        else if (assigneeFilter) params.set('telecaller_id', assigneeFilter);
      }
      const res = await fetch(`/api/whatsapp/chats?${params.toString()}`, { cache: 'no-store', signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to load chats');
      return Array.isArray(data?.chats) ? (data.chats as ChatRow[]) : [];
    },
    [showAssigneeFilter, assigneeFilter],
  );

  useEffect(() => {
    if (!isOpen || !showAssigneeFilter) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/telecaller/crm/transfer?peers=1', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        setPeers(Array.isArray(data?.peers) ? data.peers : []);
      } catch {
        if (!cancelled) setPeers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, showAssigneeFilter]);

  useEffect(() => {
    if (!isOpen) return;
    const phone = normalizePhone(initialPhone);
    setSelectedPhone(phone);
    setSelectedPreview(initialPreview || '');
    setSelectedName('');
  }, [isOpen, initialPhone, initialPreview]);

  // Mark chat as read when opened (persist locally + server so badge stays cleared after switch).
  useEffect(() => {
    if (!isOpen || !selectedPhone) return;
    const phone = normalizePhone(selectedPhone);
    if (!phone) return;

    const markRead = () => {
      const row = rowsRef.current.find((r) => normalizePhone(r.phone) === phone);
      const lastAt = row?.last_message_at ? new Date(row.last_message_at).getTime() : 0;
      const readIso = new Date(Math.max(Date.now(), lastAt || 0)).toISOString();
      saveLocalRead(phone, readIso);
      setRows((prev) =>
        applyLocalReads(
          prev.map((r) => (normalizePhone(r.phone) === phone ? { ...r, unread_count: 0 } : r)),
        ),
      );
      void fetch('/api/whatsapp/chats/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      }).catch(() => {
        /* ignore — local read still applies */
      });
    };

    markRead();
    const id = window.setInterval(markRead, 8000);
    return () => window.clearInterval(id);
  }, [isOpen, selectedPhone]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 12000);
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const chats = await fetchChats(debouncedSearch, ac.signal);
        if (cancelled) return;
        setRows(applyLocalReads(chats));
      } catch (e: any) {
        if (cancelled) return;
        setRows([]);
        if (e?.name === 'AbortError') setLoadError('Timed out — try refresh');
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
  }, [isOpen, debouncedSearch, fetchChats, refreshSignal]);

  // Keep chat list fresh without manual refresh (realtime alone is not reliable enough).
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const silentRefresh = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const chats = await fetchChats(debouncedSearch);
        if (!cancelled) {
          setRows(applyLocalReads(chats));
        }
      } catch {
        /* keep previous rows */
      }
    };
    const onLive = () => {
      void silentRefresh();
    };
    window.addEventListener('myfng:wa-message', onLive);
    window.addEventListener('myfng:wa-unread-bump', onLive);
    const pollId = window.setInterval(silentRefresh, 3000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void silentRefresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      window.removeEventListener('myfng:wa-message', onLive);
      window.removeEventListener('myfng:wa-unread-bump', onLive);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isOpen, debouncedSearch, fetchChats]);

  useEffect(() => {
    if (!selectedPhone || rows.length === 0) return;
    const hit = rows.find((c) => normalizePhone(c.phone) === normalizePhone(selectedPhone));
    if (hit?.customer_name) setSelectedName(String(hit.customer_name));
  }, [selectedPhone, rows]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Nested template picker owns Escape first.
      if (document.querySelector('[data-wa-template-picker="1"]')) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const showList = !isNarrow || !selectedPhone;
  const showChat = !isNarrow || Boolean(selectedPhone);

  const ui = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        // Desktop: leave icon-rail so left sidebar stays visible/usable
        left: isNarrow ? 0 : '5rem',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'stretch',
        width: isNarrow ? '100vw' : 'calc(100vw - 5rem)',
        height: '100dvh',
        padding: 0,
        boxSizing: 'border-box',
        background: colors.panel,
      }}
    >
      <div
        style={{
          display: 'flex',
          width: '100%',
          maxWidth: 'none',
          height: '100%',
          borderRadius: 0,
          overflow: 'hidden',
          boxShadow: 'none',
          border: 'none',
          borderLeft: isNarrow ? 'none' : `1px solid ${colors.listBorder}`,
          background: colors.panel,
        }}
      >
        {/* Left — chat list */}
        {showList ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: isNarrow ? '100%' : 'min(28vw, 420px)',
              minWidth: isNarrow ? '100%' : 340,
              maxWidth: isNarrow ? '100%' : 460,
              height: '100%',
              background: colors.listBg,
              borderRight: isNarrow ? 'none' : `1px solid ${colors.listBorder}`,
              color: colors.text,
              flexShrink: 0,
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ background: colors.listHeader }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <MessageCircle className="h-5 w-5 text-[#004AAD] shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold" style={{ color: colors.text }}>
                    {title}
                  </p>
                  <p className="truncate text-[11px]" style={{ color: colors.muted }}>
                    {hideLeadPool ? 'All chats · assigned leads' : 'All chats'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  className="rounded-md p-1.5 hover:opacity-80"
                  style={{ color: colors.muted }}
                  title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
                  onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  className="rounded-md p-1.5 hover:opacity-80"
                  style={{ color: colors.muted }}
                  title="Refresh"
                  onClick={() => {
                    setLoadError(null);
                    setLoading(true);
                    void fetchChats(debouncedSearch)
                      .then(setRows)
                      .catch((e: any) => setLoadError(e?.message || 'Failed'))
                      .finally(() => setLoading(false));
                  }}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  className="rounded-md p-1.5 hover:opacity-80"
                  style={{ color: colors.muted }}
                  onClick={onClose}
                  aria-label="Close WhatsApp"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-2 px-3 py-2" style={{ background: colors.listBg }}>
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2"
                style={{ background: colors.searchBg }}
              >
                <Search className="h-4 w-4" style={{ color: colors.muted }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or phone"
                  className="w-full bg-transparent text-sm focus:outline-none"
                  style={{ color: colors.text }}
                />
              </div>

              <div
                className="flex gap-1 rounded-lg p-1"
                style={{ background: colors.searchBg }}
                role="tablist"
                aria-label="Inbox status"
              >
                {(
                  [
                    { id: 'open' as const, label: 'Open', count: inboxCounts.open },
                    { id: 'awaiting' as const, label: 'Awaiting', count: inboxCounts.awaiting },
                    { id: 'closed' as const, label: 'Closed', count: inboxCounts.closed },
                  ] as const
                ).map((tab) => {
                  const active = inboxTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setInboxTab(tab.id)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-[11px] font-bold transition"
                      style={{
                        background: active ? colors.panel : 'transparent',
                        color: active ? colors.text : colors.muted,
                        boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                      }}
                    >
                      <span className="truncate">{tab.label}</span>
                      <span
                        className="tabular-nums rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                        style={{
                          background: active
                            ? tab.id === 'awaiting'
                              ? '#004AAD'
                              : colors.listBorder
                            : 'transparent',
                          color: active && tab.id === 'awaiting' ? '#fff' : colors.muted,
                        }}
                      >
                        {tab.count > 999 ? '999+' : tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {showAssigneeFilter ? (
                <select
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{
                    background: colors.searchBg,
                    color: colors.text,
                    border: `1px solid ${colors.listBorder}`,
                  }}
                  aria-label="Filter by assignee"
                >
                  <option value="">All assignees</option>
                  <option value="unassigned">Unassigned</option>
                  {peers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {String(p.full_name || p.phone || p.id).trim() || 'Telecaller'}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <div
                  className="flex items-center justify-center gap-2 py-12 text-sm"
                  style={{ color: colors.muted }}
                >
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : loadError ? (
                <div className="px-4 py-10 text-center text-sm text-red-500">{loadError}</div>
              ) : filteredRows.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm" style={{ color: colors.muted }}>
                  {inboxTab === 'closed'
                    ? 'No window-closed chats.'
                    : inboxTab === 'awaiting'
                      ? 'No chats awaiting reply.'
                      : hideLeadPool
                        ? 'No open chats yet.'
                        : 'No open chats. Leads with phone numbers will show here.'}
                </div>
              ) : (
                filteredRows.map((chat) => {
                  const phone = normalizePhone(chat.phone);
                  const active = phone === normalizePhone(selectedPhone);
                  const unreadCount = resolveUnreadCount(chat);
                  const unread = unreadCount > 0;
                  const name = String(chat.customer_name || '').trim();
                  return (
                    <button
                      key={phone}
                      type="button"
                      onClick={() => {
                        setSelectedPhone(phone);
                        setSelectedPreview(chat.last_message_preview || '');
                        setSelectedName(name);
                      }}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition"
                      style={{
                        borderBottom: `1px solid ${colors.listBorder}`,
                        background: active ? colors.listActive : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (!active) e.currentTarget.style.background = colors.listHover;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = active ? colors.listActive : 'transparent';
                      }}
                    >
                      <div
                        className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                        style={{ background: colors.avatar, color: theme === 'light' ? '#54656f' : '#fff' }}
                      >
                        {(name || formatPhone(phone)).slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`truncate text-sm ${unread ? 'font-bold' : 'font-semibold'}`}
                            style={{ color: colors.text }}
                          >
                            {name || formatPhone(phone)}
                          </p>
                          <span
                            className="shrink-0 text-[11px] font-medium"
                            style={{ color: unread ? colors.unread : colors.muted }}
                          >
                            {formatTime(chat.last_message_at)}
                          </span>
                        </div>
                        {name ? (
                          <p className="truncate text-[11px]" style={{ color: colors.muted }}>
                            {formatPhone(phone)}
                          </p>
                        ) : null}
                        {showAssigneeFilter ? (
                          <p className="truncate text-[10px]" style={{ color: colors.muted }}>
                            {chat.assigned_telecaller_name
                              ? `Assignee: ${chat.assigned_telecaller_name}`
                              : 'Unassigned'}
                          </p>
                        ) : null}
                        <div className="mt-0.5 flex items-center gap-2">
                          <p
                            className={`min-w-0 flex-1 truncate text-xs ${unread ? 'font-medium' : ''}`}
                            style={{ color: colors.muted }}
                          >
                            {chat.last_message_preview || '—'}
                          </p>
                          {unread ? (
                            <span
                              className="inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none text-white"
                              style={{ background: colors.unread }}
                            >
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : null}

        {/* Right — conversation */}
        {showChat ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              height: '100%',
              background: colors.chatEmpty,
            }}
          >
            {selectedPhone ? (
              <WhatsAppMobilePreviewModal
                isOpen
                embedded
                variant="web"
                theme={theme}
                phoneNumber={selectedPhone}
                customerName={selectedName || undefined}
                title="WhatsApp Chat"
                previewMessage={selectedPreview}
                chatClosed={selectedIsClosed}
                onMarkClosed={(closed) => {
                  markChatClosed(selectedPhone, closed);
                  if (closed) setInboxTab('closed');
                  else setInboxTab('open');
                }}
                onClose={onClose}
                onBack={() => {
                  setSelectedPhone('');
                  setSelectedPreview('');
                  setSelectedName('');
                }}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#004AAD]/15">
                  <MessageCircle className="h-8 w-8 text-[#004AAD]" />
                </div>
                <p className="text-lg font-semibold" style={{ color: colors.text }}>
                  WhatsApp · 6161
                </p>
                <p className="max-w-sm text-sm" style={{ color: colors.muted }}>
                  Left se chat select karo. Theme upar sun/moon se badlo.
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );

  return createPortal(ui, document.body);
}
