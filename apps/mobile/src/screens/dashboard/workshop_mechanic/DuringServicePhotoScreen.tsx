import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../../constants/theme';
import { Icon } from '../../../components/Icon';
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
  hideChrome?: boolean;
}

const DURING_PHOTOS = [
  { type: 'DURING_OIL_DRAIN', label: 'Drained oil', required: true },
  { type: 'DURING_OIL_POUR', label: 'New oil pour', required: true },
  { type: 'DURING_FILTER_OLD', label: 'Old filter', required: true },
  { type: 'DURING_FILTER_NEW', label: 'New filter', required: true },
  { type: 'DURING_BRAKE_BEFORE', label: 'Brake before', required: false },
  { type: 'DURING_BRAKE_AFTER', label: 'Brake after', required: false },
  { type: 'DURING_AC_BEFORE', label: 'AC before', required: false },
  { type: 'DURING_AC_AFTER', label: 'AC after', required: false },
  { type: 'DURING_PART_REMOVAL', label: 'Part removal', required: false },
  { type: 'DURING_PART_INSTALL', label: 'Part install', required: false },
];

export default function DuringServicePhotoScreen({ route }: Props) {
  const navigation = useNavigation();
  const params = route?.params || {};
  const leadId = (params.leadId || params.jobId) as string | undefined;

  const [photos, setPhotos] = useState<PhotoState[]>(() =>
    DURING_PHOTOS.map((photo) => ({
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
  const [workVideos, setWorkVideos] = useState<Array<{ id: string; uri: string }>>([]);
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

      const { data: existing } = await supabase
        .from('mechanic_job_photos')
        .select('photo_type, photo_url')
        .eq('lead_id', leadId)
        .eq('photo_category', 'during');

      if (existing?.length) {
        setPhotos((prev) =>
          prev.map((photo) => {
            const match = existing.find((row) => row.photo_type === photo.type);
            if (!match) return photo;
            return { ...photo, uri: match.photo_url, uploaded: true };
          }),
        );
      }

      const { data: videos } = await supabase
        .from('mechanic_job_photos')
        .select('id, photo_url, photo_type')
        .eq('lead_id', leadId)
        .ilike('photo_type', 'AFTER_VIDEO-%');
      setWorkVideos(
        (videos || []).map((row) => ({ id: String(row.id), uri: String(row.photo_url) })),
      );
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadPhoto = async (index: number, uri?: string) => {
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
      // @ts-ignore React Native FormData file
      formData.append('file', {
        uri: photoUri,
        name: filename,
        type: 'image/jpeg',
      });
      formData.append('photo_type', photo.type);
      formData.append('photo_category', 'during');

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
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.8,
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
      await uploadPhoto(index, stampedUri);
    } catch (error: any) {
      Alert.alert(
        'Could not add photo',
        error?.message || 'Pick from gallery on simulator, or use camera on a real device.',
      );
    }
  };

  const addWorkVideo = async () => {
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
          name: `work-video-${Date.now()}-${index}.mp4`,
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
        <View style={styles.hint}>
          <Text style={styles.hintTitle}>During service photos</Text>
          <Text style={styles.hintText}>
            Kaam chalte hue proof yahan add karo — oil, filter, brake, parts. QC pe yeh During mein dikhega.
          </Text>
          <Text style={styles.progressText}>
            {uploadedCount}/{requiredCount} required
          </Text>
        </View>

        <View style={styles.videoSection}>
          <Text style={styles.videoTitle}>Work videos</Text>
          <Text style={styles.videoHint}>
            Service ka video yahan add karo (extra work alag hai). QC pe Work videos mein dikhega.
          </Text>
          <View style={styles.videoRow}>
            {workVideos.map((clip) => (
              <View key={clip.id} style={styles.videoThumb}>
                <Icon name="video" size={20} color={COLORS.white} />
                <Text style={styles.videoThumbText}>VIDEO</Text>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.addVideoBtn, uploadingVideo && { opacity: 0.6 }]}
              onPress={() => void addWorkVideo()}
              disabled={uploadingVideo}
            >
              {uploadingVideo ? (
                <ActivityIndicator size="small" color="#EA580C" />
              ) : (
                <>
                  <Icon name="video" size={20} color="#EA580C" />
                  <Text style={styles.addVideoText}>Add video</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.grid}>
          {photos.map((photo, index) => (
            <View key={photo.type} style={styles.photoCard}>
              <Text style={styles.photoLabel} numberOfLines={1}>
                {photo.label}
                {photo.required ? <Text style={styles.required}> *</Text> : null}
              </Text>
              {photo.uri ? (
                <View style={styles.photoPreview}>
                  <Image source={{ uri: photo.uri }} style={styles.photoImage} />
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
                  <Icon name="camera" size={22} color="#EA580C" />
                  <Text style={styles.captureText}>Add photo</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
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
  scrollView: { flex: 1 },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  hint: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: BORDER_RADIUS.md,
    padding: 12,
    marginBottom: 12,
  },
  hintTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#C2410C',
  },
  hintText: {
    fontSize: 12,
    color: '#9A3412',
    marginTop: 4,
    lineHeight: 16,
  },
  progressText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#9A3412',
  },
  videoSection: {
    marginBottom: 12,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  videoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#C2410C',
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
    borderColor: '#FDBA74',
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  addVideoText: {
    color: '#C2410C',
    fontSize: 11,
    fontWeight: '800',
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
    borderColor: '#EA580C',
    borderStyle: 'dashed',
    borderRadius: BORDER_RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
  },
  captureText: {
    marginTop: 4,
    fontSize: 11,
    color: '#EA580C',
    fontWeight: '700',
  },
});
