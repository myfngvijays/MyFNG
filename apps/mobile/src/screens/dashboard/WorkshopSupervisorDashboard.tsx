import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';
import WorkshopCrmShell from '../../components/workshop/WorkshopCrmShell';
import {
  ADVISOR_CRM_NAV,
  ADVISOR_CRM_QUICK,
} from '../../constants/workshopCrmNav';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { formatDateTime } from '@/lib/dateFormat';
import { useAuth } from '../../context/AuthContext';
import WorkshopDateFilter, { isoInRange } from '../../components/workshop/WorkshopDateFilter';
import { istYmd, resolveCrmDateRange, type CrmDatePreset } from '../../lib/crmDateRange';
import { isReadyForMechanicAssign, isWaitingPickupAssign, isPickupInProgress, isWaitingDeliveryAssign, isDeliveryInProgress, isPendingQc, isQcPassed, FLOOR_DONE_STATUSES } from '../../lib/workshopJobFlow';
import { fetchWorkshopPickupBoys, type PickupBoyOption } from '../../lib/fetchWorkshopPickupBoys';
import PickupAssignModal from '../../components/workshop/PickupAssignModal';

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
  const [assignPickupJob, setAssignPickupJob] = useState<any | null>(null);
  const [pickupBoys, setPickupBoys] = useState<PickupBoyOption[]>([]);
  const [pickupBoysLoading, setPickupBoysLoading] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    const workshopId = workshopIdRef.current;
    if (!workshopId) return;

    try {
      const range = resolveCrmDateRange(datePreset, customStart, customEnd);

      const [mechanicsRes, leadsRes, jobsRes, extraRes] = await Promise.all([
        supabase
          .from('users_login')
          .select('id, role:role_id(role_code)')
          .eq('workshop_id', workshopId)
          .eq('is_active', true),
        supabase
          .from('service_leads')
          .select(
            `id, lead_number, customer_name, vehicle_number, status, assigned_mechanic_id, assigned_pickup_boy_id,
             qc_status, qc_performed_at, pickup_status, pickup_required, mechanic_completed_at, created_at, updated_at,
             mechanic:assigned_mechanic_id(full_name)`,
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

      const leadsDataRaw = leadsRes.data || [];
      const trackIds = leadsDataRaw
        .filter((lead: any) => {
          const status = String(lead.status || '').toUpperCase();
          if (['REJECTED', 'CANCELLED', 'CLOSED'].includes(status)) return false;
          return (
            Boolean(lead.assigned_pickup_boy_id) ||
            status === 'READY_FOR_DELIVERY' ||
            status === 'COD_PENDING' ||
            status === 'DELIVERED'
          );
        })
        .map((lead: any) => lead.id);
      let dropByLead: Record<string, any> = {};
      if (trackIds.length) {
        const { data: tracks } = await supabase
          .from('pickup_tracking')
          .select('lead_id, drop_assigned_to, drop_status, drop_otp_verified_at, drop_completed_time')
          .in('lead_id', trackIds);
        for (const row of tracks || []) {
          dropByLead[String((row as any).lead_id)] = row;
        }
      }
      const leadsData = leadsDataRaw.map((lead: any) => ({
        ...lead,
        ...(dropByLead[String(lead.id)] || {}),
      }));
      const workshopJobs =
        jobsRes.data?.filter(
          (job: any) => job.service_leads?.workshop_id === workshopId && !job.service_leads?.deleted_at,
        ) || [];

      const activeFromLeads = leadsData.filter((lead: any) => {
        if (!lead.assigned_mechanic_id) return false;
        if (isQcPassed(lead)) return false;
        const status = String(lead.status || '').toUpperCase();
        return !['WORK_COMPLETED', 'CLOSED', 'CANCELLED', 'REJECTED'].includes(status);
      });

      const activeJobsList = activeFromLeads.map((lead: any) => {
              const status = String(lead.status || '').toUpperCase();
              let mechanicStatus = 'ASSIGNED';
              if (status === 'IN_PROGRESS') mechanicStatus = 'IN_PROGRESS';
              return {
                id: lead.id,
                mechanic_status: mechanicStatus,
                assigned_at: lead.updated_at || lead.created_at,
                service_leads: {
                  id: lead.id,
                  lead_number: lead.lead_number,
                  customer_name: lead.customer_name,
                  vehicle_number: lead.vehicle_number,
                  created_at: lead.created_at,
                },
                mechanic: { full_name: lead.mechanic?.full_name },
              };
            });

      const pickupWaitingList = leadsData.filter((lead: any) => isWaitingPickupAssign(lead));
      const pickupInProgressList = leadsData.filter((lead: any) => isPickupInProgress(lead));
      const deliveryWaitingList = leadsData.filter((lead: any) => isWaitingDeliveryAssign(lead));
      const deliveryInProgressList = leadsData.filter((lead: any) => isDeliveryInProgress(lead));
      const mechanicWaitingList = leadsData.filter(
        (lead: any) =>
          !lead.assigned_mechanic_id &&
          isReadyForMechanicAssign(lead) &&
          !FLOOR_DONE_STATUSES.has(String(lead.status || '').toUpperCase()) &&
          !['WORK_COMPLETED', 'QC_APPROVED', 'CLOSED', 'CANCELLED', 'REJECTED'].includes(
            String(lead.status || '').toUpperCase(),
          ),
      );
      const unassignedJobsList = [
        ...pickupWaitingList.map((lead: any) => ({ ...lead, assignKind: 'pickup' as const })),
        ...pickupInProgressList.map((lead: any) => ({ ...lead, assignKind: 'pickup_track' as const })),
        ...deliveryWaitingList.map((lead: any) => ({ ...lead, assignKind: 'delivery' as const })),
        ...deliveryInProgressList.map((lead: any) => ({ ...lead, assignKind: 'delivery_track' as const })),
        ...mechanicWaitingList.map((lead: any) => ({ ...lead, assignKind: 'mechanic' as const })),
      ];

      const pendingLeads = leadsData.filter((lead: any) =>
        ['ASSIGNED_TO_WORKSHOP', 'ASSIGNED'].includes(lead.status),
      ).length;

      const pendingQc = leadsData.filter((lead: any) => isPendingQc(lead)).length;

      const pickupActive = leadsData.filter((lead: any) => {
        const status = String(lead.status || '').toUpperCase();
        if (FLOOR_DONE_STATUSES.has(status) || status === 'COD_PENDING') return false;
        return ['ASSIGNED', 'ON_THE_WAY', 'OTP_VERIFIED', 'VEHICLE_IN_TRANSIT', 'IN_TRANSIT'].includes(
          String(lead.pickup_status || '').toUpperCase(),
        );
      }).length;

      const unassignedCount =
        pickupWaitingList.length + mechanicWaitingList.length + deliveryWaitingList.length;

      const completedInRange = leadsData.filter((lead: any) => {
        if (!isQcPassed(lead)) return false;
        return (
          isoInRange(lead.qc_performed_at, range.start, range.end, range.allTime) ||
          isoInRange(lead.mechanic_completed_at, range.start, range.end, range.allTime) ||
          isoInRange(lead.updated_at, range.start, range.end, range.allTime)
        );
      }).length;

      const overdueJobs = workshopJobs.filter(
        (job: any) => job.sla_remaining_minutes != null && job.sla_remaining_minutes < 0,
      ).length;

      setStats({
        totalMechanics: onlyMechanics.length,
        activeJobs: activeJobsList.length,
        completedToday: completedInRange,
        pendingQc,
        overdueJobs,
        pendingLeads,
        extraJobs: extraRes.count || 0,
        pickupActive,
        unassigned: unassignedCount,
        pickupWaiting: pickupWaitingList.length + deliveryWaitingList.length,
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

  const openAssignPickup = async (job: any) => {
    const wid = workshopIdRef.current;
    if (!wid) return;
    setAssignPickupJob(job);
    setPickupBoysLoading(true);
    try {
      setPickupBoys(await fetchWorkshopPickupBoys(wid));
    } finally {
      setPickupBoysLoading(false);
    }
  };

  const assignPickupFromHome = async (boy: PickupBoyOption) => {
    if (!assignPickupJob?.id) return;
    try {
      setAssignSaving(true);
      await apiFetch(`/api/workshop/leads/${assignPickupJob.id}/assign-team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickup_boy_id: boy.id }),
      });
      setAssignPickupJob(null);
      await fetchDashboardData();
      Alert.alert('Assigned', `Pickup assigned to ${boy.full_name}`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to assign pickup');
    } finally {
      setAssignSaving(false);
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
          { key: 'assign', label: 'To Assign', value: stats.unassigned, accent: '#EA580C', screen: unassignedJobs.some((j) => ['pickup', 'delivery'].includes(String(j.assignKind))) ? 'PickupDeliveryTracking' : 'MechanicAssignment' },
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
            <Text style={[styles.statValue, { color: tile.accent }]} maxFontSizeMultiplier={1.1}>
              {tile.value}
            </Text>
            <Text style={styles.statLabel} maxFontSizeMultiplier={1.1}>
              {tile.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, styles.sectionTitleInline]} maxFontSizeMultiplier={1.1}>
          Needs Assignment
        </Text>
        <TouchableOpacity
          onPress={() =>
            go(
              unassignedJobs.some((j) =>
                ['pickup', 'pickup_track', 'delivery', 'delivery_track'].includes(String(j.assignKind)),
              )
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
          const pickupTrack = job.assignKind === 'pickup_track';
          const delivery = job.assignKind === 'delivery';
          const deliveryTrack = job.assignKind === 'delivery_track';
          const badge = pickup
            ? 'PICKUP'
            : pickupTrack
              ? 'IN PICKUP'
              : delivery
                ? 'DELIVERY'
                : deliveryTrack
                  ? 'OUT FOR DELIVERY'
                  : 'MECHANIC';
          const action = pickup
            ? 'Assign pickup'
            : pickupTrack
              ? 'Track pickup'
              : delivery
                ? 'Assign delivery'
                : deliveryTrack
                  ? 'Track delivery'
                  : 'Assign Mechanic';
          return (
          <View key={`${job.assignKind}-${job.id}`} style={styles.jobCard}>
            <View style={styles.jobHeader}>
              <Text style={styles.jobName} numberOfLines={1} maxFontSizeMultiplier={1.1}>
                {job.customer_name || 'Customer'}
              </Text>
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentText}>
                  {badge}
                </Text>
              </View>
            </View>
            {job.lead_number ? (
              <Text style={styles.jobMeta} numberOfLines={1} maxFontSizeMultiplier={1.1}>
                {job.lead_number}
              </Text>
            ) : null}
            {job.vehicle_number ? (
              <Text style={styles.jobMeta} numberOfLines={1} maxFontSizeMultiplier={1.1}>
                {job.vehicle_number}
              </Text>
            ) : null}
            {job.created_at ? (
              <Text style={styles.jobDate} maxFontSizeMultiplier={1.1}>
                {formatDateTime(job.created_at)}
              </Text>
            ) : null}
            <TouchableOpacity
              style={styles.assignButton}
              onPress={() =>
                pickup
                  ? openAssignPickup(job)
                  : pickupTrack || delivery || deliveryTrack
                    ? go('PickupDeliveryTracking')
                    : go('MechanicAssignment', { leadId: job.id })
              }
            >
              <Ionicons
                name={pickupTrack || deliveryTrack ? 'navigate' : 'person-add'}
                size={14}
                color={COLORS.white}
              />
              <Text style={styles.assignButtonText} maxFontSizeMultiplier={1.1}>
                {action}
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
              onPress={() => go('JobDetail', { leadId: job.id })}
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
                <Text style={styles.jobMeta} numberOfLines={1} maxFontSizeMultiplier={1.1}>
                  {job.service_leads.vehicle_number}
                </Text>
              ) : null}
              {job.service_leads?.created_at || job.assigned_at ? (
                <Text style={styles.jobDate} maxFontSizeMultiplier={1.1}>
                  {formatDateTime(job.service_leads?.created_at || job.assigned_at)}
                </Text>
              ) : null}
              <Text style={styles.assignedTo} maxFontSizeMultiplier={1.1}>
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
    <>
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
      <PickupAssignModal
        visible={!!assignPickupJob}
        leadLabel={assignPickupJob?.customer_name}
        pickupBoys={pickupBoys}
        loading={pickupBoysLoading}
        saving={assignSaving}
        onSelect={assignPickupFromHome}
        onClose={() => setAssignPickupJob(null)}
      />
    </>
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
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.heading,
  },
  heroMeta: {
    fontSize: 12,
    color: COLORS.bodyText,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.heading,
    marginBottom: 8,
    marginTop: 12,
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
    fontSize: 12,
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
    gap: 8,
    marginBottom: 4,
  },
  statCard: {
    width: '47.5%',
    backgroundColor: COLORS.white,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderLeftWidth: 3,
    alignItems: 'flex-start',
    ...SHADOWS.small,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.heading,
    marginBottom: 1,
    lineHeight: 22,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.bodyText,
    fontWeight: '600',
    lineHeight: 14,
  },
  jobCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
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
    fontSize: 13,
    fontWeight: '700',
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
    fontSize: 11,
    lineHeight: 15,
    color: COLORS.gray[600],
    marginBottom: 1,
  },
  jobDate: {
    fontSize: 10,
    lineHeight: 14,
    color: COLORS.gray[500],
    marginBottom: 8,
  },
  assignedTo: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
  },
  assignButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  assignButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
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
