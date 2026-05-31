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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import { ENV } from '../config/environment';
import { getCustomerSessionToken } from '../lib/customerSession';
import { apiFetch } from '../lib/api';

const stripEmojis = (text: string) =>
  text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}\u{2700}-\u{27BF}\u{2B50}\u{2B55}\u{231A}-\u{23F3}\u{23E9}-\u{23EF}\u{25AA}-\u{25FE}\u{2934}-\u{2935}\u{3030}\u{303D}\u{3297}\u{3299}]/gu, '').replace(/\s{2,}/g, ' ').trim();

type Props = {
  navigation: any;
  route: any;
};

type ChatRole = 'assistant' | 'user';
type UiSuggestion = {
  optionNumber?: number;
  kind: 'SERVICE_TYPE' | 'PACKAGE' | 'RSA';
  id: string;
  name: string;
  exactPrice?: number | null;
  checklistItems?: string[];
  checklistNote?: string | null;
};
type UiPayload =
  | { kind: 'CATEGORY_CAROUSEL'; title?: string; items: Array<{ id: string; label: string; subtitle?: string }> }
  | { kind: 'DUAL_CAROUSEL'; title?: string; category: string; packages: UiSuggestion[]; services: UiSuggestion[] }
  | {
      kind: 'WORKSHOP_CAROUSEL';
      title?: string;
      items: Array<{
        id: string;
        name: string;
        subtitle?: string;
        km?: number | null;
        imageUrl?: string | null;
        mapLink?: string | null;
        rating?: number | null;
        usp?: string | null;
      }>;
    };
