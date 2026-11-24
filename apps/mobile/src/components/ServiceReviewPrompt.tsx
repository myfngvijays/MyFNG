import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../lib/api';
import { ENV } from '../config/environment';
import { trackEvent } from '../lib/trackEvent';

/**
 * After a customer's service is completed, ask them once to rate MyFNG on the
 * store that matches their phone (App Store on iOS, Play Store on Android).
 *
 * Rules:
 * - Only orders completed in the last 14 days count.
 * - Each order is asked about at most once.
 * - At least 7 days between two prompts.
 * - Once the customer taps "Rate", we never ask again.
 */

const PROMPTED_IDS_KEY = 'myfng_review_prompted_order_ids';
const LAST_PROMPT_AT_KEY = 'myfng_review_last_prompt_at';
const RATED_KEY = 'myfng_review_store_rated';

const RECENT_COMPLETION_MS = 14 * 24 * 60 * 60 * 1000;
const PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const COMPLETED_STATUSES = new Set(['completed', 'done', 'closed']);
const IOS_APP_ID = '6744942498';

type CompletedOrder = {
  id: string;
  label: string;
};

async function readPromptedIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(PROMPTED_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

async function markPrompted(orderId: string) {
  const ids = await readPromptedIds();
  const next = [...new Set([...ids, orderId])].slice(-50);
  await AsyncStorage.multiSet([
    [PROMPTED_IDS_KEY, JSON.stringify(next)],
    [LAST_PROMPT_AT_KEY, String(Date.now())],
  ]);
}

function orderLabel(o: any) {
  const car = [o?.vehicle_make, o?.vehicle_model].filter(Boolean).join(' ').trim();
  return car || 'your car';
}

async function findOrderToReview(): Promise<CompletedOrder | null> {
  const [rated, lastAt] = await Promise.all([
    AsyncStorage.getItem(RATED_KEY),
    AsyncStorage.getItem(LAST_PROMPT_AT_KEY),
  ]);
  if (rated === '1') return null;
  if (lastAt && Date.now() - Number(lastAt) < PROMPT_COOLDOWN_MS) return null;

  const res = await apiFetch<any>('/api/customer/orders');
  const orders: any[] = Array.isArray(res?.orders) ? res.orders : [];
  const prompted = new Set(await readPromptedIds());
  const now = Date.now();

  const candidate = orders
    .filter((o) => COMPLETED_STATUSES.has(String(o?.status || '').toLowerCase()))
    .map((o) => ({ o, at: Date.parse(o?.completed_at || o?.updated_at || o?.created_at || '') }))
    .filter(({ o, at }) => o?.id && Number.isFinite(at) && now - at <= RECENT_COMPLETION_MS && !prompted.has(String(o.id)))
    .sort((a, b) => b.at - a.at)[0];

  return candidate ? { id: String(candidate.o.id), label: orderLabel(candidate.o) } : null;
}

async function openStoreReview() {
  // Native in-app review sheet first (needs a build that includes expo-store-review).
  try {
    const StoreReview = require('expo-store-review');
    if (await StoreReview.isAvailableAsync()) {
      await StoreReview.requestReview();
      return;
    }
  } catch {
    // Module not in this build — fall through to the store page.
  }
  const url =
    Platform.OS === 'ios'
      ? `itms-apps://apps.apple.com/app/id${IOS_APP_ID}?action=write-review`
      : 'market://details?id=com.myfng.app';
  const webUrl =
    Platform.OS === 'ios' ? `${ENV.APPSTORE_URL}?action=write-review` : ENV.PLAYSTORE_URL;
  try {
    await Linking.openURL(url);
  } catch {
    await Linking.openURL(webUrl).catch(() => undefined);
  }
}

export default function ServiceReviewPrompt({ enabled }: { enabled: boolean }) {
  const [order, setOrder] = useState<CompletedOrder | null>(null);
  const checkingRef = useRef(false);

  const check = useCallback(async () => {
    if (!enabled || checkingRef.current || order) return;
    checkingRef.current = true;
    try {
      const next = await findOrderToReview();
      if (next) {
        await markPrompted(next.id);
        setOrder(next);
        trackEvent('service_review_prompt_shown', { order_id: next.id, platform: Platform.OS });
      }
    } catch {
      // Never block the app on this.
    } finally {
      checkingRef.current = false;
    }
  }, [enabled, order]);

  useEffect(() => {
    if (!enabled) return;
    // Small delay so it never fights with splash / welcome popups.
    const t = setTimeout(() => void check(), 4000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check();
    });
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, [enabled, check]);

  const close = () => {
    if (order) trackEvent('service_review_prompt_later', { order_id: order.id });
    setOrder(null);
  };

  const rate = async () => {
    if (!order) return;
    trackEvent('service_review_prompt_rate', { order_id: order.id, platform: Platform.OS });
    await AsyncStorage.setItem(RATED_KEY, '1');
    setOrder(null);
    await openStoreReview();
  };

  const storeName = Platform.OS === 'ios' ? 'App Store' : 'Play Store';

  return (
    <Modal visible={!!order} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.closeBtn} onPress={close} accessibilityLabel="Close">
            <Ionicons name="close" size={18} color="#64748B" />
          </TouchableOpacity>
          <View style={styles.badge}>
            <Ionicons name="checkmark-circle" size={34} color="#10B981" />
          </View>
          <Text style={styles.title}>Service completed!</Text>
          <Text style={styles.body}>
            Hope {order?.label} is feeling brand new. If you liked our service, please rate MyFNG on the {storeName}. It
            takes 10 seconds and helps other car owners find us.
          </Text>
          <View style={styles.stars}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Ionicons key={i} name="star" size={26} color="#F59E0B" />
            ))}
          </View>
          <TouchableOpacity style={styles.primary} activeOpacity={0.85} onPress={() => void rate()}>
            <Ionicons name={Platform.OS === 'ios' ? 'logo-apple-appstore' : 'logo-google-playstore'} size={17} color="#FFFFFF" />
            <Text style={styles.primaryText}>Rate us on {storeName}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={close}>
            <Text style={styles.secondaryText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 16,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  body: {
    marginTop: 8,
    fontSize: 13.5,
    lineHeight: 20,
    color: '#475569',
    textAlign: 'center',
  },
  stars: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 16,
  },
  primary: {
    marginTop: 20,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2754C8',
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondary: {
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  secondaryText: {
    color: '#64748B',
    fontSize: 13.5,
    fontWeight: '700',
  },
});
