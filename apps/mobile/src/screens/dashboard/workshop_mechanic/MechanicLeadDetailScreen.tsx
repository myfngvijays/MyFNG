import React, { useEffect, useState } from 'react';
import { formatDateTime } from "@/lib/dateFormat";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  BackHandler,
} from 'react-native';
import { supabase } from '../../../lib/supabase';
import { COLORS, FONTS } from '../../../constants/theme';
import { ENV } from '../../../config/environment';
import DashboardHeader from '../../../components/DashboardHeader';
import { useNavigation } from '@react-navigation/native';

interface JobDetail {
  id: string;
  lead_id: string;
  lead_number: string;
  customer_name: string;
  customer_phone: string;
  vehicle_number: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_variant: string;
  problem_description: string;
  mechanic_status: string;
  job_priority: string;
  assigned_at: string;
  started_at: string | null;
  completed_at: string | null;
  work_notes: string | null;
  checklist_completed: boolean;
  before_images_count: number;
  progress_images_count: number;
  after_images_count: number;
  min_before_images: number;
  min_progress_images: number;
  min_after_images: number;
  pickup_required: boolean;
  pickup_status: string;
}

export default function MechanicLeadDetailScreen({ route, hideChrome = false }: any) {
  const navigation = useNavigation();
  const { leadId } = route.params;
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);

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
    fetchJobDetails();
  }, [leadId]);

  async function fetchJobDetails() {
    try {
      const { data: jobData, error } = await supabase
        .from('mechanic_jobs')
        .select(`
          *,
          service_leads:lead_id (
            lead_number,
            customer_name,
            customer_phone,
            vehicle_number,
            vehicle_make,
            vehicle_model,
            vehicle_variant,
            problem_description,
            pickup_required,
            pickup_status
          )
        `)
        .eq('lead_id', leadId)
        .single();

      if (error) throw error;

      if (jobData) {
        const jobDetail: JobDetail = {
          id: jobData.id,
          lead_id: jobData.lead_id,
          lead_number: jobData.service_leads?.lead_number || '',
          customer_name: jobData.service_leads?.customer_name || '',
          customer_phone: jobData.service_leads?.customer_phone || '',
          vehicle_number: jobData.service_leads?.vehicle_number || '',
          vehicle_make: jobData.service_leads?.vehicle_make || '',
          vehicle_model: jobData.service_leads?.vehicle_model || '',
          vehicle_variant: jobData.service_leads?.vehicle_variant || '',
          problem_description: jobData.service_leads?.problem_description || '',
          mechanic_status: jobData.mechanic_status,
          job_priority: jobData.job_priority,
          assigned_at: jobData.assigned_at,
          started_at: jobData.started_at,
          completed_at: jobData.completed_at,
          work_notes: jobData.work_notes,
          checklist_completed: jobData.checklist_completed,
          before_images_count: jobData.before_images_count,
          progress_images_count: jobData.progress_images_count,
          after_images_count: jobData.after_images_count,
          min_before_images: jobData.min_before_images,
          min_progress_images: jobData.min_progress_images,
          min_after_images: jobData.min_after_images,
          pickup_required: jobData.service_leads?.pickup_required || false,
          pickup_status: jobData.service_leads?.pickup_status || 'NOT_REQUIRED',
        };

        setJob(jobDetail);
      }
    } catch (error) {
      console.error('Error fetching job details:', error);
      Alert.alert('Error', 'Failed to load job details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleStartJob() {
    if (!job) return;

    Alert.alert(
      'Start Job',
      'Are you sure you want to start working on this job?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: async () => {
            setProcessing(true);
            try {
              const { error } = await supabase
                .from('mechanic_jobs')
                .update({
                  mechanic_status: 'IN_PROGRESS',
                  started_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', job.id);

              if (error) throw error;

              Alert.alert('Success', 'Job started successfully!');
              fetchJobDetails();
            } catch (error) {
              console.error('Error starting job:', error);
              Alert.alert('Error', 'Failed to start job');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  }

  async function handleCompleteJob() {
    if (!job) return;

    // Check if all required images are uploaded
    const beforeComplete = job.before_images_count >= job.min_before_images;
    const progressComplete = job.progress_images_count >= job.min_progress_images;
    const afterComplete = job.after_images_count >= job.min_after_images;

    if (!beforeComplete || !progressComplete || !afterComplete) {
      Alert.alert(
        'Missing Requirements',
        `Please upload all required images:\n\n` +
        `Before Images: ${job.before_images_count}/${job.min_before_images}\n` +
        `Progress Images: ${job.progress_images_count}/${job.min_progress_images}\n` +
        `After Images: ${job.after_images_count}/${job.min_after_images}`
      );
      return;
    }

    if (!job.checklist_completed) {
      Alert.alert('Incomplete Checklist', 'Please complete the service checklist first.');
      return;
    }

    Alert.alert(
      'Complete Job',
      'Mark this job as completed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          style: 'default',
          onPress: async () => {
            setProcessing(true);
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (!session?.access_token) throw new Error('Not authenticated');

              const response = await fetch(`${ENV.API_URL}/api/mechanic/jobs/${job.lead_id}/complete`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session.access_token}`,
                  'x-mobile-client': 'true',
                },
                body: JSON.stringify({ notes: 'Job completed from mobile' }),
              });
              const result = await response.json().catch(() => ({}));
              if (!response.ok) throw new Error(result?.error || 'Failed to complete job');

              Alert.alert('Success', 'Job completed successfully!');
              navigation.goBack();
            } catch (error: any) {
              console.error('Error completing job:', error);
              Alert.alert('Error', error?.message || 'Failed to complete job');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'ASSIGNED':
        return '#3B82F6';
      case 'IN_PROGRESS':
        return '#F59E0B';
      case 'HOLD':
        return '#EF4444';
      case 'COMPLETED':
        return '#10B981';
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

  function formatDateTime(dateString: string | null) {
    if (!dateString) return 'Not started';
    return formatDateTime(dateString);
  }

  const onRefresh = () => {
    setRefreshing(true);
    fetchJobDetails();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        {hideChrome ? null : (
          <DashboardHeader userName="Mechanic" userRole="Workshop Mechanic" onLogout={() => {}} />
        )}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.container}>
        {hideChrome ? null : (
          <DashboardHeader userName="Mechanic" userRole="Workshop Mechanic" onLogout={() => {}} />
        )}
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Job not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>← Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {hideChrome ? null : (
        <DashboardHeader userName="Mechanic" userRole="Workshop Mechanic" onLogout={() => {}} />
      )}

      <ScrollView>
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.leadNumber}>{job.lead_number}</Text>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: getStatusColor(job.mechanic_status) + '20' }]}>
              <Text style={[styles.badgeText, { color: getStatusColor(job.mechanic_status) }]}>
                {job.mechanic_status.replace(/_/g, ' ')}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: getPriorityColor(job.job_priority) + '20' }]}>
              <Text style={[styles.badgeText, { color: getPriorityColor(job.job_priority) }]}>
                {job.job_priority}
              </Text>
            </View>
          </View>
        </View>

        {/* Customer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👤 Customer Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name:</Text>
            <Text style={styles.infoValue}>{job.customer_name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone:</Text>
            <Text style={styles.infoValue}>{job.customer_phone}</Text>
          </View>
        </View>

        {/* Vehicle Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🚗 Vehicle Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Number:</Text>
            <Text style={styles.infoValue}>{job.vehicle_number}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Make/Model:</Text>
            <Text style={styles.infoValue}>
              {job.vehicle_make} {job.vehicle_model}
            </Text>
          </View>
          {job.vehicle_variant && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Variant:</Text>
              <Text style={styles.infoValue}>{job.vehicle_variant}</Text>
            </View>
          )}
        </View>

        {/* Problem Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔧 Problem Description</Text>
          <Text style={styles.problemText}>{job.problem_description || 'No description provided'}</Text>
        </View>

        {/* Work Notes */}
        {job.work_notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 Work Notes</Text>
            <Text style={styles.problemText}>{job.work_notes}</Text>
          </View>
        )}

        {/* Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⏱️ Timeline</Text>
          <View style={styles.timelineItem}>
            <Text style={styles.timelineLabel}>Assigned:</Text>
            <Text style={styles.timelineValue}>{formatDateTime(job.assigned_at)}</Text>
          </View>
          {job.started_at && (
            <View style={styles.timelineItem}>
              <Text style={styles.timelineLabel}>Started:</Text>
              <Text style={styles.timelineValue}>{formatDateTime(job.started_at)}</Text>
            </View>
          )}
          {job.completed_at && (
            <View style={styles.timelineItem}>
              <Text style={styles.timelineLabel}>Completed:</Text>
              <Text style={styles.timelineValue}>{formatDateTime(job.completed_at)}</Text>
            </View>
          )}
        </View>

        {/* Image Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📸 Image Requirements</Text>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Before Images:</Text>
            <Text style={styles.progressValue}>
              {job.before_images_count}/{job.min_before_images}
              {job.before_images_count >= job.min_before_images ? ' ✅' : ' ⚠️'}
            </Text>
          </View>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Progress Images:</Text>
            <Text style={styles.progressValue}>
              {job.progress_images_count}/{job.min_progress_images}
              {job.progress_images_count >= job.min_progress_images ? ' ✅' : ' ⚠️'}
            </Text>
          </View>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>After Images:</Text>
            <Text style={styles.progressValue}>
              {job.after_images_count}/{job.min_after_images}
              {job.after_images_count >= job.min_after_images ? ' ✅' : ' ⚠️'}
            </Text>
          </View>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Checklist:</Text>
            <Text style={styles.progressValue}>
              {job.checklist_completed ? '✅ Completed' : '⚠️ Pending'}
            </Text>
          </View>
        </View>

        {/* Pickup Info */}
        {job.pickup_required && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🚚 Pickup Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Pickup Required:</Text>
              <Text style={styles.infoValue}>Yes</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Pickup Status:</Text>
              <Text style={styles.infoValue}>{job.pickup_status.replace(/_/g, ' ')}</Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          {job.mechanic_status === 'ASSIGNED' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.startButton]}
              onPress={handleStartJob}
              disabled={processing}
            >
              <Text style={styles.actionButtonText}>
                {processing ? '⏳ Starting...' : '▶️ Start Job'}
              </Text>
            </TouchableOpacity>
          )}

          {job.mechanic_status === 'IN_PROGRESS' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.completeButton]}
              onPress={handleCompleteJob}
              disabled={processing}
            >
              <Text style={styles.actionButtonText}>
                {processing ? '⏳ Completing...' : '✅ Complete Job'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
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
  },
  header: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    marginBottom: 12,
  },
  backBtnText: {
    fontSize: 14,
    fontFamily: FONTS.family,
    color: COLORS.primary,
    fontWeight: '600',
  },
  leadNumber: {
    fontSize: 24,
    fontFamily: FONTS.family,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginBottom: 8,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: FONTS.family,
    fontWeight: '600',
  },
  section: {
    backgroundColor: COLORS.white,
    padding: 16,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: FONTS.family,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: FONTS.family,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: FONTS.family,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  problemText: {
    fontSize: 14,
    fontFamily: FONTS.family,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timelineLabel: {
    fontSize: 14,
    fontFamily: FONTS.family,
    color: COLORS.textSecondary,
  },
  timelineValue: {
    fontSize: 13,
    fontFamily: FONTS.family,
    color: COLORS.textPrimary,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontFamily: FONTS.family,
    color: COLORS.textPrimary,
  },
  progressValue: {
    fontSize: 14,
    fontFamily: FONTS.family,
    fontWeight: '600',
    color: COLORS.heading,
  },
  actions: {
    padding: 16,
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#10B981',
  },
  completeButton: {
    backgroundColor: COLORS.primary,
  },
  actionButtonText: {
    fontSize: 16,
    fontFamily: FONTS.family,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: FONTS.family,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontFamily: FONTS.family,
    color: COLORS.white,
    fontWeight: '600',
  },
});

