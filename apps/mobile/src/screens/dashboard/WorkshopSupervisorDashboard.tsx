import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import WorkshopCrmShell from '../../components/workshop/WorkshopCrmShell';
import {
  ADVISOR_CRM_NAV,
  ADVISOR_CRM_QUICK,
} from '../../constants/workshopCrmNav';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';

function WorkshopAdvisorHomeScreen({ navigation }: any) {
  const [userProfile, setUserProfile] = React.useState<any>(null);
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [stats, setStats] = useState({
    totalMechanics: 0,
    activeJobs: 0,
    completedToday: 0,
    pendingQc: 0,
    overdueJobs: 0,
  });
  const [unassignedJobs, setUnassignedJobs] = useState<any[]>([]);
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from('users_login')
          .select('*, role:role_id(role_code)')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (data) setUserProfile(data);
          });
      }
    });

    // Setup realtime subscription
    const channel = supabase
      .channel('supervisor-dashboard-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mechanic_jobs'
        },
        (payload) => {
          if (userProfile?.workshop_id) {
            fetchDashboardData();
          }
        }
      )
      .subscribe();

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      if (!userProfile?.workshop_id) return;

      const workshopId = userProfile.workshop_id;

      // Fetch mechanics in this workshop (filter by role)
      const { data: mechanicsData, error: mechanicsError } = await supabase
        .from('users_login')
        .select('id, full_name, email, role:role_id(role_code)')
        .eq('workshop_id', workshopId);

      const onlyMechanics = (mechanicsData || []).filter((user: any) => 
        user.role?.role_code === 'WORKSHOP_MECHANIC'
      );

      // Fetch ALL jobs from service_leads for this workshop
      const { data: leadsData, error: leadsError } = await supabase
        .from('service_leads')
        .select(`
          id,
          lead_number,
          customer_name,
          vehicle_number,
          vehicle_make,
          vehicle_model,
          service_type,
          status,
          assigned_mechanic_id,
          created_at,
          updated_at,
          sla_expires_at
        `)
        .eq('workshop_id', workshopId)
        .order('created_at', { ascending: false });
      
      if (leadsError) {
        // Error handled silently
      }

      // Fetch mechanic jobs for more details
      const { data: mechanicJobsData, error: jobsError } = await supabase
        .from('mechanic_jobs')
        .select(`
          *,
          service_leads:lead_id(lead_number, customer_name, vehicle_number, service_type, workshop_id),
          mechanic:mechanic_id(full_name, workshop_id)
        `)
        .order('assigned_at', { ascending: false })
        .limit(50);

      // Filter jobs by workshop
      const workshopJobs = mechanicJobsData?.filter(job => 
        job.service_leads?.workshop_id === workshopId
      ) || [];

      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // ✅ FIX: Get active jobs from mechanic_jobs (with mechanic info)
      const activeJobsList = workshopJobs.filter(job => 
        ['ASSIGNED', 'IN_PROGRESS'].includes(job.mechanic_status)
      ) || [];

      // Get unassigned jobs from service_leads
      const unassignedJobsList = leadsData?.filter(lead => 
        lead.status === 'ACCEPTED' && !lead.assigned_mechanic_id
      ) || [];

      // Completed today from mechanic_jobs
      const completedToday = workshopJobs.filter(job => {
        if (job.completed_at) {
          const completedDate = new Date(job.completed_at);
          completedDate.setHours(0, 0, 0, 0);
          return completedDate.getTime() === today.getTime();
        }
        return false;
      }).length || 0;

      // QC pending (jobs with status COMPLETED but not QC'd)
      const pendingQc = workshopJobs.filter(job => 
        job.mechanic_status === 'COMPLETED' && !job.qc_status
      ).length || 0;

      // Overdue jobs (SLA expired)
      const overdueJobs = workshopJobs.filter(job => 
        job.sla_remaining_minutes !== null && job.sla_remaining_minutes < 0
      ).length || 0;

      setStats({
        totalMechanics: onlyMechanics.length || 0,
        activeJobs: activeJobsList.length || 0,
        completedToday: completedToday,
        pendingQc: pendingQc,
        overdueJobs: overdueJobs
      });

      setUnassignedJobs(unassignedJobsList.slice(0, 5));
      setActiveJobs(activeJobsList.slice(0, 5)); // ✅ Now has mechanic info
      setRecentJobs(workshopJobs.slice(0, 10));
    } catch (error) {
      // Error handled silently
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  useEffect(() => {
    if (userProfile?.workshop_id) {
      fetchDashboardData();
    }
  }, [userProfile]);

  const handleAssignJob = (job: any) => {
    Alert.alert(
      'Assign Job',
      `Assign ${job.lead_number} to a mechanic`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Assign', onPress: () => {} },
      ]
    );
  };

  const renderDashboard = () => (
    <ScrollView
      style={styles.content}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh}
          colors={[COLORS.primary]}
        />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.heroName}>{userProfile?.full_name || 'Workshop Advisor'}</Text>
        <Text style={styles.heroMeta}>Workshop Advisor</Text>
      </View>
      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => navigation.navigate('SupervisorAdditionalJobsMaster')}
      >
        <Text style={styles.actionButtonText}>Additional Jobs Master</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Overview</Text>
      
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: '#EFF6FF' }]}>
          <Text style={styles.statValue}>{stats.totalMechanics}</Text>
          <Text style={styles.statLabel}>Total Mechanics</Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
          <Text style={styles.statValue}>{stats.activeJobs}</Text>
          <Text style={styles.statLabel}>Active Jobs</Text>
        </View>
      </View>
      
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: '#D1FAE5' }]}>
          <Text style={styles.statValue}>{stats.completedToday}</Text>
          <Text style={styles.statLabel}>Completed Today</Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: '#E9D5FF' }]}>
          <Text style={styles.statValue}>{stats.pendingQc}</Text>
          <Text style={styles.statLabel}>Pending QC</Text>
        </View>
      </View>
      
      <View style={[styles.statCard, styles.fullWidthCard, { backgroundColor: '#FEE2E2' }]}>
        <Text style={[styles.statValue, { color: '#DC2626' }]}>{stats.overdueJobs}</Text>
        <Text style={styles.statLabel}>Overdue Jobs</Text>
      </View>

      {/* Unassigned Jobs */}
      {unassignedJobs.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Jobs Requiring Assignment</Text>
          <View style={styles.card}>
            {unassignedJobs.map((job) => (
              <View key={job.id} style={styles.jobItem}>
                <View style={styles.jobHeader}>
                  <Text style={styles.jobNumber}>{job.lead_number}</Text>
                  <View style={styles.urgentBadge}>
                    <Text style={styles.urgentText}>UNASSIGNED</Text>
                  </View>
                </View>
                <Text style={styles.jobService}>{job.service_type}</Text>
                <Text style={styles.jobCustomer}>
                  {job.customer_name} • {job.vehicle_number}
                </Text>
                <TouchableOpacity 
                  style={styles.assignButton}
                  onPress={() => handleAssignJob(job)}
                >
                  <Text style={styles.assignButtonText}>Assign Mechanic</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Active Jobs */}
      <Text style={styles.sectionTitle}>Active Jobs</Text>
      <View style={styles.card}>
        {activeJobs.length > 0 ? (
          activeJobs.map((job) => (
            <View key={job.id} style={styles.jobItem}>
              <View style={styles.jobHeader}>
                <Text style={styles.jobNumber}>{job.service_leads?.lead_number}</Text>
                <View style={[styles.activeBadge, 
                  job.mechanic_status === 'IN_PROGRESS' ? { backgroundColor: COLORS.primary } :
                  job.mechanic_status === 'ASSIGNED' ? { backgroundColor: COLORS.success } :
                  { backgroundColor: COLORS.warning }
                ]}>
                  <Text style={styles.activeText}>{job.mechanic_status}</Text>
                </View>
              </View>
              <Text style={styles.jobService}>{job.service_leads?.service_type}</Text>
              <Text style={styles.jobCustomer}>
                {job.service_leads?.customer_name} • {job.service_leads?.vehicle_number}
              </Text>
              <Text style={styles.assignedTo}>
                Assigned to: {job.mechanic?.full_name || 'Unknown'}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No active jobs</Text>
        )}
      </View>

      {unassignedJobs.length === 0 && activeJobs.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>All caught up! 🎉</Text>
          <Text style={styles.emptyStateSubtext}>No jobs requiring attention</Text>
        </View>
      )}
    </ScrollView>
  );

  return (
    <WorkshopCrmShell
      key="advisor-crm-home"
      title="Home"
      userName={userProfile?.full_name}
      userEmail={userProfile?.email}
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
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl + SPACING.lg,
  },
  hero: {
    marginBottom: SPACING.md,
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
  actionButton: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.primary,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    alignSelf: 'flex-start',
  },
  actionButtonText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginBottom: SPACING.md,
    marginTop: SPACING.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  statCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  fullWidthCard: {
    width: '100%',
    marginBottom: SPACING.md,
  },
  statValue: {
    fontSize: FONT_SIZES.xxxl || 32,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginBottom: SPACING.xs,
  },
  statLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.bodyText,
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  jobItem: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  jobNumber: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.heading,
  },
  urgentBadge: {
    backgroundColor: COLORS.warning,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  urgentText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xs,
    fontWeight: 'bold',
  },
  activeBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  activeText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xs,
    fontWeight: 'bold',
  },
  jobService: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.heading,
    marginBottom: SPACING.xs,
  },
  jobCustomer: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    marginBottom: SPACING.sm,
  },
  assignedTo: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  assignButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.sm,
    alignItems: 'center',
  },
  assignButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.gray[500],
    padding: SPACING.lg,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyStateText: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginBottom: SPACING.xs,
  },
  emptyStateSubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
  },
});

