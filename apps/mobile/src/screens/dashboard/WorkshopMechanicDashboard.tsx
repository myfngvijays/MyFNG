import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';
import WorkshopCrmShell from '../../components/workshop/WorkshopCrmShell';
import WorkshopDateFilter, { isoInRange } from '../../components/workshop/WorkshopDateFilter';
import {
  MECHANIC_CRM_NAV,
  MECHANIC_CRM_QUICK,
  WORKSHOP_CRM_TAB_TITLES,
} from '../../constants/workshopCrmNav';
import { COLORS, SPACING, FONT_SIZES, SHADOWS, BORDER_RADIUS } from '../../constants/theme';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { formatDateDMY } from "@/lib/dateFormat";
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { istYmd, resolveCrmDateRange, type CrmDatePreset } from '../../lib/crmDateRange';
import { fetchMechanicJobs } from '../../lib/mechanicJobs';
import {
  isMechanicJobInProgress,
  mechanicStatusColors,
  mechanicStatusLabel,
  resolveMechanicDisplayStatus,
} from '../../lib/mechanicJobStatus';

export default function WorkshopMechanicDashboard({ navigation }: any) {
  const { jobRefreshTick } = useNotifications();
  const { userProfile: authProfile, refreshUserProfile } = useAuth();
  const [userProfile, setUserProfile] = React.useState<any>(null);
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [stats, setStats] = useState({
    assignedJobs: 0,
    inProgress: 0,
    completedToday: 0,
    onHold: 0,
    needApproval: 0,
  });
  const [myJobs, setMyJobs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [datePreset, setDatePreset] = useState<CrmDatePreset>('today');
  const [customStart, setCustomStart] = useState(istYmd());
  const [customEnd, setCustomEnd] = useState(istYmd());
  const dateRange = resolveCrmDateRange(datePreset, customStart, customEnd);

  // ✅ FIX: Fetch user profile from users_login table (like web)
  React.useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profileData, error } = await supabase
          .from('users_login')
          .select('id, full_name, first_name, last_name, email')
          .eq('email', user.email)
          .single();

        if (error) {
          return;
        }

        if (profileData) {
          setUserProfile(profileData);
        }
      } catch (error) {
        // Error handled silently
      }
    };

    fetchUserProfile();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      let dashboardData: any[] = [];

      try {
        dashboardData = await fetchMechanicJobs(session.access_token);
      } catch (apiError) {
        console.warn('Mechanic jobs API failed, trying direct query:', apiError);

        let mechanicId = userProfile?.id;
        if (!mechanicId) {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const { data: profileData } = await supabase
            .from('users_login')
            .select('id')
            .ilike('email', user.email || '')
            .maybeSingle();
          mechanicId = profileData?.id || user.id;
        }

        const { data: fallbackData } = await supabase
          .from('mechanic_jobs')
          .select(`
            *,
            lead:service_leads(customer_name, vehicle_number, vehicle_make, vehicle_model, service_type)
          `)
          .eq('mechanic_id', mechanicId)
          .order('assigned_at', { ascending: false });

        dashboardData = (fallbackData || []).map((mj: any) => ({
          id: mj.id,
          job_id: mj.id,
          lead_id: mj.lead_id,
          customer_name: mj.lead?.customer_name || 'Customer',
          vehicle_number: mj.lead?.vehicle_number || '',
          vehicle_make: mj.lead?.vehicle_make || '',
          vehicle_model: mj.lead?.vehicle_model || '',
          service_type: mj.lead?.service_type || '',
          mechanic_status: mj.mechanic_status || 'ASSIGNED',
          assigned_at: mj.assigned_at,
          completed_at: mj.completed_at,
          has_pending_extra_work: !!mj.has_pending_extra_work,
        }));
      }

      const normalizedJobs = dashboardData.map((job: any) => {
        const done = Number(job.checklist_done ?? 0);
        const total = Number(job.checklist_total ?? 0);
        const displayStatus =
          job.display_status ||
          resolveMechanicDisplayStatus(job.mechanic_status, done, total);
        return { ...job, display_status: displayStatus, checklist_done: done, checklist_total: total };
      });

      const inProgress = normalizedJobs.filter((job) =>
        isMechanicJobInProgress(job.mechanic_status, job.checklist_done, job.checklist_total),
      ).length;
      const onHold = normalizedJobs.filter((job) => {
        const s = String(job.display_status || job.mechanic_status || '');
        return s === 'HOLD' || s === 'WAITING_APPROVAL';
      }).length;
      const needApproval = normalizedJobs.filter((job) => job.has_pending_extra_work).length;

      setStats({
        assignedJobs: normalizedJobs.filter((job) => {
          if (!job.assigned_at) return false;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const assignedDate = new Date(job.assigned_at);
          assignedDate.setHours(0, 0, 0, 0);
          return assignedDate.getTime() === today.getTime();
        }).length,
        inProgress,
        completedToday: normalizedJobs.filter((job) => {
          if (!job.completed_at) return false;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const completedDate = new Date(job.completed_at);
          completedDate.setHours(0, 0, 0, 0);
          return completedDate.getTime() === today.getTime();
        }).length,
        onHold,
        needApproval,
      });

      setMyJobs(normalizedJobs);
    } catch (error) {
      console.error('Mechanic dashboard fetch error:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();

    let channel: RealtimeChannel | undefined;

    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from('users_login')
        .select('id')
        .ilike('email', user.email || '')
        .maybeSingle();
      const mechanicId = profileData?.id || user.id;

      channel = supabase
        .channel('mechanic-jobs-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'mechanic_jobs',
            filter: `mechanic_id=eq.${mechanicId}`,
          },
          () => {
            fetchData();
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'service_leads',
            filter: `assigned_mechanic_id=eq.${mechanicId}`,
          },
          () => {
            fetchData();
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'service_checklists',
          },
          () => fetchData(),
        )
        .subscribe();
    };

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [userProfile?.id]);

  useEffect(() => {
    if (!userProfile?.id && !authProfile?.id) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobRefreshTick]);

  useFocusEffect(
    React.useCallback(() => {
      void refreshUserProfile();
      void fetchData();
    }, [refreshUserProfile]),
  );

  const homeName =
    [authProfile?.first_name, authProfile?.last_name].filter(Boolean).join(' ').trim() ||
    authProfile?.full_name ||
    [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ').trim() ||
    userProfile?.full_name ||
    'Workshop Mechanic';

  const go = (screen: string, params?: any) => {
    navigation.navigate(screen, params);
  };

  const handleTabChange = (tab: string) => {
    if (tab === 'jobs') {
      go('MechanicJobs');
      return;
    }
    if (tab === 'history') {
      go('JobHistory');
      return;
    }
    if (tab === 'profile') {
      go('Profile');
      return;
    }
    if (tab === 'performance') {
      go('Performance');
      return;
    }
    setCurrentScreen(tab);
  };

  const activeJobs = myJobs.filter((job) => {
    const s = String(job.mechanic_status || job.status || '').toUpperCase();
    return s !== 'COMPLETED' && s !== 'READY_FOR_DELIVERY';
  });

  const statusLabel = (job: any) =>
    mechanicStatusLabel(job.display_status || job.mechanic_status || 'ASSIGNED');

  const statusTone = (job: any) =>
    mechanicStatusColors(job.display_status || job.mechanic_status || 'ASSIGNED');

  const shell = (child: React.ReactNode) => (
    <WorkshopCrmShell
      title={WORKSHOP_CRM_TAB_TITLES[currentScreen] || 'Home'}
      userName={homeName}
      userEmail={userProfile?.email}
      roleFallback="Workshop Mechanic"
      navigation={navigation}
      drawerItems={MECHANIC_CRM_NAV}
      quickItems={MECHANIC_CRM_QUICK}
      activeTab={currentScreen}
      onTabChange={handleTabChange}
    >
      {child}
    </WorkshopCrmShell>
  );

  const periodAssigned = useMemo(
    () => myJobs.filter((job) => isoInRange(job.assigned_at, dateRange.start, dateRange.end, dateRange.allTime)).length,
    [myJobs, dateRange.start, dateRange.end, dateRange.allTime],
  );
  const periodCompleted = useMemo(
    () => myJobs.filter((job) => isoInRange(job.completed_at, dateRange.start, dateRange.end, dateRange.allTime)).length,
    [myJobs, dateRange.start, dateRange.end, dateRange.allTime],
  );

  const workshopLine =
    authProfile?.workshop?.name || 'Jobs assigned to you';

  const kpiTiles = [
    { key: 'today', label: 'Assigned', value: periodAssigned, accent: '#004AAD', screen: 'MechanicJobs' },
    { key: 'prog', label: 'In progress', value: stats.inProgress, accent: '#D97706', screen: 'MechanicJobs' },
    { key: 'done', label: 'Completed', value: periodCompleted, accent: '#059669', screen: 'JobHistory' },
    { key: 'all', label: 'All jobs', value: myJobs.length, accent: '#0284C7', screen: 'MechanicJobs' },
    { key: 'hold', label: 'On hold', value: stats.onHold, accent: '#EA580C', screen: 'MechanicJobs' },
    { key: 'extra', label: 'Need approval', value: stats.needApproval, accent: '#6D28D9', screen: 'MechanicJobs' },
  ];

  const quickActions = [
    { key: 'jobs', label: 'Jobs', icon: 'construct-outline' as const, color: '#004AAD', screen: 'MechanicJobs' },
    { key: 'history', label: 'History', icon: 'time-outline' as const, color: '#0284C7', screen: 'JobHistory' },
    { key: 'perf', label: 'Performance', icon: 'stats-chart-outline' as const, color: '#059669', screen: 'Performance' },
    { key: 'profile', label: 'Profile', icon: 'person-outline' as const, color: '#6D28D9', screen: 'Profile' },
  ];

  return shell(
    <ScrollView
      style={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.heroName}>{homeName}</Text>
        <Text style={styles.heroMeta}>{workshopLine}</Text>
      </View>

      <WorkshopDateFilter
        preset={datePreset}
        customStart={customStart}
        customEnd={customEnd}
        onPreset={setDatePreset}
        onCustomStart={setCustomStart}
        onCustomEnd={setCustomEnd}
      />

      {datePreset !== 'today' && datePreset !== 'all_time' ? (
        <View style={styles.dateHint}>
          <Text style={styles.dateHintText}>
            Assigned / Completed counts are for selected dates. Active jobs below are current.
          </Text>
        </View>
      ) : null}

      <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Overview</Text>
      <View style={styles.statsGrid}>
        {kpiTiles.map((tile) => (
          <TouchableOpacity
            key={tile.key}
            style={[styles.statCard, { borderLeftColor: tile.accent }]}
            onPress={() => go(tile.screen)}
            activeOpacity={0.8}
          >
            <Text style={[styles.statValue, { color: tile.accent }]}>{tile.value}</Text>
            <Text style={styles.statLabel}>{tile.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>Active jobs</Text>
        <TouchableOpacity onPress={() => go('MechanicJobs')}>
          <Text style={styles.viewAll}>View all</Text>
        </TouchableOpacity>
      </View>
      {activeJobs.length > 0 ? (
        activeJobs.slice(0, 8).map((job) => {
          const tone = statusTone(job);
          return (
            <TouchableOpacity
              key={job.job_id || job.id}
              style={styles.jobCard}
              onPress={() =>
                navigation.navigate('JobDetail', {
                  jobId: job.lead_id,
                  leadId: job.lead_id,
                })
              }
              activeOpacity={0.8}
            >
              <View style={styles.jobHeader}>
                <Text style={styles.jobName} numberOfLines={1}>
                  {job.customer_name || 'Customer'}
                </Text>
                <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                  <Text style={[styles.statusPillTxt, { color: tone.fg }]}>
                    {statusLabel(job)}
                  </Text>
                </View>
              </View>
              <Text style={styles.jobMeta}>
                {[job.vehicle_number, `${job.vehicle_make || ''} ${job.vehicle_model || ''}`.trim()]
                  .filter(Boolean)
                  .join(' · ') || 'Vehicle'}
              </Text>
              <Text style={styles.jobMeta}>
                {job.service_type ||
                  (Array.isArray(job.service_types) ? job.service_types.join(', ') : '') ||
                  'Repair'}
                {job.checklist_total
                  ? ` · Checklist ${job.checklist_done || 0}/${job.checklist_total}`
                  : ''}
                {job.assigned_at ? ` · ${formatDateDMY(job.assigned_at)}` : ''}
              </Text>
              {job.has_pending_extra_work ? (
                <View style={styles.warnRow}>
                  <Ionicons name="alert-circle" size={14} color="#B45309" />
                  <Text style={styles.warnTxt}>Additional job pending</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No active jobs right now</Text>
          <Text style={styles.emptySub}>New assignments will show here</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Quick actions</Text>
      <View style={styles.quickGrid}>
        {quickActions.map((action) => (
          <TouchableOpacity
            key={action.key}
            style={styles.quickCard}
            onPress={() => go(action.screen)}
            activeOpacity={0.8}
          >
            <View style={[styles.quickIcon, { backgroundColor: `${action.color}18` }]}>
              <Ionicons name={action.icon} size={22} color={action.color} />
            </View>
            <Text style={styles.quickLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  hero: {
    marginBottom: SPACING.md,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#023D95',
  },
  heroMeta: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.bodyText,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#023D95',
    marginBottom: SPACING.md,
    marginTop: SPACING.md,
  },
  sectionTitleInline: { marginBottom: 0, marginTop: 0, flex: 1 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  viewAll: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  dateHint: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  dateHintText: {
    fontSize: 12,
    color: '#1D4ED8',
    fontWeight: '600',
    lineHeight: 16,
  },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickLabel: { fontSize: 13, fontWeight: '800', color: '#023D95' },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  statCard: {
    width: '31%',
    flexGrow: 1,
    backgroundColor: COLORS.white,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: BORDER_RADIUS.lg,
    borderLeftWidth: 3,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#023D95',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.bodyText,
    textAlign: 'center',
    fontWeight: '600',
  },
  jobCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.small,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  jobName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#023D95',
  },
  jobMeta: {
    fontSize: 13,
    color: COLORS.bodyText,
    marginTop: 4,
  },
  statusPill: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillTxt: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  warnTxt: { fontSize: 12, fontWeight: '700', color: '#B45309' },
  emptyState: {
    padding: SPACING.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#023D95',
  },
  emptySub: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },
});

