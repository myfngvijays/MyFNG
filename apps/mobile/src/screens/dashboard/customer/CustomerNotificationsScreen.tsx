import React, { useEffect, useMemo, useState } from 'react';
import { Alert, View, Text, StyleSheet, ScrollView, Switch, Platform } from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import NotificationPreferenceSwitch from '../../../components/NotificationPreferenceSwitch';
import { apiFetch } from '../../../lib/api';
import { getCustomerSessionToken } from '../../../lib/customerSession';
import {
  isExpoPushConfigured,
  showPushPermissionAlert,
  syncPushPreferenceAfterSave,
} from '../../../lib/pushPreferenceSync';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

const toggleKeys = [
  'push_enabled',
  'sms_enabled',
  'email_enabled',
  'order_updates',
  'offers',
  'wallet_credits',
  'referral_updates',
  'support_updates',
] as const;

const labelMap: Record<(typeof toggleKeys)[number], string> = {
  push_enabled: 'Push Notifications',
  sms_enabled: 'SMS Alerts',
  email_enabled: 'Email Alerts',
  order_updates: 'Order Updates',
  offers: 'Offers & Promos',
  wallet_credits: 'Wallet Credits',
  referral_updates: 'Referral Updates',
  support_updates: 'Support Updates',
};

export default function CustomerNotificationsScreen({ navigation }: any) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [pushTokenRegistered, setPushTokenRegistered] = useState(false);

  const load = async () => {
    const res = await apiFetch<{ preferences: Record<string, boolean> }>(
      '/api/customer/notifications/preferences',
    );
    setPrefs(res.preferences || {});
  };

  useEffect(() => {
    load().catch(() => null);
  }, []);

  const update = async (key: (typeof toggleKeys)[number], next: Record<string, boolean>) => {
    const prev = prefs;
    setPrefs(next);
    setSavingKey(key);
    try {
      await apiFetch('/api/customer/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });

      if (key === 'push_enabled') {
        const sessionToken = await getCustomerSessionToken();
        const sync = await syncPushPreferenceAfterSave(Boolean(next.push_enabled), sessionToken);
        if (sync.permissionDenied) {
          const reverted = { ...next, push_enabled: false };
          setPrefs(reverted);
          setPushTokenRegistered(false);
          await apiFetch('/api/customer/notifications/preferences', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reverted),
          });
          showPushPermissionAlert();
          return;
        }
        setPushTokenRegistered(Boolean(next.push_enabled && sync.tokenRegistered));
      }
    } catch {
      setPrefs(prev);
      Alert.alert('Notifications', 'Could not save your preference. Please try again.');
    } finally {
      setSavingKey(null);
    }
  };

  const pushHint = useMemo(() => {
    if (!prefs.push_enabled) return null;
    if (pushTokenRegistered) return null;
    if (!isExpoPushConfigured()) {
      return 'Push alerts ke liye app ka latest update install karein (EAS project setup).';
    }
    return 'Allow notifications in phone settings to receive alerts on this device.';
  }, [prefs.push_enabled, pushTokenRegistered]);

  return (
    <View style={styles.container}>
      <DashboardHeader title="Notification Toggles" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <NotificationPreferenceSwitch
          value={Boolean(prefs.push_enabled)}
          onValueChange={(v) => update('push_enabled', { ...prefs, push_enabled: v })}
          loading={savingKey === 'push_enabled'}
          disabled={savingKey === 'push_enabled'}
          hint={pushHint}
        />

        <View style={styles.card}>
          {toggleKeys
            .filter((key) => key !== 'push_enabled')
            .map((key, idx, arr) => (
              <View
                key={key}
                style={[styles.row, idx !== arr.length - 1 ? styles.rowDivider : null]}
              >
                <Text style={styles.rowText}>{labelMap[key]}</Text>
                <Switch
                  style={Platform.OS === 'ios' ? styles.switchIos : undefined}
                  value={Boolean(prefs[key])}
                  onValueChange={(v) => update(key, { ...prefs, [key]: v })}
                  disabled={savingKey === key}
                  trackColor={{ false: '#D1D5DB', true: '#34D399' }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#D1D5DB"
                />
              </View>
            ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl, gap: SPACING.md },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    gap: 12,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  rowText: { flex: 1, color: COLORS.textHeading, fontSize: SIZES.sm, fontWeight: '600' },
  switchIos: { transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }] },
});
