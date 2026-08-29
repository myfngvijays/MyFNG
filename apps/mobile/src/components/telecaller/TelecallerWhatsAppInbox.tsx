import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiFetch } from '../../lib/api';
import { COLORS, SHADOWS } from '../../constants/theme';
import { isWhatsAppSessionWindowClosed } from '../../lib/whatsappSessionWindow';
import TelecallerWhatsAppChat from './TelecallerWhatsAppChat';

const WA = {
  header: '#004AAD',
  bg: '#FFFFFF',
  searchBg: '#EEF4FF',
  text: '#111B21',
  meta: '#667781',
  unread: '#004AAD',
  divider: '#E9EDEF',
  avatarColors: ['#004AAD', '#0A57BF', '#003A88', '#2563EB', '#1D4ED8', '#3B82F6'],
};

type InboxTab = 'open' | 'awaiting' | 'closed';

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
  visible: boolean;
  onClose: () => void;
};

function formatPhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return phone || '—';
}

function formatListTime(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return 'Yesterday';
  }
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function previewText(raw?: string | null): string {
  const text = String(raw || '').trim();
  if (!text) return '—';
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      return String(parsed.text || parsed.payload || text);
    }
  } catch {
    /* plain */
  }
  return text;
}

function avatarLetter(name?: string | null, phone?: string): string {
  const n = String(name || '').trim();
  if (n) return n.charAt(0).toUpperCase();
  const d = String(phone || '').replace(/\D/g, '');
  return d.slice(-1) || '?';
}

function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash + seed.charCodeAt(i) * (i + 1)) % 997;
  return WA.avatarColors[hash % WA.avatarColors.length];
}

function isAwaitingReply(chat: ChatRow): boolean {
  return String(chat.last_direction || '').toUpperCase() === 'INBOUND';
}

