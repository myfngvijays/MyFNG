import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';
import DashboardHeader from '../../components/DashboardHeader';
import BottomNav from '../../components/BottomNav';
import { COLORS, SPACING } from '../../constants/theme';

type DailyRun = { run_date: string; status: string; topic?: string | null };

export default function DigitalMarketingDashboard() {
  const navigation = useNavigation();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dailyBusy, setDailyBusy] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    published: 0,
    draft: 0,
    pendingReview: 0,
    categories: 0,
    totalViews: 0,
    publishedToday: 0,
    publishedThisWeek: 0,
    dailyAi: 0,
    batchAi: 0,
    packagePosts: 0,
    rsaPosts: 0,
    seoScore: 100,
    missingToday: false,
    dailyEnabled: true,
    lastBlog: '',
    lastStatus: '',
    recentRuns: [] as DailyRun[],
    packageBlogs: [] as Array<{ id: string; title: string; status: string }>,
    postsPerDay: 1,
    postTimes: ['10:00'] as string[],
    todayPostedCount: 0,
    scheduleLabel: '10:00 IST',
  });
  const [draftCount, setDraftCount] = useState(1);
  const [draftTimes, setDraftTimes] = useState<string[]>(['10:00']);

  const fetchUserProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('users_login').select('*').eq('id', user.id).single();
      if (data) setUserProfile(data);
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      const data = await apiFetch<any>('/api/blogs/dashboard-stats');
      const summary = data?.summary || {};
      const inventory = data?.inventory || {};
      const daily = data?.dailyPost || {};
      setStats({
        total: Number(summary.total || 0),
        published: Number(summary.published || 0),
        draft: Number(summary.draft || 0),
        pendingReview: Number(summary.pendingReview || 0),
        categories: Number(inventory.categories || 0),
        totalViews: Number(summary.totalViews || 0),
        publishedToday: Number(summary.publishedToday || 0),
        publishedThisWeek: Number(summary.publishedThisWeek || 0),
        dailyAi: Number(summary.dailyAi || 0),
        batchAi: Number(summary.batchAi || 0),
        packagePosts: Number(summary.packagePosts || 0),
        rsaPosts: Number(summary.rsaPosts || 0),
        seoScore: Number(data?.seoHealth?.score || 100),
        missingToday: daily.today_posted === false && daily.enabled !== false,
        dailyEnabled: daily.enabled !== false,
        lastBlog: daily.last_blog?.title || '',
        lastStatus: daily.last_status || '',
        recentRuns: Array.isArray(daily.recent_runs) ? daily.recent_runs.slice(0, 3) : [],
        postsPerDay: Number(daily.posts_per_day || 1),
        postTimes: Array.isArray(daily.post_times) && daily.post_times.length ? daily.post_times : ['10:00'],
        todayPostedCount: Number(daily.today_posted_count || 0),
        scheduleLabel: daily.schedule || '10:00 IST',
        packageBlogs: Array.isArray(data?.recentPackage)
          ? data.recentPackage.slice(0, 10).map((b: any) => ({
              id: String(b.id),
              title: String(b.title || ''),
              status: String(b.status || ''),
            }))
          : [],
      });
      const nextCount = Number(daily.posts_per_day || 1);
      const nextTimes = Array.isArray(daily.post_times) && daily.post_times.length ? daily.post_times : ['10:00'];
      setDraftCount(nextCount);
      setDraftTimes(nextTimes.slice(0, nextCount));
    } catch (error) {
      if (__DEV__) console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUserProfile();
    void fetchDashboardData();
  }, [fetchUserProfile, fetchDashboardData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const handleNavigation = (screen: string) => {
    if (screen === 'dashboard') return;
    navigation.navigate(screen as never);
  };

  const defaultTimes = (count: number) => {
    const presets: Record<number, string[]> = {
      1: ['10:00'],
      2: ['10:00', '16:00'],
      3: ['10:00', '14:00', '18:00'],
      4: ['10:00', '13:00', '16:00', '19:00'],
      5: ['09:00', '12:00', '15:00', '18:00', '21:00'],
    };
    return presets[count] || presets[1];
  };

  const changeCount = (count: number) => {
    setDraftCount(count);
    setDraftTimes((prev) => {
      const fallback = defaultTimes(count);
      return Array.from({ length: count }, (_, i) => prev[i] || fallback[i]);
    });
  };

  const saveSchedule = async () => {
    setDailyBusy(true);
    try {
      await apiFetch('/api/blogs/daily-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posts_per_day: draftCount, post_times: draftTimes }),
      });
      await fetchDashboardData();
      Alert.alert('Saved', `Daily schedule: ${draftCount} blog${draftCount > 1 ? 's' : ''}`);
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Run database/369_daily_blog_slots.sql');
    } finally {
      setDailyBusy(false);
    }
  };

  const toggleDaily = async () => {
    setDailyBusy(true);
    try {
      await apiFetch('/api/blogs/daily-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !stats.dailyEnabled }),
      });
      await fetchDashboardData();
    } catch (e: any) {
      Alert.alert('Update failed', e?.message || 'Could not update daily posting');
    } finally {
      setDailyBusy(false);
    }
  };

  const runDailyNow = async () => {
    setDailyBusy(true);
    try {
      const data = await apiFetch<any>('/api/blogs/daily-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_now' }),
      });
      await fetchDashboardData();
      if (data?.run?.title) {
        Alert.alert('Published', data.run.title);
      }
    } catch (e: any) {
      Alert.alert('Post failed', e?.message || 'Could not publish daily blog');
    } finally {
      setDailyBusy(false);
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Home', icon: 'home' },
    { id: 'DMContent', label: 'Blogs', icon: 'document' },
    { id: 'DMSiteSeo', label: 'SEO', icon: 'search' },
    { id: 'DMCategories', label: 'Categories', icon: 'tag' },
    { id: 'DMProfile', label: 'Profile', icon: 'account' },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading content studio…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <DashboardHeader
          title="Blogs dashboard"
          subtitle="Daily · package · SEO"
          userProfile={userProfile}
        />

        <View style={[styles.dailyCard, stats.missingToday ? styles.dailyWarn : styles.dailyOk]}>
          <View style={styles.dailyRow}>
            <Text style={styles.dailyEyebrow}>DAILY AUTO-POST</Text>
            <Text style={styles.dailyTitle}>
              {stats.missingToday
                ? 'Slot missing'
                : stats.dailyEnabled
                  ? `${stats.todayPostedCount}/${stats.postsPerDay} posted`
                  : 'Paused'}
            </Text>
          </View>
          <Text style={styles.dailyMeta} numberOfLines={2}>
            {stats.scheduleLabel} · {stats.lastBlog || stats.lastStatus || 'No daily post yet'}
          </Text>
          <Text style={styles.dailyMeta}>Blogs per day</Text>
          <View style={styles.countRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.countChip, draftCount === n && styles.countChipOn]}
                onPress={() => changeCount(n)}
                disabled={dailyBusy}
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
          <View style={styles.dailyActions}>
            <TouchableOpacity style={styles.primaryBtn} onPress={saveSchedule} disabled={dailyBusy}>
              <Text style={styles.primaryBtnText}>{dailyBusy ? '…' : 'Save schedule'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={runDailyNow} disabled={dailyBusy}>
              <Text style={styles.primaryBtnText}>{dailyBusy ? '…' : 'Post now'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={toggleDaily} disabled={dailyBusy}>
              <Text style={styles.secondaryBtnText}>{stats.dailyEnabled ? 'Pause' : 'Enable'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsGrid}>
          {[
            { title: 'Total', value: stats.total.toLocaleString() },
            { title: 'Live', value: stats.published.toLocaleString() },
            { title: 'Views', value: stats.totalViews.toLocaleString() },
            { title: 'Today', value: String(stats.publishedToday) },
            { title: 'Week', value: String(stats.publishedThisWeek) },
            { title: 'Daily AI', value: String(stats.dailyAi) },
            { title: 'Batch', value: String(stats.batchAi) },
            { title: 'Package', value: String(stats.packagePosts) },
            { title: 'RSA', value: String(stats.rsaPosts) },
            { title: 'SEO', value: `${stats.seoScore}%` },
            { title: 'Drafts', value: String(stats.draft) },
            { title: 'Cats', value: String(stats.categories) },
          ].map((item) => (
            <View key={item.title} style={styles.statChip}>
              <Text style={styles.statTitle}>{item.title}</Text>
              <Text style={styles.statValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Package blogs · {stats.packagePosts}</Text>
          {stats.packageBlogs.length ? (
            stats.packageBlogs.map((blog) => (
              <TouchableOpacity key={blog.id} style={styles.blogRow} onPress={() => handleNavigation('DMContent')}>
                <Text style={styles.blogTitle} numberOfLines={1}>{blog.title}</Text>
                <Text style={styles.blogMeta}>{blog.status}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.empty}>No package blogs yet</Text>
          )}
        </View>

        {stats.recentRuns.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent daily runs</Text>
            {stats.recentRuns.map((run) => (
              <View key={run.run_date} style={styles.runRow}>
                <Text style={styles.runDate}>{run.run_date}</Text>
                <Text style={[styles.runStatus, run.status === 'success' ? styles.ok : styles.bad]}>
                  {run.status}
                </Text>
                <Text style={styles.runTopic} numberOfLines={1}>{run.topic || '—'}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.actionButton} onPress={() => handleNavigation('DMContent')}>
              <Text style={styles.actionEmoji}>📝</Text>
              <Text style={styles.actionText}>Blogs</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => handleNavigation('DMSiteSeo')}>
              <Text style={styles.actionEmoji}>🔍</Text>
              <Text style={styles.actionText}>On-page SEO</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => handleNavigation('DMCompetitors')}>
              <Text style={styles.actionEmoji}>📡</Text>
              <Text style={styles.actionText}>Competitors</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => handleNavigation('DMMetaAds')}>
              <Text style={styles.actionEmoji}>📣</Text>
              <Text style={styles.actionText}>Meta Ads</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => handleNavigation('DMGoogleAds')}>
              <Text style={styles.actionEmoji}>🎯</Text>
              <Text style={styles.actionText}>Google Ads</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => handleNavigation('DMCategories')}>
              <Text style={styles.actionEmoji}>🏷️</Text>
              <Text style={styles.actionText}>Categories</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => handleNavigation('DMProfile')}>
              <Text style={styles.actionEmoji}>👤</Text>
              <Text style={styles.actionText}>Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <BottomNav activeTab="dashboard" onTabChange={handleNavigation} tabs={tabs} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: SPACING.md, color: COLORS.textSecondary },
  dailyCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  dailyOk: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  dailyWarn: { backgroundColor: '#FFFBEB', borderColor: '#FCD34D' },
  dailyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dailyEyebrow: { fontSize: 10, fontWeight: '700', color: '#C9A227', letterSpacing: 0.4 },
  dailyTitle: { fontSize: 13, fontWeight: '800', color: COLORS.heading },
  dailyMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4 },
  dailyActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  countRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  countChip: {
    width: 36,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countChipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  countChipText: { fontSize: 13, fontWeight: '800', color: COLORS.heading },
  countChipTextOn: { color: COLORS.white },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  timeField: { minWidth: 88 },
  timeLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary },
  timeInput: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.heading,
  },
  primaryBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  primaryBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 12 },
  secondaryBtn: { backgroundColor: COLORS.white, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  secondaryBtnText: { color: COLORS.heading, fontWeight: '700', fontSize: 12 },
  statsGrid: { padding: SPACING.md, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statChip: {
    width: '31.5%',
    backgroundColor: COLORS.white,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statTitle: { fontSize: 10, color: COLORS.textSecondary },
  statValue: { fontSize: 14, fontWeight: '800', color: COLORS.primary, marginTop: 2 },
  section: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.heading, marginBottom: 6 },
  blogRow: { paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  blogTitle: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  blogMeta: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2, textTransform: 'capitalize' },
  empty: { fontSize: 12, color: COLORS.textSecondary, paddingVertical: 8 },
  runRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  runDate: { width: 72, fontSize: 11, fontWeight: '600', color: COLORS.textPrimary },
  runStatus: { width: 56, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  ok: { color: COLORS.success },
  bad: { color: COLORS.danger },
  runTopic: { flex: 1, fontSize: 11, color: COLORS.textSecondary },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionButton: {
    flex: 1,
    minWidth: 80,
    backgroundColor: COLORS.white,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionEmoji: { fontSize: 18, marginBottom: 4 },
  actionText: { fontSize: 11, color: COLORS.textPrimary, fontWeight: '700' },
});
