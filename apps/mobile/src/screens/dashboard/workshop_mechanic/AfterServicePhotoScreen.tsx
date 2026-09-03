import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../../constants/theme';
import { Icon } from '../../../components/Icon';
import { useNavigation } from '@react-navigation/native';
import { ENV, isIosSimulator, isAndroidEmulator } from '../../../config/environment';
import { takeGpsStampedPhoto } from '../../../lib/gpsPhotoStamp';
import { isDummyWorkshopLead } from '../../../lib/workshopDummyLead';

interface PhotoState {
  type: string;
  label: string;
  uri: string | null;
  uploaded: boolean;
  uploading: boolean;
  required: boolean;
}

interface Props {
  route: any;
  navigation?: any;
  hideChrome?: boolean;
}

const REQUIRED_AFTER_PHOTOS = [
  { type: 'AFTER_FRONT', label: 'Front', required: true },
  { type: 'AFTER_REAR', label: 'Rear', required: true },
  { type: 'AFTER_LEFT', label: 'Left', required: true },
  { type: 'AFTER_RIGHT', label: 'Right', required: true },
  { type: 'AFTER_ENGINE_BAY', label: 'Engine', required: true },
  { type: 'AFTER_OLD_PARTS', label: 'Old parts', required: true },
  { type: 'AFTER_ODOMETER', label: 'Odometer', required: true },
  { type: 'AFTER_NEW_PARTS', label: 'New parts', required: false },
];

function isUuid(value?: string | null) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value || ''),
  );
}

