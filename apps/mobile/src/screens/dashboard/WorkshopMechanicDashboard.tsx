import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';
import LeadCard from '../../components/LeadCard';
import WorkshopCrmShell from '../../components/workshop/WorkshopCrmShell';
import {
  MECHANIC_CRM_NAV,
  MECHANIC_CRM_QUICK,
  WORKSHOP_CRM_TAB_TITLES,
} from '../../constants/workshopCrmNav';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
import type { RealtimeChannel } from '@supabase/supabase-js';
import MechanicJobsScreen from './workshop_mechanic/MechanicJobsScreen';
import MechanicJobHistoryScreen from './workshop_mechanic/MechanicJobHistoryScreen';
import MechanicProfileScreen from './workshop_mechanic/MechanicProfileScreen';
import { formatDateDMY } from "@/lib/dateFormat";
import { useNotifications } from '../../context/NotificationContext';

export default function WorkshopMechanicDashboard({ navigation }: any) {
  const { jobRefreshTick } = useNotifications();
  const [userProfile, setUserProfile] = React.useState<any>(null);
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [stats, setStats] = useState({
    assignedJobs: 0,
    inProgress: 0,
    completedToday: 0,
  });
  const [myJobs, setMyJobs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // ✅ FIX: Fetch user profile from users_login table (like web)
  React.useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profileData, error } = await supabase
          .from('users_login')
          .select('id, full_name, email')
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
      // ✅ FIX: Get user profile if not set
      let mechanicId = userProfile?.id;
      
      if (!mechanicId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profileData } = await supabase
          .from('users_login')
          .select('id')
          .eq('email', user.email)
          .single();

        if (!profileData) {
          return;
        }
        mechanicId = profileData.id;
      }

      // ✅ FIX: Fetch jobs from mechanic_dashboard view (like web)
      const { data: dashboardData, error: jobsError } = await supabase
        .from('mechanic_dashboard')
        .select('*')
        .eq('mechanic_id', mechanicId)
        .order('assigned_at', { ascending: false });

      if (jobsError) {
        // Fallback: try mechanic_jobs if view doesn't exist
        const { data: fallbackData } = await supabase
          .from('mechanic_jobs')
          .select('*')
          .eq('mechanic_id', mechanicId)
          .order('assigned_at', { ascending: false });
        
        if (fallbackData) {
          setMyJobs(fallbackData);
          calculateStatsFromJobs(fallbackData);
        }
        return;
      }

      // ✅ FIX: Calculate stats from dashboard data (like web)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const assignedToday = dashboardData?.filter(job => {
        if (!job.assigned_at) return false;
        const assignedDate = new Date(job.assigned_at);
        assignedDate.setHours(0, 0, 0, 0);
        return assignedDate.getTime() === today.getTime();
      }).length || 0;

      const inProgress = dashboardData?.filter(job => 
        job.mechanic_status === 'IN_PROGRESS'
      ).length || 0;

      const completedToday = dashboardData?.filter(job => {
        if (!job.completed_at) return false;
        const completedDate = new Date(job.completed_at);
        completedDate.setHours(0, 0, 0, 0);
        return completedDate.getTime() === today.getTime();
      }).length || 0;

      setStats({
        assignedJobs: assignedToday,
        inProgress: inProgress,
        completedToday: completedToday,
      });

      setMyJobs(dashboardData || []);
    } catch (error) {
      // Error handled silently
    }
  };

  // Helper function for fallback stats calculation
  const calculateStatsFromJobs = (jobs: any[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const assignedToday = jobs.filter(job => {
      if (!job.assigned_at) return false;
      const assignedDate = new Date(job.assigned_at);
      assignedDate.setHours(0, 0, 0, 0);
      return assignedDate.getTime() === today.getTime();
    }).length || 0;

    const inProgress = jobs.filter(job => 
      job.mechanic_status === 'IN_PROGRESS'
    ).length || 0;

    const completedToday = jobs.filter(job => {
      if (!job.completed_at) return false;
      const completedDate = new Date(job.completed_at);
      completedDate.setHours(0, 0, 0, 0);
      return completedDate.getTime() === today.getTime();
    }).length || 0;

    setStats({
      assignedJobs: assignedToday,
      inProgress: inProgress,
      completedToday: completedToday,
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  useEffect(() => {
    if (userProfile?.id) {
      fetchData();

      // ✅ FIX: Setup realtime subscription (like web)
      let channel: RealtimeChannel;

      const setupRealtimeSubscription = async () => {
        if (!userProfile?.id) return;

        channel = supabase
          .channel('mechanic-jobs-changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'mechanic_jobs',
              filter: `mechanic_id=eq.${userProfile.id}`
            },
            (payload) => {
              fetchData();
            }
          )
          .subscribe();
      };

      setupRealtimeSubscription();

      return () => {
        if (channel) {
          supabase.removeChannel(channel);
        }
      };
    }
  }, [userProfile]);

  // If a new job-impacting notification arrives, refresh the mechanic dashboard data.
  useEffect(() => {
    if (!userProfile?.id) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobRefreshTick]);

  const handleTabChange = (tab: string) => {
    if (tab === 'performance') {
      navigation.navigate('Performance');
      return;
    }
    setCurrentScreen(tab);
  };

  const shell = (child: React.ReactNode) => (
    <WorkshopCrmShell
      title={WORKSHOP_CRM_TAB_TITLES[currentScreen] || 'Home'}
      userName={userProfile?.full_name}
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

  if (currentScreen === 'jobs') {
    return shell(React.createElement(MechanicJobsScreen as any, { navigation, embedInShell: true }));
  }

  if (currentScreen === 'history') {
    return shell(
      React.createElement(MechanicJobHistoryScreen as any, { navigation, embedInShell: true }),
    );
  }

  if (currentScreen === 'profile') {
    return shell(
      React.createElement(MechanicProfileScreen as any, { navigation, embedInShell: true }),
    );
  }

  return shell(
    <ScrollView
      style={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.heroName}>{userProfile?.full_name || 'Workshop Mechanic'}</Text>
        <Text style={styles.heroMeta}>Jobs assigned to you</Text>
      </View>

      <Text style={styles.sectionTitle}>My Jobs</Text>
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: '#EFF6FF' }]}>
          <Text style={styles.statValue}>{stats.assignedJobs}</Text>
          <Text style={styles.statLabel}>Assigned</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
          <Text style={styles.statValue}>{stats.inProgress}</Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#D1FAE5' }]}>
          <Text style={styles.statValue}>{stats.completedToday}</Text>
          <Text style={styles.statLabel}>Done today</Text>
        </View>
      </View>

      {myJobs.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Active Jobs</Text>
          {myJobs.map((job) => (
            <TouchableOpacity
              key={job.job_id || job.id}
              onPress={() => navigation.navigate('LeadDetail', { leadId: job.lead_id })}
            >
              <LeadCard
                customerName={job.customer_name || 'Unknown'}
                vehicleModel={`${job.vehicle_make || ''} ${job.vehicle_model || 'N/A'}`.trim()}
                serviceType={job.service_type || 'Repair'}
                status={job.mechanic_status || job.status || 'pending'}
                date={formatDateDMY(job.assigned_at || job.created_at)}
              />
            </TouchableOpacity>
          ))}
        </>
      )}

      {myJobs.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No jobs assigned yet</Text>
        </View>
      )}
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
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: 14,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: '#023D95',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.bodyText,
    textAlign: 'center',
  },
  emptyState: {
    padding: SPACING.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
  },
});

