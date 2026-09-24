import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING } from '../../../constants/theme';

function defaultTimes(count: number) {
  const presets: Record<number, string[]> = {
    1: ['10:00'],
    2: ['10:00', '16:00'],
    3: ['10:00', '14:00', '18:00'],
    4: ['10:00', '13:00', '16:00', '19:00'],
    5: ['09:00', '12:00', '15:00', '18:00', '21:00'],
  };
  return presets[count] || presets[1];
}

export default function SuperAdminDailyBlogsScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [label, setLabel] = useState('Daily auto-post schedule');
  const [draftCount, setDraftCount] = useState(1);
  const [draftTimes, setDraftTimes] = useState<string[]>(['10:00']);
  const [postedCount, setPostedCount] = useState(0);
  const [missing, setMissing] = useState(false);
  const [diagnosis, setDiagnosis] = useState<{ title?: string; message?: string; level?: string } | null>(null);
  const [days, setDays] = useState<Array<{ date: string; posted: number; expected: number; missing: number }>>([]);
  const [events, setEvents] = useState<
    Array<{ created_at?: string; status?: string; source?: string; blog_title?: string; reason?: string; error?: string; slot_index?: number }>
  >([]);

  const load = useCallback(async () => {
    try {
      const [data, logs] = await Promise.all([
        apiFetch<any>('/api/blogs/daily-settings'),
        apiFetch<any>('/api/blogs/daily-logs').catch(() => null),
      ]);
      if (logs) {
        setDiagnosis(logs.diagnosis || null);
        setDays(Array.isArray(logs.days) ? logs.days : []);
        setEvents(Array.isArray(logs.events) ? logs.events.slice(0, 12) : []);
      }
      const count = Number(data?.schedule?.posts_per_day || data?.settings?.posts_per_day || 1);
      const times = Array.isArray(data?.schedule?.post_times)
        ? data.schedule.post_times
        : Array.isArray(data?.settings?.post_times)
          ? data.settings.post_times
          : defaultTimes(count);
      setEnabled(Boolean(data?.settings?.enabled ?? data?.schedule?.enabled));
      setDraftCount(count);
      setDraftTimes(times.slice(0, count));
      setPostedCount(Number(data?.today_posted_count || 0));
      setMissing(Boolean(data?.missing));
      if (data?.missing) {
        setLabel(data.error || 'Run database/369_daily_blog_slots.sql');
      } else if (data?.last_blog?.title) {
        setLabel(`${Number(data.today_posted_count || 0)}/${count} posted · ${data.last_blog.title}`);
      } else {
        setLabel(data?.schedule?.schedule || `${count} blog(s) / day`);
      }
    } catch (e: any) {
      setLabel(e?.message || 'Could not load daily schedule');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const changeCount = (count: number) => {
    setDraftCount(count);
    setDraftTimes((prev) => {
      const fallback = defaultTimes(count);
      return Array.from({ length: count }, (_, i) => prev[i] || fallback[i]);
    });
  };

  return (
    <SafeAreaView style={styles.shell} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Daily auto-blogs</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
        >
          <Text style={styles.eyebrow}>SUPER ADMIN</Text>
          <Text style={styles.title}>Daily auto-post schedule</Text>
          <Text style={styles.meta}>{label}</Text>
          <Text style={styles.meta}>Blogs per day · {postedCount}/{draftCount} today</Text>

          <View style={styles.countRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity
                key={n}
                disabled={busy || missing}
                onPress={() => changeCount(n)}
                style={[styles.countChip, draftCount === n && styles.countChipOn]}
              >
                <Text style={[styles.countChipText, draftCount === n && styles.countChipTextOn]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.timeRow}>
            {draftTimes.map((time, idx) => (
              <View key={`slot-${idx}`} style={styles.timeField}>
                <Text style={styles.timeLabel}>Slot {idx + 1}</Text>
                <TextInput
                  value={time}
                  onChangeText={(value) => {
                    const next = [...draftTimes];
                    next[idx] = value;
                    setDraftTimes(next);
                  }}
                  placeholder="10:00"
                  keyboardType="numbers-and-punctuation"
                  style={styles.timeInput}
                  editable={!busy && !missing}
                />
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              disabled={busy || missing}
              style={styles.primaryBtn}
              onPress={async () => {
                try {
                  setBusy(true);
                  await apiFetch('/api/blogs/daily-settings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ posts_per_day: draftCount, post_times: draftTimes }),
                  });
                  await load();
                  Alert.alert('Saved', `Daily schedule: ${draftCount} blog${draftCount > 1 ? 's' : ''}`);
                } catch (e: any) {
                  Alert.alert('Could not save', e?.message || 'Run database/369_daily_blog_slots.sql');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Text style={styles.primaryBtnText}>{busy ? '…' : 'Save schedule'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={busy || missing}
              style={styles.secondaryBtn}
              onPress={async () => {
                try {
                  setBusy(true);
                  await apiFetch('/api/blogs/daily-settings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enabled: !enabled }),
                  });
                  await load();
                } catch (e: any) {
                  Alert.alert('Update failed', e?.message || 'Could not update daily posting');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Text style={styles.secondaryBtnText}>{enabled ? 'Pause' : 'Enable'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={busy || missing}
              style={styles.secondaryBtn}
              onPress={async () => {
                try {
                  setBusy(true);
                  const data = await apiFetch<any>('/api/blogs/daily-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'run_now' }),
                  });
                  await load();
                  if (data?.run?.title) Alert.alert('Published', data.run.title);
                } catch (e: any) {
                  Alert.alert('Post failed', e?.message || 'Could not publish daily blog');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Text style={styles.secondaryBtnText}>{busy ? '…' : 'Post now'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.logsTitle}>Auto-post logs</Text>
          {diagnosis ? (
            <View style={[styles.diagBox, diagnosis.level === 'error' ? styles.diagErr : diagnosis.level === 'ok' ? styles.diagOk : styles.diagWarn]}>
              <Text style={styles.diagTitle}>{diagnosis.title}</Text>
              <Text style={styles.diagMsg}>{diagnosis.message}</Text>
            </View>
          ) : null}
          <View style={styles.dayRow}>
            {days.map((day) => (
              <View key={day.date} style={[styles.dayChip, day.missing > 0 ? styles.dayMiss : styles.dayOk]}>
                <Text style={styles.dayDate}>{String(day.date).slice(5)}</Text>
                <Text style={styles.dayCount}>{day.posted}/{day.expected}</Text>
              </View>
            ))}
          </View>
          {events.map((row, idx) => (
            <View key={`${row.created_at}-${idx}`} style={styles.eventRow}>
              <Text style={styles.eventMeta}>
                {row.status || 'info'} · {row.source || '—'}{row.slot_index ? ` · slot ${row.slot_index}` : ''}
              </Text>
              <Text style={styles.eventDetail} numberOfLines={3}>
                {row.blog_title || row.error || row.reason || '—'}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 16, fontWeight: '800', color: COLORS.heading },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: SPACING.md, paddingBottom: 40 },
  eyebrow: { fontSize: 10, fontWeight: '800', color: '#C9A227', letterSpacing: 0.5 },
  title: { marginTop: 4, fontSize: 20, fontWeight: '800', color: COLORS.heading },
  meta: { marginTop: 6, fontSize: 13, color: COLORS.textSecondary },
  countRow: { flexDirection: 'row', gap: 6, marginTop: 14 },
  countChip: {
    width: 40,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countChipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  countChipText: { fontSize: 14, fontWeight: '800', color: COLORS.heading },
  countChipTextOn: { color: COLORS.white },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  timeField: { minWidth: 96 },
  timeLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary },
  timeInput: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.heading,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  primaryBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  primaryBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 12 },
  secondaryBtn: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryBtnText: { color: COLORS.heading, fontWeight: '700', fontSize: 12 },
  logsTitle: { marginTop: 22, fontSize: 16, fontWeight: '800', color: COLORS.heading },
  diagBox: { marginTop: 10, borderRadius: 10, padding: 10 },
  diagOk: { backgroundColor: '#ECFDF5' },
  diagWarn: { backgroundColor: '#FFFBEB' },
  diagErr: { backgroundColor: '#FEF2F2' },
  diagTitle: { fontSize: 13, fontWeight: '800', color: '#111827' },
  diagMsg: { marginTop: 4, fontSize: 12, color: '#374151' },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  dayChip: { minWidth: 64, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  dayOk: { backgroundColor: '#ECFDF5' },
  dayMiss: { backgroundColor: '#FEF2F2' },
  dayDate: { fontSize: 10, fontWeight: '700', color: '#6B7280' },
  dayCount: { fontSize: 13, fontWeight: '800', color: '#111827' },
  eventRow: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  eventMeta: { fontSize: 10, fontWeight: '700', color: '#6B7280' },
  eventDetail: { marginTop: 2, fontSize: 12, color: '#111827' },
});
