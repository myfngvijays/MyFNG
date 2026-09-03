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
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useRoute, useNavigation } from '@react-navigation/native';
import { COLORS } from '../../../constants/theme';
import { ENV } from '../../../config/environment';
import { AC } from '../../../components/workshop/advisorCrmUi';
import { apiFetch } from '../../../lib/api';

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
  const [workVideos, setWorkVideos] = useState<Photo[]>([]);
  const [extraProof, setExtraProof] = useState<Photo[]>([]);
  const [extraWork, setExtraWork] = useState<
    Array<{ id: string; label: string; status: string; amount?: number | null; proof?: Photo[] }>
  >([]);
  const [partsUsed, setPartsUsed] = useState<Part[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [showAllChecklist, setShowAllChecklist] = useState(false);
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

      const toPhoto = (item: any, category: string): Photo => ({
        id: String(item?.id || item?.url),
        photo_url: String(item?.url || item?.photo_url || ''),
        photo_category: category,
      });

      try {
        const evidence = await apiFetch<{
          photos?: {
            before?: any[];
            during?: any[];
            after?: any[];
            videos?: any[];
            extra?: any[];
          };
          extraWork?: Array<{
            id: string;
            label: string;
            status: string;
            amount?: number | null;
            proof?: any[];
          }>;
        }>(`/api/supervisor/jobs/${jobId}/qc-evidence`);
        setBeforePhotos((evidence.photos?.before || []).map((item) => toPhoto(item, 'before')));
        setDuringPhotos((evidence.photos?.during || []).map((item) => toPhoto(item, 'during')));
        setAfterPhotos((evidence.photos?.after || []).map((item) => toPhoto(item, 'after')));
        setWorkVideos((evidence.photos?.videos || []).map((item) => toPhoto(item, 'after')));
        setExtraProof((evidence.photos?.extra || []).map((item) => toPhoto(item, 'after')));
        setExtraWork(
          (evidence.extraWork || []).map((row) => ({
            ...row,
            proof: (row.proof || []).map((item) => toPhoto(item, 'after')),
          })),
        );
      } catch {
        setBeforePhotos([]);
        setDuringPhotos([]);
        setAfterPhotos([]);
        setWorkVideos([]);
        setExtraProof([]);
        setExtraWork([]);
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

  function renderPhotoBlock(title: string, photos: Photo[], emptyHint?: string) {
    return (
      <View style={AC.whiteCard}>
        <Text style={styles.sectionTitle}>
          {title} ({photos.length})
        </Text>
        {photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {photos.slice(0, 8).map((photo) => (
              <Image key={photo.id} source={{ uri: photo.photo_url }} style={styles.photoImage} />
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.mutedLabel}>{emptyHint || 'None uploaded'}</Text>
        )}
      </View>
    );
  }

  const visibleChecklist = showAllChecklist ? checklist : checklist.slice(0, 10);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  if (!lead) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error loading job details</Text>
          <TouchableOpacity style={styles.backButtonStyle} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={AC.page}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={AC.navy}>
          <View style={AC.navyRow}>
            <Text style={AC.navyName} numberOfLines={1}>
              {lead.customer_name || 'Customer'}
            </Text>
            {lead.lead_number ? (
              <View style={AC.navyBadge}>
                <Text style={AC.navyBadgeTxt}>#{lead.lead_number}</Text>
              </View>
            ) : null}
          </View>
          <Text style={AC.navyMeta} numberOfLines={1}>
            {[lead.vehicle_number, lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(' · ')}
          </Text>
          {lead.customer_phone ? (
            <Text style={AC.navyMeta}>{lead.customer_phone}</Text>
          ) : null}
          <Text style={AC.navyMeta} numberOfLines={2}>
            Mechanic: {mechanic?.full_name || 'Unknown'}
            {lead.mechanic_completed_at ? ` · ${formatDateTime(lead.mechanic_completed_at)}` : ''}
          </Text>
        </View>

        <View style={AC.whiteCard}>
          <Text style={styles.sectionTitle}>Service</Text>
          {lead.service_type_names && lead.service_type_names.length > 0 ? (
            lead.service_type_names.map((serviceName: string, index: number) => (
              <Text key={index} style={styles.bodyLine}>
                {serviceName}
              </Text>
            ))
          ) : (
            <Text style={styles.bodyLine}>{lead.service_type || 'General Service'}</Text>
          )}
          {lead.notes ? (
            <View style={styles.summaryBox}>
              <Text style={styles.mutedLabel}>Work summary</Text>
              <Text style={styles.bodyLine}>{lead.notes}</Text>
            </View>
          ) : null}
        </View>

        {renderPhotoBlock('Pickup / Before', beforePhotos, 'Pickup boy vehicle photos. Mechanic Before button job start ke baad bhi rehta hai.')}
        {renderPhotoBlock('During', duringPhotos, 'Mechanic app pe During button — kaam chalte hue oil/filter/parts proof.')}
        {renderPhotoBlock('After', afterPhotos)}
        {renderPhotoBlock('Work videos', workVideos)}

        <View style={AC.whiteCard}>
          <Text style={styles.sectionTitle}>Additional work ({extraWork.length})</Text>
          {extraWork.length === 0 ? (
            <Text style={styles.mutedLabel}>No additional work on this job</Text>
          ) : (
            extraWork.map((row) => (
              <View key={row.id} style={styles.summaryBox}>
                <Text style={styles.bodyLine}>{row.label}</Text>
                <Text style={styles.mutedLabel}>
                  {row.status}
                  {row.amount != null ? ` · ₹${row.amount}` : ''}
                </Text>
                {(row.proof || []).length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    {(row.proof || []).map((photo) => (
                      <Image key={photo.id} source={{ uri: photo.photo_url }} style={styles.photoImage} />
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.mutedLabel}>No proof uploaded</Text>
                )}
              </View>
            ))
          )}
          {extraProof.length > 0 && extraWork.every((row) => !(row.proof || []).length) ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {extraProof.map((photo) => (
                <Image key={photo.id} source={{ uri: photo.photo_url }} style={styles.photoImage} />
              ))}
            </ScrollView>
          ) : null}
        </View>

        {checklist.length > 0 && (
          <View style={AC.whiteCard}>
            <View style={styles.checkHead}>
              <Text style={styles.sectionTitle}>Checklist ({checklist.length})</Text>
              {checklist.length > 10 ? (
                <TouchableOpacity onPress={() => setShowAllChecklist((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.viewAllTxt}>{showAllChecklist ? 'Show less' : 'View all'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={styles.checkGrid}>
              {Array.from({ length: Math.ceil(visibleChecklist.length / 2) }, (_, row) => {
                const pair = visibleChecklist.slice(row * 2, row * 2 + 2);
                return (
                  <View key={row} style={styles.checkPair}>
                    {pair.map((item, col) => {
                      const index = row * 2 + col;
                      const done = String(item.status || '').toUpperCase() === 'COMPLETED';
                      return (
                        <View key={index} style={[styles.checkRow, done && styles.checkRowDone]}>
                          <View style={[styles.checkNumBadge, done && styles.checkNumBadgeDone]}>
                            <Text style={[styles.checkNum, done && styles.checkNumDone]}>{index + 1}</Text>
                          </View>
                          <Text style={[styles.checkTxt, done && styles.checkTxtDone]} numberOfLines={3}>
                            {item.name || item.item_name || `Item ${index + 1}`}
                          </Text>
                        </View>
                      );
                    })}
                    {pair.length === 1 ? <View style={styles.checkRowSpacer} /> : null}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {partsUsed.length > 0 && (
          <View style={AC.whiteCard}>
            <Text style={styles.sectionTitle}>Parts ({partsUsed.length})</Text>
            {partsUsed.map((part) => (
              <View key={part.id} style={styles.partRow}>
                <Text style={styles.bodyLine} numberOfLines={1}>
                  {part.part_name}
                </Text>
                <Text style={styles.mutedLabel}>Qty {part.quantity || 1}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={AC.whiteCard}>
          <Text style={styles.sectionTitle}>QC decision</Text>

          <Text style={styles.mutedLabel}>Quality score</Text>
          <View style={styles.scoreButtons}>
            {[1, 2, 3, 4, 5].map((score) => (
              <TouchableOpacity
                key={score}
                style={[styles.scoreButton, qualityScore === score && styles.scoreButtonSelected]}
                onPress={() => setQualityScore(score)}
              >
                <Text style={[styles.scoreButtonText, qualityScore === score && styles.scoreButtonTextSelected]}>
                  {score}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.mutedLabel, { marginTop: 12 }]}>Notes (optional)</Text>
          <TextInput
            style={styles.notesInput}
            value={approvalNotes}
            onChangeText={setApprovalNotes}
            placeholder="Any notes or feedback..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
          />

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.qcChoice, styles.qcChoicePass, processing && styles.buttonDisabled]}
              onPress={handleApprove}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.qcChoiceText}>PASS</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.qcChoice, styles.qcChoiceRework, processing && styles.buttonDisabled]}
              onPress={() => setShowRejectModal(true)}
              disabled={processing}
            >
              <Text style={styles.qcChoiceText}>REWORK</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.qcChoice, styles.qcChoiceFail, processing && styles.buttonDisabled]}
              onPress={() => setShowRejectModal(true)}
              disabled={processing}
            >
              <Text style={styles.qcChoiceText}>FAIL</Text>
            </TouchableOpacity>
          </View>

          {(beforePhotos.length === 0 || afterPhotos.length === 0) && (
            <Text style={styles.warnTxt}>
              Photos missing — Before {beforePhotos.length}, After {afterPhotos.length}
            </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 28,
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
    padding: 24,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    marginBottom: 12,
  },
  backButtonStyle: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.heading,
    marginBottom: 8,
  },
  checkHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  viewAllTxt: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 8,
  },
  bodyLine: {
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  mutedLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  summaryBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
  },
  photoImage: {
    width: 84,
    height: 84,
    borderRadius: 10,
    marginRight: 8,
    backgroundColor: '#E5E7EB',
  },
  checkGrid: {
    gap: 8,
  },
  checkPair: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  checkRow: {
    flex: 1,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  checkRowSpacer: {
    flex: 1,
  },
  checkRowDone: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  checkNumBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  checkNumBadgeDone: {
    borderColor: '#86EFAC',
    backgroundColor: '#DCFCE7',
  },
  checkNum: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    textAlign: 'center',
  },
  checkNumDone: {
    color: '#166534',
  },
  checkTxt: {
    flex: 1,
    fontSize: 11,
    color: COLORS.textPrimary,
    lineHeight: 17,
  },
  checkTxtDone: {
    color: '#166534',
  },
  partRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  scoreButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  scoreButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  scoreButtonSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  scoreButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  scoreButtonTextSelected: {
    color: '#fff',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: COLORS.textPrimary,
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  qcChoice: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qcChoicePass: {
    backgroundColor: '#16A34A',
  },
  qcChoiceRework: {
    backgroundColor: '#EA580C',
  },
  qcChoiceFail: {
    backgroundColor: '#DC2626',
  },
  qcChoiceText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.3,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  warnTxt: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.heading,
    marginBottom: 12,
  },
  modalBody: {
    gap: 12,
  },
  modalInputContainer: {
    marginBottom: 8,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  required: {
    color: COLORS.error,
  },
  modalTextInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: COLORS.textPrimary,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  modalChecklistContainer: {
    marginBottom: 8,
  },
  modalChecklist: {
    maxHeight: 180,
  },
  modalChecklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  modalChecklistText: {
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  modalRejectButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    alignItems: 'center',
  },
  modalRejectButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
});

