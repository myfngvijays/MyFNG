import React, { useState, useEffect } from 'react';
import { formatDateTime } from "@/lib/dateFormat";
import {
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
import { supabase } from '../../../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { AC } from '../../../components/workshop/advisorCrmUi';

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
  const navigation = useNavigation<any>();
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
        return '#004AAD';
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
        return '#004AAD';
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
    const isAtRisk = item.sla_remaining_minutes < 120 && item.sla_remaining_minutes > 0;
    const isOverdue = item.sla_remaining_minutes < 0;

    return (
      <View style={AC.navy}>
        <View style={AC.navyRow}>
          <Text style={AC.navyName} numberOfLines={1}>
            {item.customer_name || 'Customer'}
          </Text>
          <Text style={isOverdue || isAtRisk ? AC.navySla : AC.navySlaOk}>
            {formatSLA(item.sla_remaining_minutes)}
          </Text>
        </View>
        <Text style={AC.navyMeta} numberOfLines={1}>
          {item.vehicle_number}
          {item.mechanic_name ? ` · ${item.mechanic_name}` : ''}
        </Text>
        <Text style={AC.navyMeta}>{formatDateTime(item.assigned_at)}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
          <View style={AC.navyBadge}>
            <Text style={AC.navyBadgeTxt}>{item.mechanic_status}</Text>
          </View>
          {isOverdue ? (
            <View style={AC.navyBadge}>
              <Text style={AC.navyBadgeTxt}>SLA OVERDUE</Text>
            </View>
          ) : isAtRisk ? (
            <View style={AC.navyBadge}>
              <Text style={AC.navyBadgeTxt}>AT RISK</Text>
            </View>
          ) : null}
        </View>
        <View style={AC.navyBtnRow}>
          <TouchableOpacity
            style={AC.navyBtn}
            onPress={() => navigation.navigate('JobDetail', { jobId: item.id })}
          >
            <Text style={AC.navyBtnTxt}>View Details</Text>
          </TouchableOpacity>
          <TouchableOpacity style={AC.navyBtnGhost}>
            <Text style={AC.navyBtnGhostTxt}>Contact</Text>
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
    <View style={AC.page}>
      <Text style={AC.sub}>
        {stats.active} active · {stats.atRisk + stats.overdue} need attention
      </Text>

      <View style={AC.kpiRow}>
        <View style={AC.kpi}>
          <Text style={[AC.kpiVal, { color: '#004AAD' }]}>{stats.active}</Text>
          <Text style={AC.kpiLab}>Active</Text>
        </View>
        <View style={AC.kpi}>
          <Text style={[AC.kpiVal, { color: '#023D95' }]}>{stats.assigned}</Text>
          <Text style={AC.kpiLab}>Assigned</Text>
        </View>
        <View style={AC.kpi}>
          <Text style={[AC.kpiVal, { color: '#F59E0B' }]}>{stats.hold}</Text>
          <Text style={AC.kpiLab}>On Hold</Text>
        </View>
        <View style={AC.kpi}>
          <Text style={[AC.kpiVal, { color: '#EF4444' }]}>{stats.overdue}</Text>
          <Text style={AC.kpiLab}>Overdue</Text>
        </View>
      </View>

      <View style={AC.chipWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 24 }}>
          {['ACTIVE', 'ASSIGNED', 'HOLD', 'AT_RISK', 'OVERDUE', 'ALL'].map((f) => (
            <TouchableOpacity
              key={f}
              style={[AC.chip, filter === f && AC.chipOn]}
              onPress={() => setFilter(f)}
            >
              <Text style={[AC.chipTxt, filter === f && AC.chipTxtOn]}>{f.replace('_', ' ')}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredJobs}
        keyExtractor={(item) => item.id}
        renderItem={renderJob}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#004AAD']} />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={
          <View style={AC.empty}>
            <Text style={AC.emptyTxt}>No jobs to monitor</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F7FF',
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
    color: '#023D95',
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
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  filterButtonActive: {
    backgroundColor: '#004AAD',
    borderColor: '#004AAD',
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
    borderRadius: 14,
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
    color: '#023D95',
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
    color: '#023D95',
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
    backgroundColor: '#004AAD',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  contactButton: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#004AAD',
  },
  contactButtonText: {
    color: '#004AAD',
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

