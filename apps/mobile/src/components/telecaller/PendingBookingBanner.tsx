import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ackPendingBooking, isPendingBookingLead } from '../../lib/telecaller/pendingBooking';

const BOOKING_EVENTS = new Set(['NEW_BOOKING', 'REBOOK', 'REBOOK_FROM_LOST', 'OTP_BOOKING_COMPLETED']);

function istLabel(value: unknown) {
  const d = new Date(String(value || ''));
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Lead detail: yellow banner while a customer's App / Website / MISA booking is not called yet.
 * Same as web PendingBookingBanner. Goes away after a call, a status change from Fresh, or "Mark as called".
 */
export default function PendingBookingBanner({
  lead,
  onCall,
  onUpdated,
}: {
  lead: any;
  onCall: () => void;
  onUpdated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [hiddenFor, setHiddenFor] = useState<string | null>(null);

  const pending = Boolean(lead?.id) && hiddenFor !== String(lead?.id) && isPendingBookingLead(lead);
  const onUpdatedRef = useRef(onUpdated);
  onUpdatedRef.current = onUpdated;

  // Back in the app after "Call now": reload the lead so a logged call clears the banner.
  useEffect(() => {
    if (!pending) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => onUpdatedRef.current(), 2500);
    });
    return () => {
      sub.remove();
      if (timer) clearTimeout(timer);
    };
  }, [pending]);

  if (!pending) return null;

  const meta = lead?.coupon_meta && typeof lead.coupon_meta === 'object' ? lead.coupon_meta : {};
  const history: any[] = Array.isArray(meta.profile_history) ? meta.profile_history : [];
  const bookingEntry = history.find((h) => BOOKING_EVENTS.has(String(h?.event || '')));
  const prevLabel = String(bookingEntry?.previous_label || '').trim();
  const bookedAt = istLabel(meta.priority_booking_at);
  const slot = istLabel(lead?.preferred_slot_start);

  const markCalled = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await ackPendingBooking(String(lead.id));
      setHiddenFor(String(lead.id));
      onUpdated();
    } catch (e: unknown) {
      Alert.alert('Mark as called', e instanceof Error ? e.message : 'Could not update the lead');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Ionicons name="notifications" size={20} color="#B45309" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>
            Customer ne booking ki hai{bookedAt ? ` · ${bookedAt}` : ''}
          </Text>
          <Text style={styles.sub}>
            {prevLabel && !/^fresh$/i.test(prevLabel) ? `Pehle "${prevLabel}" tha. ` : ''}
            {slot ? `Slot: ${slot}. ` : ''}
            Call karke pickup confirm karo.
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.callBtn, !lead?.customer_phone && styles.off]}
          disabled={!lead?.customer_phone}
          onPress={onCall}
          activeOpacity={0.85}
        >
          <Ionicons name="call" size={15} color="#fff" />
          <Text style={styles.callText}>Call now</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ackBtn, saving && styles.off]}
          disabled={saving}
          onPress={() => void markCalled()}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#92400E" />
          ) : (
            <Ionicons name="checkmark-circle-outline" size={16} color="#92400E" />
          )}
          <Text style={styles.ackText}>Mark as called</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FBBF24',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  head: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  title: { fontSize: 14, fontWeight: '900', color: '#78350F' },
  sub: { fontSize: 12, fontWeight: '600', color: '#92400E', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  callBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 10,
  },
  callText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  ackBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 10,
    paddingVertical: 10,
  },
  ackText: { color: '#92400E', fontWeight: '800', fontSize: 13 },
  off: { opacity: 0.55 },
});