export default function AfterServicePhotoScreen({
  route,
  hideChrome = false,
}: Props) {
  const navigation = useNavigation();
  const params = route?.params || {};
  const jobId = params.jobId as string | undefined;
  const leadId = (params.leadId || params.jobId) as string | undefined;

  const [photos, setPhotos] = useState<PhotoState[]>(() =>
    REQUIRED_AFTER_PHOTOS.map((photo) => ({
      type: photo.type,
      label: photo.label,
      uri: null,
      uploaded: false,
      uploading: false,
      required: photo.required,
    })),
  );
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [odometerReading, setOdometerReading] = useState('');
  const [showOdometerModal, setShowOdometerModal] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [checklistCompleted, setChecklistCompleted] = useState(false);
  const [partsRecorded, setPartsRecorded] = useState(false);
  const [workNotes, setWorkNotes] = useState('');
  const [afterVideos, setAfterVideos] = useState<Array<{ id: string; uri: string }>>([]);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [isDummy, setIsDummy] = useState(() =>
    isDummyWorkshopLead({
      lead_number: params.leadNumber,
      created_from: params.createdFrom,
      customer_name: params.customerName,
    }),
  );

  const load = useCallback(async () => {
    if (!leadId) {
      setLoading(false);
      return;
    }

    try {
      const { data: lead } = await supabase
        .from('service_leads')
        .select('lead_number, created_from, customer_name')
        .eq('id', leadId)
        .maybeSingle();

      if (lead) setIsDummy(isDummyWorkshopLead(lead));

      let jobRow: any = null;
      if (isUuid(jobId)) {
        const { data } = await supabase
          .from('mechanic_jobs')
          .select('id, checklist_completed, work_notes')
          .eq('id', jobId)
          .maybeSingle();
        jobRow = data;
      }

      if (!jobRow) {
        const { data: rows } = await supabase
          .from('mechanic_jobs')
          .select('id, checklist_completed, work_notes')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false })
          .limit(1);
        jobRow = rows?.[0] || null;
      }

      if (jobRow) {
        setChecklistCompleted(Boolean(jobRow.checklist_completed));
        if (jobRow.work_notes) setWorkNotes(String(jobRow.work_notes));
      }

      const { data: partsData } = await supabase
        .from('mechanic_parts_usage')
        .select('id')
        .eq('lead_id', leadId)
        .limit(1);
      setPartsRecorded((partsData?.length || 0) > 0);

      const { data: existing } = await supabase
        .from('mechanic_job_photos')
        .select('photo_type, photo_url, odometer_reading')
        .eq('lead_id', leadId)
        .eq('photo_category', 'after');

      if (existing?.length) {
        setPhotos((prev) =>
          prev.map((photo) => {
            const match = existing.find((row) => row.photo_type === photo.type);
            if (!match) return photo;
            return { ...photo, uri: match.photo_url, uploaded: true };
          }),
        );
        const odo = existing.find((row) => row.photo_type === 'AFTER_ODOMETER');
        if (odo?.odometer_reading) setOdometerReading(String(odo.odometer_reading));
      }

      const { data: videos } = await supabase
        .from('mechanic_job_photos')
        .select('id, photo_url, photo_type')
        .eq('lead_id', leadId)
        .ilike('photo_type', 'AFTER_VIDEO-%');
      setAfterVideos(
        (videos || []).map((row) => ({ id: String(row.id), uri: String(row.photo_url) })),
      );
    } catch {
      // Never console.error objects here — LogBox covers the photo grid.
    } finally {
      setLoading(false);
    }
  }, [jobId, leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadPhoto = async (index: number, uri?: string, odoValue?: string) => {
    const photo = photos[index];
    const photoUri = uri || photo.uri;
    if (!photoUri || photo.uploaded || photo.uploading || !leadId) return;

    const next = [...photos];
    next[index] = { ...next[index], uploading: true };
    setPhotos(next);
    setUploading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const formData = new FormData();
      const filename = photoUri.split('/').pop() || 'photo.jpg';
      const isVideo = /\.(mp4|mov|m4v|webm|3gp)(\?|$)/i.test(filename) || filename.includes('video');
      // @ts-ignore React Native FormData file
      formData.append('file', {
        uri: photoUri,
        name: filename,
        type: isVideo ? 'video/mp4' : 'image/jpeg',
      });
      formData.append('photo_type', photo.type);
      formData.append('photo_category', 'after');
      const odo = odoValue || odometerReading;
      if (photo.type === 'AFTER_ODOMETER' && odo) {
        formData.append('odometer_reading', odo);
      }

      const response = await fetch(`${ENV.API_URL}/api/mechanic/jobs/${leadId}/upload-photos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Failed to upload photo');

      next[index] = {
        ...next[index],
        uploading: false,
        uploaded: true,
        uri: result.data?.photo_url || photoUri,
      };
      setPhotos([...next]);
    } catch (error: any) {
      next[index] = { ...next[index], uploading: false };
      setPhotos([...next]);
      Alert.alert('Upload failed', error?.message || 'Could not upload photo');
    } finally {
      setUploading(false);
    }
  };

  const takePhoto = async (index: number) => {
    try {
      let stampedUri: string | null = null;
      const useGallery = isDummy || isIosSimulator() || isAndroidEmulator();

      if (useGallery) {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission', 'Gallery access chahiye photo add karne ke liye.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images', 'videos'],
          allowsEditing: false,
          quality: 0.8,
          videoMaxDuration: 60,
        });
        if (result.canceled || !result.assets?.[0]?.uri) return;
        stampedUri = result.assets[0].uri;
      } else {
        stampedUri = await takeGpsStampedPhoto();
        if (!stampedUri) return;
      }

      const next = [...photos];
      next[index] = { ...next[index], uri: stampedUri, uploaded: false };
      setPhotos(next);

      if (photos[index].type === 'AFTER_ODOMETER' && !isDummy) {
        setSelectedPhotoIndex(index);
        setShowOdometerModal(true);
        return;
      }
      if (photos[index].type === 'AFTER_ODOMETER' && isDummy && !odometerReading) {
        setOdometerReading('0');
      }
      await uploadPhoto(index, stampedUri, isDummy ? odometerReading || '0' : undefined);
    } catch (error: any) {
      Alert.alert(
        'Could not add photo',
        error?.message || 'Pick from gallery on simulator, or use camera on a real device.',
      );
    }
  };

  const handleOdometerSubmit = () => {
    if (!odometerReading || Number.isNaN(parseFloat(odometerReading))) {
      Alert.alert('Odometer', 'Enter a valid reading');
      return;
    }
    setShowOdometerModal(false);
    if (selectedPhotoIndex !== null) {
      void uploadPhoto(selectedPhotoIndex);
    }
  };

  const addAfterVideo = async () => {
    if (!leadId) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission', 'Gallery access chahiye video add karne ke liye.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsMultipleSelection: true,
        quality: 0.8,
        videoMaxDuration: 60,
      });
      if (result.canceled || !result.assets?.length) return;

      setUploadingVideo(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      for (const [index, asset] of result.assets.entries()) {
        const formData = new FormData();
        // @ts-ignore React Native FormData file
        formData.append('file', {
          uri: asset.uri,
          name: `after-video-${Date.now()}-${index}.mp4`,
          type: 'video/mp4',
        });
        formData.append('photo_type', `AFTER_VIDEO-${Date.now()}-${index}`);
        formData.append('photo_category', 'after_video');
        const response = await fetch(`${ENV.API_URL}/api/mechanic/jobs/${leadId}/upload-photos`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json?.error || 'Failed to upload video');
      }
      await load();
    } catch (error: any) {
      Alert.alert('Upload failed', error?.message || 'Could not upload video');
    } finally {
      setUploadingVideo(false);
    }
  };

  const requiredCount = photos.filter((p) => p.required).length;
  const uploadedCount = photos.filter((p) => p.required && p.uploaded).length;

  const canCompleteJob = () => {
    if (isDummy) return workNotes.trim().length > 0;
    return (
      uploadedCount >= 6 &&
      checklistCompleted &&
      partsRecorded &&
      workNotes.trim().length > 0
    );
  };

  const handleCompleteJob = async () => {
    if (!canCompleteJob()) {
      Alert.alert(
        'Incomplete',
        isDummy
          ? 'Add a short work note, then mark complete. Photos are optional on dummy leads.'
          : 'Need 6 after photos, checklist, parts, and work notes.',
      );
      return;
    }
    if (!leadId) return;

    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (workNotes.trim()) {
        await supabase.from('mechanic_jobs').update({ work_notes: workNotes }).eq('lead_id', leadId);
      }
      const response = await fetch(`${ENV.API_URL}/api/mechanic/jobs/${leadId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          notes: 'Job completed with after service photos',
          work_summary: workNotes.trim() || undefined,
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.details || error.error || error.hint || 'Failed to complete job');
      }
      Alert.alert('Done', 'Job sent to QC', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to complete job');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.inPageBack}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Icon name="arrow-left" size={18} color={COLORS.primary} />
        <Text style={styles.inPageBackText}>Back to job</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {isDummy ? (
          <View style={styles.dummyBanner}>
            <Text style={styles.dummyTitle}>Dummy lead</Text>
            <Text style={styles.dummyText}>
              Simulator pe gallery se photo / video add karo. Checklist / parts yahan mandatory nahi.
            </Text>
          </View>
        ) : null}

        <View style={styles.topBar}>
          <Text style={styles.progressText}>
            {uploadedCount}/{requiredCount} photos
          </Text>
          <View style={styles.chipRow}>
            <Text style={[styles.chip, checklistCompleted || isDummy ? styles.chipOk : styles.chipWait]}>
              Checklist
            </Text>
            <Text style={[styles.chip, partsRecorded || isDummy ? styles.chipOk : styles.chipWait]}>
              Parts
            </Text>
            <Text style={[styles.chip, workNotes.trim() ? styles.chipOk : styles.chipWait]}>Notes</Text>
          </View>
        </View>

        <View style={styles.videoSection}>
          <Text style={styles.videoTitle}>Work videos</Text>
          <Text style={styles.videoHint}>
            Regular service ka video yahan add karo. Extra work ke videos Extra Work tab pe alag hain.
          </Text>
          <View style={styles.videoRow}>
            {afterVideos.map((clip) => (
              <View key={clip.id} style={styles.videoThumb}>
                <Icon name="video" size={20} color={COLORS.white} />
                <Text style={styles.videoThumbText}>VIDEO</Text>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.addVideoBtn, uploadingVideo && { opacity: 0.6 }]}
              onPress={() => void addAfterVideo()}
              disabled={uploadingVideo}
            >
              {uploadingVideo ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <>
                  <Icon name="video" size={20} color={COLORS.primary} />
                  <Text style={styles.addVideoText}>Add video</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <TextInput
          style={styles.notesInput}
          placeholder="Work notes *"
          value={workNotes}
          onChangeText={setWorkNotes}
          multiline
        />

        <View style={styles.grid}>
          {photos.map((photo, index) => (
            <View key={photo.type} style={styles.photoCard}>
              <Text style={styles.photoLabel} numberOfLines={1}>
                {photo.label}
                {photo.required ? <Text style={styles.required}> *</Text> : null}
              </Text>
              {photo.uri ? (
                <View style={styles.photoPreview}>
                  {/\.(mp4|mov|m4v|webm|3gp)(\?|$)/i.test(photo.uri) ? (
                    <View style={styles.videoPlaceholder}>
                      <Icon name="video" size={22} color={COLORS.white} />
                      <Text style={styles.videoPlaceholderText}>Video</Text>
                    </View>
                  ) : (
                    <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                  )}
                  {photo.uploading ? (
                    <View style={styles.uploadingOverlay}>
                      <ActivityIndicator size="small" color={COLORS.white} />
                    </View>
                  ) : null}
                  {photo.uploaded ? (
                    <View style={styles.uploadedBadge}>
                      <Icon name="check" size={12} color={COLORS.white} />
                    </View>
                  ) : null}
                  <TouchableOpacity style={styles.retakeButton} onPress={() => void takePhoto(index)}>
                    <Text style={styles.retakeText}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={() => void takePhoto(index)}
                  disabled={uploading}
                >
                  <Icon name="camera" size={22} color={COLORS.primary} />
                  <Text style={styles.captureText}>Add photo / video</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.completeButton, (!canCompleteJob() || uploading) && styles.completeButtonDisabled]}
          onPress={() => void handleCompleteJob()}
          disabled={!canCompleteJob() || uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.completeButtonText}>Mark job complete</Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={showOdometerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOdometerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Final odometer (km)</Text>
            <TextInput
              style={styles.odometerInput}
              placeholder="e.g. 45210"
              value={odometerReading}
              onChangeText={setOdometerReading}
              keyboardType="numeric"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowOdometerModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSubmit]}
                onPress={handleOdometerSubmit}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextSubmit]}>Save</Text>
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
  inPageBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  inPageBackText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  dummyBanner: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  dummyTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
    color: '#C2410C',
  },
  dummyText: {
    marginTop: 2,
    fontSize: FONT_SIZES.xs,
    color: '#9A3412',
  },
  topBar: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  progressText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    overflow: 'hidden',
  },
  chipOk: {
    backgroundColor: '#D1FAE5',
    color: '#047857',
  },
  chipWait: {
    backgroundColor: '#FEE2E2',
    color: '#B91C1C',
  },
  notesInput: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    minHeight: 52,
    textAlignVertical: 'top',
    marginBottom: SPACING.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoCard: {
    width: '48%',
    flexGrow: 1,
    maxWidth: '48.5%',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  photoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  required: {
    color: COLORS.error,
  },
  photoPreview: {
    position: 'relative',
    width: '100%',
    height: 110,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  videoPlaceholderText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
  },
  videoSection: {
    marginTop: 16,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  videoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#004AAD',
  },
  videoHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: 10,
  },
  videoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  videoThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  videoThumbText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
  },
  addVideoBtn: {
    minWidth: 72,
    height: 72,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  addVideoText: {
    color: '#004AAD',
    fontSize: 11,
    fontWeight: '800',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.success,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retakeButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  retakeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
  },
  captureButton: {
    height: 110,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: BORDER_RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.gray[50],
  },
  captureText: {
    marginTop: 4,
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '700',
  },
  footer: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
  },
  completeButton: {
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.md,
  },
  completeButtonDisabled: {
    backgroundColor: COLORS.gray[300],
  },
  completeButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    width: '82%',
  },
  modalTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  odometerInput: {
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    fontSize: FONT_SIZES.md,
    marginBottom: SPACING.md,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
  },
  modalButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  modalButtonCancel: {
    backgroundColor: COLORS.gray[200],
  },
  modalButtonSubmit: {
    backgroundColor: COLORS.primary,
  },
  modalButtonText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: '600',
  },
  modalButtonTextSubmit: {
    color: COLORS.white,
  },
});
