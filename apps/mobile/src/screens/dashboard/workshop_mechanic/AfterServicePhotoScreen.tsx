import React, { useState, useEffect } from 'react';
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
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../../constants/theme';
import Icon from '../../../components/Icon';

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
  navigation: any;
}

const REQUIRED_AFTER_PHOTOS = [
  { type: 'AFTER_FRONT', label: 'Front View (After)', required: true },
  { type: 'AFTER_REAR', label: 'Rear View (After)', required: true },
  { type: 'AFTER_LEFT', label: 'Left Side (After)', required: true },
  { type: 'AFTER_RIGHT', label: 'Right Side (After)', required: true },
  { type: 'AFTER_ENGINE_BAY', label: 'Engine Bay (After)', required: true },
  { type: 'AFTER_OLD_PARTS', label: 'Old Parts Photo', required: true },
  { type: 'AFTER_NEW_PARTS', label: 'New Parts Installed', required: false },
  { type: 'AFTER_ODOMETER', label: 'Final Odometer Reading', required: true },
];

export default function AfterServicePhotoScreen({ route, navigation }: Props) {
  const { jobId, leadId } = route.params;
  const { user } = useAuth();
  const [photos, setPhotos] = useState<PhotoState[]>([]);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [odometerReading, setOdometerReading] = useState('');
  const [showOdometerModal, setShowOdometerModal] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [job, setJob] = useState<any>(null);
  const [checklistCompleted, setChecklistCompleted] = useState(false);
  const [partsRecorded, setPartsRecorded] = useState(false);
  const [workNotes, setWorkNotes] = useState('');

  useEffect(() => {
    requestPermissions();
    getLocation();
    initializePhotos();
    fetchJobDetails();
    fetchExistingPhotos();
  }, []);

  const initializePhotos = () => {
    setPhotos(
      REQUIRED_AFTER_PHOTOS.map((photo) => ({
        type: photo.type,
        label: photo.label,
        uri: null,
        uploaded: false,
        uploading: false,
        required: photo.required,
      }))
    );
  };

  const fetchJobDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('mechanic_jobs')
        .select('*, service_leads!inner(lead_number, customer_name, vehicle_number)')
        .eq('lead_id', leadId)
        .single();

      if (error) throw error;
      setJob(data);
      setChecklistCompleted(data.checklist_completed || false);
      setWorkNotes(data.work_notes || '');

      // Check if parts are recorded
      const { data: partsData } = await supabase
        .from('mechanic_parts_usage')
        .select('id')
        .eq('lead_id', leadId)
        .limit(1);

      setPartsRecorded((partsData?.length || 0) > 0);
    } catch (error) {
      console.error('Error fetching job:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from('mechanic_job_photos')
        .select('photo_type, photo_url, odometer_reading')
        .eq('lead_id', leadId)
        .eq('photo_category', 'after');

      if (error) throw error;

      if (data && data.length > 0) {
        setPhotos((prevPhotos) =>
          prevPhotos.map((photo) => {
            const existing = data.find((d) => d.photo_type === photo.type);
            if (existing) {
              return {
                ...photo,
                uri: existing.photo_url,
                uploaded: true,
              };
            }
            return photo;
          })
        );

        // Set odometer reading if exists
        const odometerPhoto = data.find((d) => d.photo_type === 'AFTER_ODOMETER');
        if (odometerPhoto?.odometer_reading) {
          setOdometerReading(odometerPhoto.odometer_reading.toString());
        }
      }
    } catch (error) {
      console.error('Error fetching photos:', error);
    }
  };

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();

    if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
      Alert.alert('Permissions Required', 'Please grant camera and media library permissions to continue');
    }
  };

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      // Silent fail
    }
  };

  const takePhoto = async (index: number) => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        exif: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const newPhotos = [...photos];
        newPhotos[index].uri = asset.uri;
        setPhotos(newPhotos);

        // If it's odometer photo, show input
        if (photos[index].type === 'AFTER_ODOMETER') {
          setSelectedPhotoIndex(index);
          setShowOdometerModal(true);
        } else {
          uploadPhoto(index, asset.uri);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const uploadPhoto = async (index: number, uri?: string) => {
    const photo = photos[index];
    const photoUri = uri || photo.uri;
    if (!photoUri || photo.uploaded || photo.uploading) return;

    const newPhotos = [...photos];
    newPhotos[index].uploading = true;
    setPhotos(newPhotos);
    setUploading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const formData = new FormData();
      const filename = photoUri.split('/').pop() || 'photo.jpg';
      
      // @ts-ignore
      formData.append('file', {
        uri: photoUri,
        name: filename,
        type: 'image/jpeg',
      });
      
      formData.append('photo_type', photo.type);
      formData.append('photo_category', 'after');
      
      if (photo.type === 'AFTER_ODOMETER' && odometerReading) {
        formData.append('odometer_reading', odometerReading);
      }
      
      if (location) {
        formData.append('latitude', location.latitude.toString());
        formData.append('longitude', location.longitude.toString());
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/mechanic/jobs/${leadId}/upload-photos`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload photo');
      }

      newPhotos[index].uploading = false;
      newPhotos[index].uploaded = true;
      newPhotos[index].uri = result.data.photo_url;
      setPhotos(newPhotos);
      setUploading(false);
    } catch (error: any) {
      newPhotos[index].uploading = false;
      setPhotos(newPhotos);
      setUploading(false);
      Alert.alert('Error', error.message || 'Failed to upload photo');
    }
  };

  const handleOdometerSubmit = () => {
    if (!odometerReading || isNaN(parseFloat(odometerReading))) {
      Alert.alert('Error', 'Please enter a valid odometer reading');
      return;
    }
    setShowOdometerModal(false);
    if (selectedPhotoIndex !== null) {
      uploadPhoto(selectedPhotoIndex);
    }
  };

  const canCompleteJob = () => {
    const requiredPhotos = photos.filter((p) => p.required);
    const uploadedRequired = requiredPhotos.filter((p) => p.uploaded);
    return (
      uploadedRequired.length >= 6 &&
      checklistCompleted &&
      partsRecorded &&
      workNotes.trim().length > 0
    );
  };

  const handleCompleteJob = async () => {
    if (!canCompleteJob()) {
      Alert.alert(
        'Incomplete Requirements',
        'Please ensure:\n• All required photos uploaded (minimum 6)\n• Checklist completed\n• Parts recorded\n• Work notes entered'
      );
      return;
    }

    try {
      // Update work notes first
      if (workNotes.trim()) {
        await supabase
          .from('mechanic_jobs')
          .update({ work_notes: workNotes })
          .eq('lead_id', leadId);
      }

      // Complete the job
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/mechanic/jobs/${leadId}/status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            status: 'COMPLETED',
            notes: 'Job completed with all after service photos',
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to complete job');
      }

      Alert.alert('Success', 'Job completed successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to complete job');
    }
  };

  const requiredCount = photos.filter((p) => p.required).length;
  const uploadedCount = photos.filter((p) => p.required && p.uploaded).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>After Service Photos</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          {uploadedCount} / {requiredCount} Required Photos
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(uploadedCount / requiredCount) * 100}%` },
            ]}
          />
        </View>
      </View>

      {/* Requirements Checklist */}
      <View style={styles.requirementsContainer}>
        <Text style={styles.requirementsTitle}>Completion Requirements:</Text>
        <View style={styles.requirementItem}>
          <Icon 
            name={checklistCompleted ? "check" : "x"} 
            size={16} 
            color={checklistCompleted ? COLORS.success : COLORS.error} 
          />
          <Text style={styles.requirementText}>Checklist Completed</Text>
        </View>
        <View style={styles.requirementItem}>
          <Icon 
            name={partsRecorded ? "check" : "x"} 
            size={16} 
            color={partsRecorded ? COLORS.success : COLORS.error} 
          />
          <Text style={styles.requirementText}>Parts Recorded</Text>
        </View>
        <View style={styles.requirementItem}>
          <Icon 
            name={workNotes.trim().length > 0 ? "check" : "x"} 
            size={16} 
            color={workNotes.trim().length > 0 ? COLORS.success : COLORS.error} 
          />
          <Text style={styles.requirementText}>Work Notes Entered</Text>
        </View>
      </View>

      {/* Work Notes Input */}
      <View style={styles.notesContainer}>
        <Text style={styles.notesLabel}>Work Notes *</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Enter work notes..."
          value={workNotes}
          onChangeText={setWorkNotes}
          multiline
          numberOfLines={4}
        />
      </View>

      {/* Photos Grid */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {photos.map((photo, index) => (
          <View key={photo.type} style={styles.photoCard}>
            <Text style={styles.photoLabel}>
              {photo.label}
              {photo.required && <Text style={styles.required}> *</Text>}
            </Text>
            
            {photo.uri ? (
              <View style={styles.photoPreview}>
                <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                {photo.uploading && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator size="small" color={COLORS.white} />
                  </View>
                )}
                {photo.uploaded && (
                  <View style={styles.uploadedBadge}>
                    <Icon name="check" size={16} color={COLORS.white} />
                  </View>
                )}
                {!photo.uploaded && !photo.uploading && (
                  <TouchableOpacity
                    style={styles.retakeButton}
                    onPress={() => takePhoto(index)}
                  >
                    <Text style={styles.retakeText}>Retake</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <TouchableOpacity
                style={styles.captureButton}
                onPress={() => takePhoto(index)}
                disabled={uploading}
              >
                <Icon name="camera" size={32} color={COLORS.primary} />
                <Text style={styles.captureText}>Capture Photo</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Complete Job Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.completeButton,
            (!canCompleteJob() || uploading) && styles.completeButtonDisabled,
          ]}
          onPress={handleCompleteJob}
          disabled={!canCompleteJob() || uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <>
              <Icon name="check" size={20} color={COLORS.white} />
              <Text style={styles.completeButtonText}>Mark Job Complete</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Odometer Modal */}
      <Modal
        visible={showOdometerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOdometerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Final Odometer Reading</Text>
            <TextInput
              style={styles.odometerInput}
              placeholder="Enter final odometer reading"
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
                <Text style={[styles.modalButtonText, styles.modalButtonTextSubmit]}>
                  Submit
                </Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  placeholder: {
    width: 40,
  },
  progressContainer: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  progressText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.gray[200],
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  requirementsContainer: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  requirementsTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  requirementText: {
    marginLeft: SPACING.sm,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
  notesContainer: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  notesLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
  },
  photoCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  photoLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  required: {
    color: COLORS.error,
  },
  photoPreview: {
    position: 'relative',
    width: '100%',
    height: 200,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadedBadge: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    backgroundColor: COLORS.success,
    borderRadius: BORDER_RADIUS.full,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retakeButton: {
    position: 'absolute',
    bottom: SPACING.xs,
    right: SPACING.xs,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  retakeText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  captureButton: {
    width: '100%',
    height: 150,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.gray[50],
  },
  captureText: {
    marginTop: SPACING.xs,
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  footer: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
  },
  completeButton: {
    backgroundColor: COLORS.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  completeButtonDisabled: {
    backgroundColor: COLORS.gray[300],
    opacity: 0.6,
  },
  completeButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    width: '80%',
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  odometerInput: {
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    marginBottom: SPACING.md,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.md,
  },
  modalButton: {
    paddingHorizontal: SPACING.lg,
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
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  modalButtonTextSubmit: {
    color: COLORS.white,
    fontWeight: '600',
  },
});

