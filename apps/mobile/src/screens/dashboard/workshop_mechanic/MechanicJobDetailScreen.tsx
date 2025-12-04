import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useNavigation, useRoute } from '@react-navigation/native';

interface JobDetail {
  id: string;
  lead_id: string;
  lead_number: string;
  customer_name: string;
  vehicle_number: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_variant: string;
  problem_description: string;
  service_types: string[];
  service_type_ids?: string[];
  mechanic_status: string;
  job_priority: string;
  sla_remaining_minutes: number;
  assigned_at: string;
  expected_completion_time: string;
  checklist_completed: boolean;
  before_images_count: number;
  progress_images_count: number;
  after_images_count: number;
  min_before_images: number;
  min_progress_images: number;
  min_after_images: number;
}

interface ChecklistItem {
  id: string;
  name: string;
  status: string;
  notes?: string;
  remark?: string;
  category?: string;
  mandatory: boolean;
  completed_at?: string;
}

export default function MechanicJobDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { jobId } = route.params as { jobId: string };
  const [job, setJob] = useState<JobDetail | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [workNotes, setWorkNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [editingRemark, setEditingRemark] = useState<{ itemId: string; value: string } | null>(null);
  const [serviceTypeNames, setServiceTypeNames] = useState<string[]>([]);
  const { user } = useAuth();

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

      // Setup realtime subscription for job updates
      const channel = supabase
        .channel(`mechanic-job-${jobId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'mechanic_jobs',
            filter: `lead_id=eq.${jobId}`
          },
          () => {
            console.log('Mechanic job updated in real-time');
            fetchJobDetail();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'service_leads',
            filter: `id=eq.${jobId}`
          },
          (payload) => {
            console.log('Lead status updated in real-time:', payload);
            // If status changed to IN_PROGRESS (sent back), refresh immediately
            if (payload.new && payload.new.status === 'IN_PROGRESS') {
              fetchJobDetail();
            }
          }
        )
        .subscribe((status) => {
          console.log('Mechanic job subscription status:', status);
        });

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [jobId]);

  async function fetchJobDetail() {
    try {
      // Fetch job details
      const { data: jobData, error: jobError } = await supabase
        .from('mechanic_jobs')
        .select(`
          *,
          service_leads:lead_id (
            lead_number,
            customer_name,
            vehicle_number,
            vehicle_make,
            vehicle_model,
            vehicle_variant,
            problem_description,
            service_types,
            service_type_ids
          )
        `)
        .eq('lead_id', jobId)
        .single();

      if (jobError) throw jobError;

      if (jobData) {
        const detail: JobDetail = {
          id: jobData.id,
          lead_id: jobData.lead_id,
          lead_number: jobData.service_leads?.lead_number || '',
          customer_name: jobData.service_leads?.customer_name || '',
          vehicle_number: jobData.service_leads?.vehicle_number || '',
          vehicle_make: jobData.service_leads?.vehicle_make || '',
          vehicle_model: jobData.service_leads?.vehicle_model || '',
          vehicle_variant: jobData.service_leads?.vehicle_variant || '',
          problem_description: jobData.service_leads?.problem_description || '',
          service_types: jobData.service_leads?.service_types || [],
          service_type_ids: jobData.service_leads?.service_type_ids || [],
          mechanic_status: jobData.mechanic_status,
          job_priority: jobData.job_priority,
          sla_remaining_minutes: jobData.sla_remaining_minutes,
          assigned_at: jobData.assigned_at,
          expected_completion_time: jobData.expected_completion_time,
          checklist_completed: jobData.checklist_completed,
          before_images_count: jobData.before_images_count,
          progress_images_count: jobData.progress_images_count,
          after_images_count: jobData.after_images_count,
          min_before_images: jobData.min_before_images,
          min_progress_images: jobData.min_progress_images,
          min_after_images: jobData.min_after_images,
        };
        setJob(detail);
        setWorkNotes(jobData.work_notes || '');

        // Fetch service type names if service_type_ids exists
        if (jobData.service_leads?.service_type_ids) {
          try {
            const serviceIds = Array.isArray(jobData.service_leads.service_type_ids) 
              ? jobData.service_leads.service_type_ids 
              : JSON.parse(jobData.service_leads.service_type_ids || '[]');
            
            if (Array.isArray(serviceIds) && serviceIds.length > 0) {
              const { data: serviceTypesData } = await supabase
                .from('service_types')
                .select('id, name')
                .in('id', serviceIds);
              
              if (serviceTypesData) {
                setServiceTypeNames(serviceTypesData.map(st => st.name));
              }
            }
          } catch (e) {
            console.error('Error parsing service_type_ids:', e);
            // Fallback to service_types if available
            if (jobData.service_leads?.service_types) {
              setServiceTypeNames(jobData.service_leads.service_types);
            }
          }
        } else if (jobData.service_leads?.service_types) {
          // Fallback: use service_types directly if service_type_ids not available
          setServiceTypeNames(jobData.service_leads.service_types);
        }
      }

      // Fetch checklist
      const { data: checklistData } = await supabase
        .from('service_checklists')
        .select('*')
        .eq('lead_id', jobId)
        .single();

      if (checklistData && checklistData.checklist_items) {
        setChecklist(checklistData.checklist_items);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching job detail:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to load job details');
    }
  }

  async function updateJobStatus(newStatus: string) {
    try {
      const updates: any = {
        mechanic_status: newStatus,
        updated_at: new Date().toISOString()
      };

      if (newStatus === 'IN_PROGRESS' && !job?.assigned_at) {
        updates.started_at = new Date().toISOString();
      }

      if (newStatus === 'COMPLETED') {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('mechanic_jobs')
        .update(updates)
        .eq('lead_id', jobId);

      if (error) throw error;

      Alert.alert('Success', `Job status updated to ${newStatus}`);
      fetchJobDetail();
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update job status');
    }
  }

  async function updateChecklistItem(itemId: string, status: string, remark?: string) {
    try {
      // Get current item
      const currentItem = checklist.find(item => item.id === itemId);
      if (!currentItem) return;

      // Update local state first
      const updatedChecklist = checklist.map(item =>
        item.id === itemId
          ? { 
              ...item, 
              status, 
              remark: remark !== undefined ? remark : item.remark,
              completed_at: status === 'COMPLETED' ? new Date().toISOString() : item.completed_at 
            }
          : item
      );
      setChecklist(updatedChecklist);

      // Call API to update checklist
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://myfng.astric.ai';
      const response = await fetch(`${apiUrl}/api/mechanic/jobs/${jobId}/checklist`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          item_id: itemId,
          status,
          notes: currentItem.notes || '',
          remark: remark !== undefined ? remark : currentItem.remark || ''
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update checklist');
      }

      // Refresh job details to get updated completion status
      await fetchJobDetail();
    } catch (error: any) {
      console.error('Error updating checklist:', error);
      Alert.alert('Error', error.message || 'Failed to update checklist');
      // Revert local state on error
      fetchJobDetail();
    }
  }

  async function saveWorkNotes() {
    try {
      const { error } = await supabase
        .from('mechanic_jobs')
        .update({
          work_notes: workNotes,
          updated_at: new Date().toISOString()
        })
        .eq('lead_id', jobId);

      if (error) throw error;

      Alert.alert('Success', 'Work notes saved');
    } catch (error) {
      console.error('Error saving notes:', error);
      Alert.alert('Error', 'Failed to save work notes');
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Job not found</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const canStartJob = job.mechanic_status === 'ASSIGNED';
  const canCompleteJob = job.mechanic_status === 'IN_PROGRESS' &&
                         job.checklist_completed &&
                         job.before_images_count >= job.min_before_images &&
                         job.after_images_count >= job.min_after_images;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.leadNumber}>{job.lead_number}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{job.mechanic_status}</Text>
        </View>
      </View>

      {/* SLA Warning */}
      <View style={[
        styles.slaContainer,
        { backgroundColor: job.sla_remaining_minutes < 0 ? '#fee2e2' : job.sla_remaining_minutes < 60 ? '#fef3c7' : '#d1fae5' }
      ]}>
        <Text style={styles.slaLabel}>SLA Remaining:</Text>
        <Text style={[
          styles.slaValue,
          { color: job.sla_remaining_minutes < 0 ? '#991b1b' : job.sla_remaining_minutes < 60 ? '#78350f' : '#065f46' }
        ]}>
          {job.sla_remaining_minutes < 0
            ? `Overdue by ${Math.abs(job.sla_remaining_minutes)}m`
            : job.sla_remaining_minutes < 60
            ? `${job.sla_remaining_minutes}m`
            : `${Math.floor(job.sla_remaining_minutes / 60)}h ${job.sla_remaining_minutes % 60}m`
          }
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {canStartJob && (
          <TouchableOpacity
            style={[styles.button, styles.startButton]}
            onPress={() => {
              // Navigate to before inspection screen first
              navigation.navigate('BeforeInspection', { 
                jobId: job.id, 
                leadId: job.lead_id 
              });
            }}
          >
            <Text style={styles.buttonText}>📸 Before Inspection</Text>
          </TouchableOpacity>
        )}

        {job.mechanic_status === 'IN_PROGRESS' && (
          <>
            <TouchableOpacity
              style={[styles.button, styles.uploadButton]}
              onPress={() => navigation.navigate('AfterServicePhotos', { 
                jobId: job.id, 
                leadId: job.lead_id 
              })}
            >
              <Text style={styles.buttonText}>📸 After Service Photos</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          style={[styles.button, styles.extraWorkButton]}
          onPress={() => navigation.navigate('MechanicExtraWorkRequest', { jobId: job.lead_id })}
        >
          <Text style={styles.buttonText}>⚠️ Request Extra Work</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {['overview', 'checklist', 'notes'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <ScrollView style={styles.content}>
        {activeTab === 'overview' && (
          <View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Vehicle Information</Text>
              <Text style={styles.detailText}>
                {job.vehicle_number} - {job.vehicle_make} {job.vehicle_model} {job.vehicle_variant}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Service Types</Text>
              <View style={styles.tagsContainer}>
                {(serviceTypeNames.length > 0 ? serviceTypeNames : job.service_types).map((type, idx) => (
                  <View key={idx} style={styles.tag}>
                    <Text style={styles.tagText}>{type}</Text>
                  </View>
                ))}
              </View>
            </View>

            {job.problem_description && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Customer Complaint</Text>
                <Text style={styles.detailText}>{job.problem_description}</Text>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Progress Status</Text>
              <View style={styles.progressGrid}>
                <View style={styles.progressCard}>
                  <Text style={styles.progressTitle}>Before</Text>
                  <Text style={styles.progressValue}>
                    {job.before_images_count} / {job.min_before_images}
                  </Text>
                </View>
                <View style={styles.progressCard}>
                  <Text style={styles.progressTitle}>Progress</Text>
                  <Text style={styles.progressValue}>
                    {job.progress_images_count} / {job.min_progress_images}
                  </Text>
                </View>
                <View style={styles.progressCard}>
                  <Text style={styles.progressTitle}>After</Text>
                  <Text style={styles.progressValue}>
                    {job.after_images_count} / {job.min_after_images}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'checklist' && (
          <View>
            <Text style={styles.sectionTitle}>Service Checklist</Text>
            
            {/* Group by category if categories exist */}
            {checklist.some(item => item.category) ? (
              <View>
                {Array.from(new Set(checklist.map(item => item.category).filter(Boolean))).map((category) => {
                  const categoryItems = checklist.filter(item => item.category === category);
                  if (categoryItems.length === 0) return null;
                  
                  return (
                    <View key={category} style={styles.categorySection}>
                      <Text style={styles.categoryTitle}>
                        {category} ({categoryItems.length})
                      </Text>
                      {categoryItems.map((item) => (
                        <View key={item.id} style={styles.checklistItem}>
                          <TouchableOpacity
                            style={styles.checklistItemHeader}
                            onPress={() => updateChecklistItem(
                              item.id,
                              item.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED',
                              item.remark
                            )}
                          >
                            <View style={styles.checkbox}>
                              {item.status === 'COMPLETED' && <Text style={styles.checkmark}>✓</Text>}
                            </View>
                            <View style={styles.checklistContent}>
                              <Text style={[
                                styles.checklistText,
                                item.status === 'COMPLETED' && styles.checklistTextCompleted
                              ]}>
                                {item.name}
                              </Text>
                              {item.mandatory && (
                                <View style={styles.requiredBadge}>
                                  <Text style={styles.requiredText}>Required</Text>
                                </View>
                              )}
                            </View>
                          </TouchableOpacity>
                          
                          {/* Remark input */}
                          <View style={styles.remarkContainer}>
                            <Text style={styles.remarkLabel}>Remark:</Text>
                            <TextInput
                              style={styles.remarkInput}
                              value={editingRemark?.itemId === item.id ? editingRemark.value : (item.remark || '')}
                              onChangeText={(text) => {
                                setEditingRemark({ itemId: item.id, value: text });
                                // Update local state
                                const updatedChecklist = checklist.map(i =>
                                  i.id === item.id ? { ...i, remark: text } : i
                                );
                                setChecklist(updatedChecklist);
                              }}
                              onBlur={() => {
                                if (editingRemark?.itemId === item.id) {
                                  updateChecklistItem(item.id, item.status, editingRemark.value);
                                  setEditingRemark(null);
                                }
                              }}
                              placeholder="Enter remark..."
                              multiline
                            />
                          </View>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            ) : (
              /* Fallback: No categories - show simple list */
              <View>
                {checklist.map((item) => (
                  <View key={item.id} style={styles.checklistItem}>
                    <TouchableOpacity
                      style={styles.checklistItemHeader}
                      onPress={() => updateChecklistItem(
                        item.id,
                        item.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED',
                        item.remark
                      )}
                    >
                      <View style={styles.checkbox}>
                        {item.status === 'COMPLETED' && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <View style={styles.checklistContent}>
                        <Text style={[
                          styles.checklistText,
                          item.status === 'COMPLETED' && styles.checklistTextCompleted
                        ]}>
                          {item.name}
                        </Text>
                        {item.mandatory && (
                          <View style={styles.requiredBadge}>
                            <Text style={styles.requiredText}>Required</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                    
                    {/* Remark input if remark field exists */}
                    {item.remark !== undefined && (
                      <View style={styles.remarkContainer}>
                        <Text style={styles.remarkLabel}>Remark:</Text>
                        <TextInput
                          style={styles.remarkInput}
                          value={editingRemark?.itemId === item.id ? editingRemark.value : (item.remark || '')}
                          onChangeText={(text) => {
                            setEditingRemark({ itemId: item.id, value: text });
                            const updatedChecklist = checklist.map(i =>
                              i.id === item.id ? { ...i, remark: text } : i
                            );
                            setChecklist(updatedChecklist);
                          }}
                          onBlur={() => {
                            if (editingRemark?.itemId === item.id) {
                              updateChecklistItem(item.id, item.status, editingRemark.value);
                              setEditingRemark(null);
                            }
                          }}
                          placeholder="Enter remark..."
                          multiline
                        />
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {activeTab === 'notes' && (
          <View>
            <Text style={styles.sectionTitle}>Work Notes</Text>
            <TextInput
              style={styles.textArea}
              value={workNotes}
              onChangeText={setWorkNotes}
              placeholder="Add your work notes, observations, complications..."
              multiline
              numberOfLines={10}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={saveWorkNotes}
            >
              <Text style={styles.buttonText}>💾 Save Notes</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '600',
  },
  leadNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  statusBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  slaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
  },
  slaLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  slaValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionsContainer: {
    padding: 16,
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#3b82f6',
  },
  uploadButton: {
    backgroundColor: '#8b5cf6',
  },
  completeButton: {
    backgroundColor: '#10b981',
  },
  extraWorkButton: {
    backgroundColor: '#f59e0b',
  },
  saveButton: {
    backgroundColor: '#2563eb',
    marginTop: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#2563eb',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#2563eb',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    color: '#1e40af',
    fontWeight: '600',
  },
  progressGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  progressCard: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  progressTitle: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  progressValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 6,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: 'bold',
  },
  checklistContent: {
    flex: 1,
  },
  checklistText: {
    fontSize: 14,
    color: '#111827',
  },
  checklistTextCompleted: {
    color: '#6b7280',
  },
  requiredBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  requiredText: {
    fontSize: 10,
    color: '#991b1b',
    fontWeight: '600',
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
  },
  checklistItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  remarkContainer: {
    marginTop: 12,
    marginLeft: 36,
  },
  remarkLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  remarkInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 40,
    textAlignVertical: 'top',
  },
  textArea: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    minHeight: 200,
    color: '#111827',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 24,
  },
});

