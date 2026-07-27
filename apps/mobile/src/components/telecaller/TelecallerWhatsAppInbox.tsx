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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../lib/api';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import TelecallerWhatsAppChat from './TelecallerWhatsAppChat';

type ChatRow = {
  phone: string;
  last_message_preview: string;
  last_message_at: string | null;
  last_status: string | null;
  last_direction: string | null;
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

export default function TelecallerWhatsAppInbox({ visible, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [mode, setMode] = useState<'assigned' | 'unassigned'>('assigned');
  const [activePhone, setActivePhone] = useState<string | null>(null);

  const fetchChats = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '250',
        scan: '50000',
        mode,
      });
      if (search.trim()) params.set('search', search.trim());
      const data = await apiFetch<{ success?: boolean; chats?: ChatRow[] }>(
        `/api/whatsapp/chats?${params.toString()}`
      );
      setRows(Array.isArray(data.chats) ? data.chats : []);
    } catch (e) {
      console.error('WhatsApp chats failed', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [mode, search]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(fetchChats, 250);
    return () => clearTimeout(t);
  }, [visible, fetchChats]);

  useEffect(() => {
    if (!visible) setActivePhone(null);
  }, [visible]);

  const unreadCount = useMemo(
    () => rows.filter((r) => String(r.last_direction || '').toUpperCase() === 'INBOUND').length,
    [rows]
  );

  const handleClose = () => {
    setActivePhone(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={activePhone ? () => setActivePhone(null) : handleClose}
    >
      {activePhone ? (
        <TelecallerWhatsAppChat phone={activePhone} onBack={() => setActivePhone(null)} />
      ) : (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <Ionicons name="close" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>WhatsApp Inbox</Text>
            <Text style={styles.subtitle}>
              {unreadCount > 0 ? `${unreadCount} inbound` : 'Assigned chats'}
            </Text>
          </View>
          <TouchableOpacity onPress={fetchChats} style={styles.closeBtn}>
            <Ionicons name="refresh" size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.modeRow}>
          {(['assigned', 'unassigned'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modeChip, mode === m && styles.modeChipActive]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>
                {m === 'assigned' ? 'Assigned' : 'Unassigned'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search phone..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="phone-pad"
          />
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item, idx) => `${item.phone}-${idx}`}
            contentContainerStyle={{ padding: SPACING.md, paddingBottom: 40 }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="logo-whatsapp" size={40} color={COLORS.gray[300]} />
                <Text style={styles.emptyText}>No chats found</Text>
              </View>
            }
            renderItem={({ item }) => {
              const inbound = String(item.last_direction || '').toUpperCase() === 'INBOUND';
              return (
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => setActivePhone(item.phone)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.avatar, inbound && styles.avatarUnread]}>
                    <Ionicons name="logo-whatsapp" size={18} color={COLORS.white} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.cardTop}>
                      <Text style={styles.phone}>{formatPhone(item.phone)}</Text>
                      <Text style={styles.time}>{formatTime(item.last_message_at)}</Text>
                    </View>
                    <Text style={styles.preview} numberOfLines={2}>
                      {previewText(item.last_message_preview)}
                    </Text>
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

/** Floating action button for telecaller WhatsApp inbox */
export function TelecallerWhatsAppFab({
  onPress,
  badge,
  bottomOffset = 108,
}: {
  onPress: () => void;
  badge?: number;
  /** Clearance above bottom nav (CRM pill is taller) */
  bottomOffset?: number;
}) {
  return (
    <TouchableOpacity
      style={[styles.fab, { bottom: bottomOffset }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Ionicons name="logo-whatsapp" size={24} color={COLORS.white} />
      {badge && badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: '#075E54',
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  modeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.gray[100],
  },
  modeChipActive: {
    backgroundColor: '#25D366',
  },
  modeText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  modeTextActive: {
    color: COLORS.white,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: 12,
    paddingVertical: 4,
    ...SHADOWS.small,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: 12,
    marginBottom: 8,
    ...SHADOWS.small,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarUnread: {
    backgroundColor: COLORS.primary,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  phone: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
  },
  time: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  preview: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 10,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    right: 18,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.large,
    zIndex: 50,
    elevation: 18,
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