export default function TelecallerWhatsAppInbox({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [leadCount, setLeadCount] = useState(0);
  const [inboxTab, setInboxTab] = useState<InboxTab>('open');
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [activeCustomerName, setActiveCustomerName] = useState<string | null>(null);

  const fetchChats = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '250',
        scan: '50000',
        mode: 'assigned',
      });
      if (search.trim()) params.set('search', search.trim());
      const data = await apiFetch<{ success?: boolean; chats?: ChatRow[]; lead_count?: number }>(
        `/api/whatsapp/chats?${params.toString()}`,
      );
      setRows(Array.isArray(data.chats) ? data.chats : []);
      setLeadCount(Number(data.lead_count ?? data.chats?.length ?? 0));
    } catch (e) {
      console.error('WhatsApp chats failed', e);
      if (!silent) setRows([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => fetchChats(), 250);
    return () => clearTimeout(t);
  }, [visible, fetchChats]);

  // Keep inbox list live while open (no manual refresh needed).
  useEffect(() => {
    if (!visible || activePhone) return;
    const id = setInterval(() => {
      void fetchChats({ silent: true });
    }, 8000);
    return () => clearInterval(id);
  }, [visible, activePhone, fetchChats]);

  useEffect(() => {
    if (!visible) {
      setActivePhone(null);
      setActiveCustomerName(null);
      setSearch('');
      setInboxTab('open');
    }
  }, [visible]);

  const inboundCount = useMemo(
    () =>
      rows.reduce((sum, r) => {
        const n =
          typeof r.unread_count === 'number' && Number.isFinite(r.unread_count)
            ? r.unread_count
            : String(r.last_direction || '').toUpperCase() === 'INBOUND'
              ? 1
              : 0;
        return sum + (n > 0 ? 1 : 0);
      }, 0),
    [rows],
  );

  const inboxCounts = useMemo(() => {
    let open = 0;
    let awaiting = 0;
    let closed = 0;
    for (const chat of rows) {
      if (isWhatsAppSessionWindowClosed(chat)) {
        closed += 1;
        continue;
      }
      if (isAwaitingReply(chat)) awaiting += 1;
      else open += 1;
    }
    return { open, awaiting, closed };
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((chat) => {
      const closed = isWhatsAppSessionWindowClosed(chat);
      const awaiting = isAwaitingReply(chat);
      if (inboxTab === 'closed') return closed;
      if (closed) return false;
      if (inboxTab === 'awaiting') return awaiting;
      return !awaiting;
    });
  }, [rows, inboxTab]);

  const subtitle = useMemo(() => {
    return `${leadCount} chats${inboundCount > 0 ? ` · ${inboundCount} unread` : ''}`;
  }, [leadCount, inboundCount]);

  const handleClose = () => {
    setActivePhone(null);
    setActiveCustomerName(null);
    onClose();
  };

  const openChat = (phone: string, name?: string | null) => {
    const digits = String(phone || '').replace(/\D/g, '');
    const normalized =
      digits.length === 10 ? `91${digits}` : digits.startsWith('91') ? digits : `91${digits.slice(-10)}`;
    setRows((prev) =>
      prev.map((row) => {
        const p = String(row.phone || '').replace(/\D/g, '');
        const rowNorm =
          p.length === 10 ? `91${p}` : p.startsWith('91') ? p : `91${p.slice(-10)}`;
        return rowNorm === normalized ? { ...row, unread_count: 0 } : row;
      }),
    );
    void apiFetch('/api/whatsapp/chats/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normalized || phone }),
    }).catch(() => {
      /* ignore */
    });
    setActivePhone(phone);
    setActiveCustomerName(String(name || '').trim() || null);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={
        activePhone
          ? () => {
              setActivePhone(null);
              setActiveCustomerName(null);
            }
          : handleClose
      }
    >
      {activePhone ? (
        <TelecallerWhatsAppChat
          phone={activePhone}
          customerName={activeCustomerName}
          onBack={() => {
            setActivePhone(null);
            setActiveCustomerName(null);
          }}
        />
      ) : (
        <View style={styles.container}>
          <StatusBar barStyle="light-content" backgroundColor={WA.header} />
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 4 }]}>
            <TouchableOpacity style={styles.iconHit} onPress={handleClose}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>WhatsApp</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <TouchableOpacity onPress={() => fetchChats()} style={styles.iconHit}>
              <Ionicons name="refresh" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchWrap}>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={18} color={WA.meta} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search or start new chat"
                value={search}
                onChangeText={setSearch}
                placeholderTextColor={WA.meta}
                keyboardType="default"
              />
            </View>
          </View>

          <View style={styles.tabsRow}>
            {(
              [
                { id: 'open' as const, label: 'Open', count: inboxCounts.open },
                { id: 'awaiting' as const, label: 'Awaiting', count: inboxCounts.awaiting },
                { id: 'closed' as const, label: 'Closed', count: inboxCounts.closed },
              ] as const
            ).map((t) => {
              const active = inboxTab === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.tabBtn, active && styles.tabBtnOn]}
                  onPress={() => setInboxTab(t.id)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.tabLabel, active && styles.tabLabelOn]}>{t.label}</Text>
                  <View style={[styles.tabCount, active && styles.tabCountOn]}>
                    <Text style={[styles.tabCountText, active && styles.tabCountTextOn]}>
                      {t.count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {loading ? (
            <ActivityIndicator color={WA.header} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={filteredRows}
              keyExtractor={(item, idx) => `${item.phone}-${idx}`}
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="chatbubbles-outline" size={42} color="#D1D7DB" />
                  <Text style={styles.emptyText}>
                    {inboxTab === 'closed'
                      ? 'No window-closed chats'
                      : inboxTab === 'awaiting'
                        ? 'No chats awaiting reply'
                        : 'No open chats'}
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const unreadCount = Math.max(
                  0,
                  typeof item.unread_count === 'number' && Number.isFinite(item.unread_count)
                    ? item.unread_count
                    : String(item.last_direction || '').toUpperCase() === 'INBOUND'
                      ? 1
                      : 0,
                );
                const inbound = unreadCount > 0;
                const name = String(item.customer_name || '').trim() || formatPhone(item.phone);
                const letter = avatarLetter(item.customer_name, item.phone);
                return (
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => openChat(item.phone, item.customer_name)}
                    activeOpacity={0.65}
                  >
                    <View style={[styles.avatar, { backgroundColor: avatarColor(item.phone) }]}>
                      <Text style={styles.avatarText}>{letter}</Text>
                    </View>
                    <View style={styles.rowBody}>
                      <View style={styles.rowTop}>
                        <Text style={[styles.name, inbound && styles.nameUnread]} numberOfLines={1}>
                          {name}
                        </Text>
                        <Text style={[styles.time, inbound && styles.timeUnread]}>
                          {formatListTime(item.last_message_at)}
                        </Text>
                      </View>
                      <View style={styles.rowBottom}>
                        {!inbound ? (
                          <Ionicons
                            name="checkmark-done"
                            size={16}
                            color={
                              String(item.last_status || '').toUpperCase() === 'READ'
                                ? '#004AAD'
                                : WA.meta
                            }
                            style={{ marginRight: 2 }}
                          />
                        ) : null}
                        <Text style={styles.preview} numberOfLines={1}>
                          {previewText(item.last_message_preview)}
                        </Text>
                        {inbound ? (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>
                              {unreadCount > 99 ? '99+' : String(unreadCount)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}
    </Modal>
  );
}

/** Floating action buttons: Call (dialer) + WhatsApp — CRM shell */
export function TelecallerWhatsAppFab({
  onPress,
  onCallPress,
  badge,
  bottomOffset = 108,
}: {
  onPress: () => void;
  /** Opens CRM dialer when set */
  onCallPress?: () => void;
  badge?: number;
  /** Clearance above bottom nav (CRM pill is taller) */
  bottomOffset?: number;
}) {
  return (
    <View style={[styles.fabStack, { bottom: bottomOffset }]} pointerEvents="box-none">
      {onCallPress ? (
        <TouchableOpacity
          style={[styles.fab, styles.fabCall]}
          onPress={onCallPress}
          activeOpacity={0.85}
          accessibilityLabel="Open dialer"
        >
          <Ionicons name="call" size={24} color={COLORS.white} />
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        style={[styles.fab, styles.fabWhatsApp]}
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityLabel="Open WhatsApp"
      >
        <Ionicons name="logo-whatsapp" size={26} color={COLORS.white} />
        {badge && badge > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WA.bg,
  },
  header: {
    backgroundColor: WA.header,
    paddingBottom: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconHit: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  searchWrap: {
    backgroundColor: WA.header,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: WA.searchBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: WA.text,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: WA.divider,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: WA.searchBg,
  },
  tabBtnOn: {
    backgroundColor: '#E8F1FF',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: WA.meta,
  },
  tabLabelOn: {
    color: WA.header,
  },
  tabCount: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
  },
  tabCountOn: {
    backgroundColor: WA.header,
  },
  tabCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: WA.meta,
  },
  tabCountTextOn: {
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: '#fff',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: WA.text,
  },
  nameUnread: {
    fontWeight: '700',
  },
  time: {
    fontSize: 12,
    color: WA.meta,
  },
  timeUnread: {
    color: WA.unread,
    fontWeight: '600',
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  preview: {
    flex: 1,
    fontSize: 14,
    color: WA.meta,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: WA.unread,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: WA.divider,
    marginLeft: 78,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 10,
  },
  emptyText: {
    color: WA.meta,
    fontSize: 15,
  },
  fabStack: {
    position: 'absolute',
    right: 18,
    alignItems: 'center',
    gap: 12,
    zIndex: 50,
    elevation: 18,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.large,
  },
  fabCall: {
    backgroundColor: COLORS.primary,
  },
  fabWhatsApp: {
    backgroundColor: COLORS.primary,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
  },
});
