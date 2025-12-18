import React, { useEffect, useState } from 'react';
import {
import { formatDateDMY } from "@/lib/dateFormat";
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { supabase } from '../../../lib/supabase';
import { COLORS, FONTS } from '../../../constants/theme';
import DashboardHeader from '../../../components/DashboardHeader';
import BottomNav from '../../../components/BottomNav';
import { useNavigation } from '@react-navigation/native';

interface JobHistoryItem {
  job_id: string;
  lead_id: string;
  lead_number: string;
  customer_name: string;
  vehicle_number: string;
  vehicle_make: string;
  vehicle_model: string;
  mechanic_status: string;
  job_priority: string;
  assigned_at: string;
  started_at: string | null;
  completed_at: string | null;
  actual_work_duration: number | null;
  efficiency_score: number | null;
}

export default function MechanicJobHistoryScreen() {
  const navigation = useNavigation();
  const [jobs, setJobs] = useState<JobHistoryItem[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<JobHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');

  const [stats, setStats] = useState({
    total_completed: 0,
    total_duration: 0,
    avg_efficiency: 0,
    on_time_completion: 0,
  });

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation?.goBack) {
        navigation.goBack();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [navigation]);

  useEffect(() => {
    fetchJobHistory();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, activeFilter, jobs]);

  async function fetchJobHistory() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!userProfile) return;

      const { data: jobsData, error } = await supabase
        .from('mechanic_jobs')
        .select(`
          id,
          lead_id,
          mechanic_status,
          job_priority,
          assigned_at,
          started_at,
          completed_at,
          actual_work_duration,
          efficiency_score,
          service_leads:lead_id (
            lead_number,
            customer_name,
            vehicle_number,
            vehicle_make,
            vehicle_model
          )
        `)
        .eq('mechanic_id', userProfile.id)
        .in('mechanic_status', ['COMPLETED', 'READY_FOR_DELIVERY'])
        .order('completed_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const formattedJobs = (jobsData || []).map((job: any) => ({
        job_id: job.id,
        lead_id: job.lead_id,
        lead_number: job.service_leads?.lead_number || 'N/A',
        customer_name: job.service_leads?.customer_name || 'N/A',
        vehicle_number: job.service_leads?.vehicle_number || 'N/A',
        vehicle_make: job.service_leads?.vehicle_make || '',
        vehicle_model: job.service_leads?.vehicle_model || '',
        mechanic_status: job.mechanic_status,
        job_priority: job.job_priority,
        assigned_at: job.assigned_at,
        started_at: job.started_at,
        completed_at: job.completed_at,
        actual_work_duration: job.actual_work_duration,
        efficiency_score: job.efficiency_score,
      }));

      setJobs(formattedJobs);

      // Calculate stats
      const totalCompleted = formattedJobs.length;
      const totalDuration = formattedJobs.reduce((sum, job) => sum + (job.actual_work_duration || 0), 0);
      const avgEfficiency = totalCompleted > 0
        ? formattedJobs.reduce((sum, job) => sum + (job.efficiency_score || 0), 0) / totalCompleted
        : 0;
      const onTimeCount = formattedJobs.filter((j) => (j.efficiency_score || 0) >= 80).length;

      setStats({
        total_completed: totalCompleted,
        total_duration: totalDuration,
        avg_efficiency: avgEfficiency,
        on_time_completion: totalCompleted > 0 ? Math.round((onTimeCount / totalCompleted) * 100) : 0,
      });
    } catch (error) {
      console.error('Error fetching job history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function applyFilters() {
    let filtered = [...jobs];

    if (searchTerm) {
      filtered = filtered.filter(
        (job) =>
          job.lead_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          job.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          job.vehicle_number.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (activeFilter !== 'ALL') {
      filtered = filtered.filter((job) => job.mechanic_status === activeFilter);
    }

    setFilteredJobs(filtered);
  }

  function formatDuration(minutes: number | null) {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'COMPLETED':
        return '#10B981';
      case 'READY_FOR_DELIVERY':
        return COLORS.primary;
      default:
        return COLORS.textSecondary;
    }
  }

  function getPriorityColor(priority: string) {
    switch (priority) {
      case 'URGENT':
      case 'CRITICAL':
        return '#EF4444';
      case 'HIGH':
        return '#F59E0B';
      default:
        return COLORS.textSecondary;
    }
  }

  const onRefresh = () => {
    setRefreshing(true);
    fetchJobHistory();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <DashboardHeader userName="Mechanic" userRole="Workshop Mechanic" onLogout={() => {}} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader userName="Mechanic" userRole="Workshop Mechanic" onLogout={() => {}} />

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Job History</Text>
          <Text style={styles.subtitle}>Your completed jobs and performance</Text>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: '#DBEAFE' }]}>
            <Text style={styles.statLabel}>Completed</Text>
            <Text style={styles.statValue}>{stats.total_completed}</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#D1FAE5' }]}>
            <Text style={styles.statLabel}>Total Time</Text>
            <Text style={styles.statValue}>{formatDuration(stats.total_duration)}</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#E9D5FF' }]}>
            <Text style={styles.statLabel}>Efficiency</Text>
            <Text style={styles.statValue}>{Math.round(stats.avg_efficiency)}%</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
            <Text style={styles.statLabel}>On-Time</Text>
            <Text style={styles.statValue}>{stats.on_time_completion}%</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search jobs..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholderTextColor={COLORS.textSecondary}
          />
        </View>

        {/* Filter Buttons */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, activeFilter === 'ALL' && styles.filterButtonActive]}
            onPress={() => setActiveFilter('ALL')}
          >
            <Text style={[styles.filterText, activeFilter === 'ALL' && styles.filterTextActive]}>
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterButton, activeFilter === 'COMPLETED' && styles.filterButtonActive]}
            onPress={() => setActiveFilter('COMPLETED')}
          >
            <Text style={[styles.filterText, activeFilter === 'COMPLETED' && styles.filterTextActive]}>
              Completed
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterButton, activeFilter === 'READY_FOR_DELIVERY' && styles.filterButtonActive]}
            onPress={() => setActiveFilter('READY_FOR_DELIVERY')}
          >
            <Text style={[styles.filterText, activeFilter === 'READY_FOR_DELIVERY' && styles.filterTextActive]}>
              Ready for Delivery
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Job List */}
        <View style={styles.jobList}>
          {filteredJobs.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>No completed jobs found</Text>
            </View>
          ) : (
            filteredJobs.map((job) => (
              <TouchableOpacity
                key={job.job_id}
                style={styles.jobCard}
                onPress={() => navigation.navigate('JobDetail', { leadId: job.lead_id })}
              >
                <View style={styles.jobHeader}>
                  <Text style={styles.jobNumber}>{job.lead_number}</Text>
                  <View style={styles.badges}>
                    <View style={[styles.badge, { backgroundColor: getStatusColor(job.mechanic_status) + '20' }]}>
                      <Text style={[styles.badgeText, { color: getStatusColor(job.mechanic_status) }]}>
                        {job.mechanic_status.replace(/_/g, ' ')}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.customerName}>{job.customer_name}</Text>
                <Text style={styles.vehicleInfo}>
                  {job.vehicle_number} • {job.vehicle_make} {job.vehicle_model}
                </Text>

                <View style={styles.jobFooter}>
                  <View style={styles.footerItem}>
                    <Text style={styles.footerLabel}>Duration:</Text>
                    <Text style={styles.footerValue}>{formatDuration(job.actual_work_duration)}</Text>
                  </View>

                  <View style={styles.footerItem}>
                    <Text style={styles.footerLabel}>Efficiency:</Text>
                    <Text style={styles.footerValue}>
                      {job.efficiency_score ? `${Math.round(job.efficiency_score)}%` : 'N/A'}
                    </Text>
                  </View>

                  <View style={styles.footerItem}>
                    <Text style={styles.footerLabel}>Completed:</Text>
                    <Text style={styles.footerValue}>
                      {job.completed_at ? formatDateDMY(job.completed_at) : 'N/A'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      <BottomNav
        activeTab="history"
        onTabPress={(tab) => {
          if (tab === 'dashboard') navigation.navigate('Dashboard');
          else if (tab === 'profile') navigation.navigate('Profile');
        }}
        tabs={[
          { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
          { id: 'history', label: 'History', icon: '📋' },
          { id: 'profile', label: 'Profile', icon: '👤' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontFamily: FONTS.family,
    fontWeight: 'bold',
    color: COLORS.heading,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.family,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: '47%',
    padding: 16,
    borderRadius: 12,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: FONTS.family,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontFamily: FONTS.family,
    fontWeight: 'bold',
    color: COLORS.heading,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontFamily: FONTS.family,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  filterContainer: {
    marginBottom: 20,
    flexDirection: 'row',
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontFamily: FONTS.family,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  filterTextActive: {
    color: COLORS.white,
    fontWeight: '600',
  },
  jobList: {
    gap: 12,
  },
  jobCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  jobNumber: {
    fontSize: 16,
    fontFamily: FONTS.family,
    fontWeight: 'bold',
    color: COLORS.heading,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: FONTS.family,
    fontWeight: '600',
  },
  customerName: {
    fontSize: 14,
    fontFamily: FONTS.family,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  vehicleInfo: {
    fontSize: 12,
    fontFamily: FONTS.family,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  footerItem: {
    flex: 1,
  },
  footerLabel: {
    fontSize: 11,
    fontFamily: FONTS.family,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  footerValue: {
    fontSize: 13,
    fontFamily: FONTS.family,
    fontWeight: '600',
    color: COLORS.heading,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: FONTS.family,
    color: COLORS.textSecondary,
  },
});

