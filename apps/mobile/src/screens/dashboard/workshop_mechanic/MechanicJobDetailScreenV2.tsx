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
  Image,
  Platform,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { ENV } from '../../../config/environment';

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
  work_notes: string;
}

export default function MechanicJobDetailScreen({ route }: any) {
  const navigation = useNavigation();
  const { jobId } = route.params;
  const [job, setJob] = useState<JobDetail | null>(null);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [workNotes, setWorkNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCategory, setSelectedCategory] = useState('BEFORE');
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
    fetchJobDetail();
    setupRealtimeSubscription();
  }, [jobId]);

  function setupRealtimeSubscription() {
    // Setup real-time updates for job changes
    const channel = supabase
      .channel(`job-${jobId}-updates`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mechanic_jobs',
          filter: `lead_id=eq.${jobId}`
        },
        () => {
          fetchJobDetail();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }

  async function fetchJobDetail() {
    try {
      // Fetch job details using API (for consistency)
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
            service_types
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
          work_notes: jobData.work_notes || ''
        };
        setJob(detail);
        setWorkNotes(jobData.work_notes || '');
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

      // Fetch media
      const { data: mediaData } = await supabase
        .from('mechanic_media')
        .select('*')
        .eq('lead_id', jobId)
        .order('uploaded_at', { ascending: false });

      setMedia(mediaData || []);

      // Fetch parts
      const { data: partsData } = await supabase
        .from('mechanic_parts_usage')
        .select('*')
        .eq('lead_id', jobId);

      setParts(partsData || []);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching job detail:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to load job details');
    }
  }

  async function updateJobStatus(newStatus: string) {
    try {
      // Use API endpoint for status update (includes validations)
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const response = await fetch(`${ENV.API_URL}/api/mechanic/jobs/${jobId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: newStatus,
          notes: `Status changed to ${newStatus} from mobile`
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update status');
      }

      Alert.alert('Success', `Job status updated to ${newStatus}`);
      await fetchJobDetail();
    } catch (error: any) {
      console.error('Error updating status:', error);
      Alert.alert('Error', error.message || 'Failed to update job status');
    }
  }

  async function updateChecklistItem(itemId: string, status: string) {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const response = await fetch(`${ENV.API_URL}/api/mechanic/jobs/${jobId}/checklist`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          item_id: itemId,
          status,
          notes: ''
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update checklist');
      }

      await fetchJobDetail();
    } catch (error: any) {
      console.error('Error updating checklist:', error);
      Alert.alert('Error', error.message || 'Failed to update checklist');
    }
  }

  async function pickImageAndUpload() {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Please grant camera roll permissions to upload images');
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  }

  async function takePictureAndUpload() {
    try {
      // Request permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Please grant camera permissions to take pictures');
        return;
      }

      // Take picture
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to take picture');
    }
  }

  async function uploadImage(uri: string) {
    try {
      setUploading(true);

      // Create file object
      const fileName = `${jobId}_${Date.now()}.jpg`;
      const filePath = `mechanic_media/${fileName}`;

      // Fetch the image as blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('service-media')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('service-media')
        .getPublicUrl(filePath);

      // Call API to save media record
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const apiResponse = await fetch(`${ENV.API_URL}/api/mechanic/jobs/${jobId}/media`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          media_url: publicUrl,
          media_category: selectedCategory,
          media_type: 'IMAGE',
          file_size_kb: Math.round(blob.size / 1024),
          description: ''
        }),
      });

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json();
        throw new Error(errorData.error || 'Failed to save media');
      }

      Alert.alert('Success', 'Image uploaded successfully!');
      await fetchJobDetail();
    } catch (error: any) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', error.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  }

  async function saveWorkNotes() {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const response = await fetch(`${ENV.API_URL}/api/mechanic/jobs/${jobId}/notes`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          work_notes: workNotes
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save notes');
      }

      Alert.alert('Success', 'Work notes saved!');
    } catch (error: any) {
      console.error('Error saving notes:', error);
      Alert.alert('Error', error.message || 'Failed to save notes');
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#FF6B00" />
      </SafeAreaView>
    );
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Job not found</Text>
      </SafeAreaView>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ASSIGNED': return '#10B981';
      case 'IN_PROGRESS': return '#3B82F6';
      case 'HOLD':
      case 'WAITING_APPROVAL': return '#F59E0B';
      case 'COMPLETED': return '#8B5CF6';
      default: return '#6B7280';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
      case 'CRITICAL': return '#EF4444';
      case 'HIGH': return '#F97316';
      case 'NORMAL': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Job Detail</Text>
      </View>

      {/* Status Bar */}
      <View style={styles.statusBar}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(job.mechanic_status) }]}>
          <Text style={styles.statusText}>{job.mechanic_status}</Text>
        </View>
        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(job.job_priority) }]}>
          <Text style={styles.priorityText}>{job.job_priority}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['overview', 'checklist', 'media', 'parts', 'notes'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content}>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Job Information</Text>
            
            <View style={styles.infoRow}>
              <Text style={styles.label}>Lead Number:</Text>
              <Text style={styles.value}>{job.lead_number}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Customer:</Text>
              <Text style={styles.value}>{job.customer_name}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Vehicle:</Text>
              <Text style={styles.value}>
                {job.vehicle_make} {job.vehicle_model} ({job.vehicle_number})
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Problem:</Text>
              <Text style={styles.value}>{job.problem_description}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Service Types:</Text>
              <Text style={styles.value}>{job.service_types.join(', ')}</Text>
            </View>

            {/* Image Progress */}
            <View style={styles.progressSection}>
              <Text style={styles.sectionTitle}>Image Requirements</Text>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>Before:</Text>
                <Text style={styles.progressValue}>
                  {job.before_images_count} / {job.min_before_images}
                </Text>
              </View>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>Progress:</Text>
                <Text style={styles.progressValue}>
                  {job.progress_images_count} / {job.min_progress_images}
                </Text>
              </View>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>After:</Text>
                <Text style={styles.progressValue}>
                  {job.after_images_count} / {job.min_after_images}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              {job.mechanic_status === 'ASSIGNED' && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.startButton]}
                  onPress={() => updateJobStatus('IN_PROGRESS')}
                >
                  <Text style={styles.actionButtonText}>Start Job</Text>
                </TouchableOpacity>
              )}

              {job.mechanic_status === 'IN_PROGRESS' && (
                <>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.holdButton]}
                    onPress={() => updateJobStatus('HOLD')}
                  >
                    <Text style={styles.actionButtonText}>Hold</Text>
                  </TouchableOpacity>

                  {job.checklist_completed && 
                   job.before_images_count >= job.min_before_images &&
                   job.after_images_count >= job.min_after_images && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.completeButton]}
                      onPress={() => {
                        Alert.alert(
                          'Complete Job',
                          'Are you sure you want to mark this job as completed?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Complete', onPress: () => updateJobStatus('COMPLETED') }
                          ]
                        );
                      }}
                    >
                      <Text style={styles.actionButtonText}>Complete Job</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {job.mechanic_status === 'HOLD' && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.resumeButton]}
                  onPress={() => updateJobStatus('IN_PROGRESS')}
                >
                  <Text style={styles.actionButtonText}>Resume</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Checklist Tab */}
        {activeTab === 'checklist' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service Checklist</Text>
            {checklist.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.checklistItem}
                onPress={() => {
                  const newStatus = item.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
                  updateChecklistItem(item.id, newStatus);
                }}
              >
                <View style={[
                  styles.checkbox,
                  item.status === 'COMPLETED' && styles.checkboxChecked
                ]}>
                  {item.status === 'COMPLETED' && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <View style={styles.checklistTextContainer}>
                  <Text style={[
                    styles.checklistText,
                    item.status === 'COMPLETED' && styles.checklistTextCompleted
                  ]}>
                    {item.name}
                  </Text>
                  {item.mandatory && <Text style={styles.mandatoryBadge}>Required</Text>}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Media Tab */}
        {activeTab === 'media' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upload Images</Text>
            
            {/* Category Selector */}
            <View style={styles.categorySelector}>
              {['BEFORE', 'PROGRESS', 'AFTER'].map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryButton,
                    selectedCategory === category && styles.categoryButtonActive
                  ]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text style={[
                    styles.categoryButtonText,
                    selectedCategory === category && styles.categoryButtonTextActive
                  ]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Upload Buttons */}
            <View style={styles.uploadButtons}>
              <TouchableOpacity
                style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
                onPress={takePictureAndUpload}
                disabled={uploading}
              >
                <Text style={styles.uploadButtonText}>
                  {uploading ? 'Uploading...' : '📷 Take Picture'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
                onPress={pickImageAndUpload}
                disabled={uploading}
              >
                <Text style={styles.uploadButtonText}>
                  {uploading ? 'Uploading...' : '🖼️ Choose Image'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Media Gallery */}
            <View style={styles.mediaGallery}>
              {media
                .filter(m => m.media_category === selectedCategory)
                .map((item) => (
                  <View key={item.id} style={styles.mediaItem}>
                    <Image
                      source={{ uri: item.media_url }}
                      style={styles.mediaImage}
                      resizeMode="cover"
                    />
                  </View>
                ))}
            </View>
          </View>
        )}

        {/* Parts Tab */}
        {activeTab === 'parts' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Parts Usage</Text>
            {parts.map((part) => (
              <View key={part.id} style={styles.partItem}>
                <Text style={styles.partName}>{part.part_name}</Text>
                <Text style={styles.partDetails}>
                  Issued: {part.quantity_issued} | Used: {part.quantity_used}
                </Text>
                <Text style={[styles.partStatus, { color: part.usage_status === 'USED' ? '#10B981' : '#F59E0B' }]}>
                  {part.usage_status}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Work Notes</Text>
            <TextInput
              style={styles.notesInput}
              multiline
              numberOfLines={8}
              value={workNotes}
              onChangeText={setWorkNotes}
              placeholder="Add work notes, observations, or technical details..."
            />
            <TouchableOpacity
              style={[styles.actionButton, styles.saveButton]}
              onPress={saveWorkNotes}
            >
              <Text style={styles.actionButtonText}>Save Notes</Text>
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
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    fontSize: 16,
    color: '#FF6B00',
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  statusBar: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  priorityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  priorityText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#FF6B00',
  },
  tabText: {
    fontSize: 12,
    color: '#6B7280',
  },
  activeTabText: {
    color: '#FF6B00',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  infoRow: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: '#111827',
  },
  progressSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  actionButtons: {
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#10B981',
  },
  holdButton: {
    backgroundColor: '#F59E0B',
  },
  completeButton: {
    backgroundColor: '#8B5CF6',
  },
  resumeButton: {
    backgroundColor: '#3B82F6',
  },
  saveButton: {
    backgroundColor: '#FF6B00',
    marginTop: 16,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkmark: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checklistTextContainer: {
    flex: 1,
  },
  checklistText: {
    fontSize: 16,
    color: '#111827',
  },
  checklistTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#6B7280',
  },
  mandatoryBadge: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  categorySelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  categoryButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  categoryButtonActive: {
    backgroundColor: '#FF6B00',
    borderColor: '#FF6B00',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#6B7280',
  },
  categoryButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  uploadButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    alignItems: 'center',
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  mediaGallery: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mediaItem: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  partItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  partName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  partDetails: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  partStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 150,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
  },
});

