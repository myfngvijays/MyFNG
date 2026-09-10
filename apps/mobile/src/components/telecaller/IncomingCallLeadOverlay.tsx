import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  DeviceEventEmitter,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiFetch } from '../../lib/api';
import { LeadBrainStrip } from './LeadBrainCard';

export const CRM_OPEN_LEAD_EVENT = 'crm:openLead';
export const CRM_CALLER_ID_EVENT = 'crm:callerId';

type DialLead = {
  id?: string | null;
  lead_number?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  vehicle_number?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  city?: string | null;
};

type CallerCard = {
  id: string;
  lead_id?: string | null;
  status?: string | null;
  direction?: 'inbound' | 'outbound' | null;
  fromPush?: boolean;
  lead?: DialLead | null;
};

let pendingOpenLeadId: string | null = null;

export function requestOpenCrmLead(leadId: string) {
  const id = String(leadId || '').trim();
  if (!id) return;
  pendingOpenLeadId = id;
  DeviceEventEmitter.emit(CRM_OPEN_LEAD_EVENT, { leadId: id });
}

export function takePendingOpenCrmLead(): string | null {
  const id = pendingOpenLeadId;
  pendingOpenLeadId = null;
  return id;
}

export type CallerIdPayload = {
  leadId?: string | null;
  leadNumber?: string | null;
  customerName?: string | null;
  vehicle?: string | null;
  city?: string | null;
  direction?: string | null;
  sessionId?: string | null;
};

export function emitCallerIdCard(payload: CallerIdPayload) {
  DeviceEventEmitter.emit(CRM_CALLER_ID_EVENT, payload);
}

function vehicleLine(lead?: DialLead | null): string {
  return [lead?.vehicle_make, lead?.vehicle_model, lead?.vehicle_number]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .join(' ');
}

