import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import TelecallerProfileScreen from '../telecaller/TelecallerProfileScreen';
import { COLORS, SPACING, SHADOWS } from '../../../constants/theme';

type Props = {
  navigation: any;
};

export default function CrmMeTab({ navigation }: Props) {
  const [segment, setSegment] = useState<'attendance' | 'profile'>('attendance');
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [data, setData] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<any>('/api/telecaller/crm/attendance');
      setData(res);
    } catch (e: any) {
      setData({
        is_punched_in: false,
        history: [],
        warning: e?.message,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const punch = async (action: 'punch_in' | 'punch_out') => {
    setPunching(true);
    try {
      await apiFetch('/api/telecaller/crm/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      Alert.alert('Done', action === 'punch_in' ? 'Punched in' : 'Punched out');
      await load();
    } catch (e: any) {
      Alert.alert(
        'Attendance',
        e?.message?.includes('telecaller_attendance') || e?.message?.includes('relation')
          ? 'Run database migration 282_telecaller_crm_advanced.sql first'
          : e?.message || 'Failed'
      );
    } finally {
      setPunching(false);
    }
  };

  const logout = async () => {
    if (data?.is_punched_in) {
      try {
        await apiFetch('/api/telecaller/crm/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'punch_out' }),
        });
      } catch {
        // continue logout
      }
    }
    await supabase.auth.signOut();
  };

  if (segment === 'profile') {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backToAtt} onPress={() => setSegment('attendance')}>
          <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
          <Text style={styles.backToAttText}>Back to Attendance</Text>
        </TouchableOpacity>
        <TelecallerProfileScreen navigation={navigation} embedded />
      </View>
    );
  }

  const history = Array.isArray(data?.history) ? data.history : [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Text style={styles.title}>Workforce Timings</Text>
      <Text style={styles.sub}>Punch in when you start calling. Punch out when you leave.</Text>

      <View style={[styles.statusCard, data?.is_punched_in ? styles.on : styles.off]}>
        <Ionicons
          name={data?.is_punched_in ? 'checkmark-circle' : 'time-outline'}
          size={28}
          color={data?.is_punched_in ? COLORS.green : COLORS.orange}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.statusTitle}>
            {data?.is_punched_in ? 'Currently On Floor' : 'Currently Off Duty'}
          </Text>
          {data?.open_session?.punch_in_at ? (
            <Text style={styles.statusMeta}>
              In since {new Date(data.open_session.punch_in_at).toLocaleString('en-IN')}
            </Text>
          ) : (
            <Text style={styles.statusMeta}>No open session</Text>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.punchBtn, data?.is_punched_in ? styles.punchOut : styles.punchIn]}
        disabled={punching}
        onPress={() => punch(data?.is_punched_in ? 'punch_out' : 'punch_in')}
      >
        {punching ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.punchText}>
            {data?.is_punched_in ? 'Punch Out' : 'Punch In'}
          </Text>
        )}
      </TouchableOpacity>

      <Text style={styles.section}>Recent Timings</Text>
      {history.length === 0 ? (
        <Text style={styles.empty}>No attendance records yet</Text>
      ) : (
        history.map((row: any) => (
          <View key={row.id} style={styles.row}>
            <Text style={styles.rowDate}>{row.work_date}</Text>
            <Text style={styles.rowTime}>
              In: {row.punch_in_at ? new Date(row.punch_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
            </Text>
            <Text style={styles.rowTime}>
              Out: {row.punch_out_at ? new Date(row.punch_out_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
            </Text>
          </View>
        ))
      )}

      <TouchableOpacity style={styles.linkBtn} onPress={() => setSegment('profile')}>
        <Ionicons name="person-outline" size={18} color={COLORS.primary} />
        <Text style={styles.linkText}>My Profile</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Ionicons name="log-out-outline" size={18} color={COLORS.white} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: SPACING.md, paddingTop: 4, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.textHeading },
  sub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, marginBottom: 14 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    ...SHADOWS.small,
  },
  on: { borderWidth: 1, borderColor: COLORS.green + '40' },
  off: { borderWidth: 1, borderColor: COLORS.orange + '40' },
  statusTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  statusMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  punchBtn: {
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  punchIn: { backgroundColor: COLORS.green },
  punchOut: { backgroundColor: COLORS.red },
  punchText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  section: { marginTop: 22, marginBottom: 8, fontSize: 15, fontWeight: '700', color: COLORS.textHeading },
  empty: { color: COLORS.textSecondary, fontSize: 13 },
  row: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    ...SHADOWS.small,
  },
  rowDate: { fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  rowTime: { fontSize: 12, color: COLORS.textSecondary },
  linkBtn: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    padding: 14,
    borderRadius: 12,
    ...SHADOWS.small,
  },
  linkText: { color: COLORS.primary, fontWeight: '700' },
  logoutBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.red,
    padding: 14,
    borderRadius: 12,
  },
  logoutText: { color: '#fff', fontWeight: '700' },
  backToAtt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 12,
    backgroundColor: COLORS.white,
  },
  backToAttText: { color: COLORS.primary, fontWeight: '600' },
});
