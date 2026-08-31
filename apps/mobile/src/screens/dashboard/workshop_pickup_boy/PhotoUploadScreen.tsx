import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { takeGpsStampedPhoto } from '../../../lib/gpsPhotoStamp';
import { analyzeVehiclePhoto } from '../../../lib/pickupPhotoOcr';
import { startVoiceNote, stopVoiceNote, transcribeVoiceNote, isVoiceRecordingAvailable } from '../../../lib/pickupVoiceNote';
import * as Location from 'expo-location';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../../constants/theme';
import { ENV } from '../../../config/environment';
import type { VehiclePhotoType, FuelLevel } from '../../../../../shared/types';

interface Props {
  leadId: string;
  photoCategory: 'PICKUP' | 'DROP';
  onBack: () => void;
  onComplete: () => void;
}

interface PhotoState {
  type: VehiclePhotoType;
  uri: string | null;
  uploaded: boolean;
  uploading: boolean;
}

const FUEL_LEVELS: FuelLevel[] = ['EMPTY', 'QUARTER', 'HALF', 'THREE_QUARTER', 'FULL'];

export default function PhotoUploadScreen({
  leadId,
  photoCategory,
  onBack,
  onComplete,
}: Props) {
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (onBack) {
        onBack();
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [onBack]);

  const [photos, setPhotos] = useState<PhotoState[]>([]);
  const [dashboardUri, setDashboardUri] = useState<string | null>(null);
  const [dashboardUploaded, setDashboardUploaded] = useState(false);
  const [dashboardUploading, setDashboardUploading] = useState(false);
  const [odometerReading, setOdometerReading] = useState('');
  const [fuelLevel, setFuelLevel] = useState<FuelLevel>('HALF');
  const [damageDescription, setDamageDescription] = useState('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceAvailable] = useState(() => isVoiceRecordingAvailable());

  useEffect(() => {
    requestPermissions();
    getLocation();
    initializePhotos();
    fetchExistingPhotos();
  }, []);

  const initializePhotos = () => {
    const photoTypes: VehiclePhotoType[] =
      photoCategory === 'PICKUP'
        ? [
            'PICKUP_FRONT',
            'PICKUP_LEFT',
            'PICKUP_RIGHT',
            'PICKUP_REAR',
            'PICKUP_INTERIOR',
            'PICKUP_DAMAGE',
          ]
        : [
            'DROP_FRONT',
            'DROP_LEFT',
            'DROP_RIGHT',
            'DROP_REAR',
            'DROP_INTERIOR',
            'DROP_ODOMETER',
            'DROP_HANDOVER',
            'AFTER_WORK',
            'DELIVERY_SIGNATURE',
          ];

    setPhotos(
      photoTypes.map((type) => ({
        type,
        uri: null,
        uploaded: false,
        uploading: false,
      })),
    );
  };

  const fetchExistingPhotos = async () => {
    try {
      let query = supabase
        .from('vehicle_condition_photos')
        .select('photo_type, photo_url')
        .eq('lead_id', leadId);

      if (photoCategory === 'DROP') {
        query = query.or('photo_type.like.DROP_%,photo_type.eq.DELIVERY_SIGNATURE');
      } else {
        query = query.like('photo_type', 'PICKUP_%');
      }

      const { data, error } = await query;
      if (error || !data?.length) return;

      const dashboard = data.find(
        (d) => d.photo_type === (photoCategory === 'PICKUP' ? 'PICKUP_ODOMETER' : 'DROP_ODOMETER'),
      );
      if (dashboard?.photo_url) {
        setDashboardUri(dashboard.photo_url);
        setDashboardUploaded(true);
      }

      setPhotos((prevPhotos) =>
        prevPhotos.map((photo) => {
          const existing = data.find((d) => d.photo_type === photo.type);
          if (existing) {
            return { ...photo, uri: existing.photo_url, uploaded: true };
          }
          return photo;
        }),
      );
    } catch {
      // silent
    }
  };

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();

    if (cameraStatus !== 'granted' || mediaStatus !== 'granted' || locationStatus !== 'granted') {
      Alert.alert(
        'Permissions Required',
        'Please grant camera, gallery, and location permissions to continue',
      );
    }
  };

  const getLocation = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch {
      // silent
    }
  };

  const readDashboardFromPhoto = async (uri: string) => {
    setOcrLoading(true);
    try {
      const result = await analyzeVehiclePhoto(leadId, uri, 'dashboard');
      if (result?.odometer_km != null) {
        setOdometerReading(String(result.odometer_km));
      }
      if (result?.fuel_level) {
        setFuelLevel(result.fuel_level);
      }
      if (result?.odometer_km != null || result?.fuel_level) {
        const parts = [
          result.odometer_km != null ? `KM: ${result.odometer_km}` : null,
          result.fuel_level ? `Fuel: ${result.fuel_level.replace('_', ' ')}` : null,
        ].filter(Boolean);
        Alert.alert('Dashboard read', parts.join('\n') || 'Values updated');
      } else {
        Alert.alert('Could not read dashboard', 'Retake a clearer photo or enter values manually.');
      }
    } catch {
      Alert.alert('Read failed', 'Enter km and fuel manually.');
    } finally {
      setOcrLoading(false);
    }
  };

  const captureDashboardPhoto = async () => {
    try {
      const stampedUri = await takeGpsStampedPhoto();
      if (!stampedUri) return;
      setDashboardUri(stampedUri);
      setDashboardUploaded(false);
      await readDashboardFromPhoto(stampedUri);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to add dashboard photo');
    }
  };

  const uploadDashboardPhoto = async () => {
    if (!dashboardUri || dashboardUploaded || dashboardUploading) return;

    setDashboardUploading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const formData = new FormData();
      const filename = dashboardUri.split('/').pop() || 'dashboard.jpg';

      // @ts-ignore
      formData.append('file', {
        uri: dashboardUri,
        name: filename,
        type: 'image/jpeg',
      });
      formData.append('photo_type', photoCategory === 'PICKUP' ? 'PICKUP_ODOMETER' : 'DROP_ODOMETER');
      if (odometerReading) formData.append('odometer_reading', odometerReading);
      formData.append('fuel_level', fuelLevel);
      if (location) {
        formData.append('latitude', location.latitude.toString());
        formData.append('longitude', location.longitude.toString());
      }

      const response = await fetch(`${ENV.API_URL}/api/pickup/${leadId}/upload-photos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to upload dashboard photo');

      setDashboardUploaded(true);
      Alert.alert('Saved', 'Dashboard photo uploaded with km & fuel readings.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to upload dashboard photo');
    } finally {
      setDashboardUploading(false);
    }
  };

  const takePhoto = async (index: number) => {
    try {
      const stampedUri = await takeGpsStampedPhoto();
      if (!stampedUri) return;

      const newPhotos = [...photos];
      newPhotos[index].uri = stampedUri;
      setPhotos(newPhotos);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to add photo');
    }
  };

  const uploadPhoto = async (index: number) => {
    const photo = photos[index];
    if (!photo.uri || photo.uploaded || photo.uploading) return;

    const newPhotos = [...photos];
    newPhotos[index].uploading = true;
    setPhotos(newPhotos);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const formData = new FormData();
      const filename = photo.uri.split('/').pop() || 'photo.jpg';

      // @ts-ignore
      formData.append('file', {
        uri: photo.uri,
        name: filename,
        type: 'image/jpeg',
      });

      formData.append('photo_type', photo.type);

      if (photo.type.includes('ODOMETER') && odometerReading) {
        formData.append('odometer_reading', odometerReading);
      }

      if (photo.type.includes('FUEL')) {
        formData.append('fuel_level', fuelLevel);
      }

      if (photo.type.includes('DAMAGE') && damageDescription) {
        formData.append('damage_description', damageDescription);
      }

      if (location) {
        formData.append('latitude', location.latitude.toString());
        formData.append('longitude', location.longitude.toString());
      }

      const response = await fetch(`${ENV.API_URL}/api/pickup/${leadId}/upload-photos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload photo');
      }

      newPhotos[index].uploading = false;
      newPhotos[index].uploaded = true;
      setPhotos(newPhotos);
    } catch (error: any) {
      newPhotos[index].uploading = false;
      setPhotos(newPhotos);
      Alert.alert('Error', error.message || 'Failed to upload photo');
    }
  };

  const toggleVoiceNote = async () => {
    if (recording) {
      setRecording(false);
      setTranscribing(true);
      try {
        const uri = await stopVoiceNote();
        if (!uri) return;
        const text = await transcribeVoiceNote(uri);
        if (text) {
          setDamageDescription((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
        } else {
          Alert.alert('No speech detected', 'Try again or type the damage description.');
        }
      } catch (e: any) {
        Alert.alert('Transcription failed', e?.message || 'Could not transcribe audio');
      } finally {
        setTranscribing(false);
      }
      return;
    }

    try {
      await startVoiceNote();
      setRecording(true);
    } catch (e: any) {
      Alert.alert('Microphone', e?.message || 'Could not start recording');
    }
  };

  const getPhotoLabel = (type: VehiclePhotoType): string => {
    const labels: Record<VehiclePhotoType, string> = {
      PICKUP_FRONT: 'Front',
      PICKUP_LEFT: 'Left',
      PICKUP_RIGHT: 'Right',
      PICKUP_REAR: 'Rear',
      PICKUP_INTERIOR: 'Interior',
      PICKUP_ODOMETER: 'Odometer',
      PICKUP_FUEL: 'Fuel',
      PICKUP_DAMAGE: 'Damage',
      DROP_FRONT: 'Front',
      DROP_LEFT: 'Left',
      DROP_RIGHT: 'Right',
      DROP_REAR: 'Rear',
      DROP_INTERIOR: 'Interior',
      DROP_ODOMETER: 'Odometer',
      DROP_HANDOVER: 'Handover',
      AFTER_WORK: 'After Service',
      DELIVERY_SIGNATURE: 'Signature',
    };
    return labels[type] || type;
  };

  const isRequired = (type: VehiclePhotoType): boolean => {
    if (photoCategory === 'PICKUP') {
      return ['PICKUP_FRONT', 'PICKUP_LEFT', 'PICKUP_RIGHT', 'PICKUP_INTERIOR'].includes(type);
    }
    return ['DROP_FRONT', 'DROP_INTERIOR', 'AFTER_WORK', 'DROP_HANDOVER'].includes(type);
  };

  const allRequiredPhotosUploaded = () =>
    photos.filter((photo) => isRequired(photo.type)).every((photo) => photo.uploaded);

  const getAccessToken = async (): Promise<string> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Not authenticated');
    return token;
  };

  const handleComplete = async () => {
    if (photoCategory === 'PICKUP' && !dashboardUploaded) {
      Alert.alert('Dashboard photo required', 'Upload dashboard photo with km & fuel readings.');
      return;
    }
    if (!allRequiredPhotosUploaded()) {
      Alert.alert('Error', 'Please upload all required photos');
      return;
    }

    try {
      const token = await getAccessToken();
      const response = await fetch(`${ENV.API_URL}/api/pickup/${leadId}/photos-submitted`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ category: photoCategory }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit photos');
      }
      Alert.alert('Success', 'All photos uploaded successfully!', [{ text: 'OK', onPress: onComplete }]);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to submit photos');
    }
  };

  const renderPhotoTile = (photo: PhotoState, index: number) => (
    <View key={photo.type} style={styles.photoTile}>
      <View style={styles.photoHeader}>
        <Text style={styles.photoLabel} numberOfLines={1}>
          {getPhotoLabel(photo.type)}
          {isRequired(photo.type) ? <Text style={styles.required}> *</Text> : null}
        </Text>
        {photo.uploaded ? <Ionicons name="checkmark-circle" size={16} color={COLORS.success} /> : null}
      </View>

      {photo.uri ? (
        <View style={styles.photoPreview}>
          <Image source={{ uri: photo.uri }} style={styles.photoImage} />
          {!photo.uploaded ? (
            <View style={styles.photoOverlay}>
              <TouchableOpacity style={styles.miniBtn} onPress={() => takePhoto(index)}>
                <Text style={styles.miniBtnTxt}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.miniBtn, styles.miniBtnPrimary, photo.uploading && styles.miniBtnDisabled]}
                onPress={() => uploadPhoto(index)}
                disabled={photo.uploading}
              >
                {photo.uploading ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.miniBtnTxtPrimary}>Upload</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ) : (
        <TouchableOpacity style={styles.photoPlaceholder} onPress={() => takePhoto(index)}>
          <Ionicons name="camera-outline" size={28} color={COLORS.gray[500]} />
          <Text style={styles.photoPlaceholderText}>Add photo</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{photoCategory === 'PICKUP' ? 'Pickup' : 'Drop'} Photos</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>Photo tips</Text>
          <Text style={styles.instructionText}>• Take clear photos in good lighting</Text>
          <Text style={styles.instructionText}>• Upload dashboard photo first — KM & fuel auto-read</Text>
          <Text style={styles.instructionText}>• GPS, date & time stamped on each photo</Text>
          <Text style={styles.instructionText}>• * = required</Text>
        </View>

        {photoCategory === 'PICKUP' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Dashboard photo *</Text>
            <Text style={styles.hint}>
              Upload instrument cluster / dashboard photo — app reads odometer (km) and fuel level.
            </Text>

            {dashboardUri ? (
              <View style={styles.dashboardPreview}>
                <Image source={{ uri: dashboardUri }} style={styles.dashboardImage} />
                <View style={styles.dashboardActions}>
                  <TouchableOpacity style={styles.miniBtn} onPress={captureDashboardPhoto}>
                    <Text style={styles.miniBtnTxt}>Retake</Text>
                  </TouchableOpacity>
                  {!dashboardUploaded ? (
                    <TouchableOpacity
                      style={[styles.miniBtn, styles.miniBtnPrimary, dashboardUploading && styles.miniBtnDisabled]}
                      onPress={uploadDashboardPhoto}
                      disabled={dashboardUploading}
                    >
                      {dashboardUploading ? (
                        <ActivityIndicator color={COLORS.white} size="small" />
                      ) : (
                        <Text style={styles.miniBtnTxtPrimary}>Upload</Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.miniBtn, styles.miniBtnPrimary]}>
                      <Text style={styles.miniBtnTxtPrimary}>Uploaded</Text>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.dashboardPlaceholder} onPress={captureDashboardPhoto}>
                <Ionicons name="speedometer-outline" size={32} color={COLORS.primary} />
                <Text style={styles.dashboardPlaceholderTitle}>Upload dashboard photo</Text>
                <Text style={styles.dashboardPlaceholderSub}>KM & petrol level auto-fill below</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.label}>Odometer (km)</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                value={odometerReading}
                onChangeText={setOdometerReading}
                placeholder="Auto from dashboard photo"
                keyboardType="number-pad"
              />
              {ocrLoading ? <ActivityIndicator color={COLORS.primary} /> : null}
            </View>

            <Text style={styles.label}>Fuel level</Text>
            <View style={styles.fuelOptions}>
              {FUEL_LEVELS.map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[styles.fuelOption, fuelLevel === level && styles.fuelOptionSelected]}
                  onPress={() => setFuelLevel(level)}
                >
                  <Text
                    style={[styles.fuelOptionText, fuelLevel === level && styles.fuelOptionTextSelected]}
                  >
                    {level.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {dashboardUri && !dashboardUploaded ? (
              <TouchableOpacity
                style={[styles.readAgainBtn, ocrLoading && styles.miniBtnDisabled]}
                onPress={() => readDashboardFromPhoto(dashboardUri)}
                disabled={ocrLoading}
              >
                <Text style={styles.readAgainBtnTxt}>Read km & fuel from photo again</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.gridTitle}>Vehicle photos</Text>
        <View style={styles.photoGrid}>{photos.map((photo, index) => renderPhotoTile(photo, index))}</View>

        {photoCategory === 'PICKUP' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Damage description</Text>
            <Text style={styles.hint}>
              {voiceAvailable === false
                ? 'Type damage notes below. Voice needs app rebuild (npm run ios / android).'
                : 'Record voice or type — both work.'}
            </Text>

            <TextInput
              style={[styles.input, styles.textArea]}
              value={damageDescription}
              onChangeText={setDamageDescription}
              placeholder="Scratches, dents, missing parts…"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[
                styles.voiceBtn,
                recording && styles.voiceBtnActive,
                voiceAvailable === false && styles.voiceBtnDisabled,
              ]}
              onPress={toggleVoiceNote}
              disabled={transcribing || voiceAvailable === false}
            >
              {transcribing ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons
                    name={recording ? 'stop-circle' : 'mic'}
                    size={20}
                    color={COLORS.white}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.voiceBtnTxt}>
                    {recording ? 'Stop & transcribe' : 'Record damage note'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {allRequiredPhotosUploaded() ? (
          <TouchableOpacity style={styles.completeButton} onPress={handleComplete}>
            <Text style={styles.completeButtonText}>All photos uploaded — Continue</Text>
          </TouchableOpacity>
        ) : null}

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </View>
  );
}

const TILE_GAP = SPACING.sm;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  backButton: { padding: SPACING.sm },
  backButtonText: { fontSize: FONT_SIZES.md, color: COLORS.primary, fontWeight: '600' },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginLeft: SPACING.sm,
  },
  content: { flex: 1 },
  scrollContent: { padding: SPACING.md },
  instructionsCard: {
    backgroundColor: COLORS.info + '20',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.info,
  },
  instructionsTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginBottom: SPACING.sm,
  },
  instructionText: { fontSize: FONT_SIZES.sm, color: COLORS.bodyText, marginBottom: 4 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginBottom: SPACING.sm,
  },
  hint: { fontSize: FONT_SIZES.sm, color: COLORS.gray[600], marginBottom: SPACING.md, lineHeight: 20 },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.heading,
    marginBottom: SPACING.xs,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  input: {
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    fontSize: FONT_SIZES.sm,
    backgroundColor: COLORS.white,
  },
  inputFlex: { flex: 1 },
  textArea: { height: 100, textAlignVertical: 'top', marginBottom: SPACING.md },
  fuelOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  fuelOption: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.sm,
  },
  fuelOptionSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  fuelOptionText: { fontSize: FONT_SIZES.xs, color: COLORS.bodyText },
  fuelOptionTextSelected: { color: COLORS.white, fontWeight: '600' },
  gridTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
    color: COLORS.heading,
    marginBottom: SPACING.sm,
  },
  dashboardPlaceholder: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.md,
    backgroundColor: '#F0F7FF',
  },
  dashboardPlaceholderTitle: {
    marginTop: SPACING.sm,
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
    color: COLORS.primary,
  },
  dashboardPlaceholderSub: {
    marginTop: 4,
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[600],
    textAlign: 'center',
  },
  dashboardPreview: { marginBottom: SPACING.md },
  dashboardImage: {
    width: '100%',
    height: 180,
    borderRadius: BORDER_RADIUS.sm,
  },
  dashboardActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  readAgainBtn: {
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginTop: SPACING.xs,
  },
  readAgainBtnTxt: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: FONT_SIZES.sm,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -TILE_GAP / 2,
    marginBottom: SPACING.md,
  },
  photoTile: {
    width: '50%',
    paddingHorizontal: TILE_GAP / 2,
    marginBottom: SPACING.md,
  },
  photoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    paddingHorizontal: 2,
  },
  photoLabel: { fontSize: FONT_SIZES.sm, fontWeight: '700', color: COLORS.heading, flex: 1 },
  required: { color: COLORS.danger },
  photoPreview: { position: 'relative' },
  photoImage: { width: '100%', height: 130, borderRadius: BORDER_RADIUS.sm },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 6,
    gap: 6,
  },
  miniBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: 'rgba(55,65,81,0.92)',
    alignItems: 'center',
  },
  miniBtnPrimary: { backgroundColor: COLORS.primary },
  miniBtnDisabled: { backgroundColor: COLORS.gray[400] },
  miniBtnTxt: { fontSize: 11, fontWeight: '700', color: COLORS.white },
  miniBtnTxtPrimary: { fontSize: 11, fontWeight: '700', color: COLORS.white },
  photoPlaceholder: {
    height: 130,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1.5,
    borderColor: COLORS.gray[300],
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray[50],
  },
  photoPlaceholderText: { fontSize: FONT_SIZES.xs, color: COLORS.gray[500], marginTop: 4 },
  voiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
  },
  voiceBtnActive: { backgroundColor: COLORS.danger },
  voiceBtnDisabled: { backgroundColor: COLORS.gray[400], opacity: 0.85 },
  voiceBtnTxt: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZES.sm },
  completeButton: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  completeButtonText: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.white },
});
