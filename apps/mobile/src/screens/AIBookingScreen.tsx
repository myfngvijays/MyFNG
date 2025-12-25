import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import { ENV } from '../config/environment';

type Props = {
  navigation: any;
  route: any;
};

type ChatRole = 'assistant' | 'user';
type ChatMsg = {
  id: string;
  role: ChatRole;
  text: string;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function apiBase() {
  return String(ENV.API_URL || '').replace(/\/$/, '');
}

export default function AIBookingScreen({ navigation, route }: Props) {
  const city: string | undefined = route?.params?.city;
  const prefill: string | undefined = route?.params?.prefill;

  const initial = useMemo<ChatMsg[]>(
    () => [
      {
        id: uid(),
        role: 'assistant',
        text: `Hi! I’m MY FNG AI Assistant.${city ? `\nCity: ${city}` : ''}\nAap regular service / repair / cleaning me se kya chahte ho?`,
      },
      ...(prefill ? [{ id: uid(), role: 'user' as const, text: prefill }] : []),
    ],
    [city, prefill]
  );

  const [messages, setMessages] = useState<ChatMsg[]>(initial);
  const [draft, setDraft] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatContext, setChatContext] = useState<any>({
    preferredLanguage: 'auto',
    cityName: city || undefined,
  });

  // Payments are supported via chat commands (e.g., “pay now”, “pay invoice”, “pay advance 2000”).

  const scrollRef = useRef<ScrollView>(null);

  const push = (msg: ChatMsg) => {
    setMessages((m) => [...m, msg]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  useEffect(() => {
    if (prefill) {
      void sendChatMessage(prefill);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendChatMessage(text: string) {
    if (chatLoading) return;

    setChatLoading(true);
    try {
      const res = await fetch(`${apiBase()}/api/chatbot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: {
            ...(chatContext || {}),
            cityName: chatContext?.cityName || city || undefined,
          },
        }),
      });

      const data: any = await res.json().catch(() => null);
      const assistantText = data?.assistantMessage || 'Sorry, kuch issue aa gaya. Please try again.';
      push({ id: uid(), role: 'assistant', text: assistantText });

      if (data?.contextPatch) {
        setChatContext((prev: any) => ({ ...(prev || {}), ...(data.contextPatch || {}) }));
      }
    } catch {
      push({ id: uid(), role: 'assistant', text: 'Network issue. Please try again.' });
    } finally {
      setChatLoading(false);
    }
  }

  const onSend = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    push({ id: uid(), role: 'user', text });
    void sendChatMessage(text);
  };

  // NOTE: To pay, user can type “pay now” / “pay invoice” / “pay advance 2000”.

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.primaryDark} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Chat & Book with AI</Text>
            <Text style={styles.headerSub}>Booking in minutes. No forms.</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginBtn}>
            <Text style={styles.loginBtnText}>Login</Text>
          </TouchableOpacity>
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={styles.chat} showsVerticalScrollIndicator={false}>
          {messages.map((m) => (
            <View key={m.id} style={[styles.msgRow, m.role === 'user' ? styles.msgRowUser : null]}>
              <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleBot]}>
                <Text style={[styles.bubbleText, m.role === 'user' ? styles.bubbleTextUser : null]}>{m.text}</Text>
              </View>
            </View>
          ))}

          {chatLoading ? (
            <View style={styles.typingRow}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.typingText}>Typing…</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Type your message…"
            style={styles.input}
            returnKeyType="send"
            onSubmitEditing={onSend}
          />
          <TouchableOpacity
            style={[styles.sendBtn, draft.trim().length === 0 ? styles.sendBtnDisabled : null]}
            onPress={onSend}
            disabled={draft.trim().length === 0}
            activeOpacity={0.9}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.gray[50] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    backgroundColor: COLORS.gray[50],
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  headerSub: {
    marginTop: 2,
    fontSize: FONT_SIZES.xs,
    fontWeight: '800',
    color: COLORS.gray[600],
  },
  loginBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#EEF6FF',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.16)',
  },
  loginBtnText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  chat: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  msgRow: {
    marginTop: SPACING.sm,
    alignItems: 'flex-start',
  },
  msgRowUser: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '92%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleBot: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
  },
  bubbleUser: {
    backgroundColor: COLORS.primary,
  },
  bubbleText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.primaryDark,
    lineHeight: 18,
  },
  bubbleTextUser: {
    color: '#fff',
  },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  typingText: { fontSize: 12, color: COLORS.gray[600], fontWeight: '700' },

  composer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(17,24,39,0.06)',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.gray[50],
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.08)',
    paddingHorizontal: 12,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
});


