import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView } from 'react-native';
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
      <ScrollView contentContainerStyle={{ paddingBottom: SPACING.xl }}>
        <View style={styles.card}>
          {toggleKeys.map((key) => (
            <View key={key} style={styles.row}>
              <Text style={styles.rowText}>{key.replace(/_/g, ' ')}</Text>
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
  card: { backgroundColor: COLORS.white, margin: SPACING.md, borderRadius: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowText: { color: COLORS.textHeading, textTransform: 'capitalize', fontSize: SIZES.sm },
});

