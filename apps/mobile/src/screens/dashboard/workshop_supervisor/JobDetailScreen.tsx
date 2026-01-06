import React, { useState, useEffect } from 'react';
import { formatDateTime } from "@/lib/dateFormat";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { useRoute, useNavigation } from '@react-navigation/native';

interface JobDetail {
  id: string;
  lead_id: {
    id: string;
    lead_number: string;
    customer_name: string;
    vehicle_number: string;
    service_type: string;
    estimated_amount: number;
  };
  mechanic_id: { full_name: string };
  status: string;
  priority: string;
  estimated_completion_time: string;
  started_at: string;
  completed_at: string;
  work_notes: string;
}

export default function JobDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const { jobId } = route.params as { jobId: string };

  const [job, setJob] = useState<JobDetail | null>(null);
  const [checklistItems, setChecklistItems] = useState<any[]>([]);
  const [extraCharges, setExtraCharges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
    if (jobId) {
      fetchJobDetail();
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId || !job?.lead_id?.id) return;
      
    // Setup realtime subscription after job is loaded
      const channel = supabase
        .channel(`job-detail-${jobId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'mechanic_jobs',
          filter: `id=eq.${jobId}`
        }, () => {
          console.log('Job Detail: Real-time update received');
          fetchJobDetail();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'mechanic_checklist_items',
          filter: `job_id=eq.${jobId}`
        }, () => {
          console.log('Checklist: Real-time update received');
          fetchJobDetail();
        })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'service_leads',
        filter: `id=eq.${job.lead_id.id}`
      }, (payload) => {
        console.log('Lead status updated in real-time:', payload);
        fetchJobDetail();
      })
        .subscribe((status) => {
          console.log('Job detail subscription status:', status);
        });
      
      return () => {
        supabase.removeChannel(channel);
      };
  }, [jobId, job?.lead_id?.id]);

  const fetchJobDetail = async () => {
    try {
      setLoading(true);

      // Fetch job details
      const { data: jobData, error: jobError } = await supabase
        .from('mechanic_jobs')
        .select('*, lead_id(id, lead_number, customer_name, vehicle_number, service_type, estimated_amount), mechanic_id(full_name)')
        .eq('id', jobId)
        .single();

      if (jobError) throw jobError;
      setJob(jobData);

      // Fetch checklist items
      const { data: checklistData } = await supabase
        .from('mechanic_checklist_items')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });

      setChecklistItems(checklistData || []);

      // Fetch extra charges
      const { data: chargesData } = await supabase
        .from('lead_extra_charges')
        .select('*')
        .eq('lead_id', jobData.lead_id.id)
        .order('created_at', { ascending: false });

      setExtraCharges(chargesData || []);

    } catch (error) {
      console.error('Error fetching job detail:', error);
      Alert.alert('Error', 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  };

  const calculateProgress = () => {
    if (checklistItems.length === 0) return 0;
    const completed = checklistItems.filter(item => item.is_completed).length;
    return (completed / checklistItems.length) * 100;
  };

  const calculateSLARemaining = () => {
    if (!job?.estimated_completion_time) return null;
    const now = new Date().getTime();
    const deadline = new Date(job.estimated_completion_time).getTime();
    const remaining = deadline - now;
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    return hours;
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      ASSIGNED: '#f59e0b',
      IN_PROGRESS: '#3b82f6',
      COMPLETED: '#10b981',
      HOLD: '#ef4444',
    };
    return colors[status] || '#6b7280';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading job details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>❌</Text>
          <Text style={styles.errorText}>Job not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const slaHours = calculateSLARemaining();
  const progress = calculateProgress();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.leadNumber}>#{job.lead_id.lead_number}</Text>
            <Text style={styles.customerName}>{job.lead_id.customer_name}</Text>
            <Text style={styles.vehicle}>{job.lead_id.vehicle_number}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(job.status) }]}>
            <Text style={styles.statusText}>{job.status}</Text>
          </View>
        </View>

        {/* SLA Warning */}
        {slaHours !== null && slaHours < 2 && job.status !== 'COMPLETED' && (
          <View style={[
            styles.slaWarning,
            { backgroundColor: slaHours < 0 ? '#fee2e2' : '#fef3c7' }
          ]}>
            <Text style={[
              styles.slaText,
              { color: slaHours < 0 ? '#dc2626' : '#d97706' }
            ]}>
              {slaHours < 0 ? '🚨 SLA BREACHED!' : `⚠️ SLA At Risk: ${slaHours}h remaining`}
            </Text>
          </View>
        )}

        {/* Progress Card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Job Progress</Text>
          <View style={styles.progressCard}>
            <Text style={styles.progressPercent}>{progress.toFixed(0)}%</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {checklistItems.filter(i => i.is_completed).length} of {checklistItems.length} tasks completed
            </Text>
          </View>
        </View>

        {/* Job Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Job Information</Text>
          <View style={styles.infoCard}>
            <InfoRow label="Service Type" value={job.lead_id.service_type} />
            <InfoRow label="Mechanic" value={job.mechanic_id.full_name} />
            <InfoRow label="Priority" value={job.priority || 'NORMAL'} />
            {job.started_at && (
              <InfoRow 
                label="Started At" 
                value={formatDateTime(job.started_at)} 
              />
            )}
            {job.estimated_completion_time && (
              <InfoRow 
                label="ETA" 
                value={formatDateTime(job.estimated_completion_time)} 
              />
            )}
          </View>
        </View>

        {/* Checklist */}
        {checklistItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Checklist ({checklistItems.length})</Text>
            <View style={styles.checklistCard}>
              {checklistItems.map((item, index) => (
                <View key={index} style={styles.checklistItem}>
                  <Text style={styles.checklistIcon}>
                    {item.is_completed ? '✅' : '○'}
                  </Text>
                  <Text style={[
                    styles.checklistText,
                    item.is_completed && styles.checklistTextCompleted
                  ]}>
                    {item.item_name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Extra Charges */}
        {extraCharges.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Extra Charges ({extraCharges.length})</Text>
            <View style={styles.chargesCard}>
              {extraCharges.map((charge, index) => (
                <View key={index} style={styles.chargeItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.chargeTitle}>{charge.issue_found}</Text>
                    <Text style={styles.chargeDesc}>{charge.work_needed}</Text>
                    <View style={[
                      styles.chargeStatus,
                      { backgroundColor: charge.approval_status === 'APPROVED' ? '#d1fae5' : '#fef3c7' }
                    ]}>
                      <Text style={[
                        styles.chargeStatusText,
                        { color: charge.approval_status === 'APPROVED' ? '#059669' : '#d97706' }
                      ]}>
                        {charge.approval_status}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.chargeAmount}>₹{charge.estimated_cost}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Work Notes */}
        {job.work_notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Work Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{job.work_notes}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      {job.status === 'IN_PROGRESS' && (
        <View style={styles.actionBar}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('QCCheck' as never, { jobId: job.id } as never)}
          >
            <Text style={styles.actionButtonText}>🔍 Conduct QC</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}:</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 18,
    color: '#6b7280',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  leadNumber: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
  },
  vehicle: {
    fontSize: 14,
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  slaWarning: {
    padding: 12,
    margin: 16,
    borderRadius: 8,
  },
  slaText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  section: {
    marginTop: 8,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  progressCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  progressPercent: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#8b5cf6',
    marginBottom: 12,
  },
  progressBarBg: {
    width: '100%',
    height: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#8b5cf6',
    borderRadius: 6,
  },
  progressText: {
    fontSize: 12,
    color: '#6b7280',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    flex: 2,
    textAlign: 'right',
  },
  checklistCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checklistIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  checklistText: {
    fontSize: 13,
    color: '#111827',
    flex: 1,
  },
  checklistTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#9ca3af',
  },
  chargesCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  chargeItem: {
    flexDirection: 'row',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  chargeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  chargeDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 6,
  },
  chargeStatus: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  chargeStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  chargeAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
    marginLeft: 12,
  },
  notesCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  notesText: {
    fontSize: 13,
    color: '#111827',
    lineHeight: 20,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  actionButton: {
    backgroundColor: '#8b5cf6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

