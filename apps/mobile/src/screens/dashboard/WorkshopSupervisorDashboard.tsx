import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { supabase } from '../../lib/supabase';
import WorkshopCrmShell from '../../components/workshop/WorkshopCrmShell';
import {
  ADVISOR_CRM_NAV,
  ADVISOR_CRM_QUICK,
} from '../../constants/workshopCrmNav';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { formatDateTime } from '@/lib/dateFormat';
import { useAuth } from '../../context/AuthContext';
import WorkshopDateFilter, { isoInRange } from '../../components/workshop/WorkshopDateFilter';
import { istYmd, resolveCrmDateRange, type CrmDatePreset } from '../../lib/crmDateRange';
import { isReadyForMechanicAssign, isWaitingPickupAssign } from '../../lib/workshopJobFlow';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type QuickAction = {
  key: string;
  label: string;
  icon: IoniconName;
  color: string;
  screen: string;
  badge: number;
};

function WorkshopAdvisorHomeScreen({ navigation }: any) {
  const { userProfile: authProfile, refreshUserProfile } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [stats, setStats] = useState({
    totalMechanics: 0,
    activeJobs: 0,
    completedToday: 0,
    pendingQc: 0,
    overdueJobs: 0,
    pendingLeads: 0,
    extraJobs: 0,
    pickupActive: 0,
    unassigned: 0,
    pickupWaiting: 0,
    mechanicUnassigned: 0,
  });
  const [unassignedJobs, setUnassignedJobs] = useState<any[]>([]);
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const workshopIdRef = useRef<string | null>(null);
  const [datePreset, setDatePreset] = useState<CrmDatePreset>('today');
  const [customStart, setCustomStart] = useState(istYmd());
  const [customEnd, setCustomEnd] = useState(istYmd());

  const fetchDashboardData = useCallback(async () => {
    const workshopId = workshopIdRef.current;
    if (!workshopId) return;

    try {
      const range = resolveCrmDateRange(datePreset, customStart, customEnd);

      const [mechanicsRes, leadsRes, jobsRes, extraRes] = await Promise.all([
        supabase
          .from('users_login')
          .select('id, role:role_id(role_code)')
          .eq('workshop_id', workshopId),
        supabase
          .from('service_leads')
          .select(
            'id, lead_number, customer_name, vehicle_number, status, assigned_mechanic_id, assigned_pickup_boy_id, qc_status, pickup_status, pickup_required, created_at',
          )
          .eq('workshop_id', workshopId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('mechanic_jobs')
          .select(
            `id, mechanic_status, completed_at, sla_remaining_minutes, qc_status, assigned_at,
             service_leads:lead_id(id, lead_number, customer_name, vehicle_number, workshop_id, created_at, deleted_at),
             mechanic:mechanic_id(full_name, workshop_id)`,
          )
          .order('assigned_at', { ascending: false })
          .limit(80),
        supabase
          .from('lead_extra_charges')
          .select('id, service_leads!inner(workshop_id)', { count: 'exact', head: true })
          .eq('service_leads.workshop_id', workshopId)
          .eq('status', 'PENDING'),
      ]);

      const onlyMechanics = (mechanicsRes.data || []).filter(
        (user: any) => user.role?.role_code === 'WORKSHOP_MECHANIC',
      );

      const leadsData = leadsRes.data || [];
      const workshopJobs =
        jobsRes.data?.filter(
          (job: any) => job.service_leads?.workshop_id === workshopId && !job.service_leads?.deleted_at,
        ) || [];

      const activeJobsList = workshopJobs.filter((job: any) =>
        ['ASSIGNED', 'IN_PROGRESS', 'HOLD'].includes(job.mechanic_status),
      );

      const pickupWaitingList = leadsData.filter((lead: any) => isWaitingPickupAssign(lead));
      const mechanicWaitingList = leadsData.filter(
        (lead: any) =>
          !lead.assigned_mechanic_id &&
          isReadyForMechanicAssign(lead) &&
          ['ACCEPTED', 'VEHICLE_DROPPED_AT_WORKSHOP'].includes(lead.status),
      );
      const unassignedJobsList = [
        ...pickupWaitingList.map((lead: any) => ({ ...lead, assignKind: 'pickup' as const })),
        ...mechanicWaitingList.map((lead: any) => ({ ...lead, assignKind: 'mechanic' as const })),
      ];

      const pendingLeads = leadsData.filter((lead: any) =>
        ['ASSIGNED_TO_WORKSHOP', 'ASSIGNED'].includes(lead.status),
      ).length;

      const pendingQcFromLeads = leadsData.filter(
        (lead: any) => lead.qc_status === 'PENDING',
      ).length;
      const pendingQcFromJobs = workshopJobs.filter(
        (job: any) => job.mechanic_status === 'COMPLETED' && !job.qc_status,
      ).length;

      const pickupActive = leadsData.filter((lead: any) =>
        ['ASSIGNED', 'IN_TRANSIT', 'PICKED_UP', 'EN_ROUTE'].includes(lead.pickup_status),
      ).length;

      const completedInRange = workshopJobs.filter((job: any) =>
        isoInRange(job.completed_at, range.start, range.end, range.allTime),
      ).length;

      const overdueJobs = workshopJobs.filter(
        (job: any) => job.sla_remaining_minutes != null && job.sla_remaining_minutes < 0,
      ).length;

      setStats({
        totalMechanics: onlyMechanics.length,
        activeJobs: activeJobsList.length,
        completedToday: completedInRange,
        pendingQc: Math.max(pendingQcFromLeads, pendingQcFromJobs),
        overdueJobs,
        pendingLeads,
        extraJobs: extraRes.count || 0,
        pickupActive,
        unassigned: unassignedJobsList.length,
        pickupWaiting: pickupWaitingList.length,
        mechanicUnassigned: mechanicWaitingList.length,
      });

      setUnassignedJobs(unassignedJobsList.slice(0, 5));
      setActiveJobs(activeJobsList.slice(0, 5));
    } catch {
      /* keep last good snapshot */
    }
  }, [datePreset, customStart, customEnd]);

  const loadProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('users_login')
      .select('*, role:role_id(role_code, role_name), workshop:workshops!workshop_id(id, name)')
      .eq('id', user.id)
      .single();
    if (!data) return;
    workshopIdRef.current = data.workshop_id || null;
    const joined = [data.first_name, data.last_name]
      .map((s: any) => String(s || '').trim())
      .filter(Boolean)
      .join(' ');
    setUserProfile({ ...data, full_name: joined || data.full_name });
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useFocusEffect(
    useCallback(() => {
      void refreshUserProfile();
      void loadProfile();
      if (workshopIdRef.current) fetchDashboardData();
    }, [loadProfile, fetchDashboardData, refreshUserProfile]),
  );

  useEffect(() => {
    if (!userProfile?.workshop_id) return;
    workshopIdRef.current = userProfile.workshop_id;
    fetchDashboardData();

    const channel = supabase
      .channel('advisor-home-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mechanic_jobs' },
        () => fetchDashboardData(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_leads' },
        () => fetchDashboardData(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile?.workshop_id, fetchDashboardData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    await fetchDashboardData();
    setRefreshing(false);
  };

  const go = (screen: string, params?: Record<string, string>) => {
    try {
      if (params) navigation.navigate(screen, params);
      else navigation.navigate(screen);
    } catch {
      /* screen missing */
    }
  };

  const quickActions: QuickAction[] = [
    {
      key: 'leads',
      label: 'Pending Leads',
      icon: 'time-outline',
      color: '#D97706',
      screen: 'PendingLeads',
      badge: stats.pendingLeads,
    },
    {
      key: 'assign',
      label: 'Assign Mechanic',
      icon: 'person-add-outline',
      color: COLORS.primary,
      screen: 'MechanicAssignment',
      badge: stats.mechanicUnassigned,
    },
    {
      key: 'qc',
      label: 'QC Queue',
      icon: 'checkmark-circle-outline',
      color: '#7C3AED',
      screen: 'QCCheck',
      badge: stats.pendingQc,
    },
    {
      key: 'pickup',
      label: 'Pickup & Delivery',
      icon: 'car-outline',
      color: '#0D9488',
      screen: 'PickupDeliveryTracking',
      badge: stats.pickupWaiting + stats.pickupActive,
    },
    {
      key: 'extra',
      label: 'Extra Jobs',
      icon: 'cash-outline',
      color: '#EA580C',
      screen: 'ExtraWorkApproval',
      badge: stats.extraJobs,
    },
    {
      key: 'planning',
      label: 'Day Planning',
      icon: 'calendar-outline',
      color: '#4F46E5',
      screen: 'DayPlanning',
      badge: 0,
    },
  ];

  const statusLabel = (status?: string) => {
    if (status === 'IN_PROGRESS') return 'In Progress';
    if (status === 'ASSIGNED') return 'Assigned';
    if (status === 'HOLD') return 'On Hold';
    return status || 'Active';
  };

  const statusTone = (status?: string) => {
    if (status === 'IN_PROGRESS') return { bg: '#DBEAFE', fg: COLORS.primary };
    if (status === 'ASSIGNED') return { bg: '#D1FAE5', fg: '#047857' };
    return { bg: '#FEF3C7', fg: '#B45309' };
  };

  const homeName =
    [authProfile?.first_name, authProfile?.last_name].filter(Boolean).join(' ').trim() ||
    authProfile?.full_name ||
    [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ').trim() ||
    userProfile?.full_name ||
    'Workshop Advisor';

  const renderDashboard = () => (
    <ScrollView
      style={styles.content}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.heroName}>{homeName}</Text>
        <Text style={styles.heroMeta}>
          {userProfile?.workshop?.name || 'Workshop Advisor'}
        </Text>
      </View>

      <WorkshopDateFilter
        preset={datePreset}
        customStart={customStart}
        customEnd={customEnd}
        onPreset={setDatePreset}
        onCustomStart={setCustomStart}
        onCustomEnd={setCustomEnd}
      />

      <Text style={[styles.sectionTitle, styles.sectionTitleFirst]}>Overview</Text>
      <View style={styles.statsWrap}>
        {[
          { key: 'mech', label: 'Mechanics', value: stats.totalMechanics, accent: '#004AAD', screen: 'TeamOverview' },
          { key: 'active', label: 'Active Jobs', value: stats.activeJobs, accent: '#D97706', screen: 'JobMonitoring' },
          { key: 'assign', label: 'To Assign', value: stats.unassigned, accent: '#EA580C', screen: unassignedJobs.some((j) => j.assignKind === 'pickup') ? 'PickupDeliveryTracking' : 'MechanicAssignment' },
          { key: 'leads', label: 'Pending Leads', value: stats.pendingLeads, accent: '#0284C7', screen: 'PendingLeads' },
          { key: 'done', label: 'Completed', value: stats.completedToday, accent: '#059669', screen: 'DailyReport' },
          { key: 'qc', label: 'Pending QC', value: stats.pendingQc, accent: '#6D28D9', screen: 'QCCheck' },
          { key: 'pickup', label: 'Pickup Active', value: stats.pickupActive, accent: '#4338CA', screen: 'PickupDeliveryTracking' },
          { key: 'overdue', label: 'Overdue', value: stats.overdueJobs, accent: '#DC2626', screen: 'JobMonitoring' },
        ].map((tile) => (
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
        <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>Needs Assignment</Text>
        <TouchableOpacity
          onPress={() =>
            go(
              unassignedJobs.some((j) => j.assignKind === 'pickup')
                ? 'PickupDeliveryTracking'
                : 'MechanicAssignment',
            )
          }
        >
          <Text style={styles.viewAll}>View all</Text>
        </TouchableOpacity>
      </View>
      {unassignedJobs.length > 0 ? (
        unassignedJobs.map((job) => {
          const pickup = job.assignKind === 'pickup';
          return (
          <View key={`${job.assignKind}-${job.id}`} style={styles.jobCard}>
            <View style={styles.jobHeader}>
              <Text style={styles.jobName} numberOfLines={1}>
                {job.customer_name || 'Customer'}
              </Text>
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentText}>{pickup ? 'PICKUP' : 'MECHANIC'}</Text>
              </View>
            </View>
            {job.vehicle_number ? (
              <Text style={styles.jobMeta} numberOfLines={1}>{job.vehicle_number}</Text>
            ) : null}
            {job.created_at ? (
              <Text style={styles.jobDate}>{formatDateTime(job.created_at)}</Text>
            ) : null}
            <TouchableOpacity
              style={styles.assignButton}
              onPress={() =>
                pickup
                  ? go('PickupDeliveryTracking')
                  : go('MechanicAssignment', { leadId: job.id })
              }
            >
              <Ionicons name="person-add" size={16} color={COLORS.white} />
              <Text style={styles.assignButtonText}>
                {pickup ? 'Assign pickup' : 'Assign Mechanic'}
              </Text>
            </TouchableOpacity>
          </View>
          );
        })
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No jobs waiting to assign</Text>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>Active Jobs</Text>
        <TouchableOpacity onPress={() => go('JobMonitoring')}>
          <Text style={styles.viewAll}>Monitor</Text>
        </TouchableOpacity>
      </View>
      {activeJobs.length > 0 ? (
        activeJobs.map((job) => {
          const tone = statusTone(job.mechanic_status);
          return (
            <TouchableOpacity
              key={job.id}
              style={styles.jobCard}
              onPress={() => go('JobDetail', { jobId: job.id })}
              activeOpacity={0.8}
            >
              <View style={styles.jobHeader}>
                <Text style={styles.jobName} numberOfLines={1}>
                  {job.service_leads?.customer_name || 'Customer'}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
                  <Text style={[styles.statusBadgeText, { color: tone.fg }]}>
                    {statusLabel(job.mechanic_status)}
                  </Text>
                </View>
              </View>
              {job.service_leads?.vehicle_number ? (
                <Text style={styles.jobMeta} numberOfLines={1}>
                  {job.service_leads.vehicle_number}
                </Text>
              ) : null}
              {job.service_leads?.created_at || job.assigned_at ? (
                <Text style={styles.jobDate}>
                  {formatDateTime(job.service_leads?.created_at || job.assigned_at)}
                </Text>
              ) : null}
              <Text style={styles.assignedTo}>
                {job.mechanic?.full_name || 'Mechanic not set'}
              </Text>
            </TouchableOpacity>
          );
        })
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No active jobs right now</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickGrid}>
        {quickActions.map((action) => (
          <TouchableOpacity
            key={action.key}
            style={styles.quickCard}
            onPress={() => go(action.screen)}
            activeOpacity={0.8}
          >
            {action.badge > 0 ? (
              <View style={styles.quickBadge}>
                <Text style={styles.quickBadgeText}>
                  {action.badge > 99 ? '99+' : String(action.badge)}
                </Text>
              </View>
            ) : null}
            <View style={[styles.quickIcon, { backgroundColor: action.color + '18' }]}>
              <Ionicons name={action.icon} size={22} color={action.color} />
            </View>
            <Text style={styles.quickLabel} numberOfLines={1}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  return (
    <WorkshopCrmShell
      key="advisor-crm-home"
      title="Home"
      userName={homeName}
      userEmail={authProfile?.email || userProfile?.email}
      roleFallback="Workshop Advisor"
      navigation={navigation}
      drawerItems={ADVISOR_CRM_NAV}
      quickItems={ADVISOR_CRM_QUICK}
      activeTab={currentScreen}
      onTabChange={setCurrentScreen}
    >
      {renderDashboard()}
    </WorkshopCrmShell>
  );
}

export default WorkshopAdvisorHomeScreen;

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl + SPACING.lg,
  },
  hero: {
    marginBottom: SPACING.sm,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.heading,
  },
  heroMeta: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.bodyText,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
    color: COLORS.heading,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  sectionTitleFirst: {
    marginTop: 0,
  },
  sectionTitleInline: {
    marginTop: 0,
    marginBottom: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  viewAll: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.primary,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: SPACING.sm,
  },
  quickCard: {
    width: '47.5%',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 8,
    position: 'relative',
    ...SHADOWS.small,
  },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  quickBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    zIndex: 1,
  },
  quickBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
  },
  statsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  statCard: {
    width: '47.5%',
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    borderLeftWidth: 4,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.heading,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: FONT_SIZES.sm,
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
    marginBottom: 4,
    gap: 8,
  },
  jobName: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
    color: COLORS.heading,
  },
  urgentBadge: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  urgentText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  jobMeta: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    marginBottom: 2,
  },
  jobDate: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginBottom: 8,
  },
  assignedTo: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  assignButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  assignButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.gray[500],
    fontWeight: '600',
  },
});
