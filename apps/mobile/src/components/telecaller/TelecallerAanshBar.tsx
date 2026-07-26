import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../lib/api';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';

const AANSH_SESSION_KEY = 'myfng:aansh_session';
const AANSH_SKIP_KEY = 'myfng:aansh_optional_skip';

type AanshItem = { aansh_id: number; system_name: string | null };
type AanshSession = { session_token: string; aansh_id: number; expires_at: string };

async function getStoredSession(): Promise<AanshSession | null> {
  try {
    const raw = await AsyncStorage.getItem(AANSH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AanshSession;
    if (!parsed?.session_token || parsed?.aansh_id == null) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function setStoredSession(session: AanshSession | null) {
  if (!session) {
    await AsyncStorage.removeItem(AANSH_SESSION_KEY);
    return;
  }
  await AsyncStorage.setItem(AANSH_SESSION_KEY, JSON.stringify(session));
}

export default function TelecallerAanshBar({
  onSessionChange,
  onClaimed,
}: {
  onSessionChange?: (session: AanshSession | null) => void;
  onClaimed?: () => void;
} = {}) {
  const [session, setSession] = useState<AanshSession | null>(null);
  const [available, setAvailable] = useState<AanshItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshAvailable = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{
        available?: AanshItem[];
        currentSession?: AanshSession | null;
      }>('/api/sarv-aansh/session/available');
      setAvailable(data.available || []);
      if (data.currentSession?.session_token) {
        setSession(data.currentSession);
        await setStoredSession(data.currentSession);
        onSessionChange?.(data.currentSession);
      }
    } catch (e) {
      console.error('Aansh available failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await getStoredSession();
      if (stored) {
        setSession(stored);
        onSessionChange?.(stored);
      }
      const skipped = await AsyncStorage.getItem(AANSH_SKIP_KEY);
      await refreshAvailable();
      if (!stored && !skipped) {
        setModalOpen(true);
      }
    })();
  }, [refreshAvailable]);

  useEffect(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (!session?.session_token) return;

    const beat = async () => {
      try {
        await apiFetch('/api/sarv-aansh/session/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_token: session.session_token }),
        });
      } catch (e) {
        console.error('Aansh heartbeat failed', e);
      }
    };
    beat();
    heartbeatRef.current = setInterval(beat, 60_000);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [session?.session_token]);

  const claim = async (aanshId: number) => {
    setClaiming(true);
    try {
      const data = await apiFetch<AanshSession & { success?: boolean }>('/api/sarv-aansh/session/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aansh_id: aanshId }),
      });
      const next = {
        session_token: data.session_token,
        aansh_id: data.aansh_id,
        expires_at: data.expires_at,
      };
      setSession(next);
      await setStoredSession(next);
      await AsyncStorage.removeItem(AANSH_SKIP_KEY);
      onSessionChange?.(next);
      // Claiming dialer means telecaller is on floor — punch in if needed
      try {
        await apiFetch('/api/telecaller/crm/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'punch_in', notes: `Aansh ${aanshId}` }),
        });
      } catch (punchErr: any) {
        const msg = String(punchErr?.message || '');
        if (msg.includes('282_telecaller') || msg.includes('telecaller_attendance') || msg.includes('relation')) {
          Alert.alert(
            'Attendance',
            'Dialer claimed, but attendance table is missing. Run database/282_telecaller_crm_advanced.sql on Supabase so Me → Punch In works.',
          );
        }
      }
      onClaimed?.();
      setModalOpen(false);
      setAvailable((prev) => prev.filter((i) => i.aansh_id !== aanshId));
    } catch (e: any) {
      Alert.alert('Aansh', e?.message || 'Failed to claim dialer');
    } finally {
      setClaiming(false);
    }
  };

  const release = async () => {
    if (!session?.session_token) return;
    try {
      await apiFetch('/api/sarv-aansh/session/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: session.session_token }),
      });
    } catch {
      // ignore
    }
    setSession(null);
    await setStoredSession(null);
    onSessionChange?.(null);
    await refreshAvailable();
  };

  const skip = async () => {
    await AsyncStorage.setItem(AANSH_SKIP_KEY, '1');
    setModalOpen(false);
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.bar, session ? styles.barActive : styles.barIdle]}
        onPress={() => {
          refreshAvailable();
          setModalOpen(true);
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="headset-outline" size={16} color={session ? COLORS.white : COLORS.primary} />
        <Text style={[styles.barText, session && styles.barTextActive]} numberOfLines={1}>
          {session ? `Aansh ${session.aansh_id}` : 'Select Aansh Dialer'}
        </Text>
        <Ionicons name="chevron-down" size={14} color={session ? COLORS.white : COLORS.primary} />
      </TouchableOpacity>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>SARV Aansh Dialer</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sheetSub}>
              Claim a dialer ID for outbound calls. Keep this session active while calling.
            </Text>

            {session ? (
              <View style={styles.currentBox}>
                <Text style={styles.currentLabel}>Current session</Text>
                <Text style={styles.currentValue}>Aansh {session.aansh_id}</Text>
                <TouchableOpacity style={styles.releaseBtn} onPress={release}>
                  <Text style={styles.releaseText}>Release Dialer</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {loading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
            ) : (
              <ScrollView style={{ maxHeight: 280 }}>
                {available.length === 0 ? (
                  <Text style={styles.empty}>No free Aansh IDs available right now.</Text>
                ) : (
                  available.map((item) => (
                    <TouchableOpacity
                      key={item.aansh_id}
                      style={styles.item}
                      disabled={claiming}
                      onPress={() => claim(item.aansh_id)}
                    >
                      <View>
                        <Text style={styles.itemTitle}>
                          {item.system_name || `Aansh ${item.aansh_id}`}
                        </Text>
                        <Text style={styles.itemSub}>ID: {item.aansh_id}</Text>
                      </View>
                      <Text style={styles.claimText}>{claiming ? '...' : 'Claim'}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            )}

            {!session && (
              <TouchableOpacity style={styles.skipBtn} onPress={skip}>
                <Text style={styles.skipText}>Skip for now</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.small,
  },
  barIdle: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  barActive: {
    backgroundColor: COLORS.primary,
  },
  barText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  barTextActive: {
    color: COLORS.white,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SPACING.lg,
    paddingBottom: 32,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textHeading,
  },
  sheetSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 14,
    lineHeight: 18,
  },
  currentBox: {
    backgroundColor: COLORS.primary + '10',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  currentLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  currentValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 2,
  },
  releaseBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.red,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  releaseText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 12,
  },
  empty: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    paddingVertical: 24,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: COLORS.gray[50],
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  itemSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  claimText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  skipBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  skipText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
});
