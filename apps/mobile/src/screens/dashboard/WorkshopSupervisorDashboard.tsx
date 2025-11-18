import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import DashboardHeader from '../../components/DashboardHeader';
import StatCard from '../../components/StatCard';
import LeadCard from '../../components/LeadCard';
import BottomNav from '../../components/BottomNav';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';

export default function WorkshopSupervisorDashboard() {
  const [userProfile, setUserProfile] = React.useState<any>(null);
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [stats, setStats] = useState({
    totalJobs: 0,
    activeJobs: 0,
    mechanics: 0,
    pickupBoys: 0,
  });
  const [unassignedJobs, setUnassignedJobs] = useState<any[]>([]);
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (data) setUserProfile(data);
          });
      }
    });
  }, []);

  const fetchDashboardData = async () => {
    try {
      if (!userProfile?.workshop_id) return;

      const workshopId = userProfile.workshop_id;

      // Fetch total jobs for workshop
      const { count: totalCount } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', workshopId)
        .in('status', ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED']);

      // Fetch active jobs
      const { count: activeCount } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', workshopId)
        .in('status', ['ACCEPTED', 'IN_PROGRESS']);

      // Fetch unassigned jobs
      const { data: unassigned } = await supabase
        .from('service_leads')
        .select('*')
        .eq('workshop_id', workshopId)
        .eq('status', 'ACCEPTED')
        .is('assigned_to_id', null)
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch assigned jobs
      const { data: assigned } = await supabase
        .from('service_leads')
        .select(`
          *,
          assigned_to:user_profiles!service_leads_assigned_to_id_fkey(full_name)
        `)
        .eq('workshop_id', workshopId)
        .in('status', ['IN_PROGRESS'])
        .not('assigned_to_id', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(5);

      // Get mechanics count
      const { data: mechanicRole } = await supabase
        .from('roles')
        .select('id')
        .eq('role_code', 'WORKSHOP_MECHANIC')
        .single();

      const { count: mechanicsCount } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', workshopId)
        .eq('role_id', mechanicRole?.id);

      // Get pickup boys count
      const { data: pickupRole } = await supabase
        .from('roles')
        .select('id')
        .eq('role_code', 'WORKSHOP_PICKUP_BOY')
        .single();

      const { count: pickupCount } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', workshopId)
        .eq('role_id', pickupRole?.id);

      setStats({
        totalJobs: totalCount || 0,
        activeJobs: activeCount || 0,
        mechanics: mechanicsCount || 0,
        pickupBoys: pickupCount || 0,
      });

      setUnassignedJobs(unassigned || []);
      setActiveJobs(assigned || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  useEffect(() => {
    if (userProfile) {
      fetchDashboardData();
    }
  }, [userProfile]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleAssignJob = (job: any) => {
    Alert.alert(
      'Assign Job',
      `Assign ${job.lead_number} to a mechanic`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Assign', onPress: () => console.log('Assign job:', job.id) },
      ]
    );
  };

  const tabs = [
    { id: 'dashboard', label: 'Home', icon: '🏠' },
    { id: 'jobs', label: 'Jobs', icon: '🔧' },
    { id: 'team', label: 'Team', icon: '👥' },
    { id: 'more', label: 'More', icon: '⚙️' },
  ];

  const handleTabChange = (tab: string) => {
    if (tab === 'jobs' || tab === 'team' || tab === 'more') {
      Alert.alert('Coming Soon', 'This feature will be available soon!');
    } else {
      setCurrentScreen(tab);
    }
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
      <View style={styles.header}>
        <Text style={styles.title}>Supervisor Dashboard</Text>
        <Text style={styles.subtitle}>Manage job assignments and team performance</Text>
      </View>

      {/* Stats Grid */}
      <Text style={styles.sectionTitle}>Overview</Text>
      
      <StatCard
        title="Total Jobs"
        value={stats.totalJobs}
        subtitle="All workshop jobs"
        color={COLORS.primary}
      />
      
      <StatCard
        title="Active Jobs"
        value={stats.activeJobs}
        subtitle="In progress"
        color={COLORS.secondary}
      />
      
      <StatCard
        title="Mechanics"
        value={stats.mechanics}
        subtitle="Workshop mechanics"
        color={COLORS.accent}
      />
      
      <StatCard
        title="Pickup Team"
        value={stats.pickupBoys}
        subtitle="Pickup & delivery"
        color={COLORS.warning}
      />

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
                <Text style={styles.jobNumber}>{job.lead_number}</Text>
                <View style={styles.activeBadge}>
                  <Text style={styles.activeText}>IN PROGRESS</Text>
                </View>
              </View>
              <Text style={styles.jobService}>{job.service_type}</Text>
              <Text style={styles.jobCustomer}>
                {job.customer_name} • {job.vehicle_number}
              </Text>
              <Text style={styles.assignedTo}>
                Assigned to: {job.assigned_to?.full_name || 'Unknown'}
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
    <View style={styles.container}>
      <DashboardHeader
        name={userProfile?.full_name || 'Supervisor'}
        role="Workshop Supervisor"
        onLogout={handleLogout}
      />
      
      {renderDashboard()}

      <BottomNav 
        activeTab={currentScreen} 
        onTabChange={handleTabChange}
        tabs={tabs}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl + SPACING.lg,
  },
  header: {
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.heading,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.bodyText,
    marginTop: SPACING.xs,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginBottom: SPACING.md,
    marginTop: SPACING.lg,
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

