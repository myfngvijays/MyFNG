import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SectionList,
  Alert,
  RefreshControl,
  Animated,
  Easing,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { clickToCallCustomer } from '../../../lib/clickToCall';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING, SHADOWS } from '../../../constants/theme';
import CallRecordingInlinePlayer from '../../../components/telecaller/CallRecordingInlinePlayer';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'] as const;
type Tab = 'keypad' | 'recents' | 'missed';

type HistoryRow = {
  id: string;
  created_at: string;
  call_type?: string | null;
  call_status?: string | null;
  call_duration?: number | null;
  phone_number?: string | null;
  is_missed?: boolean;
  has_recording?: boolean;
  lead?: {
    id: string;
    lead_number?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
  } | null;
};

type ContactGroup = {
  key: string;
  phone: string;
  name: string;
  leadId: string;
  leadNumber: string;
  calls: HistoryRow[];
  callCount: number;
  talkedCount: number;
  totalTalkSec: number;
  lastAt: string;
  hasMissed: boolean;
  recordingCount: number;
};

type CallPhase = 'initiating' | 'ringing' | 'connected' | 'ended' | 'failed' | 'missed';

type ActiveCall = {
  to: string;
  name?: string | null;
  leadId?: string | null;
  phase: CallPhase;
  sessionId?: string | null;
  error?: string | null;
  answeredAt?: number | null;
  endedAt?: number | null;
  durationSec?: number | null;
};

function normalizePhone10(raw: string): string | null {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length >= 10) return d.slice(-10);
  if (d.length >= 8) return d;
  return null;
}

