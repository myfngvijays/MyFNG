import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING } from '../../../constants/theme';

type Log = {
  id: string;
  status?: string;
  sent_at?: string;
  recipient?: string;
  meta?: { title?: string; body?: string; opens?: number; clicks?: number; devices?: number; sent_by?: string };
};

type OpenRow = {
  id: string;
  created_at?: string;
  name?: string | null;
  phone?: string | null;
};

function formatDate(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SuperAdminPushHistoryScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openLogId, setOpenLogId] = useState<string | null>(null);
  const [opens, setOpens] = useState<OpenRow[]>([]);
  const [opensLoading, setOpensLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch<{ logs?: Log[] }>('/api/super_admin/notifications/history?limit=40');
      setLogs(Array.isArray(data?.logs) ? data.logs : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const viewOpens = async (log: Log) => {
    if (openLogId === log.id) {
      setOpenLogId(null);
      return;
    }
    setOpenLogId(log.id);
    setOpens([]);
    setOpensLoading(true);
    try {
      const data = await apiFetch<{ opens?: OpenRow[] }>(
        `/api/super_admin/notifications/history?view=opens&id=${encodeURIComponent(log.id)}`,
      );
      setOpens(Array.isArray(data?.opens) ? data.opens : []);
    } catch (e: any) {
      setError(e?.message || 'Could not load opens');
    } finally {
      setOpensLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.shell} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Notification History</Text>
        <View style={{ width: 40 }} />
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {logs.length === 0 && !error ? <Text style={styles.empty}>No notifications yet.</Text> : null}
          {logs.map((log) => (
            <View key={log.id} style={styles.card}>
              <Text style={styles.cardTitle}>{log.meta?.title || 'Notification'}</Text>
              {log.meta?.body ? <Text style={styles.message}>{log.meta.body}</Text> : null}
              <Text style={styles.meta}>
                {(log.status || '').toUpperCase()}
                {log.sent_at ? ` · ${formatDate(log.sent_at)}` : ''}
                {typeof log.meta?.devices === 'number' ? ` · ${log.meta.devices} delivered` : ''}
              </Text>
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => void viewOpens(log)}>
                  <Text style={styles.link}>
                    {log.meta?.opens ?? 0} opens · {log.meta?.clicks ?? 0} clicks
                    {openLogId === log.id ? '  · hide' : '  · view'}
                  </Text>
                </TouchableOpacity>
              </View>
              {openLogId === log.id ? (
                <View style={styles.opensBox}>
                  {opensLoading ? (
                    <ActivityIndicator color={COLORS.primary} />
                  ) : opens.length === 0 ? (
                    <Text style={styles.meta}>No opens recorded yet.</Text>
                  ) : (
                    opens.map((row, index) => (
                      <Text key={row.id || String(index)} style={styles.openRow}>
                        {row.name || row.phone || `Open ${index + 1}`}
                        {row.phone && row.name ? ` · ${row.phone}` : ''}
                        {row.created_at ? ` · ${formatDate(row.created_at)}` : ''}
                      </Text>
                    ))
                  )}
                </View>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#F8FAFC' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: COLORS.primary },
  body: { padding: SPACING.md, paddingBottom: 40 },
  empty: { color: '#64748B', textAlign: 'center', marginTop: 24 },
  error: { color: '#B91C1C', fontSize: 12, marginBottom: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  message: { fontSize: 13, color: '#334155', marginTop: 6 },
  meta: { fontSize: 12, color: '#64748B', marginTop: 6 },
  actions: { marginTop: 8 },
  link: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  opensBox: { marginTop: 8, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10 },
  openRow: { fontSize: 12, color: '#1E293B', marginBottom: 4 },
});
