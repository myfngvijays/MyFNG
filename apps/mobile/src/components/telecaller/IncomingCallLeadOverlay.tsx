import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiFetch } from '../../lib/api';
import { LeadBrainStrip } from './LeadBrainCard';
import { COLORS, SHADOWS } from '../../constants/theme';

type DialLead = {
  id?: string | null;
  lead_number?: string | null;
  customer_name?: string | null;
  vehicle_number?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  city?: string | null;
};

type DialSession = {
  id: string;
  status?: string | null;
  customer_phone?: string | null;
  lead_id?: string | null;
  lead?: DialLead | null;
};

function vehicleLine(lead?: DialLead | null): string {
  return [lead?.vehicle_make, lead?.vehicle_model, lead?.vehicle_number]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .join(' ');
}

export default function IncomingCallLeadOverlay({
  leadScreen = 'TelecallerLeadDetail',
  onOpenLead,
  showMlInsights = false,
}: {
  leadScreen?: string;
  onOpenLead?: (leadId: string) => void;
  showMlInsights?: boolean;
}) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<DialSession | null>(null);
  const [minimized, setMinimized] = useState(false);
  const lastIdRef = useRef<string | null>(null);
  const hiddenIdsRef = useRef<Set<string>>(new Set());

  const onDialer = useNavigationState((state) => {
    if (!state) return false;
    let route: any = state.routes[state.index];
    while (route?.state?.routes) {
      route = route.state.routes[route.state.index];
    }
    return String(route?.name || '') === 'CrmDialer';
  });

  const poll = useCallback(async () => {
    try {
      const json = await apiFetch<any>('/api/telecaller/crm/dial-session?active=1');
      const next = (json?.session || null) as DialSession | null;
      const st = String(next?.status || '').toUpperCase();
      if (!next?.id || !['INITIATED', 'RINGING', 'ANSWERED'].includes(st)) {
        setSession(null);
        return;
      }
      if (hiddenIdsRef.current.has(next.id)) {
        setSession(null);
        return;
      }
      if (lastIdRef.current !== next.id) {
        lastIdRef.current = next.id;
        setMinimized(false);
      }
      setSession(next);
    } catch {
      /* keep last */
    }
  }, []);

  useEffect(() => {
    void poll();
    const id = setInterval(poll, 2500);
    return () => clearInterval(id);
  }, [poll]);

  const lead = session?.lead || null;
  const leadId = String(session?.lead_id || lead?.id || '').trim();
  const name = String(lead?.customer_name || '').trim();
  const leadNumber = String(lead?.lead_number || '').trim();
  const vehicle = useMemo(() => vehicleLine(lead), [lead]);
  const city = String(lead?.city || '').trim();
  const connected = String(session?.status || '').toUpperCase() === 'ANSWERED';
  const title = name || leadNumber || 'Lead call';
  const subtitle = [leadNumber && leadNumber !== title ? leadNumber : null, vehicle, city]
    .filter(Boolean)
    .join(' · ');

  if (!session || onDialer) return null;

  const openLead = () => {
    if (!leadId) return;
    if (onOpenLead) {
      onOpenLead(leadId);
      return;
    }
    try {
      navigation.navigate(leadScreen, { leadId });
    } catch {
      /* ignore */
    }
  };

  if (minimized) {
    return (
      <TouchableOpacity
        style={[styles.chip, { bottom: Math.max(insets.bottom, 12) + 8 }]}
        onPress={() => setMinimized(false)}
        activeOpacity={0.9}
      >
        <View style={styles.chipIcon}>
          <Ionicons name="call" size={16} color="#fff" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.chipKicker}>{connected ? 'LIVE CALL' : 'PHONE RINGING'}</Text>
          <Text style={styles.chipTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Ionicons name="chevron-up" size={18} color="#fff" />
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.card, { bottom: Math.max(insets.bottom, 12) + 8 }]}>
      <View style={styles.row}>
        <View style={[styles.avatar, connected ? styles.avatarLive : styles.avatarRing]}>
          <Ionicons name="call" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.kicker}>
            {connected ? 'CUSTOMER CONNECTED' : 'PHONE RINGING — THIS LEAD'}
          </Text>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.sub} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          <Text style={styles.hint}>Phone pe DID dikhega. Lead yahan se open karo.</Text>
          {showMlInsights && leadId ? <LeadBrainStrip leadId={leadId} /> : null}
        </View>
        <View>
          <TouchableOpacity onPress={() => setMinimized(true)} hitSlop={8} style={styles.iconBtn}>
            <Ionicons name="chevron-down" size={18} color="#94a3b8" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (session?.id) hiddenIdsRef.current.add(session.id);
              setSession(null);
            }}
            hitSlop={8}
            style={styles.iconBtn}
          >
            <Ionicons name="close" size={18} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity style={styles.cta} onPress={openLead} disabled={!leadId} activeOpacity={0.9}>
        <Ionicons name="person" size={16} color="#fff" />
        <Text style={styles.ctaText}>Open lead</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 80,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    ...SHADOWS.large,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: { backgroundColor: '#10b981' },
  avatarLive: { backgroundColor: COLORS.primary },
  kicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#059669',
  },
  title: { marginTop: 2, fontSize: 16, fontWeight: '800', color: COLORS.primary },
  sub: { marginTop: 2, fontSize: 12, color: '#64748b' },
  hint: { marginTop: 4, fontSize: 11, color: '#94a3b8' },
  iconBtn: { padding: 4 },
  cta: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  chip: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 80,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...SHADOWS.large,
  },
  chipIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipKicker: { fontSize: 9, fontWeight: '800', color: '#a7f3d0', letterSpacing: 0.6 },
  chipTitle: { fontSize: 13, fontWeight: '800', color: '#fff' },
});
