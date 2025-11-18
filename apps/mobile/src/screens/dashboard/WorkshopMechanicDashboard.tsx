import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import DashboardHeader from '../../components/DashboardHeader';
import StatCard from '../../components/StatCard';
import LeadCard from '../../components/LeadCard';
import { COLORS, SPACING } from '../../constants/theme';

export default function WorkshopMechanicDashboard() {
  const [userProfile, setUserProfile] = React.useState(null);

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
  const [stats, setStats] = useState({
    assignedJobs: 0,
    inProgress: 0,
    completedToday: 0,
  });
  const [myJobs, setMyJobs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      if (!userProfile?.id) return;

      // Fetch mechanic's jobs
      const [assigned, inProgress, completed] = await Promise.all([
        supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('assigned_to', userProfile.id),
        supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('assigned_to', userProfile.id).eq('status', 'in_progress'),
        supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('assigned_to', userProfile.id).eq('status', 'completed').gte('completed_at', new Date().toISOString().split('T')[0]),
      ]);

      setStats({
        assignedJobs: assigned.count || 0,
        inProgress: inProgress.count || 0,
        completedToday: completed.count || 0,
      });

      // Fetch my jobs
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('*')
        .eq('assigned_to', userProfile.id)
        .order('created_at', { ascending: false })
        .limit(10);

      setMyJobs(jobsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

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
              <LeadCard
                key={job.id}
                customerName={job.customer_name || 'Unknown'}
                vehicleModel={job.vehicle_model || 'N/A'}
                serviceType={job.service_type || 'Repair'}
                status={job.status || 'pending'}
                date={new Date(job.created_at).toLocaleDateString()}
              />
            ))}
          </>
        )}

        {myJobs.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No jobs assigned yet</Text>
          </View>
        )}
      </ScrollView>
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