type ChatMsg = {
  id: string;
  role: ChatRole;
  text: string;
  ui?: UiPayload;
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
        text: `Hi! I'm Misa AI (MyFNG Instant Service Assistant).\nAapko kya help chahiye — service, repair, cleaning, ya workshop location?`,
      },
      ...(prefill ? [{ id: uid(), role: 'user' as const, text: prefill }] : []),
    ],
    [city, prefill]
  );

  const [messages, setMessages] = useState<ChatMsg[]>(initial);
  const [draft, setDraft] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<{ name?: string; phone?: string; vehicles?: any[] } | null>(null);
  const [chatContext, setChatContext] = useState<any>({
    preferredLanguage: 'auto',
    locationLabel: city || undefined,
    locationConfirmed: Boolean(city),
  });

  // Payments are supported via chat commands (e.g., “pay now”, “pay invoice”, “pay advance 2000”).

  const scrollRef = useRef<ScrollView>(null);

  const push = (msg: ChatMsg) => {
    setMessages((m) => [...m, msg]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  useEffect(() => {
    (async () => {
      try {
        const token = await getCustomerSessionToken();
        if (!token) return;
        setIsLoggedIn(true);
        const [profileRes, vehiclesRes] = await Promise.all([
          apiFetch<any>('/api/customer/profile').catch(() => null),
          apiFetch<any>('/api/customer/vehicles').catch(() => null),
        ]);
        const name = profileRes?.profile?.full_name || profileRes?.profile?.name || '';
        const phone = profileRes?.profile?.phone || '';
        const vehicles = (vehiclesRes?.vehicles || []).map((v: any) => ({
          make: v.make,
          model: v.model_name || v.model,
          variant: v.variant,
          reg_number: v.registration_number,
        }));
        setCustomerInfo({ name, phone, vehicles });
        setChatContext((prev: any) => ({
          ...prev,
          customerName: name,
          customerPhone: phone,
          customerVehicles: vehicles,
        }));
        if (vehicles.length > 0) {
          const vehicleList = vehicles.map((v: any, i: number) => `${i + 1}. ${v.make} ${v.model}${v.reg_number ? ` (${v.reg_number})` : ''}`).join('\n');
          const greeting = `Welcome back${name ? `, ${name}` : ''}!` +
            `\n\nAapke registered vehicles:\n${vehicleList}` +
            `\n\nKis vehicle ke liye service chahiye? Ya naya vehicle add karna hai?` +
            `\n\nReply karein: vehicle number (1, 2...) ya "new vehicle"`;
          setMessages((m) => [...m, { id: uid(), role: 'assistant', text: greeting }]);
        } else if (name) {
          const greeting = `Welcome back, ${name}!` +
            `\n\nAapke paas abhi koi vehicle registered nahi hai. Kya aap naya vehicle add karna chahenge ya directly service book karna hai?`;
          setMessages((m) => [...m, { id: uid(), role: 'assistant', text: greeting }]);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (prefill) {
      void sendChatMessage(prefill);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendChatMessage(rawText: string, displayText?: string) {
    if (chatLoading) return;
    const text = (rawText || '').trim();
    const shown = (displayText || rawText || '').trim();
    if (!text) return;

    setChatLoading(true);
    try {
      const url = `${apiBase()}/api/chatbot/v2`;
      const payload = {
        message: text,
        context: {
          ...(chatContext || {}),
          locationLabel: chatContext?.locationLabel || city || undefined,
        },
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const raw = await res.text().catch(() => '');
      const data: any = (() => {
        try {
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      })();

      if (!res.ok) {
        if (__DEV__) console.log('Chatbot API error', { url, status: res.status, body: raw?.slice(0, 400) });
        push({
          id: uid(),
          role: 'assistant',
          text: `Sorry, kuch issue aa gaya.\nAPI error: ${res.status}\nPlease try again.`,
        });
        return;
      }

      const msg = typeof data?.message === 'string' ? data.message.trim() : '';
      const cta = typeof data?.cta === 'string' ? data.cta.trim() : '';
      const assistantText =
        (typeof data?.assistantMessage === 'string' && data.assistantMessage.trim()) ||
        (typeof data?.response === 'string' && data.response.trim()) ||
        ([msg, cta].filter(Boolean).join('\n') || 'Sorry, kuch issue aa gaya. Please try again.');

      const ui: UiPayload | undefined = (() => {
        const u = data?.ui || data?.data?.ui;
        if (!u || typeof u !== 'object') return undefined;
        if (u.kind === 'CATEGORY_CAROUSEL' && Array.isArray(u.items)) {
          return {
            kind: 'CATEGORY_CAROUSEL',
            title: typeof u.title === 'string' ? u.title : undefined,
            items: u.items
              .map((it: any) => ({
                id: String(it?.id || ''),
                label: String(it?.label || '').trim(),
                subtitle: typeof it?.subtitle === 'string' ? it.subtitle : undefined,
              }))
              .filter((it: any) => it.id && it.label),
          };
        }
        if (u.kind === 'DUAL_CAROUSEL' && Array.isArray(u.packages) && Array.isArray(u.services)) {
          const mapOpt = (o: any, optionNumber?: number): UiSuggestion | null => {
            const s = o?.suggestion;
            const kind = String(s?.kind || '').toUpperCase();
            const id = String(s?.id || '');
            const name = String(s?.name || '').trim();
            if (!id || !name || !kind) return null;
            return {
              optionNumber,
              kind: kind as any,
              id,
              name,
              exactPrice: typeof o?.exactPrice === 'number' ? o.exactPrice : typeof o?.exactPrice?.amount === 'number' ? o.exactPrice.amount : null,
              checklistItems: Array.isArray(o?.checklistItems) ? o.checklistItems.map((x: any) => String(x)) : undefined,
              checklistNote: typeof o?.checklistNote === 'string' ? o.checklistNote : null,
            };
          };
          return {
            kind: 'DUAL_CAROUSEL',
            title: typeof u.title === 'string' ? u.title : undefined,
            category: String(u.category || ''),
            packages: (u.packages || []).map((x: any, idx: number) => mapOpt(x, idx + 1)).filter(Boolean) as UiSuggestion[],
            services: (u.services || []).map((x: any, idx: number) => mapOpt(x, idx + 1)).filter(Boolean) as UiSuggestion[],
          };
        }
        if (u.kind === 'WORKSHOP_CAROUSEL' && Array.isArray(u.items)) {
          return {
            kind: 'WORKSHOP_CAROUSEL',
            title: typeof u.title === 'string' ? u.title : undefined,
            items: u.items
              .map((it: any) => ({
                id: String(it?.id || ''),
                name: String(it?.name || '').trim(),
                subtitle: typeof it?.subtitle === 'string' ? it.subtitle : undefined,
                km: typeof it?.km === 'number' ? it.km : null,
                imageUrl: typeof it?.imageUrl === 'string' ? it.imageUrl : null,
                mapLink: typeof it?.mapLink === 'string' ? it.mapLink : null,
                rating: typeof it?.rating === 'number' ? it.rating : null,
                usp: typeof it?.usp === 'string' ? it.usp : null,
              }))
              .filter((it: any) => it.id && it.name),
          };
        }
        return undefined;
      })();

      push({ id: uid(), role: 'assistant', text: assistantText, ui });

      const ctxPatch = data?.data?.contextPatch || data?.contextPatch || null;
      if (ctxPatch && typeof ctxPatch === 'object') {
        setChatContext((prev: any) => ({ ...(prev || {}), ...(ctxPatch || {}) }));
      }
    } catch (e: any) {
      if (__DEV__) console.log('Chatbot API network error', { err: String(e?.message || e), apiBase: apiBase() });
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
            <Ionicons name="arrow-back" size={20} color={COLORS.secondary} />
          </TouchableOpacity>
          <View style={styles.botAvatar}>
            <Ionicons name="sparkles" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Misa AI</Text>
            <Text style={styles.headerSub}>{city ? `City: ${city}` : 'Ask anything about your car service'}</Text>
          </View>
          {isLoggedIn ? (
            <View style={styles.loggedInBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#059669" />
              <Text style={styles.loggedInText}>{customerInfo?.name ? customerInfo.name.split(' ')[0] : 'Logged In'}</Text>
            </View>
          ) : (
            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginBtn}>
              <Text style={styles.loginBtnText}>Login</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={styles.chat} showsVerticalScrollIndicator={false}>
          {messages.map((m) => (
            <View key={m.id}>
              <View style={[styles.msgRow, m.role === 'user' ? styles.msgRowUser : null]}>
                <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleBot]}>
                  <Text style={[styles.bubbleText, m.role === 'user' ? styles.bubbleTextUser : null]}>{m.text}</Text>
                </View>
              </View>

              {m.role === 'assistant' && m.ui?.kind === 'CATEGORY_CAROUSEL' ? (
                <View style={{ marginTop: 8 }}>
                  {m.ui.title ? <Text style={styles.uiTitle}>{m.ui.title}</Text> : null}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6, gap: 10 }}>
                    {m.ui.items.map((it) => (
                      <TouchableOpacity
                        key={it.id}
                        style={styles.chipCard}
                        onPress={() => {
                          push({ id: uid(), role: 'user', text: it.label });
                          void sendChatMessage(it.id, it.label);
                        }}
                        activeOpacity={0.9}
                      >
                        <Text style={styles.chipTitle}>{stripEmojis(it.label)}</Text>
                        {it.subtitle ? <Text style={styles.chipSub}>{stripEmojis(it.subtitle)}</Text> : null}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              {m.role === 'assistant' && m.ui?.kind === 'WORKSHOP_CAROUSEL' ? (
                <View style={{ marginTop: 8 }}>
                  {m.ui.title ? <Text style={styles.uiTitle}>{m.ui.title}</Text> : null}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6, gap: 12 }}>
                    {m.ui.items.map((w) => (
                      <View key={w.id} style={styles.workshopCard}>
                        <Text style={styles.workshopName}>{stripEmojis(w.name)}</Text>
                        {w.subtitle ? <Text style={styles.workshopSub}>{stripEmojis(w.subtitle)}</Text> : null}
                        {w.usp ? <Text style={styles.workshopMeta}>• {stripEmojis(w.usp)}</Text> : null}
                        {typeof w.rating === 'number' ? <Text style={styles.workshopMeta}>⭐ {Math.round(w.rating)}/100</Text> : null}
                        <Text style={styles.workshopMeta}>{typeof w.km === 'number' ? `${w.km.toFixed(1)} km away` : 'Distance unavailable'}</Text>
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                          {w.mapLink ? (
                            <TouchableOpacity
                              style={styles.primaryBtn}
                              onPress={() => Linking.openURL(w.mapLink as string).catch(() => null)}
                              activeOpacity={0.9}
                            >
                              <Text style={styles.primaryBtnText}>Directions</Text>
                            </TouchableOpacity>
                          ) : null}
                          <TouchableOpacity
                            style={styles.ghostBtn}
                            onPress={() => {
                              push({ id: uid(), role: 'user', text: 'Pickup' });
                              void sendChatMessage('pickup', 'Pickup');
                            }}
                            activeOpacity={0.9}
                          >
                            <Text style={styles.ghostBtnText}>Pickup?</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              {m.role === 'assistant' && m.ui?.kind === 'DUAL_CAROUSEL' ? (
                <View style={{ marginTop: 8 }}>
                  {m.ui.title ? <Text style={styles.uiTitle}>{m.ui.title}</Text> : null}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6, gap: 12 }}>
                    {[...(m.ui.packages || []), ...(m.ui.services || [])].slice(0, 8).map((s) => (
                      <TouchableOpacity
                        key={`${s.kind}:${s.id}`}
                        style={styles.chipCard}
                        activeOpacity={0.9}
                        onPress={() => {
                          const lines: string[] = [];
                          lines.push(stripEmojis(s.name));
                          if (typeof s.exactPrice === 'number' && s.exactPrice > 0) lines.push(`₹${Math.round(s.exactPrice)}`);
                          if (Array.isArray(s.checklistItems) && s.checklistItems.length > 0) {
                            lines.push('');
                            lines.push('Checkpoints:');
                            s.checklistItems.slice(0, 12).forEach((x) => lines.push(`- ${stripEmojis(x)}`));
                            if (s.checklistItems.length > 12) lines.push(`+${s.checklistItems.length - 12} more`);
                          }
                          // Use a lightweight native modal via Alert
                          Alert.alert('Details', lines.join('\n'), [{ text: 'OK' }]);
                        }}
                      >
                        <Text style={styles.chipTitle}>{stripEmojis(s.name)}</Text>
                        {typeof s.exactPrice === 'number' && s.exactPrice > 0 ? (
                          <Text style={[styles.chipSub, { color: '#0E7A2D', fontWeight: '900' }]}>₹{Math.round(s.exactPrice)}</Text>
                        ) : null}
                        <Text style={styles.chipSub}>{Array.isArray(s.checklistItems) && s.checklistItems.length > 0 ? 'View details' : 'Details'}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>
          ))}

          {chatLoading ? (
            <View style={styles.typingRow}>
              <View style={styles.typingDot} />
              <View style={styles.typingDot} />
              <View style={styles.typingDot} />
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Type your request..."
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
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    gap: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  botAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  headerSub: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.gray[600],
  },
  loginBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  loginBtnText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '900',
    color: COLORS.primary,
  },
  loggedInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  loggedInText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  chat: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  uiTitle: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '900',
    color: COLORS.gray[600],
    marginLeft: 4,
  },
  chipCard: {
    minWidth: 220,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  chipSub: {
    marginTop: 4,
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.gray[600],
  },
  workshopCard: {
    minWidth: 260,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.08)',
  },
  workshopName: { fontSize: FONT_SIZES.sm, fontWeight: '900', color: COLORS.primaryDark },
  workshopSub: { marginTop: 4, fontSize: FONT_SIZES.xs, fontWeight: '700', color: COLORS.gray[600] },
  workshopMeta: { marginTop: 6, fontSize: 12, fontWeight: '700', color: COLORS.gray[700] },
  primaryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  ghostBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.12)',
  },
  ghostBtnText: { color: COLORS.primaryDark, fontWeight: '900', fontSize: 12 },
  msgRow: {
    marginTop: SPACING.sm,
    alignItems: 'flex-start',
  },
  msgRowUser: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '80%',
    padding: 16,
    borderRadius: 16,
  },
  bubbleBot: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderTopLeftRadius: 6,
  },
  bubbleUser: {
    backgroundColor: COLORS.primary,
    borderTopRightRadius: 6,
  },
  bubbleText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 18,
  },
  bubbleTextUser: {
    color: '#fff',
  },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginLeft: 6 },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#9CA3AF',
  },

  composer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: '#111827',
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


