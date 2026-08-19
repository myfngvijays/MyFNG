'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, MessageCircle, Moon, RefreshCw, Search, Sun, X } from 'lucide-react';
import WhatsAppMobilePreviewModal from '@/components/shared/WhatsAppMobilePreviewModal';

type ChatRow = {
  phone: string;
  last_message_preview: string;
  last_message_at: string | null;
  last_status: string | null;
  last_direction: string | null;
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
  return d.startsWith('91') ? d : `91${d.slice(-10)}`;
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
      unread: '#25D366',
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
    unread: '#25D366',
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

  const debouncedSearch = useMemo(() => search.trim(), [search]);
  const colors = themePalette(theme);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(THEME_KEY);
      // Default is light; only restore if user explicitly picked a theme before.
      if (saved === 'light' || saved === 'dark') setTheme(saved);
    } catch {
      /* ignore */
    }
  }, []);

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
        setRows(chats);
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
                <MessageCircle className="h-5 w-5 text-[#25D366] shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold" style={{ color: colors.text }}>
                    {title}
                  </p>
                  <p className="truncate text-[11px]" style={{ color: colors.muted }}>
                    {hideLeadPool ? 'Your assigned leads' : 'Inbox'}
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
              ) : rows.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm" style={{ color: colors.muted }}>
                  {hideLeadPool ? 'No assigned chats yet.' : 'No chats yet. Leads with phone numbers will show here.'}
                </div>
              ) : (
                rows.map((chat) => {
                  const phone = normalizePhone(chat.phone);
                  const active = phone === normalizePhone(selectedPhone);
                  const unread = (chat.last_direction || '').toUpperCase() === 'INBOUND';
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
                          <span className="shrink-0 text-[10px]" style={{ color: colors.muted }}>
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
                        <p
                          className={`mt-0.5 truncate text-xs ${unread ? 'font-medium' : ''}`}
                          style={{ color: colors.muted }}
                        >
                          {chat.last_message_preview || '—'}
                        </p>
                      </div>
                      {unread ? (
                        <span
                          className="mt-2 h-2 w-2 shrink-0 rounded-full"
                          style={{ background: colors.unread }}
                        />
                      ) : null}
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
                onClose={onClose}
                onBack={() => {
                  setSelectedPhone('');
                  setSelectedPreview('');
                  setSelectedName('');
                }}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#25D366]/15">
                  <MessageCircle className="h-8 w-8 text-[#25D366]" />
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
