import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';
import DashboardHeader from '../../components/DashboardHeader';
import BottomNav from '../../components/BottomNav';
import StatCard from '../../components/StatCard';
import LeadCard from '../../components/LeadCard';
import { COLORS, SPACING } from '../../constants/theme';
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleTabChange = (tab: string) => {
    setCurrentScreen(tab);
  };

  const tabs = [
    { id: 'dashboard', label: 'Home', icon: '🏠' },
    { id: 'jobs', label: 'Jobs', icon: '🔧' },
    { id: 'history', label: 'History', icon: '📋' },
    { id: 'profile', label: 'Profile', icon: '👤' },
  ];

  // Render different screens based on currentScreen
  if (currentScreen === 'jobs') {
    return (
      <View style={styles.container}>
        <View style={{ flex: 1 }}>
          {React.createElement(MechanicJobsScreen as any, { navigation })}
        </View>
        <BottomNav
          activeTab={currentScreen}
          onTabChange={handleTabChange}
          tabs={tabs}
        />
      </View>
    );
  }

  if (currentScreen === 'history') {
    return (
      <View style={styles.container}>
        <View style={{ flex: 1 }}>
          {React.createElement(MechanicJobHistoryScreen as any, { navigation })}
        </View>
        <BottomNav
          activeTab={currentScreen}
          onTabChange={handleTabChange}
          tabs={tabs}
        />
      </View>
    );
  }

  if (currentScreen === 'profile') {
    return (
      <View style={styles.container}>
        <View style={{ flex: 1 }}>
          {React.createElement(MechanicProfileScreen as any, { navigation })}
        </View>
        <BottomNav
          activeTab={currentScreen}
          onTabChange={handleTabChange}
          tabs={tabs}
        />
      </View>
    );
  }

  // Main Dashboard Screen
  return (
    <View style={styles.container}>
      <DashboardHeader
        name={userProfile?.full_name || 'Mechanic'}
        role="Workshop Mechanic"
        onLogout={handleLogout}
      />
      
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.sectionTitle}>My Jobs</Text>
        
        <StatCard
          title="Assigned Jobs"
          value={stats.assignedJobs}
          subtitle="Total assigned to me"
          color={COLORS.secondary}
        />
        
        <StatCard
          title="In Progress"
          value={stats.inProgress}
          subtitle="Currently working on"
          color={COLORS.warning}
        />
        
        <StatCard
          title="Completed Today"
          value={stats.completedToday}
          subtitle="Finished today"
          color={COLORS.success}
        />

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
    padding: SPACING.lg,
    paddingBottom: 80, // Space for bottom nav
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: SPACING.md,
    marginTop: SPACING.md,
  },
  emptyState: {
    padding: SPACING.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.gray[500],
  },
});

