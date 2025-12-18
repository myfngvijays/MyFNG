import React, { useState, useEffect } from 'react';
import {
import { formatDateTime } from "@/lib/dateFormat";
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Modal,
  Alert,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { useNavigation } from '@react-navigation/native';

interface JobMonitor {
  id: string;
  lead_id: string;
  lead_number: string;
  customer_name: string;
  vehicle_number: string;
  mechanic_name: string;
  mechanic_status: string;
  job_priority: string;
  assigned_at: string;
  started_at?: string;
  sla_expires_at: string;
  sla_remaining_minutes: number;
  checklist_progress: number;
  images_uploaded: boolean;
  parts_assigned: boolean;
  has_issues: boolean;
}

export default function JobMonitoringScreen() {
  const navigation = useNavigation();
  const [jobs, setJobs] = useState<JobMonitor[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<JobMonitor[]>([]);
  const [filter, setFilter] = useState('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedJob, setSelectedJob] = useState<JobMonitor | null>(null);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [mechanics, setMechanics] = useState<any[]>([]);

  useEffect(() => {
    fetchJobs();
    
    // Setup realtime subscription
    const channel = supabase
      .channel('job-monitoring-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mechanic_jobs'
      }, () => {
        console.log('Job monitoring: Real-time update received');
        fetchJobs();
      })
      .subscribe((status) => {
        console.log('Job monitoring subscription status:', status);
      });
    
    // Update time every minute for SLA countdown
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    
    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    filterJobs();
  }, [jobs, filter]);

  async function fetchJobs() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('email', user.email)
        .single();

      const workshopId = userProfile?.workshop_id;
      if (!workshopId) return;

      console.log('🔍 Fetching jobs for workshop:', workshopId);

      // ✅ FIX: Use service_leads like web app (show ALL jobs, not just assigned)
      const { data: leads, error } = await supabase
        .from('service_leads')
        .select(`
            id,
            lead_number,
            customer_name,
            vehicle_number,
          status,
          priority,
          assigned_mechanic_id,
          created_at,
          updated_at,
          sla_expires_at,
          mechanic:assigned_mechanic_id(
            id,
            full_name
          )
        `)
        .eq('workshop_id', workshopId)
        .not('status', 'in', '(REJECTED,CANCELLED,CLOSED)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching jobs:', error);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      console.log('✅ Found', leads?.length || 0, 'jobs');

      const now = new Date();
      const formattedJobs = leads?.map((lead: any) => {
        const slaDeadline = lead.sla_expires_at ? new Date(lead.sla_expires_at) : new Date(lead.created_at);
        const slaRemaining = Math.floor((slaDeadline.getTime() - now.getTime()) / (1000 * 60));
        
        // Determine mechanic_status from lead status
        let mechanicStatus = 'UNASSIGNED';
        if (lead.assigned_mechanic_id) {
          if (lead.status === 'IN_PROGRESS') mechanicStatus = 'IN_PROGRESS';
          else if (lead.status === 'COMPLETED') mechanicStatus = 'COMPLETED';
          else if (lead.status === 'ACCEPTED') mechanicStatus = 'ASSIGNED';
        }
        
        return {
          id: lead.id,
          lead_id: lead.id,
          lead_number: lead.lead_number,
          customer_name: lead.customer_name,
          vehicle_number: lead.vehicle_number,
          mechanic_name: lead.mechanic?.full_name || 'Unassigned',
          mechanic_status: mechanicStatus,
          job_priority: lead.priority || 'NORMAL',
          assigned_at: lead.created_at,
          started_at: lead.updated_at,
          sla_expires_at: lead.sla_expires_at,
          sla_remaining_minutes: slaRemaining,
          checklist_progress: 0,
          images_uploaded: false,
          parts_assigned: false,
          has_issues: slaRemaining < 60,
        };
      }) || [];

      console.log('📊 Formatted jobs:', formattedJobs.length);
      setJobs(formattedJobs);
      
      // Fetch mechanics for reassignment
      const { data: mechanicsData } = await supabase
        .from('users_login')
        .select('id, full_name, role:role_id(role_code)')
        .eq('workshop_id', workshopId)
        .eq('is_active', true);
      
      const onlyMechanics = (mechanicsData || []).filter((user: any) => 
        user.role?.role_code === 'WORKSHOP_MECHANIC'
      );
      
      console.log('👨‍🔧 Found', onlyMechanics.length, 'mechanics');
      setMechanics(onlyMechanics || []);
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function reassignJob(jobId: string, mechanicId: string, mechanicName: string) {
    try {
      const { error } = await supabase
        .from('mechanic_jobs')
        .update({
          mechanic_id: mechanicId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (error) throw error;

      Alert.alert('Success', `Job reassigned to ${mechanicName}`, [
        {
          text: 'OK',
          onPress: () => {
            setShowReassignModal(false);
            setSelectedJob(null);
            fetchJobs();
          },
        },
      ]);
    } catch (error) {
      console.error('Error reassigning job:', error);
      Alert.alert('Error', 'Failed to reassign job');
    }
  }

  async function updateJobStatus(jobId: string, newStatus: string) {
    try {
      const { error } = await supabase
        .from('mechanic_jobs')
        .update({
          mechanic_status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (error) throw error;

      Alert.alert('Success', `Job status updated to ${newStatus}`, [
        {
          text: 'OK',
          onPress: () => {
            setShowStatusModal(false);
            setSelectedJob(null);
            fetchJobs();
          },
        },
      ]);
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update status');
    }
  }

  function filterJobs() {
    if (filter === 'ACTIVE') {
      setFilteredJobs(jobs.filter((j) => j.mechanic_status === 'IN_PROGRESS'));
    } else if (filter === 'ASSIGNED') {
      setFilteredJobs(jobs.filter((j) => j.mechanic_status === 'ASSIGNED'));
    } else if (filter === 'HOLD') {
      setFilteredJobs(jobs.filter((j) => j.mechanic_status === 'HOLD'));
    } else if (filter === 'AT_RISK') {
      setFilteredJobs(jobs.filter((j) => j.sla_remaining_minutes < 120 && j.sla_remaining_minutes > 0));
    } else if (filter === 'OVERDUE') {
      setFilteredJobs(jobs.filter((j) => j.sla_remaining_minutes < 0));
    } else {
      setFilteredJobs(jobs);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    fetchJobs();
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'IN_PROGRESS':
        return '#3b82f6';
      case 'ASSIGNED':
        return '#6b7280';
      case 'HOLD':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  }

  function getPriorityColor(priority: string) {
    switch (priority) {
      case 'URGENT':
      case 'CRITICAL':
        return '#ef4444';
      case 'HIGH':
        return '#f97316';
      default:
        return '#3b82f6';
    }
  }

  function getSLAColor(minutes: number) {
    if (minutes < 0) return '#ef4444'; // Overdue
    if (minutes < 60) return '#f59e0b'; // Less than 1 hour
    if (minutes < 120) return '#fbbf24'; // Less than 2 hours
    return '#10b981'; // Safe
  }

  function formatSLA(minutes: number) {
    if (minutes < 0) {
      const absMinutes = Math.abs(minutes);
      const hours = Math.floor(absMinutes / 60);
      const mins = absMinutes % 60;
      return `⚠️ ${hours}h ${mins}m OVERDUE`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }

  function renderJob({ item }: { item: JobMonitor }) {
    const slaColor = getSLAColor(item.sla_remaining_minutes);
    const isAtRisk = item.sla_remaining_minutes < 120 && item.sla_remaining_minutes > 0;
    const isOverdue = item.sla_remaining_minutes < 0;

    return (
      <View
        style={[
          styles.jobCard,
          isOverdue && styles.jobCardOverdue,
          isAtRisk && styles.jobCardAtRisk,
        ]}
      >
        {/* Alert Banner */}
        {(isOverdue || isAtRisk || item.mechanic_status === 'HOLD') && (
          <View
            style={[
              styles.alertBanner,
              { backgroundColor: isOverdue ? '#fee2e2' : isAtRisk ? '#fef3c7' : '#fef3c7' },
            ]}
          >
            <Text
              style={[
                styles.alertText,
                { color: isOverdue ? '#991b1b' : isAtRisk ? '#92400e' : '#92400e' },
              ]}
            >
              {isOverdue
                ? '🚨 SLA OVERDUE'
                : isAtRisk
                ? '⚠️ SLA AT RISK'
                : '⏸️ JOB ON HOLD'}
            </Text>
          </View>
        )}

        <View style={styles.jobHeader}>
          <View style={styles.jobInfo}>
            <Text style={styles.leadNumber}>{item.lead_number}</Text>
            <Text style={styles.customerName}>{item.customer_name}</Text>
            <View style={styles.badges}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(item.mechanic_status) },
                ]}
              >
                <Text style={styles.statusText}>{item.mechanic_status}</Text>
              </View>
              {item.job_priority !== 'NORMAL' && (
                <View
                  style={[
                    styles.priorityBadge,
                    { backgroundColor: getPriorityColor(item.job_priority) },
                  ]}
                >
                  <Text style={styles.priorityText}>{item.job_priority}</Text>
                </View>
              )}
            </View>
          </View>

          {/* SLA Timer */}
          <View style={styles.slaContainer}>
            <Text style={styles.slaLabel}>SLA</Text>
            <Text style={[styles.slaTime, { color: slaColor }]}>
              {formatSLA(item.sla_remaining_minutes)}
            </Text>
          </View>
        </View>

        <View style={styles.jobDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Vehicle:</Text>
            <Text style={styles.detailValue}>{item.vehicle_number}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Mechanic:</Text>
            <Text style={styles.detailValue}>{item.mechanic_name}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Assigned:</Text>
            <Text style={styles.detailValue}>
              {formatDateTime(item.assigned_at)}
            </Text>
          </View>
          {item.started_at && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Started:</Text>
              <Text style={styles.detailValue}>
                {formatDateTime(item.started_at)}
              </Text>
            </View>
          )}
        </View>

        {/* Progress Indicators */}
        <View style={styles.progressContainer}>
          <View style={styles.progressItem}>
            <View
              style={[
                styles.progressIcon,
                { backgroundColor: item.checklist_progress > 0 ? '#10b981' : '#e5e7eb' },
              ]}
            >
              <Text style={styles.progressIconText}>
                {item.checklist_progress > 0 ? '✓' : '○'}
              </Text>
            </View>
            <Text style={styles.progressLabel}>
              Checklist {item.checklist_progress}%
            </Text>
          </View>

          <View style={styles.progressItem}>
            <View
              style={[
                styles.progressIcon,
                { backgroundColor: item.images_uploaded ? '#10b981' : '#e5e7eb' },
              ]}
            >
              <Text style={styles.progressIconText}>
                {item.images_uploaded ? '✓' : '○'}
              </Text>
            </View>
            <Text style={styles.progressLabel}>Photos</Text>
          </View>

          <View style={styles.progressItem}>
            <View
              style={[
                styles.progressIcon,
                { backgroundColor: item.parts_assigned ? '#10b981' : '#e5e7eb' },
              ]}
            >
              <Text style={styles.progressIconText}>
                {item.parts_assigned ? '✓' : '○'}
              </Text>
            </View>
            <Text style={styles.progressLabel}>Parts</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${item.checklist_progress}%`, backgroundColor: slaColor },
            ]}
          />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() =>
              navigation.navigate('JobDetail', { jobId: item.id })
            }
          >
            <Text style={styles.actionButtonText}>View Details</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.contactButton]}
            onPress={() => {
              // Handle contact mechanic
            }}
          >
            <Text style={styles.actionButtonText}>Contact Mechanic</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const stats = {
    total: jobs.length,
    active: jobs.filter((j) => j.mechanic_status === 'IN_PROGRESS').length,
    assigned: jobs.filter((j) => j.mechanic_status === 'ASSIGNED').length,
    hold: jobs.filter((j) => j.mechanic_status === 'HOLD').length,
    atRisk: jobs.filter((j) => j.sla_remaining_minutes < 120 && j.sla_remaining_minutes > 0).length,
    overdue: jobs.filter((j) => j.sla_remaining_minutes < 0).length,
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Job Monitoring</Text>
        <Text style={styles.subtitle}>
          {stats.active} active • {stats.atRisk + stats.overdue} need attention
        </Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#3b82f6' }]}>
            {stats.active}
          </Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#6b7280' }]}>
            {stats.assigned}
          </Text>
          <Text style={styles.statLabel}>Assigned</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#f59e0b' }]}>
            {stats.hold}
          </Text>
          <Text style={styles.statLabel}>On Hold</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#ef4444' }]}>
            {stats.overdue}
          </Text>
          <Text style={styles.statLabel}>Overdue</Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['ACTIVE', 'ASSIGNED', 'HOLD', 'AT_RISK', 'OVERDUE', 'ALL'].map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterButton,
                filter === f && styles.filterButtonActive,
              ]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filter === f && styles.filterButtonTextActive,
                ]}
              >
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Jobs List */}
      <FlatList
        data={filteredJobs}
        keyExtractor={(item) => item.id}
        renderItem={renderJob}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No jobs to monitor</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  filterContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  filterButtonActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  listContainer: {
    padding: 16,
  },
  jobCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  jobCardOverdue: {
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  jobCardAtRisk: {
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  alertBanner: {
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  alertText: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  jobInfo: {
    flex: 1,
    gap: 4,
  },
  leadNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  customerName: {
    fontSize: 14,
    color: '#374151',
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  slaContainer: {
    alignItems: 'flex-end',
  },
  slaLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  slaTime: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  jobDetails: {
    marginBottom: 12,
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
  },
  detailLabel: {
    fontSize: 12,
    color: '#6b7280',
    width: 70,
  },
  detailValue: {
    flex: 1,
    fontSize: 12,
    color: '#111827',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  progressItem: {
    alignItems: 'center',
  },
  progressIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressIconText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  progressLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#8b5cf6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  contactButton: {
    backgroundColor: '#3b82f6',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
  },
});

