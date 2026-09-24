import React, { useCallback, useEffect, useState } from 'react';
import { formatDateDMY } from '@/lib/dateFormat';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { resolvePublicMediaUrl } from '../../../lib/publicMediaUrl';
import { COLORS, SPACING } from '../../../constants/theme';

type Blog = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  status: string;
  views: number;
  read_time: number;
  published_at?: string;
  created_at?: string;
  featured_image?: string;
  category?: { id?: string; name: string };
  tags?: Array<{ name: string; slug: string }>;
};

type Category = { id: string; name: string };

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

function postedLabel(count: number, posted: unknown) {
  return `${Number(posted || 0)}/${count} posted today`;
}

export default function DMContentScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [total, setTotal] = useState(0);
  const [dailyEnabled, setDailyEnabled] = useState(true);
  const [dailyLabel, setDailyLabel] = useState('Daily auto-post schedule');
  const [dailyBusy, setDailyBusy] = useState(false);
  const [draftCount, setDraftCount] = useState(1);
  const [draftTimes, setDraftTimes] = useState<string[]>(['10:00']);
  const [postedCount, setPostedCount] = useState(0);
  const [diagnosis, setDiagnosis] = useState<{ title?: string; message?: string; level?: string } | null>(null);
  const [days, setDays] = useState<Array<{ date: string; posted: number; expected: number; missing: number }>>([]);
  const [events, setEvents] = useState<
    Array<{ status?: string; source?: string; blog_title?: string; reason?: string; error?: string; slot_index?: number }>
  >([]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (categoryId) params.append('category_id', categoryId);
      params.append('page', '1');
      params.append('limit', '8');
      const data = await apiFetch<any>(`/api/blogs?${params.toString()}`);
      setBlogs(Array.isArray(data?.blogs) ? data.blogs : []);
      setTotal(Number(data?.pagination?.total || data?.blogs?.length || 0));
    } catch {
      setBlogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, categoryId]);

  const loadDaily = useCallback(async () => {
    try {
      const [data, logs] = await Promise.all([
        apiFetch<any>('/api/blogs/daily-settings'),
        apiFetch<any>('/api/blogs/daily-logs').catch(() => null),
      ]);
      if (logs) {
        setDiagnosis(logs.diagnosis || null);
        setDays(Array.isArray(logs.days) ? logs.days : []);
        setEvents(Array.isArray(logs.events) ? logs.events.slice(0, 10) : []);
      }
      const enabled = Boolean(data?.settings?.enabled ?? data?.schedule?.enabled);
      const count = Number(data?.schedule?.posts_per_day || data?.settings?.posts_per_day || 1);
      const times = Array.isArray(data?.schedule?.post_times)
        ? data.schedule.post_times
        : Array.isArray(data?.settings?.post_times)
          ? data.settings.post_times
          : defaultTimes(count);
      setDailyEnabled(enabled);
      setDraftCount(count);
      setDraftTimes(times.slice(0, count));
      setPostedCount(Number(data?.today_posted_count || 0));
      if (data?.missing) {
        setDailyLabel(data.error || 'Run database/369_daily_blog_slots.sql');
      } else if (data?.last_blog?.title) {
        setDailyLabel(`${postedLabel(count, data.today_posted_count)} · Last: ${data.last_blog.title}`);
      } else if (data?.schedule?.last_status === 'failed') {
        setDailyLabel(data?.schedule?.last_error || 'Last daily run failed');
      } else {
        setDailyLabel(data?.schedule?.schedule || `${count} blog(s) / day`);
      }
    } catch {
      setDailyLabel('Daily auto-post schedule');
    }
  }, []);

  useEffect(() => {
    void apiFetch<any>('/api/blogs/categories')
      .then((data) => setCategories(Array.isArray(data?.categories) ? data.categories : []))
      .catch(() => setCategories([]));
    void loadDaily();
  }, [loadDaily]);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      void load();
    }, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  return (
    <View style={styles.container}>
      <DashboardHeader title="Blogs" onBack={() => navigation.goBack()} />

      <View style={styles.searchWrap}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search blogs..."
          placeholderTextColor={COLORS.textSecondary}
          style={styles.search}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        <TouchableOpacity
          onPress={() => setCategoryId('')}
          style={[styles.tab, categoryId === '' && styles.tabActive]}
        >
          <Text style={[styles.tabText, categoryId === '' && styles.tabTextActive]}>All</Text>
        </TouchableOpacity>
        {categories.map((cat) => {
          const active = categoryId === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setCategoryId(cat.id)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{cat.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
                void loadDaily();
              }}
            />
          }
        >
          <View style={styles.dailyCard}>
            <Text style={styles.dailyTitle}>Daily auto-post schedule</Text>
            <Text style={styles.dailyMeta}>{dailyLabel}</Text>
            <Text style={styles.dailyMeta}>Blogs per day · {postedCount}/{draftCount} today</Text>
            <View style={styles.countRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  disabled={dailyBusy}
                  onPress={() => {
                    setDraftCount(n);
                    setDraftTimes((prev) => {
                      const fallback = defaultTimes(n);
                      return Array.from({ length: n }, (_, i) => prev[i] || fallback[i]);
                    });
                  }}
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
                    editable={!dailyBusy}
                  />
                </View>
              ))}
            </View>
            <View style={styles.dailyRow}>
              <TouchableOpacity
                disabled={dailyBusy}
                onPress={async () => {
                  try {
                    setDailyBusy(true);
                    await apiFetch<any>('/api/blogs/daily-settings', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ posts_per_day: draftCount, post_times: draftTimes }),
                    });
                    await loadDaily();
                    Alert.alert('Saved', `Daily schedule: ${draftCount} blog${draftCount > 1 ? 's' : ''}`);
                  } catch (e: any) {
                    Alert.alert('Could not save', e?.message || 'Run database/369_daily_blog_slots.sql');
                  } finally {
                    setDailyBusy(false);
                  }
                }}
                style={[styles.dailyBtn, styles.dailyBtnOn]}
              >
                <Text style={[styles.dailyBtnText, styles.dailyBtnTextOn]}>
                  {dailyBusy ? '…' : 'Save schedule'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={dailyBusy}
                onPress={async () => {
                  try {
                    setDailyBusy(true);
                    const data = await apiFetch<any>('/api/blogs/daily-settings', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ enabled: !dailyEnabled }),
                    });
                    setDailyEnabled(Boolean(data?.settings?.enabled ?? !dailyEnabled));
                    await loadDaily();
                  } catch {
                    /* keep previous */
                  } finally {
                    setDailyBusy(false);
                  }
                }}
                style={[styles.dailyBtn, dailyEnabled && styles.dailyBtnOn]}
              >
                <Text style={[styles.dailyBtnText, dailyEnabled && styles.dailyBtnTextOn]}>
                  {dailyEnabled ? 'Pause' : 'Enable'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={dailyBusy}
                onPress={async () => {
                  try {
                    setDailyBusy(true);
                    await apiFetch<any>('/api/blogs/daily-settings', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'run_now' }),
                    });
                    await loadDaily();
                    await load();
                  } catch {
                    /* ignore */
                  } finally {
                    setDailyBusy(false);
                  }
                }}
                style={styles.dailyBtn}
              >
                <Text style={styles.dailyBtnText}>{dailyBusy ? 'Working…' : 'Post now'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {diagnosis ? (
            <View style={styles.logsCard}>
              <Text style={styles.dailyTitle}>Auto-post logs</Text>
              <Text style={styles.diagTitle}>{diagnosis.title}</Text>
              <Text style={styles.dailyMeta}>{diagnosis.message}</Text>
              <View style={styles.dayRow}>
                {days.map((day) => (
                  <View key={day.date} style={styles.dayChip}>
                    <Text style={styles.timeLabel}>{String(day.date).slice(5)}</Text>
                    <Text style={styles.dayCount}>{day.posted}/{day.expected}</Text>
                  </View>
                ))}
              </View>
              {events.slice(0, 6).map((row, idx) => (
                <Text key={`${row.source}-${idx}`} style={styles.eventLine} numberOfLines={2}>
                  {row.status || 'info'} · {row.blog_title || row.error || row.reason || row.source || '—'}
                </Text>
              ))}
            </View>
          ) : null}

          <Text style={styles.count}>
            Showing {blogs.length === 0 ? 0 : 1}-{blogs.length} of {total} blogs
          </Text>
          {blogs.length === 0 ? (
            <Text style={styles.empty}>No blog posts found matching your criteria.</Text>
          ) : (
            blogs.map((blog) => {
              const date = blog.published_at || blog.created_at;
              return (
                <View key={blog.id} style={styles.card}>
                  {blog.featured_image ? (
                    <View>
                      <Image source={{ uri: resolvePublicMediaUrl(blog.featured_image) }} style={styles.cover} />
                      {blog.category ? (
                        <View style={styles.catBadge}>
                          <Text style={styles.catBadgeText}>{blog.category.name}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <View style={styles.coverFallback}>
                      <Text style={styles.coverLetter}>{(blog.title || 'B').charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.body}>
                    <Text style={styles.meta}>
                      {date ? formatDateDMY(date) : ''}
                      {date ? '  ·  ' : ''}
                      {blog.read_time || 3} min read
                      {'  ·  '}
                      {Number(blog.views || 0).toLocaleString('en-IN')} views
                    </Text>
                    <Text style={styles.title} numberOfLines={2}>
                      {blog.title}
                    </Text>
                    {blog.excerpt ? (
                      <Text style={styles.excerpt} numberOfLines={3}>
                        {blog.excerpt}
                      </Text>
                    ) : null}
                    {blog.tags && blog.tags.length > 0 ? (
                      <View style={styles.tags}>
                        {blog.tags.slice(0, 3).map((tag) => (
                          <Text key={tag.slug || tag.name} style={styles.tag}>
                            {tag.name}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                    <TouchableOpacity
                      onPress={() => {
                        if (blog.status === 'published' && blog.slug) {
                          void Linking.openURL(`https://myfng.in/blogs/${blog.slug}`);
                        }
                      }}
                    >
                      <Text style={styles.readMore}>Read More →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  searchWrap: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  search: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  tabs: { paddingHorizontal: SPACING.md, paddingVertical: 12, gap: 8 },
  tab: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  tabActive: { backgroundColor: '#004AAD' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  tabTextActive: { color: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: SPACING.md, gap: 16, paddingBottom: 32 },
  dailyCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  dailyTitle: { fontSize: 14, fontWeight: '800', color: '#023D95' },
  dailyMeta: { marginTop: 4, fontSize: 12, color: '#4B5563' },
  countRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  countChip: {
    width: 36,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countChipOn: { backgroundColor: '#004AAD', borderColor: '#004AAD' },
  countChipText: { fontSize: 13, fontWeight: '800', color: '#023D95' },
  countChipTextOn: { color: '#fff' },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  timeField: { minWidth: 88 },
  timeLabel: { fontSize: 10, fontWeight: '700', color: '#6B7280' },
  timeInput: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#023D95',
  },
  dailyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  dailyBtn: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  dailyBtnOn: { backgroundColor: '#004AAD', borderColor: '#004AAD' },
  dailyBtnText: { fontSize: 12, fontWeight: '700', color: '#004AAD' },
  dailyBtnTextOn: { color: '#fff' },
  logsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  diagTitle: { marginTop: 6, fontSize: 13, fontWeight: '800', color: '#111827' },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  dayChip: { minWidth: 58, backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  dayCount: { fontSize: 13, fontWeight: '800', color: '#023D95' },
  eventLine: { marginTop: 6, fontSize: 11, color: '#4B5563' },
  count: { fontSize: 13, color: '#4B5563', marginBottom: 4 },
  empty: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 40 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cover: { width: '100%', height: 160, backgroundColor: '#E5E7EB' },
  coverFallback: {
    width: '100%',
    height: 160,
    backgroundColor: '#004AAD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverLetter: { fontSize: 40, fontWeight: '800', color: '#fff' },
  catBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#004AAD',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  catBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  body: { padding: 16 },
  meta: { fontSize: 11, color: '#6B7280', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '800', color: '#023D95', marginBottom: 8 },
  excerpt: { fontSize: 13, color: '#4B5563', lineHeight: 19, marginBottom: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tag: {
    fontSize: 11,
    color: '#4B5563',
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  readMore: { fontSize: 13, fontWeight: '700', color: '#004AAD' },
});