function initialOf(name: string): string {
  const ch = name.trim().charAt(0);
  return ch ? ch.toUpperCase() : '?';
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
  const [card, setCard] = useState<CallerCard | null>(null);
  const [minimized, setMinimized] = useState(false);
  const lastIdRef = useRef<string | null>(null);
  const hiddenIdsRef = useRef<Set<string>>(new Set());
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyCard = useCallback((next: CallerCard | null) => {
    if (!next?.id) {
      setCard(null);
      return;
    }
    if (hiddenIdsRef.current.has(next.id)) {
      setCard(null);
      return;
    }
    if (lastIdRef.current !== next.id) {
      lastIdRef.current = next.id;
      setMinimized(false);
    }
    setCard(next);
  }, []);

  const poll = useCallback(async () => {
    try {
      const json = await apiFetch<any>('/api/telecaller/crm/dial-session?active=1');
      const next = (json?.session || null) as {
        id?: string;
        status?: string | null;
        lead_id?: string | null;
        lead?: DialLead | null;
      } | null;
      const st = String(next?.status || '').toUpperCase();
      if (!next?.id || !['INITIATED', 'RINGING', 'ANSWERED'].includes(st)) {
        setCard((prev) => (prev && !prev.fromPush ? null : prev));
        return;
      }
      applyCard({
        id: next.id,
        lead_id: next.lead_id || next.lead?.id || null,
        status: st,
        direction: 'outbound',
        fromPush: false,
        lead: next.lead || null,
      });
    } catch {
      /* keep last */
    }
  }, [applyCard]);

  useEffect(() => {
    void poll();
    const id = setInterval(poll, 1500);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void poll();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [poll]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      CRM_CALLER_ID_EVENT,
      (payload: CallerIdPayload) => {
        const leadId = String(payload?.leadId || '').trim();
        if (!leadId) return;
        const sessionId = String(payload?.sessionId || '').trim();
        const id = sessionId || `push:${leadId}`;
        const inbound = String(payload?.direction || '').toLowerCase() === 'inbound';
        applyCard({
          id,
          lead_id: leadId,
          status: inbound ? 'RINGING' : 'INITIATED',
          direction: inbound ? 'inbound' : 'outbound',
          fromPush: true,
          lead: {
            id: leadId,
            lead_number: payload?.leadNumber || null,
            customer_name: payload?.customerName || null,
            city: payload?.city || null,
          },
        });
        if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
        pushTimerRef.current = setTimeout(() => {
          setCard((prev) => (prev?.id === id && prev.fromPush ? null : prev));
        }, 90_000);
      },
    );
    return () => {
      sub.remove();
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, [applyCard]);

  const lead = card?.lead || null;
  const leadId = String(card?.lead_id || lead?.id || '').trim();
  const name = String(lead?.customer_name || '').trim();
  const leadNumber = String(lead?.lead_number || '').trim();
  const phone = String(lead?.customer_phone || '').trim();
  const vehicle = useMemo(() => vehicleLine(lead), [lead]);
  const city = String(lead?.city || '').trim();
  const connected = String(card?.status || '').toUpperCase() === 'ANSWERED';
  const inbound = card?.direction === 'inbound';
  const title = name || leadNumber || 'MyFNG customer';
  const placeLine = [vehicle, city].filter(Boolean).join(', ');
  const statusLine = connected ? 'Live call' : inbound ? 'Incoming call' : 'Calling now';

  if (!card) return null;

  const hideCard = () => {
    if (card?.id) hiddenIdsRef.current.add(card.id);
    setCard(null);
  };

  const openLead = () => {
    if (!leadId) return;
    requestOpenCrmLead(leadId);
    try {
      onOpenLead?.(leadId);
    } catch {
      /* ignore */
    }
    try {
      navigation.navigate(leadScreen, { leadId });
    } catch {
      try {
        navigation.navigate('Dashboard', { screen: leadScreen, params: { leadId } });
      } catch {
        /* ignore */
      }
    }
    setMinimized(true);
  };

  const top = Math.max(insets.top, 8) + 6;

  if (minimized) {
    return (
      <TouchableOpacity
        style={[styles.chip, { top }]}
        onPress={() => setMinimized(false)}
        activeOpacity={0.9}
      >
        <View style={styles.chipAvatar}>
          <Text style={styles.chipInitial}>{initialOf(title)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.chipBrand}>myfng</Text>
          <Text style={styles.chipTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color="#111827" />
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.card, { top }]}>
      <View style={styles.topRow}>
        <Text style={styles.brand}>myfng</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {statusLine}
        </Text>
        <TouchableOpacity onPress={hideCard} hitSlop={10} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color="#6b7280" />
        </TouchableOpacity>
      </View>

      <View style={styles.identity}>
        <View style={[styles.avatar, connected && styles.avatarLive]}>
          <Text style={styles.initial}>{initialOf(title)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.nameRow}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Ionicons name="checkmark-circle" size={16} color="#0B57D0" />
          </View>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={openLead}
            disabled={!leadId}
            activeOpacity={0.85}
          >
            <Ionicons name="open-outline" size={14} color="#0B57D0" />
            <Text style={styles.profileBtnText}>Open lead</Text>
          </TouchableOpacity>
        </View>
      </View>

      {phone || leadNumber ? (
        <Text style={styles.phone} numberOfLines={1}>
          {phone || leadNumber}
        </Text>
      ) : null}
      <Text style={styles.place} numberOfLines={1}>
        {[leadNumber && leadNumber !== phone ? leadNumber : null, placeLine || 'MyFNG customer']
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {showMlInsights && leadId ? <LeadBrainStrip leadId={leadId} /> : null}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={openLead} disabled={!leadId}>
          <Ionicons name="person-outline" size={18} color="#111827" />
          <Text style={styles.actionText}>OPEN</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={() => setMinimized(true)}>
          <Ionicons name="remove-outline" size={18} color="#111827" />
          <Text style={styles.actionText}>HIDE</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={hideCard}>
          <Ionicons name="close-circle-outline" size={18} color="#111827" />
          <Text style={styles.actionText}>CLOSE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 10,
    right: 10,
    zIndex: 200,
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  brand: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  meta: { flex: 1, marginLeft: 8, fontSize: 11, color: '#9ca3af' },
  closeBtn: { padding: 2 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLive: { backgroundColor: '#d1fae5' },
  initial: { color: '#111827', fontSize: 22, fontWeight: '700' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flexShrink: 1, fontSize: 20, fontWeight: '700', color: '#111827' },
  profileBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#0B57D0',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileBtnText: { color: '#0B57D0', fontSize: 13, fontWeight: '700' },
  phone: { marginTop: 14, fontSize: 15, color: '#111827' },
  place: { marginTop: 2, fontSize: 13, color: '#6b7280' },
  actions: {
    marginTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    flexDirection: 'row',
  },
  action: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionText: { fontSize: 11, fontWeight: '700', color: '#111827', letterSpacing: 0.4 },
  chip: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 200,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  chipAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipInitial: { color: '#111827', fontSize: 13, fontWeight: '800' },
  chipBrand: { fontSize: 10, fontWeight: '700', color: '#6b7280' },
  chipTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
});
