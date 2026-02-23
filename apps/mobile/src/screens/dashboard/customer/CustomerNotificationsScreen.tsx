import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
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
];

const labelMap: Record<string, string> = {
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
  const [prefs, setPrefs] = useState<any>({});

  const load = async () => {
    const res = await apiFetch<{ preferences: any }>('/api/customer/notifications/preferences');
    setPrefs(res.preferences || {});
  };

  useEffect(() => {
    load().catch(() => null);
  }, []);

  const update = async (next: any) => {
    setPrefs(next);
    await apiFetch('/api/customer/notifications/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });
  };

  return (
    <View style={styles.container}>
      <DashboardHeader title="Notification Toggles" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View>
            <Text style={styles.heroTitle}>Notification Preferences</Text>
            <Text style={styles.heroSub}>Control where and when we notify you.</Text>
          </View>
          <Ionicons name="notifications-outline" size={22} color={COLORS.primary} />
        </View>
        <View style={styles.card}>
          {toggleKeys.map((key) => (
            <View key={key} style={styles.row}>
              <Text style={styles.rowText}>{labelMap[key] || key.replace(/_/g, ' ')}</Text>
              <Switch value={Boolean(prefs[key])} onValueChange={(v) => update({ ...prefs, [key]: v })} />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl },
  heroCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 10,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTitle: { color: COLORS.textHeading, fontWeight: '800', fontSize: SIZES.md },
  heroSub: { color: COLORS.textSecondary, marginTop: 4, fontSize: SIZES.sm },
  card: { backgroundColor: COLORS.white, borderRadius: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowText: { color: COLORS.textHeading, fontSize: SIZES.sm, fontWeight: '600' },
});

