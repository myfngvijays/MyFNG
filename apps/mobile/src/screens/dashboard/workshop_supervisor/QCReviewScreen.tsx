import React, { useState, useEffect } from 'react';
import { formatDateTime } from '@/lib/dateFormat';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Image,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useRoute, useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZES } from '../../../constants/theme';
import { ENV } from '../../../config/environment';

interface Photo {
  id: string;
  photo_url: string;
  photo_category: string;
}

interface Part {
  id: string;
  part_name: string;
  part_code?: string;
  quantity: number;
}

interface ChecklistItem {
  id?: string;
  name?: string;
  item_name?: string;
  status?: string;
}

export default function QCReviewScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { jobId } = route.params as { jobId: string };

  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [qualityScore, setQualityScore] = useState(5);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [failedItems, setFailedItems] = useState<string[]>([]);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const [beforePhotos, setBeforePhotos] = useState<Photo[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<Photo[]>([]);
  const [duringPhotos, setDuringPhotos] = useState<Photo[]>([]);
  const [partsUsed, setPartsUsed] = useState<Part[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [mechanic, setMechanic] = useState<any>(null);

  const checklistItems = [
    'Before images uploaded',
    'After images uploaded',
    'Progress images uploaded',
    'All parts documented',
    'Service completed as requested',
    'No warning lights',
    'Test drive completed',
    'Car cleaned',
    'Documents ready',
    'No additional issues found',
  ];

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
      fetchJobDetails();
    }
  }, [jobId]);

  async function fetchJobDetails() {
    try {
      setLoading(true);

      const supabaseClient = supabase;

      // Fetch lead details
      const { data: leadData, error: leadError } = await supabaseClient
        .from('service_leads')
        .select('*')
        .eq('id', jobId)
        .single();

      if (leadError) throw leadError;
      setLead(leadData);

      // Fetch mechanic details
      if (leadData?.assigned_mechanic_id) {
        const { data: mechanicData } = await supabaseClient
          .from('users_login')
          .select('id, full_name, profile_image')
          .eq('id', leadData.assigned_mechanic_id)
          .single();
        setMechanic(mechanicData);
      }

      // Fetch photos
      const { data: photosData, error: photosError } = await supabaseClient
        .from('mechanic_job_photos')
        .select('*')
        .eq('lead_id', jobId)
        .order('created_at', { ascending: false });

      if (!photosError && photosData) {
        setBeforePhotos(photosData.filter((p: any) => p.photo_category === 'before'));
        setAfterPhotos(photosData.filter((p: any) => p.photo_category === 'after'));
        setDuringPhotos(photosData.filter((p: any) => p.photo_category === 'during'));
      }

      // Fetch parts used
      const { data: partsData, error: partsError } = await supabaseClient
        .from('mechanic_parts_usage')
        .select('*')
        .eq('lead_id', jobId)
        .order('created_at', { ascending: false });

      if (!partsError && partsData) {
        setPartsUsed(partsData);
      }

      // Fetch checklist
      if (leadData?.assigned_mechanic_id) {
        const { data: checklistData, error: checklistError } = await supabaseClient
          .from('service_checklists')
          .select('*')
          .eq('lead_id', jobId)
          .eq('mechanic_id', leadData.assigned_mechanic_id)
          .maybeSingle();

        if (!checklistError && checklistData?.checklist_items) {
          let items = checklistData.checklist_items;
          if (typeof items === 'string') {
            try {
              items = JSON.parse(items);
            } catch (e) {
              items = [];
            }
          }
          setChecklist(items);
        }
      }
    } catch (err: any) {
      console.error('Error fetching job details:', err);
      Alert.alert('Error', err.message || 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    if (!lead) return;

    setProcessing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${ENV.API_URL}/api/supervisor/jobs/${jobId}/approve-qc`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            notes: approvalNotes,
            quality_score: qualityScore,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve QC');
      }

      Alert.alert('Success', 'QC approved successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      console.error('Error approving QC:', error);
      Alert.alert('Error', error.message || 'Failed to approve QC');
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject() {
    if (!lead || !rejectionReason.trim()) {
      Alert.alert('Error', 'Please provide a rejection reason');
      return;
    }

    setProcessing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${ENV.API_URL}/api/supervisor/jobs/${jobId}/reject-qc`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            reason: rejectionReason,
            failed_checklist_items: failedItems,
            notes: approvalNotes,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reject QC');
      }

      Alert.alert('Success', 'QC rejected - Job sent back to mechanic', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      console.error('Error rejecting QC:', error);
      Alert.alert('Error', error.message || 'Failed to reject QC');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>QC Review</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!lead) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>QC Review</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error loading job details</Text>
          <TouchableOpacity style={styles.backButtonStyle} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>QC Review: {lead.lead_number}</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Job Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Customer</Text>
              <Text style={styles.summaryValue}>{lead.customer_name}</Text>
              <Text style={styles.summarySubValue}>{lead.customer_phone}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Vehicle</Text>
              <Text style={styles.summaryValue}>{lead.vehicle_number}</Text>
              <Text style={styles.summarySubValue}>
                {lead.vehicle_make} {lead.vehicle_model}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Mechanic</Text>
              <Text style={styles.summaryValue}>{mechanic?.full_name || 'Unknown'}</Text>
              {lead.mechanic_completed_at && (
                <Text style={styles.summarySubValue}>
                  Completed: {formatDateTime(lead.mechanic_completed_at)}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Service Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Service Details</Text>
          {lead.service_type_names && lead.service_type_names.length > 0 ? (
            lead.service_type_names.map((serviceName: string, index: number) => (
              <View key={index} style={styles.serviceItem}>
                <View style={styles.serviceDot} />
                <Text style={styles.serviceText}>{serviceName}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.serviceText}>{lead.service_type || 'General Service'}</Text>
          )}
          {lead.notes && (
            <View style={styles.notesContainer}>
              <Text style={styles.notesTitle}>Work Summary:</Text>
              <Text style={styles.notesText}>{lead.notes}</Text>
            </View>
          )}
        </View>

        {/* Photos Section */}
        <View style={styles.photosContainer}>
          {/* Before Photos */}
          <View style={styles.photoCard}>
            <View style={styles.photoHeader}>
              <Ionicons name="camera" size={20} color={COLORS.primary} />
              <Text style={styles.photoTitle}>Before ({beforePhotos.length})</Text>
            </View>
            {beforePhotos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {beforePhotos.slice(0, 4).map((photo) => (
                  <Image
                    key={photo.id}
                    source={{ uri: photo.photo_url }}
                    style={styles.photoImage}
                  />
                ))}
              </ScrollView>
            ) : (
              <View style={styles.noPhotoContainer}>
                <Ionicons name="alert-circle" size={32} color={COLORS.textSecondary} />
                <Text style={styles.noPhotoText}>No before photos</Text>
              </View>
            )}
          </View>

          {/* During Photos */}
          <View style={styles.photoCard}>
            <View style={styles.photoHeader}>
              <Ionicons name="camera" size={20} color="#f59e0b" />
              <Text style={styles.photoTitle}>During ({duringPhotos.length})</Text>
            </View>
            {duringPhotos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {duringPhotos.slice(0, 4).map((photo) => (
                  <Image
                    key={photo.id}
                    source={{ uri: photo.photo_url }}
                    style={styles.photoImage}
                  />
                ))}
              </ScrollView>
            ) : (
              <View style={styles.noPhotoContainer}>
                <Ionicons name="alert-circle" size={32} color={COLORS.textSecondary} />
                <Text style={styles.noPhotoText}>No during photos</Text>
              </View>
            )}
          </View>

          {/* After Photos */}
          <View style={styles.photoCard}>
            <View style={styles.photoHeader}>
              <Ionicons name="camera" size={20} color={COLORS.success} />
              <Text style={styles.photoTitle}>After ({afterPhotos.length})</Text>
            </View>
            {afterPhotos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {afterPhotos.slice(0, 4).map((photo) => (
                  <Image
                    key={photo.id}
                    source={{ uri: photo.photo_url }}
                    style={styles.photoImage}
                  />
                ))}
              </ScrollView>
            ) : (
              <View style={styles.noPhotoContainer}>
                <Ionicons name="alert-circle" size={32} color={COLORS.textSecondary} />
                <Text style={styles.noPhotoText}>No after photos</Text>
              </View>
            )}
          </View>
        </View>

        {/* Checklist */}
        {checklist.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Service Checklist</Text>
            {checklist.map((item, index) => (
              <View
                key={index}
                style={[
                  styles.checklistItem,
                  item.status === 'COMPLETED' ? styles.checklistItemCompleted : null,
                ]}
              >
                {item.status === 'COMPLETED' ? (
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                ) : (
                  <View style={styles.checklistCircle} />
                )}
                <Text
                  style={[
                    styles.checklistText,
                    item.status === 'COMPLETED' ? styles.checklistTextCompleted : null,
                  ]}
                >
                  {item.name || item.item_name || `Item ${index + 1}`}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Parts Used */}
        {partsUsed.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="cube" size={20} color={COLORS.primary} />
              <Text style={styles.cardTitle}>Parts Used ({partsUsed.length})</Text>
            </View>
            {partsUsed.map((part) => (
              <View key={part.id} style={styles.partRow}>
                <View style={styles.partInfo}>
                  <Text style={styles.partName}>{part.part_name}</Text>
                  {part.part_code && (
                    <Text style={styles.partCode}>{part.part_code}</Text>
                  )}
                </View>
                <Text style={styles.partQuantity}>Qty: {part.quantity || 1}</Text>
              </View>
            ))}
          </View>
        )}

        {/* QC Approval Form */}
        <View style={styles.qcFormCard}>
          <Text style={styles.qcFormTitle}>Quality Check Review</Text>

          {/* Quality Score */}
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreLabel}>Quality Score (1-5)</Text>
            <View style={styles.scoreButtons}>
              {[1, 2, 3, 4, 5].map((score) => (
                <TouchableOpacity
                  key={score}
                  style={[
                    styles.scoreButton,
                    qualityScore === score ? styles.scoreButtonSelected : null,
                  ]}
                  onPress={() => setQualityScore(score)}
                >
                  <Text
                    style={[
                      styles.scoreButtonText,
                      qualityScore === score ? styles.scoreButtonTextSelected : null,
                    ]}
                  >
                    {score}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Approval Notes */}
          <View style={styles.notesInputContainer}>
            <Text style={styles.notesLabel}>Approval Notes (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={approvalNotes}
              onChangeText={setApprovalNotes}
              placeholder="Any notes or feedback..."
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[
                styles.approveButton,
                (processing || beforePhotos.length === 0 || afterPhotos.length === 0) &&
                  styles.buttonDisabled,
              ]}
              onPress={handleApprove}
              disabled={processing || beforePhotos.length === 0 || afterPhotos.length === 0}
            >
              {processing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.approveButtonText}>Approve QC</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rejectButton, processing && styles.buttonDisabled]}
              onPress={() => setShowRejectModal(true)}
              disabled={processing}
            >
              <Ionicons name="close-circle" size={18} color="#fff" />
              <Text style={styles.rejectButtonText}>Reject QC</Text>
            </TouchableOpacity>
          </View>

          {(beforePhotos.length === 0 || afterPhotos.length === 0) && (
            <View style={styles.warningContainer}>
              <Text style={styles.warningText}>
                ⚠️ Missing photos: Before ({beforePhotos.length}), After ({afterPhotos.length})
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Reject Modal */}
      <Modal visible={showRejectModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject Quality Check</Text>

            <View style={styles.modalBody}>
              <View style={styles.modalInputContainer}>
                <Text style={styles.modalLabel}>
                  Rejection Reason <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.modalTextInput}
                  value={rejectionReason}
                  onChangeText={setRejectionReason}
                  placeholder="Explain what needs to be fixed..."
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.modalChecklistContainer}>
                <Text style={styles.modalLabel}>Failed Checklist Items</Text>
                <ScrollView style={styles.modalChecklist}>
                  {checklistItems.map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={styles.modalChecklistItem}
                      onPress={() => {
                        if (failedItems.includes(item)) {
                          setFailedItems(failedItems.filter((i) => i !== item));
                        } else {
                          setFailedItems([...failedItems, item]);
                        }
                      }}
                    >
                      <Ionicons
                        name={failedItems.includes(item) ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={COLORS.primary}
                      />
                      <Text style={styles.modalChecklistText}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalRejectButton, !rejectionReason.trim() && styles.buttonDisabled]}
                onPress={handleReject}
                disabled={processing || !rejectionReason.trim()}
              >
                <Text style={styles.modalRejectButtonText}>
                  {processing ? 'Rejecting...' : 'Reject & Send Back'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                  setFailedItems([]);
                }}
                disabled={processing}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    marginRight: SPACING.md,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
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
    padding: SPACING.xl,
  },
  errorText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.error,
    marginBottom: SPACING.md,
  },
  backButtonStyle: {
    padding: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  summaryCard: {
    backgroundColor: '#e0f2fe',
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: 4,
  },
  summarySubValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  card: {
    backgroundColor: '#fff',
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  serviceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  serviceText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
  },
  notesContainer: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  notesTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  notesText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  photosContainer: {
    margin: SPACING.md,
    gap: SPACING.md,
  },
  photoCard: {
    backgroundColor: '#fff',
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  photoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  photoTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  photoImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: SPACING.sm,
  },
  noPhotoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  noPhotoText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.sm,
    borderRadius: 8,
    marginBottom: SPACING.xs,
    backgroundColor: '#f9fafb',
  },
  checklistItemCompleted: {
    backgroundColor: '#f0fdf4',
  },
  checklistCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  checklistText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
  },
  checklistTextCompleted: {
    color: COLORS.success,
  },
  partRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  partInfo: {
    flex: 1,
  },
  partName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  partCode: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  partQuantity: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
  },
  qcFormCard: {
    backgroundColor: '#f0fdf4',
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.success,
  },
  qcFormTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.success,
    marginBottom: SPACING.md,
  },
  scoreContainer: {
    marginBottom: SPACING.md,
  },
  scoreLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  scoreButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  scoreButton: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  scoreButtonSelected: {
    borderColor: COLORS.success,
    backgroundColor: '#dcfce7',
  },
  scoreButtonText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  scoreButtonTextSelected: {
    color: COLORS.success,
  },
  notesInputContainer: {
    marginBottom: SPACING.md,
  },
  notesLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    padding: SPACING.md,
    backgroundColor: COLORS.success,
    borderRadius: 8,
  },
  approveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    padding: SPACING.md,
    backgroundColor: COLORS.error,
    borderRadius: 8,
  },
  rejectButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  warningContainer: {
    marginTop: SPACING.md,
    padding: SPACING.sm,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 8,
  },
  warningText: {
    fontSize: FONT_SIZES.sm,
    color: '#92400e',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SPACING.md,
    width: '100%',
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.error,
    marginBottom: SPACING.md,
  },
  modalBody: {
    gap: SPACING.md,
  },
  modalInputContainer: {
    marginBottom: SPACING.md,
  },
  modalLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  required: {
    color: COLORS.error,
  },
  modalTextInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalChecklistContainer: {
    marginBottom: SPACING.md,
  },
  modalChecklist: {
    maxHeight: 200,
  },
  modalChecklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  modalChecklistText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  modalRejectButton: {
    flex: 1,
    padding: SPACING.md,
    backgroundColor: COLORS.error,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalRejectButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalCancelButton: {
    flex: 1,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
});