function formatDur(sec: unknown): string {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return '';
  const s = Math.round(n);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function formatLiveTimer(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

function wasTalked(row: HistoryRow): boolean {
  const dur = Number(row.call_duration) || 0;
  if (dur > 0) return true;
  return String(row.call_status || '').toUpperCase() === 'ANSWERED';
}

function groupCallsByContact(rows: HistoryRow[]): ContactGroup[] {
  const map = new Map<string, ContactGroup>();
  for (const row of rows) {
    const phone =
      normalizePhone10(String(row.phone_number || '')) ||
      normalizePhone10(String(row.lead?.customer_phone || '')) ||
      '';
    const leadId = row.lead?.id ? String(row.lead.id) : '';
    const key = leadId ? `lead:${leadId}` : phone ? `phone:${phone}` : `call:${row.id}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        phone,
        name: String(row.lead?.customer_name || '').trim(),
        leadId,
        leadNumber: String(row.lead?.lead_number || '').trim(),
        calls: [],
        callCount: 0,
        talkedCount: 0,
        totalTalkSec: 0,
        lastAt: row.created_at,
        hasMissed: false,
        recordingCount: 0,
      };
      map.set(key, g);
    }
    g.calls.push(row);
    g.callCount += 1;
    if (wasTalked(row)) {
      g.talkedCount += 1;
      g.totalTalkSec += Math.max(0, Number(row.call_duration) || 0);
    }
    if (row.is_missed) g.hasMissed = true;
    if (row.has_recording) g.recordingCount += 1;
    if (!g.name && row.lead?.customer_name) g.name = String(row.lead.customer_name).trim();
    if (!g.leadId && leadId) g.leadId = leadId;
    if (!g.leadNumber && row.lead?.lead_number) g.leadNumber = String(row.lead.lead_number);
    if (!g.phone && phone) g.phone = phone;
    if (new Date(row.created_at).getTime() > new Date(g.lastAt).getTime()) {
      g.lastAt = row.created_at;
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
  );
}

function contactKeyForRow(row: HistoryRow): string {
  const phone =
    normalizePhone10(String(row.phone_number || '')) ||
    normalizePhone10(String(row.lead?.customer_phone || '')) ||
    '';
  const leadId = row.lead?.id ? String(row.lead.id) : '';
  if (leadId) return `lead:${leadId}`;
  if (phone) return `phone:${phone}`;
  return `call:${row.id}`;
}

function istYmd(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  } catch {
    return String(iso || '').slice(0, 10);
  }
}

function daySectionTitle(iso: string): string {
  const day = istYmd(iso);
  const today = istYmd(new Date().toISOString());
  const yest = istYmd(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  if (day === today) return 'Today';
  if (day === yest) return 'Yesterday';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return day;
  }
}

function buildDaySections(rows: HistoryRow[]): { title: string; data: HistoryRow[] }[] {
  const order: string[] = [];
  const map = new Map<string, HistoryRow[]>();
  for (const row of rows) {
    const title = daySectionTitle(row.created_at);
    if (!map.has(title)) {
      map.set(title, []);
      order.push(title);
    }
    map.get(title)!.push(row);
  }
  return order.map((title) => ({ title, data: map.get(title)! }));
}

export default function CrmDialerScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const leadDetailScreen = 'TelecallerLeadDetail';
  const [tab, setTab] = useState<Tab>('keypad');
  const [digits, setDigits] = useState('');
  const [calling, setCalling] = useState(false);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [q, setQ] = useState('');
  const [qApplied, setQApplied] = useState('');
  const [loading, setLoading] = useState(false);
  const [calls, setCalls] = useState<HistoryRow[]>([]);
  const [missedCount, setMissedCount] = useState(0);
  const [historyGroup, setHistoryGroup] = useState<ContactGroup | null>(null);
  const [playingCallLogId, setPlayingCallLogId] = useState<string | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  const display = useMemo(() => {
    const d = digits.replace(/\D/g, '');
    if (d.length <= 5) return d;
    if (d.length <= 10) return `${d.slice(0, 5)} ${d.slice(5)}`;
    return d;
  }, [digits]);

  const appendDigit = useCallback((k: string) => {
    setDigits((p) => `${p}${k}`.slice(0, 15));
  }, []);

  const backspaceDigit = useCallback(() => {
    setDigits((p) => p.slice(0, -1));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setQApplied(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Pulse while waiting for real answer
  useEffect(() => {
    if (!activeCall || (activeCall.phase !== 'ringing' && activeCall.phase !== 'initiating')) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.18,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [activeCall?.phase, pulse]);

  // Poll Smartflo session — NEVER invent "connected"
  useEffect(() => {
    const sessionId = activeCall?.sessionId;
    if (
      !sessionId ||
      !activeCall ||
      activeCall.phase === 'failed' ||
      activeCall.phase === 'ended' ||
      activeCall.phase === 'missed'
    ) {
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const data = await apiFetch<any>(
          `/api/telecaller/crm/dial-session?id=${encodeURIComponent(sessionId)}`,
        );
        const s = data?.session;
        if (cancelled || !s) return;
        const st = String(s.status || '').toUpperCase();
        if (st === 'ANSWERED') {
          setActiveCall((prev) =>
            prev && prev.sessionId === sessionId
              ? {
                  ...prev,
                  phase: 'connected',
                  answeredAt: s.answered_at
                    ? new Date(s.answered_at).getTime()
                    : prev.answeredAt || Date.now(),
                }
              : prev,
          );
          if (typeof s.elapsed_seconds === 'number') setElapsedSec(s.elapsed_seconds);
        } else if (st === 'ENDED') {
          setActiveCall((prev) =>
            prev && prev.sessionId === sessionId
              ? {
                  ...prev,
                  phase: 'ended',
                  answeredAt: s.answered_at
                    ? new Date(s.answered_at).getTime()
                    : prev.answeredAt,
                  endedAt: s.ended_at ? new Date(s.ended_at).getTime() : Date.now(),
                  durationSec:
                    s.duration_seconds ??
                    s.elapsed_seconds ??
                    prev.durationSec ??
                    null,
                }
              : prev,
          );
          if (typeof s.elapsed_seconds === 'number') setElapsedSec(s.elapsed_seconds);
          else if (typeof s.duration_seconds === 'number') setElapsedSec(s.duration_seconds);
        } else if (st === 'MISSED' || st === 'FAILED') {
          setActiveCall((prev) =>
            prev && prev.sessionId === sessionId
              ? {
                  ...prev,
                  phase: st === 'MISSED' ? 'missed' : 'failed',
                  error: s.error_message || (st === 'MISSED' ? 'Customer missed' : 'Call failed'),
                  endedAt: Date.now(),
                }
              : prev,
          );
        }
      } catch {
        /* keep current honest state */
      }
    };

    void poll();
    const id = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [activeCall?.sessionId, activeCall?.phase]);

  // Live timer only after Smartflo ANSWERED
  useEffect(() => {
    if (!activeCall || activeCall.phase !== 'connected' || !activeCall.answeredAt) {
      return;
    }
    const tick = () => {
      setElapsedSec(Math.floor((Date.now() - Number(activeCall.answeredAt)) / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeCall?.phase, activeCall?.answeredAt]);

  const dismissCall = useCallback(() => {
    setActiveCall(null);
    setElapsedSec(0);
  }, []);

  const loadHistory = useCallback(async () => {
    if (tab === 'keypad') return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        filter: tab === 'missed' ? 'missed' : 'all',
        days: '14',
        limit: '80',
      });
      if (qApplied) params.set('q', qApplied);
      const data = await apiFetch<any>(`/api/telecaller/crm/dialer-history?${params}`);
      setCalls(Array.isArray(data?.calls) ? data.calls : []);
      setMissedCount(Number(data?.missed_count || 0));
    } catch (e: any) {
      setCalls([]);
      Alert.alert('History', e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [tab, qApplied]);

  useEffect(() => {
    void loadHistory();
    setHistoryGroup(null);
    setPlayingCallLogId(null);
  }, [loadHistory]);

  const contactGroups = useMemo(() => groupCallsByContact(calls), [calls]);
  const daySections = useMemo(() => buildDaySections(calls), [calls]);

  const openContactHistory = useCallback(
    (row: HistoryRow) => {
      const key = contactKeyForRow(row);
      const found = contactGroups.find((g) => g.key === key);
      if (found) {
        setHistoryGroup(found);
        setPlayingCallLogId(null);
        return;
      }
      // Fallback single-call group
      const phone =
        normalizePhone10(String(row.phone_number || '')) ||
        normalizePhone10(String(row.lead?.customer_phone || '')) ||
        '';
      setHistoryGroup({
        key,
        phone,
        name: String(row.lead?.customer_name || '').trim(),
        leadId: row.lead?.id ? String(row.lead.id) : '',
        leadNumber: String(row.lead?.lead_number || '').trim(),
        calls: [row],
        callCount: 1,
        talkedCount: wasTalked(row) ? 1 : 0,
        totalTalkSec: Math.max(0, Number(row.call_duration) || 0),
        lastAt: row.created_at,
        hasMissed: Boolean(row.is_missed),
        recordingCount: row.has_recording ? 1 : 0,
      });
      setPlayingCallLogId(null);
    },
    [contactGroups],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<any>(
          '/api/telecaller/crm/dialer-history?filter=all&days=14&limit=80',
        );
        if (!cancelled) setMissedCount(Number(data?.missed_count || 0));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openLead = useCallback(
    (leadId: string) => {
      if (!leadId) return;
      dismissCall();
      navigation.navigate(leadDetailScreen, { leadId });
    },
    [navigation, leadDetailScreen, dismissCall],
  );

  const openAddLead = useCallback(
    (phone: string) => {
      const p = normalizePhone10(phone);
      if (!p) {
        Alert.alert('Add lead', 'Valid phone required');
        return;
      }
      dismissCall();
      setHistoryGroup(null);
      const state = navigation.getState?.() as any;
      const names: string[] = Array.isArray(state?.routes)
        ? state.routes.map((r: any) => String(r?.name || ''))
        : [];
      const shell = names.includes('LeadManagerAdvancedCRM')
        ? 'LeadManagerAdvancedCRM'
        : names.includes('TelecallerDashboard')
          ? 'TelecallerDashboard'
          : null;
      if (shell) {
        navigation.navigate(shell, { openAddLeadPhone: p });
        return;
      }
      try {
        navigation.navigate('TelecallerCreateLead', { phone: p });
      } catch {
        Alert.alert('Add lead', 'Add Lead screen open nahi ho paya.');
      }
    },
    [navigation, dismissCall],
  );

  const dial = useCallback(
    async (raw?: string, meta?: { name?: string | null; leadId?: string | null }) => {
      const to = normalizePhone10(raw ?? digits);
      if (!to) {
        Alert.alert('Dialer', 'Enter a valid 10-digit mobile number');
        return;
      }
      if (calling) return;
      setDigits(to);
      setElapsedSec(0);
      setActiveCall({
        to,
        name: meta?.name || null,
        leadId: meta?.leadId || null,
        phase: 'initiating',
      });
      setCalling(true);
      try {
        const attempt = () =>
          clickToCallCustomer({
            customerPhone: to,
            leadId: meta?.leadId,
            fallbackToDialer: false,
            silent: true,
          });

        let result = await Promise.race([
          attempt(),
          new Promise<{ ok: false; timedOut: true }>((resolve) =>
            setTimeout(() => resolve({ ok: false, timedOut: true }), 32_000),
          ),
        ]);

        if (
          !('timedOut' in result && result.timedOut) &&
          !result.ok &&
          /providers?\s+failed|temporarily|busy|try again/i.test(String(result.error || '')) &&
          !/missed by agent/i.test(String(result.error || ''))
        ) {
          await new Promise((r) => setTimeout(r, 1500));
          result = await Promise.race([
            attempt(),
            new Promise<{ ok: false; timedOut: true }>((resolve) =>
              setTimeout(() => resolve({ ok: false, timedOut: true }), 32_000),
            ),
          ]);
        }

        if ('timedOut' in result && result.timedOut) {
          setActiveCall((prev) =>
            prev
              ? {
                  ...prev,
                  phase: 'failed',
                  error:
                    'Server did not respond within 32s. Try again; if it fails again, check your phone in Click to Call setup.',
                }
              : {
                  to,
                  name: meta?.name || null,
                  leadId: meta?.leadId || null,
                  phase: 'failed',
                  error: 'Server timeout — retry karo',
                },
          );
          return;
        }
        if (result.ok) {
          setActiveCall((prev) =>
            prev
              ? {
                  ...prev,
                  phase: 'ringing',
                  sessionId: result.sessionId || null,
                }
              : {
                  to,
                  name: meta?.name || null,
                  leadId: meta?.leadId || null,
                  phase: 'ringing',
                  sessionId: result.sessionId || null,
                },
          );
          if (tab !== 'keypad') void loadHistory();
        } else if (result.error) {
          setActiveCall((prev) =>
            prev
              ? { ...prev, phase: 'failed', error: result.error || 'Call failed' }
              : {
                  to,
                  name: meta?.name || null,
                  leadId: meta?.leadId || null,
                  phase: 'failed',
                  error: result.error || 'Call failed',
                },
          );
        }
      } finally {
        setCalling(false);
      }
    },
    [digits, calling, tab, loadHistory],
  );



  const renderCallRow = ({ item }: { item: HistoryRow }) => {
    const phone =
      normalizePhone10(String(item.phone_number || '')) ||
      normalizePhone10(String(item.lead?.customer_phone || '')) ||
      '';
    const name = String(item.lead?.customer_name || '').trim();
    const leadId = item.lead?.id ? String(item.lead.id) : '';
    const inbound = String(item.call_type || '').toUpperCase() === 'INBOUND';
    const iconName = item.is_missed
      ? 'call-outline'
      : inbound
        ? 'arrow-down'
        : 'arrow-up';
    const iconColor = item.is_missed ? COLORS.danger : inbound ? COLORS.primary : COLORS.success;

    return (
      <View style={[styles.rowCard, item.is_missed && styles.rowMissed]}>
        <View style={styles.rowMain}>
          <TouchableOpacity
            style={[styles.avatar, item.is_missed && styles.avatarMissed]}
            onPress={() => openContactHistory(item)}
            activeOpacity={0.8}
            accessibilityLabel="Open call history"
          >
            <Text style={[styles.avatarText, item.is_missed && { color: COLORS.danger }]}>
              {(name || phone || '?').charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>

          <View style={styles.rowBody}>
            <View style={styles.rowTitleLine}>
              <Ionicons name={iconName as any} size={13} color={iconColor} />
              <Text
                style={[styles.rowName, item.is_missed && styles.rowNameMissed]}
                numberOfLines={1}
              >
                {name || phone || 'Unknown'}
              </Text>
            </View>
            <Text style={styles.rowPhone} numberOfLines={1}>
              {phone || '—'}
              {item.lead?.lead_number ? ` · ${item.lead.lead_number}` : ''}
            </Text>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {[
                formatWhen(item.created_at),
                item.is_missed ? 'Missed' : wasTalked(item) ? 'Talked' : 'No answer',
                formatDur(item.call_duration) || null,
                item.has_recording ? 'Rec' : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>

          <View style={styles.rowIcons}>
            {phone ? (
              <TouchableOpacity
                style={styles.iconBtnCall}
                disabled={calling}
                onPress={() => void dial(phone, { name, leadId: leadId || null })}
                activeOpacity={0.85}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityLabel="Call"
              >
                <Ionicons name="call" size={18} color="#fff" />
              </TouchableOpacity>
            ) : null}
            {leadId ? (
              <TouchableOpacity
                style={styles.iconBtnLead}
                onPress={() => openLead(leadId)}
                activeOpacity={0.85}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityLabel="View lead"
              >
                <Ionicons name="eye-outline" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            ) : phone ? (
              <TouchableOpacity
                style={styles.iconBtnAdd}
                onPress={() => openAddLead(phone)}
                activeOpacity={0.85}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityLabel="Add lead"
              >
                <Ionicons name="person-add-outline" size={18} color="#B45309" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  const historyTalkLabel = historyGroup ? formatDur(historyGroup.totalTalkSec) : '';

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.heading} />
          </TouchableOpacity>
          <View style={styles.topTitleWrap}>
            <Text style={styles.topTitle}>Dialer</Text>
            <Text style={styles.topSub}>Click-to-call</Text>
          </View>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.segment}>
          {(
            [
              { id: 'keypad' as const, label: 'Keypad' },
              { id: 'recents' as const, label: 'Recents' },
              { id: 'missed' as const, label: 'Missed' },
            ] as const
          ).map((t) => {
            const on = tab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.segmentBtn, on && styles.segmentBtnOn]}
                onPress={() => setTab(t.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{t.label}</Text>
                {t.id === 'missed' && missedCount > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {missedCount > 99 ? '99+' : missedCount}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>

      {tab === 'keypad' ? (
        <View style={[styles.keypadPane, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.keypadCard}>
            <View style={styles.numberRow}>
              <Text style={[styles.numberDisplay, { flex: 1 }]} numberOfLines={1}>
                {display || ' '}
              </Text>
              <TouchableOpacity
                style={[styles.backspaceBtn, (!digits || calling) && { opacity: 0.35 }]}
                onPress={backspaceDigit}
                onLongPress={() => setDigits('')}
                disabled={!digits || calling}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Backspace"
              >
                <Ionicons name="backspace-outline" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.pasteInput}
              value={digits}
              onChangeText={(t) => {
                setDigits(t.replace(/[^\d*#+]/g, '').slice(0, 15));
              }}
              keyboardType="phone-pad"
              placeholder="Type or paste number"
              placeholderTextColor={COLORS.textSecondary}
              editable={!calling}
            />

            <View style={styles.pad}>
              {KEYS.map((k) => (
                <TouchableOpacity
                  key={k}
                  style={styles.key}
                  disabled={calling}
                  onPress={() => appendDigit(k)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.keyText}>{k}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.keypadFooter}>
              <TouchableOpacity
                style={[
                  styles.callBtn,
                  (!normalizePhone10(digits) || calling) && styles.callBtnDisabled,
                ]}
                disabled={!normalizePhone10(digits) || calling}
                onPress={() => void dial()}
                activeOpacity={0.9}
              >
                {calling ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Ionicons name="call" size={28} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.listPane, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={COLORS.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={q}
              onChangeText={setQ}
              placeholder="Search name, phone, lead #"
              placeholderTextColor={COLORS.textSecondary}
              clearButtonMode="while-editing"
            />
          </View>
          <SectionList
            sections={daySections}
            keyExtractor={(item) => item.id}
            renderItem={renderCallRow}
            renderSectionHeader={({ section: { title } }) => (
              <Text style={styles.sectionHeader}>{title}</Text>
            )}
            stickySectionHeadersEnabled
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={() => void loadHistory()} />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                {loading ? (
                  <ActivityIndicator color={COLORS.primary} />
                ) : (
                  <>
                    <Ionicons
                      name={tab === 'missed' ? 'call-outline' : 'time-outline'}
                      size={32}
                      color="#CBD5E1"
                    />
                    <Text style={styles.emptyTitle}>
                      {tab === 'missed' ? 'No missed calls' : 'No recent calls'}
                    </Text>
                    <Text style={styles.emptySub}>
                      {qApplied ? 'Try another search' : 'Last 14 days show here'}
                    </Text>
                  </>
                )}
              </View>
            }
            contentContainerStyle={calls.length === 0 ? styles.emptyList : { paddingBottom: 24 }}
          />
        </View>
      )}

      <Modal
        visible={Boolean(historyGroup)}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setHistoryGroup(null);
          setPlayingCallLogId(null);
        }}
      >
        <SafeAreaView style={styles.histSafe} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.histTop}>
            <TouchableOpacity
              onPress={() => {
                setHistoryGroup(null);
                setPlayingCallLogId(null);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={COLORS.heading} />
            </TouchableOpacity>
            <Text style={styles.histTitle} numberOfLines={1}>
              {historyGroup?.name || historyGroup?.phone || 'Call history'}
            </Text>
            <View style={{ width: 24 }} />
          </View>
          {historyGroup ? (
            <>
              <View style={styles.histSummary}>
                <Text style={styles.histPhone}>
                  {historyGroup.phone || '—'}
                  {historyGroup.leadNumber ? ` · ${historyGroup.leadNumber}` : ''}
                </Text>
                <Text style={styles.histStats}>
                  {[
                    `${historyGroup.callCount} call${historyGroup.callCount === 1 ? '' : 's'}`,
                    `${historyGroup.talkedCount} talked`,
                    historyTalkLabel ? `${historyTalkLabel} talk` : null,
                    historyGroup.recordingCount > 0
                      ? `${historyGroup.recordingCount} recording${
                          historyGroup.recordingCount === 1 ? '' : 's'
                        }`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                <View style={styles.histActions}>
                  {historyGroup.phone ? (
                    <TouchableOpacity
                      style={styles.histCallBtn}
                      disabled={calling}
                      onPress={() => {
                        const g = historyGroup;
                        setHistoryGroup(null);
                        void dial(g.phone, { name: g.name, leadId: g.leadId || null });
                      }}
                    >
                      <Ionicons name="call" size={16} color="#fff" />
                      <Text style={styles.histCallBtnText}>Call</Text>
                    </TouchableOpacity>
                  ) : null}
                  {historyGroup.leadId ? (
                    <TouchableOpacity
                      style={styles.histLeadBtn}
                      onPress={() => {
                        const id = historyGroup.leadId;
                        setHistoryGroup(null);
                        openLead(id);
                      }}
                    >
                      <Ionicons name="eye-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.histLeadBtnText}>View lead</Text>
                    </TouchableOpacity>
                  ) : historyGroup.phone ? (
                    <TouchableOpacity
                      style={styles.histAddBtn}
                      onPress={() => openAddLead(historyGroup.phone)}
                    >
                      <Ionicons name="person-add-outline" size={16} color="#B45309" />
                      <Text style={styles.histAddBtnText}>Add lead</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: SPACING.md, paddingBottom: 40, gap: 8 }}
              >
                {historyGroup.calls.map((c) => {
                  const cIn = String(c.call_type || '').toUpperCase() === 'INBOUND';
                  const cIcon = c.is_missed
                    ? 'call-outline'
                    : cIn
                      ? 'arrow-down'
                      : 'arrow-up';
                  const cColor = c.is_missed
                    ? COLORS.danger
                    : cIn
                      ? COLORS.primary
                      : COLORS.success;
                  const isPlaying = Boolean(c.has_recording && playingCallLogId === c.id);
                  return (
                    <View key={c.id} style={styles.expandRow}>
                      <View style={styles.expandRowTop}>
                        <Ionicons name={cIcon as any} size={14} color={cColor} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.expandWhen}>{formatWhen(c.created_at)}</Text>
                          <Text style={styles.expandMeta}>
                            {[
                              c.is_missed ? 'Missed' : wasTalked(c) ? 'Talked' : 'No answer',
                              formatDur(c.call_duration) || null,
                              String(c.call_status || '').replace(/_/g, ' ') || null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                        </View>
                        {c.has_recording ? (
                          <TouchableOpacity
                            style={[styles.playChip, isPlaying && styles.playChipActive]}
                            onPress={() =>
                              setPlayingCallLogId((prev) => (prev === c.id ? null : c.id))
                            }
                          >
                            <Text style={styles.playChipText}>
                              {isPlaying ? '■ Stop' : '▶ Play'}
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.noRec}>No recording</Text>
                        )}
                      </View>
                      {isPlaying ? (
                        <CallRecordingInlinePlayer
                          callLogId={c.id}
                          onClose={() => setPlayingCallLogId(null)}
                        />
                      ) : null}
                    </View>
                  );
                })}
              </ScrollView>
            </>
          ) : null}
        </SafeAreaView>
      </Modal>

      {/* Live dial overlay */}
      {activeCall ? (
        <View style={styles.ringOverlay} pointerEvents="auto">
          <View style={[styles.ringCard, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            {activeCall.phase === 'initiating' || activeCall.phase === 'ringing' ? (
              <>
                <Text style={styles.ringEyebrow}>
                  {activeCall.phase === 'initiating' ? 'CONNECTING…' : 'RINGING…'}
                </Text>
                <Animated.View style={[styles.ringPulse, { transform: [{ scale: pulse }] }]}>
                  <View style={styles.ringCircle}>
                    {activeCall.phase === 'initiating' ? (
                      <ActivityIndicator color="#fff" size="large" />
                    ) : (
                      <Ionicons name="call" size={36} color="#fff" />
                    )}
                  </View>
                </Animated.View>
                <Text style={styles.ringTitle}>
                  {activeCall.phase === 'initiating'
                    ? 'Call is starting'
                    : 'Pick up your phone'}
                </Text>
                <Text style={styles.ringSub}>
                  Your phone will ring first. Live duration will show here after the customer
                  connects.
                </Text>
                <Text style={styles.ringName}>{activeCall.name || activeCall.to}</Text>
                {activeCall.name ? (
                  <Text style={styles.ringPhone}>{activeCall.to}</Text>
                ) : null}
                <View style={styles.ringActions}>
                  {activeCall.leadId ? (
                    <TouchableOpacity
                      style={styles.ringLeadBtn}
                      onPress={() => openLead(String(activeCall.leadId))}
                    >
                      <Ionicons name="person-outline" size={18} color={COLORS.primary} />
                      <Text style={styles.ringLeadText}>View lead</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={styles.ringDismiss} onPress={dismissCall}>
                    <Text style={styles.ringDismissText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}

            {activeCall.phase === 'connected' ? (
              <>
                <Text style={[styles.ringEyebrow, { color: COLORS.success }]}>
                  LIVE · CUSTOMER CONNECTED
                </Text>
                <View style={[styles.ringCircle, { backgroundColor: COLORS.heading }]}>
                  <Ionicons name="call" size={36} color="#fff" />
                </View>
                <Text style={styles.liveTimer}>{formatLiveTimer(elapsedSec)}</Text>
                <Text style={styles.ringTitle}>Call in progress</Text>
                <Text style={styles.ringSub}>
                  This timer started after the customer answered. Status will update after you hang
                  up.
                </Text>
                <Text style={styles.ringName}>{activeCall.name || activeCall.to}</Text>
                {activeCall.name ? (
                  <Text style={styles.ringPhone}>{activeCall.to}</Text>
                ) : null}
                <View style={styles.ringActions}>
                  {activeCall.leadId ? (
                    <TouchableOpacity
                      style={styles.ringLeadBtn}
                      onPress={() => openLead(String(activeCall.leadId))}
                    >
                      <Ionicons name="person-outline" size={18} color={COLORS.primary} />
                      <Text style={styles.ringLeadText}>View lead</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={styles.ringDismiss} onPress={dismissCall}>
                    <Text style={styles.ringDismissText}>Minimize</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}

            {activeCall.phase === 'ended' ? (
              <>
                <Text style={[styles.ringEyebrow, { color: COLORS.textSecondary }]}>
                  CALL ENDED
                </Text>
                <View style={[styles.ringCircle, { backgroundColor: '#64748B' }]}>
                  <Ionicons name="checkmark" size={36} color="#fff" />
                </View>
                <Text style={styles.liveTimer}>
                  {formatLiveTimer(
                    activeCall.durationSec != null
                      ? activeCall.durationSec
                      : elapsedSec,
                  )}
                </Text>
                <Text style={styles.ringTitle}>Call complete</Text>
                <Text style={styles.ringSub}>
                  Duration is from the call. Recording may sync in Activity.
                </Text>
                <Text style={styles.ringName}>{activeCall.name || activeCall.to}</Text>
                <View style={styles.ringActions}>
                  <TouchableOpacity style={styles.ringDismiss} onPress={dismissCall}>
                    <Text style={styles.ringDismissText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}

            {activeCall.phase === 'missed' || activeCall.phase === 'failed' ? (
              <>
                <Text style={[styles.ringEyebrow, { color: COLORS.danger }]}>
                  {activeCall.phase === 'missed' ? 'MISSED' : 'CALL FAILED'}
                </Text>
                <View style={[styles.ringCircle, { backgroundColor: COLORS.danger }]}>
                  <Ionicons name="close" size={36} color="#fff" />
                </View>
                <Text style={styles.ringTitle}>
                  {activeCall.phase === 'missed' ? 'Connect nahi hua' : 'Call nahi lagi'}
                </Text>
                <Text style={styles.ringSub}>{activeCall.error || 'Call gateway error'}</Text>
                <Text style={styles.ringName}>{activeCall.name || activeCall.to}</Text>
                <View style={styles.ringActions}>
                  <TouchableOpacity
                    style={styles.ringConnectedBtn}
                    disabled={calling}
                    onPress={() =>
                      void dial(activeCall.to, {
                        name: activeCall.name,
                        leadId: activeCall.leadId,
                      })
                    }
                  >
                    <Ionicons name="refresh" size={18} color="#fff" />
                    <Text style={styles.ringConnectedText}>
                      {calling ? 'Retrying…' : 'Retry call'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.ringLeadBtn} onPress={dismissCall}>
                    <Text style={styles.ringLeadText}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EEF4FB' },
  safe: { backgroundColor: '#EEF4FB' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 6,
    minHeight: 48,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitleWrap: { flex: 1, alignItems: 'center' },
  topTitle: { fontSize: 18, fontWeight: '800', color: COLORS.heading },
  topSub: { marginTop: 1, fontSize: 11, color: COLORS.textSecondary },
  segment: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md,
    marginBottom: 10,
    padding: 3,
    borderRadius: 14,
    backgroundColor: '#DCE7F5',
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 11,
  },
  segmentBtnOn: {
    backgroundColor: '#fff',
    ...SHADOWS.small,
  },
  segmentText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  segmentTextOn: { color: COLORS.heading, fontWeight: '800' },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  keypadPane: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
  },
  keypadCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: '#D9E6F5',
    ...SHADOWS.medium,
  },
  numberDisplay: {
    textAlign: 'center',
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: 1.2,
    color: COLORS.heading,
    minHeight: 40,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
  },
  backspaceBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F7FC',
  },
  pasteInput: {
    marginTop: 4,
    marginBottom: 14,
    textAlign: 'center',
    fontSize: 13,
    color: COLORS.textSecondary,
    paddingVertical: 6,
  },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  key: {
    width: '30%',
    aspectRatio: 1,
    maxHeight: 74,
    marginBottom: 12,
    borderRadius: 999,
    backgroundColor: '#F3F7FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { fontSize: 28, fontWeight: '500', color: COLORS.heading },
  keypadFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  callBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.success,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  callBtnDisabled: { opacity: 0.4, shadowOpacity: 0 },

  listPane: { flex: 1, paddingHorizontal: SPACING.md },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9E6F5',
    paddingHorizontal: 12,
    marginBottom: 10,
    ...SHADOWS.small,
  },
  searchInput: { flex: 1, paddingVertical: 12, color: COLORS.textPrimary, fontSize: 14 },
  rowCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#D9E6F5',
    ...SHADOWS.small,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowMissed: { borderColor: '#FECACA', backgroundColor: '#FFF8F8' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F1FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMissed: { backgroundColor: '#FEE2E2' },
  avatarText: { fontWeight: '800', fontSize: 15, color: COLORS.primary },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowName: { flex: 1, fontSize: 15, fontWeight: '800', color: COLORS.heading },
  rowNameMissed: { color: COLORS.danger },
  rowPhone: { marginTop: 1, fontSize: 12, color: COLORS.textSecondary },
  rowMeta: { marginTop: 1, fontSize: 11, color: '#94A3B8' },
  rowIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtnCall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnLead: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F1FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnAdd: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.heading,
    backgroundColor: '#EEF4FB',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 6,
    marginTop: 4,
  },
  expandRow: {
    backgroundColor: '#F8FBFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E8EEF7',
  },
  expandRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expandWhen: { fontSize: 13, fontWeight: '700', color: COLORS.heading },
  expandMeta: { marginTop: 2, fontSize: 11, color: COLORS.textSecondary },
  playChip: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  playChipActive: { backgroundColor: '#DDD6FE' },
  playChipText: { color: '#5B21B6', fontSize: 11, fontWeight: '700' },
  noRec: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
  histSafe: { flex: 1, backgroundColor: '#EEF4FB' },
  histTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EEF7',
  },
  histTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.heading,
    marginHorizontal: 8,
  },
  histSummary: {
    backgroundColor: '#fff',
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EEF7',
  },
  histPhone: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  histStats: { marginTop: 4, fontSize: 13, fontWeight: '700', color: COLORS.heading },
  histActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  histCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.success,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  histCallBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  histLeadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F1FF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  histLeadBtnText: { color: COLORS.primary, fontWeight: '800', fontSize: 13 },
  histAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  histAddBtnText: { color: '#B45309', fontWeight: '800', fontSize: 13 },

  empty: { alignItems: 'center', paddingVertical: 56 },
  emptyList: { flexGrow: 1 },
  emptyTitle: { marginTop: 10, fontWeight: '700', color: COLORS.textSecondary },
  emptySub: { marginTop: 4, fontSize: 12, color: '#94A3B8' },

  ringOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    backgroundColor: 'rgba(2, 20, 48, 0.72)',
    justifyContent: 'flex-end',
  },
  ringCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    alignItems: 'center',
  },
  ringEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: COLORS.success,
    marginBottom: 16,
  },
  ringPulse: { marginBottom: 16 },
  ringCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.success,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  ringTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.heading,
    textAlign: 'center',
  },
  ringSub: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  ringName: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.heading,
  },
  ringPhone: {
    marginTop: 4,
    fontSize: 15,
    color: COLORS.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  ringActions: {
    width: '100%',
    marginTop: 22,
    gap: 10,
  },
  ringLeadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: '#E8F1FF',
    paddingVertical: 14,
  },
  ringLeadText: { fontWeight: '800', color: COLORS.primary, fontSize: 15 },
  ringDismiss: {
    borderRadius: 14,
    backgroundColor: COLORS.heading,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ringDismissText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  ringConnectedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: COLORS.success,
    paddingVertical: 14,
  },
  ringConnectedText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  ringEndBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: COLORS.danger,
    paddingVertical: 14,
  },
  ringEndText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  liveTimer: {
    marginTop: 12,
    marginBottom: 4,
    fontSize: 40,
    fontWeight: '200',
    color: COLORS.heading,
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
});
