import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../lib/api';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';

type Msg = {
  id: string;
  direction?: string | null;
  text_body?: string | null;
  message_type?: string | null;
  media_caption?: string | null;
  template_name?: string | null;
  created_at?: string | null;
  status?: string | null;
};

type Props = {
  phone: string;
  onBack: () => void;
};

function formatPhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return phone || '—';
}

function normalizePhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 10 ? `91${digits}` : digits.startsWith('91') ? digits : `91${digits.slice(-10)}`;
}

function messageText(m: Msg): string {
  const body = String(m.text_body || m.media_caption || '').trim();
  if (body) {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object') {
        return String(parsed.text || parsed.payload || body);
      }
    } catch {
      /* plain text */
    }
    return body;
  }
  if (m.template_name) return `Template: ${m.template_name}`;
  const type = String(m.message_type || '').toUpperCase();
  if (type && type !== 'TEXT') return type;
  return '—';
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

export default function TelecallerWhatsAppChat({ phone, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  /** Newest-first for inverted FlatList (opens on latest message). */
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const normalized = normalizePhone(phone);

  const load = useCallback(async () => {
    if (!normalized) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ phone: normalized, limit: '80' });
      const data = await apiFetch<{ messages?: Msg[] }>(
        `/api/whatsapp/conversation?${params.toString()}`,
      );
      const rows = Array.isArray(data.messages) ? data.messages : [];
      // API returns oldest → newest; invert for chat UI
      setMessages([...rows].reverse());
    } catch (e) {
      console.error('WA conversation failed', e);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [normalized]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await apiFetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_phone: normalized,
          message_type: 'text',
          text,
        }),
      });
      setDraft('');
      await load();
    } catch (e: any) {
      console.error('WA send failed', e);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={20} color={COLORS.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{formatPhone(phone)}</Text>
          <Text style={styles.subtitle}>In-app WhatsApp</Text>
        </View>
        <TouchableOpacity style={styles.backBtn} onPress={load}>
          <Ionicons name="refresh" size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={messages}
          inverted
          keyExtractor={(item, idx) => item.id || `${idx}`}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No messages yet</Text>
            </View>
          }
          renderItem={({ item }) => {
            const outbound = String(item.direction || '').toUpperCase() === 'OUTBOUND';
            return (
              <View style={[styles.bubble, outbound ? styles.bubbleOut : styles.bubbleIn]}>
                <Text style={[styles.bubbleText, outbound && styles.bubbleTextOut]}>
                  {messageText(item)}
                </Text>
                <Text style={[styles.bubbleTime, outbound && styles.bubbleTimeOut]}>
                  {formatTime(item.created_at)}
                </Text>
              </View>
            );
          }}
        />
      )}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message..."
          placeholderTextColor={COLORS.textSecondary}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!draft.trim() || sending) && { opacity: 0.5 }]}
          onPress={send}
          disabled={!draft.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : (
            <Ionicons name="send" size={18} color={COLORS.white} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ECE5DD' },
  header: {
    backgroundColor: '#075E54',
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  subtitle: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  list: { paddingHorizontal: SPACING.md, paddingVertical: 12, flexGrow: 1 },
  empty: { alignItems: 'center', paddingTop: 60, transform: [{ scaleY: -1 }] },
  emptyText: { color: COLORS.textSecondary },
  bubble: {
    maxWidth: '82%',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  bubbleIn: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 4,
  },
  bubbleOut: {
    alignSelf: 'flex-end',
    backgroundColor: '#DCF8C6',
    borderTopRightRadius: 4,
  },
  bubbleText: { fontSize: 14, color: COLORS.textPrimary, lineHeight: 20 },
  bubbleTextOut: { color: COLORS.textPrimary },
  bubbleTime: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  bubbleTimeOut: { color: COLORS.textSecondary },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 10,
    backgroundColor: COLORS.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
