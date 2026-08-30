import React, { useState, useEffect } from 'react';
import { formatDateTime } from "@/lib/dateFormat";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  Image,
  BackHandler,
} from 'react-native';
import { supabase } from '../../../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { AC } from '../../../components/workshop/advisorCrmUi';

interface QCJob {
  id: string;
  lead_id: string;
  lead_number: string;
  customer_name: string;
  vehicle_number: string;
  vehicle_make: string;
  vehicle_model: string;
  mechanic_name: string;
  service_types: string[];
  mechanic_status: string;
  completed_at: string;
  checklist_completed: boolean;
  before_images_count: number;
  after_images_count: number;
  qc_status?: string;
}

interface ChecklistItem {
  id: string;
  item_name: string;
  is_completed: boolean;
  notes?: string;
}

export default function QCCheckScreen({ navigation }: any) {
  const [jobs, setJobs] = useState<QCJob[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<QCJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<QCJob | null>(null);
  const [showQCModal, setShowQCModal] = useState(false);
  const [qcChecklist, setQcChecklist] = useState<ChecklistItem[]>([]);
  const [qcNotes, setQcNotes] = useState('');
  const [qcStatus, setQcStatus] = useState<'PASS' | 'FAIL' | 'REWORK'>('PASS');
  const [filter, setFilter] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    fetchQCJobs();
    
    // Setup realtime subscription
    const channel = supabase
      .channel('qc-queue-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mechanic_jobs'
      }, () => {
        console.log('QC Queue: Real-time update received');
        fetchQCJobs();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'qc_checks'
      }, () => {
        console.log('QC Checks: Real-time update received');
        fetchQCJobs();
      })
      .subscribe((status) => {
        console.log('QC queue subscription status:', status);
      });
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    filterJobs();
  }, [jobs, filter]);

  async function fetchQCJobs() {
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

      console.log('🔍 Fetching QC jobs for workshop:', workshopId);

      // ✅ FIX: Use service_leads table like web app does
      const { data: qcJobs, error } = await supabase
        .from('service_leads')
        .select(`
          id,
          lead_number,
          customer_name,
          vehicle_number,
          vehicle_make,
          vehicle_model,
          mechanic_completed_at,
          notes,
          status,
          qc_status,
          assigned_mechanic_id
        `)
        .eq('workshop_id', workshopId)
        .eq('status', 'COMPLETED')
        .eq('qc_status', 'PENDING')
        .order('mechanic_completed_at', { ascending: true });

      if (error) {
        console.error('❌ Error fetching QC queue:', error);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      console.log('✅ Found', qcJobs?.length || 0, 'jobs pending QC');

      // Fetch mechanic names and image counts from mechanic_media
      const jobsWithDetails = await Promise.all((qcJobs || []).map(async (job) => {
        // Get mechanic name
        const { data: mechanic } = await supabase
          .from('users_login')
          .select('full_name')
          .eq('id', job.assigned_mechanic_id)
          .single();

        // Get image counts from mechanic_media
        const { count: beforeCount } = await supabase
          .from('mechanic_media')
          .select('*', { count: 'exact', head: true })
          .eq('lead_id', job.id)
          .eq('media_category', 'BEFORE');

        const { count: afterCount } = await supabase
          .from('mechanic_media')
          .select('*', { count: 'exact', head: true })
          .eq('lead_id', job.id)
          .eq('media_category', 'AFTER');

        return {
          id: job.id,
          lead_id: job.id,
          lead_number: job.lead_number,
          customer_name: job.customer_name,
          vehicle_number: job.vehicle_number,
          vehicle_make: job.vehicle_make || '',
          vehicle_model: job.vehicle_model || '',
          mechanic_name: mechanic?.full_name || 'Unknown',
          service_types: [],
          mechanic_status: 'COMPLETED',
          completed_at: job.mechanic_completed_at,
          checklist_completed: true,
          before_images_count: beforeCount || 0,
          after_images_count: afterCount || 0,
          qc_status: job.qc_status,
        };
      }));

      setJobs(jobsWithDetails);
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error fetching QC jobs:', error);
      setLoading(false);
      setRefreshing(false);
    }
  }

  function filterJobs() {
    if (filter === 'PENDING') {
      setFilteredJobs(jobs.filter((j) => !j.qc_status));
    } else if (filter === 'PASSED') {
      setFilteredJobs(jobs.filter((j) => j.qc_status === 'PASSED'));
    } else if (filter === 'FAILED') {
      setFilteredJobs(jobs.filter((j) => j.qc_status === 'FAILED'));
    } else if (filter === 'REWORK') {
      setFilteredJobs(jobs.filter((j) => j.qc_status === 'REWORK_REQUIRED'));
    } else {
      setFilteredJobs(jobs);
    }
  }

  async function openQCModal(job: QCJob) {
    setSelectedJob(job);
    
    // Fetch checklist for this job
    const { data: checklistData } = await supabase
      .from('mechanic_checklist_items')
      .select('*')
      .eq('job_id', job.id)
      .order('item_order');

    setQcChecklist(
      checklistData?.map((item: any) => ({
        id: item.id,
        item_name: item.item_name,
        is_completed: item.is_completed,
        notes: item.notes,
      })) || []
    );

    setShowQCModal(true);
  }

  async function submitQC() {
    if (!selectedJob) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      const supervisorId = userProfile?.id;

      // Create QC check record
      const { error: qcError } = await supabase
        .from('qc_checks')
        .insert({
          lead_id: selectedJob.lead_id,
          mechanic_job_id: selectedJob.id,
          supervisor_id: supervisorId,
          qc_status: qcStatus === 'PASS' ? 'PASSED' : qcStatus === 'FAIL' ? 'FAILED' : 'REWORK_REQUIRED',
          supervisor_notes: qcNotes,
          checked_at: new Date().toISOString(),
        });

      if (qcError) throw qcError;

      // Update lead status based on QC result
      if (qcStatus === 'PASS') {
        await supabase
          .from('service_leads')
          .update({
            status: 'READY_FOR_DELIVERY',
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedJob.lead_id);
      } else if (qcStatus === 'REWORK') {
        await supabase
          .from('mechanic_jobs')
          .update({
            mechanic_status: 'REWORK_REQUIRED',
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedJob.id);
      }

      Alert.alert(
        'Success',
        `QC ${qcStatus === 'PASS' ? 'Passed' : qcStatus === 'FAIL' ? 'Failed' : 'Sent for Rework'}!`,
        [
          {
            text: 'OK',
            onPress: () => {
              setShowQCModal(false);
              setSelectedJob(null);
              setQcNotes('');
              setQcStatus('PASS');
              fetchQCJobs();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error submitting QC:', error);
      Alert.alert('Error', 'Failed to submit QC. Please try again.');
    }
  }

  function onRefresh() {
    setRefreshing(true);
    fetchQCJobs();
  }

  function getStatusColor(status?: string) {
    switch (status) {
      case 'PASSED':
        return '#10b981';
      case 'FAILED':
        return '#ef4444';
      case 'REWORK_REQUIRED':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  }

  function renderJob({ item }: { item: QCJob }) {
    return (
      <View style={AC.navy}>
        <View style={AC.navyRow}>
          <Text style={AC.navyName} numberOfLines={1}>
            {item.customer_name || 'Customer'}
          </Text>
          {item.qc_status ? (
            <View style={AC.navyBadge}>
              <Text style={AC.navyBadgeTxt}>{item.qc_status}</Text>
            </View>
          ) : (
            <View style={AC.navyBadge}>
              <Text style={AC.navyBadgeTxt}>PENDING</Text>
            </View>
          )}
        </View>
        <Text style={AC.navyMeta} numberOfLines={1}>
          {item.vehicle_number}
          {item.mechanic_name ? ` · ${item.mechanic_name}` : ''}
        </Text>
        {item.completed_at ? (
          <Text style={AC.navyMeta}>{formatDateTime(item.completed_at)}</Text>
        ) : null}
        <View style={AC.navyBtnRow}>
          <TouchableOpacity
            style={AC.navyBtn}
            onPress={() => openQCModal(item)}
            disabled={!!item.qc_status}
          >
            <Text style={AC.navyBtnTxt}>{item.qc_status ? 'QC done' : 'Start QC'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={AC.navyBtnGhost}
            onPress={() => navigation.navigate('QCReview', { jobId: item.lead_id || item.id })}
          >
            <Text style={AC.navyBtnGhostTxt}>Review</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const stats = {
    pending: jobs.filter((j) => !j.qc_status).length,
    passed: jobs.filter((j) => j.qc_status === 'PASSED').length,
    failed: jobs.filter((j) => j.qc_status === 'FAILED').length,
    rework: jobs.filter((j) => j.qc_status === 'REWORK_REQUIRED').length,
  };

  return (
    <View style={AC.page}>
      <Text style={AC.sub}>{stats.pending} jobs pending QC</Text>

      <View style={AC.chipWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['PENDING', 'PASSED', 'FAILED', 'REWORK', 'ALL'].map((f) => (
            <TouchableOpacity
              key={f}
              style={[AC.chip, filter === f && AC.chipOn]}
              onPress={() => setFilter(f)}
            >
              <Text style={[AC.chipTxt, filter === f && AC.chipTxtOn]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={AC.kpiRow}>
        <View style={AC.kpi}>
          <Text style={[AC.kpiVal, { color: '#004AAD' }]}>{stats.pending}</Text>
          <Text style={AC.kpiLab}>Pending</Text>
        </View>
        <View style={AC.kpi}>
          <Text style={[AC.kpiVal, { color: '#10B981' }]}>{stats.passed}</Text>
          <Text style={AC.kpiLab}>Passed</Text>
        </View>
        <View style={AC.kpi}>
          <Text style={[AC.kpiVal, { color: '#EF4444' }]}>{stats.failed}</Text>
          <Text style={AC.kpiLab}>Failed</Text>
        </View>
        <View style={AC.kpi}>
          <Text style={[AC.kpiVal, { color: '#F59E0B' }]}>{stats.rework}</Text>
          <Text style={AC.kpiLab}>Rework</Text>
        </View>
      </View>

      <FlatList
        data={filteredJobs}
        keyExtractor={(item) => item.id}
        renderItem={renderJob}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#004AAD']} />}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={
          <View style={AC.empty}>
            <Text style={AC.emptyTxt}>No jobs for QC</Text>
          </View>
        }
      />

      {/* QC Modal */}
      <Modal
        visible={showQCModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowQCModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Quality Control Check</Text>

              {selectedJob && (
                <View style={styles.selectedJobInfo}>
                  <Text style={styles.selectedJobNumber}>
                    {selectedJob.customer_name || 'Customer'}
                  </Text>
                  <Text style={styles.selectedJobCustomer}>
                    {selectedJob.vehicle_number}
                  </Text>
                  <Text style={styles.selectedJobMechanic}>
                    Mechanic: {selectedJob.mechanic_name}
                  </Text>
                </View>
              )}

              {/* Checklist Review */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Checklist ({qcChecklist.length} items)
                </Text>
                {qcChecklist.map((item) => (
                  <View key={item.id} style={styles.checklistItem}>
                    <Text style={styles.checklistIcon}>
                      {item.is_completed ? '✅' : '❌'}
                    </Text>
                    <View style={styles.checklistItemContent}>
                      <Text style={styles.checklistItemName}>
                        {item.item_name}
                      </Text>
                      {item.notes && (
                        <Text style={styles.checklistItemNotes}>
                          {item.notes}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>

              {/* QC Decision */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>QC Decision</Text>
                <View style={styles.qcOptions}>
                  <TouchableOpacity
                    style={[
                      styles.qcOption,
                      styles.qcOptionPass,
                      qcStatus === 'PASS' && styles.qcOptionActive,
                    ]}
                    onPress={() => setQcStatus('PASS')}
                  >
                    <Text
                      style={[
                        styles.qcOptionText,
                        qcStatus === 'PASS' && styles.qcOptionTextActive,
                      ]}
                    >
                      ✅ PASS
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.qcOption,
                      styles.qcOptionRework,
                      qcStatus === 'REWORK' && styles.qcOptionActive,
                    ]}
                    onPress={() => setQcStatus('REWORK')}
                  >
                    <Text
                      style={[
                        styles.qcOptionText,
                        qcStatus === 'REWORK' && styles.qcOptionTextActive,
                      ]}
                    >
                      🔄 REWORK
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.qcOption,
                      styles.qcOptionFail,
                      qcStatus === 'FAIL' && styles.qcOptionActive,
                    ]}
                    onPress={() => setQcStatus('FAIL')}
                  >
                    <Text
                      style={[
                        styles.qcOptionText,
                        qcStatus === 'FAIL' && styles.qcOptionTextActive,
                      ]}
                    >
                      ❌ FAIL
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* QC Notes */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>QC Notes</Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="Enter your observations and notes..."
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={4}
                  value={qcNotes}
                  onChangeText={setQcNotes}
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={styles.submitButton}
                onPress={submitQC}
              >
                <Text style={styles.submitButtonText}>
                  Submit QC Check
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setShowQCModal(false);
                  setSelectedJob(null);
                  setQcNotes('');
                  setQcStatus('PASS');
                }}
              >
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  jobHeader: {
    marginBottom: 12,
  },
  jobInfo: {
    gap: 4,
  },
  leadNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#023D95',
  },
  customerName: {
    fontSize: 16,
    color: '#374151',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  jobDetails: {
    marginBottom: 12,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
  },
  detailLabel: {
    fontSize: 13,
    color: '#6b7280',
    width: 90,
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    color: '#023D95',
  },
  qcIndicators: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  indicatorIcon: {
    fontSize: 16,
  },
  indicatorText: {
    fontSize: 12,
    color: '#6b7280',
  },
  qcButton: {
    backgroundColor: '#004AAD',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  qcButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  qcButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  viewDetailsButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  viewDetailsText: {
    fontSize: 13,
    color: '#004AAD',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#023D95',
    marginBottom: 16,
  },
  selectedJobInfo: {
    backgroundColor: '#EAF2FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  selectedJobNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#023D95',
  },
  selectedJobCustomer: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  selectedJobMechanic: {
    fontSize: 13,
    color: '#004AAD',
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#023D95',
    marginBottom: 12,
  },
  checklistItem: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  checklistIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  checklistItemContent: {
    flex: 1,
  },
  checklistItemName: {
    fontSize: 14,
    color: '#023D95',
    fontWeight: '500',
  },
  checklistItemNotes: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  qcOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  qcOption: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
  },
  qcOptionPass: {
    borderColor: '#10b981',
    backgroundColor: '#ecfdf5',
  },
  qcOptionRework: {
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  qcOptionFail: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  qcOptionActive: {
    borderWidth: 3,
  },
  qcOptionText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  qcOptionTextActive: {
    fontSize: 16,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#023D95',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#004AAD',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    paddingVertical: 14,
    backgroundColor: '#6b7280',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

