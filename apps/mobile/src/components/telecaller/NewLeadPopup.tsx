import React, { useEffect, useRef } from 'react';
import { Animated, DeviceEventEmitter, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const CRM_NEW_LEAD_POPUP_EVENT = 'crm:newLeadPopup';
const AUTO_DISMISS_MS = 2600;

export type NewLeadPopupPayload = {
  leadId: string;
  name: string;
  phone?: string | null;
  /** UI preview — always shows even if setting is off; tap does not open a lead */
  demo?: boolean;
};

export const DEMO_NEW_LEAD_POPUP: NewLeadPopupPayload = {
  leadId: 'demo-new-lead',
  name: 'Ramesh Shahani (Demo)',
  phone: '9876543210',
  demo: true,
};

export function emitNewLeadPopupDemo() {
  emitNewLeadPopup(DEMO_NEW_LEAD_POPUP);
}

export function emitNewLeadPopup(payload: NewLeadPopupPayload) {
  const leadId = String(payload.leadId || '').trim();
  if (!leadId) return;
  DeviceEventEmitter.emit(CRM_NEW_LEAD_POPUP_EVENT, {
    leadId,
    name: String(payload.name || 'New lead').trim() || 'New lead',
    phone: payload.phone ? String(payload.phone) : null,
  });
}

export function NewLeadPopupCard({
  payload,
  onOpen,
  onDismiss,
}: {
  payload: NewLeadPopupPayload;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const scale = useRef(new Animated.Value(0.92)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [fade, onDismiss, scale]);

  return (
    <Animated.View
      style={[styles.card, { opacity: fade, transform: [{ scale }] }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.iconWrap}>
        <Ionicons name="person-add" size={22} color="#047857" />
      </View>
      <TouchableOpacity style={styles.body} activeOpacity={0.85} onPress={onOpen}>
        <Text style={styles.kicker}>New lead</Text>
        <Text style={styles.name} numberOfLines={1}>
          {payload.name}
        </Text>
        {payload.phone ? (
          <Text style={styles.meta} numberOfLines={1}>
            {payload.phone}
          </Text>
        ) : null}
      </TouchableOpacity>
      <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="close" size={18} color="#64748B" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ECFDF5',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    shadowColor: '#064E3B',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0 },
  kicker: { fontSize: 11, fontWeight: '800', color: '#047857', letterSpacing: 0.3 },
  name: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  meta: { fontSize: 12, fontWeight: '600', color: '#475569', marginTop: 2 },
});