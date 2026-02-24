import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';
import { apiFetch } from '../../../lib/api';

export default function RSASessionsScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<any>('/api/super_admin/sarv-aansh-sessions');
      setRows(Array.isArray(data?.sessions) ? data.sessions : []);
    } catch (e) {
      console.error('rsa sessions load failed', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const removeSession = async (id: string) => {
    try {
      await apiFetch('/api/super_admin/sarv-aansh-sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: id }),
      });
      load();
    } catch (e) {
      console.error('remove session failed', e);
      Alert.alert('Error', 'Failed to remove session');
    }
  };

  const handleBack = () => {
    if (typeof navigation?.canGoBack === 'function' && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (typeof navigation?.goBack === 'function') {
      navigation.goBack();
      return;
    }
    navigation?.navigate?.('RSAManagerDashboard');
  };

  return (
    <View style={styles.container}>
      <DashboardHeader title="Active Aansh Sessions" onBack={handleBack} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity style={styles.primaryBtn} onPress={load}><Text style={styles.primaryBtnText}>Refresh</Text></TouchableOpacity>
          {rows.map((row: any) => (
            <View key={row.id} style={styles.card}>
              <Text style={styles.title}>Aansh: {row.aansh_id} • {row.assignee_role}</Text>
              <Text style={styles.subtle}>{row.user_name || row.user_email || row.user_id || 'User'}</Text>
              <Text style={styles.subtle}>Expires: {row.expires_at || '—'}</Text>
              <TouchableOpacity style={styles.dangerBtn} onPress={() => removeSession(String(row.id))}>
                <Text style={styles.primaryBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.xl },
  card: { backgroundColor: COLORS.white, borderRadius: 10, padding: SPACING.sm, gap: SPACING.xs },
  title: { fontSize: SIZES.sm, color: COLORS.textHeading, fontWeight: '700' },
  subtle: { fontSize: SIZES.xs, color: COLORS.textSecondary },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: SPACING.sm, alignItems: 'center' },
  primaryBtnText: { color: COLORS.white, fontSize: SIZES.xs, fontWeight: '700' },
  dangerBtn: { marginTop: SPACING.xs, backgroundColor: COLORS.error, borderRadius: 8, paddingVertical: SPACING.sm, alignItems: 'center' },
});
