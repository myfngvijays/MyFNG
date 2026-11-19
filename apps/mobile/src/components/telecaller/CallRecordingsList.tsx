import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../lib/api';
import { COLORS } from '../../constants/theme';
import CallRecordingInlinePlayer from './CallRecordingInlinePlayer';

type Row = {
  id: string;
  lead_id: string;
  lead_number: string;
  customer_name: string;
  phone: string;
  created_at: string;
  duration: number;
};

function stamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export default function CallRecordingsList() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      setError('');
      void apiFetch<{ items?: Row[]; error?: string }>(
        `/api/telecaller/calls/recordings?q=${encodeURIComponent(q.trim())}`,
      )
        .then((res) => {
          if (cancelled) return;
          setRows(Array.isArray(res?.items) ? res.items : []);
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load recordings');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Recordings</Text>
      <View style={styles.search}>
        <Ionicons name="search" size={16} color="#94A3B8" />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search name, phone, lead"
          placeholderTextColor="#94A3B8"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      {loading ? <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && rows.length === 0 ? (
        <Text style={styles.empty}>No recordings yet</Text>
      ) : null}
      <FlatList
        style={{ flex: 1 }}
        data={rows}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => {
          const open = playing === item.id;
          return (
            <View style={styles.card}>
              <TouchableOpacity style={styles.row} onPress={() => setPlaying(open ? null : item.id)}>
                <View style={styles.play}>
                  <Ionicons name={open ? 'pause' : 'play'} size={16} color="#fff" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.customer_name || 'Customer'}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {[item.lead_number ? `#${item.lead_number}` : '', item.phone, stamp(item.created_at)]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              </TouchableOpacity>
              {open ? (
                <CallRecordingInlinePlayer callLogId={item.id} onClose={() => setPlaying(null)} />
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.background },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 14, color: '#0F172A' },
  error: { color: '#B45309', marginBottom: 8 },
  empty: { color: '#64748B', marginTop: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    marginBottom: 8,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  play: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  meta: { marginTop: 2, fontSize: 12, color: '#64748B' },
});
