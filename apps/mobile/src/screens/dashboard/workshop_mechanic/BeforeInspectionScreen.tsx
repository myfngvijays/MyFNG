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
  BackHandler,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../../constants/theme';
import Icon from '../../../components/Icon';
import { useNavigation } from '@react-navigation/native';

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

const REQUIRED_PHOTOS = [
  { type: 'BEFORE_FRONT', label: 'Front View', required: true },
  { type: 'BEFORE_REAR', label: 'Rear View', required: true },
  { type: 'BEFORE_LEFT', label: 'Left Side', required: true },
  { type: 'BEFORE_RIGHT', label: 'Right Side', required: true },
  { type: 'BEFORE_DASHBOARD', label: 'Dashboard & Odometer', required: true },
  { type: 'BEFORE_ENGINE_BAY', label: 'Engine Bay', required: true },
  { type: 'BEFORE_DAMAGE', label: 'Visible Damages (Optional)', required: false },
  { type: 'BEFORE_TYRE', label: 'Tyres (Optional)', required: false },
];

export default function BeforeInspectionScreen({ route }: Props) {
  const navigation = useNavigation();
  const { jobId, leadId } = route.params;
  const { user } = useAuth();
  const [photos, setPhotos] = useState<PhotoState[]>([]);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsWarning, setGpsWarning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [odometerReading, setOdometerReading] = useState('');
  const [showOdometerModal, setShowOdometerModal] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [job, setJob] = useState<any>(null);

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
    requestPermissions();
    getLocation();
    initializePhotos();
    fetchJobDetails();
    fetchExistingPhotos();
  }, []);

  const initializePhotos = () => {
    setPhotos(
      REQUIRED_PHOTOS.map((photo) => ({
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
        .eq('photo_category', 'before');

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

        // Set odometer reading if dashboard photo exists
        const dashboardPhoto = data.find((d) => d.photo_type === 'BEFORE_DASHBOARD');
        if (dashboardPhoto?.odometer_reading) {
          setOdometerReading(dashboardPhoto.odometer_reading.toString());
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

    if (locationStatus !== 'granted') {
      setGpsWarning(true);
    }
  };

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsWarning(true);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      setGpsWarning(false);
    } catch (error) {
      setGpsWarning(true);
    }
  };

  const takePhoto = async (index: number) => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        exif: true, // Capture EXIF data including GPS
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const newPhotos = [...photos];
        newPhotos[index].uri = asset.uri;
        setPhotos(newPhotos);

        // Check for GPS in EXIF
        if (!asset.exif?.GPSLatitude || !asset.exif?.GPSLongitude) {
          setGpsWarning(true);
        } else {
          setLocation({
            latitude: asset.exif.GPSLatitude,
            longitude: asset.exif.GPSLongitude,
          });
          setGpsWarning(false);
        }

        // If it's dashboard photo, show odometer input
        if (photos[index].type === 'BEFORE_DASHBOARD') {
          setSelectedPhotoIndex(index);
          setShowOdometerModal(true);
        } else {
          // Auto-upload other photos
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

      // Create form data
      const formData = new FormData();
      const filename = photoUri.split('/').pop() || 'photo.jpg';
      
      // @ts-ignore - React Native FormData handles this
      formData.append('file', {
        uri: photoUri,
        name: filename,
        type: 'image/jpeg',
      });
      
      formData.append('photo_type', photo.type);
      formData.append('photo_category', 'before');
      
      if (photo.type === 'BEFORE_DASHBOARD' && odometerReading) {
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

      // Check if all required photos are uploaded
      checkCompletion();
    } catch (error: any) {
      newPhotos[index].uploading = false;
      setPhotos(newPhotos);
      setUploading(false);
      Alert.alert('Error', error.message || 'Failed to upload photo');
    }
  };

  const checkCompletion = async () => {
    const requiredPhotos = photos.filter((p) => p.required);
    const uploadedRequired = requiredPhotos.filter((p) => p.uploaded);
    
    if (uploadedRequired.length >= 6) {
      // All required photos uploaded
      // The trigger will update before_inspection_complete
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

  const canStartRepair = () => {
    const requiredPhotos = photos.filter((p) => p.required);
    const uploadedRequired = requiredPhotos.filter((p) => p.uploaded);
    return uploadedRequired.length >= 6;
  };

  const handleStartRepair = async () => {
    if (!canStartRepair()) {
      Alert.alert(
        'Incomplete Inspection',
        'Please upload all required photos (minimum 6) before starting repair.'
      );
      return;
    }

    if (gpsWarning) {
      Alert.alert(
        'GPS Warning',
        'Some photos may be missing GPS data. This is not blocking, but GPS is recommended for location verification.',
        [
          { text: 'Continue Anyway', onPress: () => proceedWithStart() },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else {
      proceedWithStart();
    }
  };

  const proceedWithStart = async () => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/mechanic/jobs/${leadId}/status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            status: 'IN_PROGRESS',
            notes: 'Before inspection completed, starting repair',
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start repair');
      }

      Alert.alert('Success', 'Repair started successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to start repair');
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
        <Text style={styles.headerTitle}>Before Inspection</Text>
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

      {/* GPS Warning */}
      {gpsWarning && (
        <View style={styles.warningContainer}>
          <Icon name="alert-triangle" size={20} color={COLORS.warning} />
          <Text style={styles.warningText}>
            GPS data missing. Location verification recommended but not required.
          </Text>
        </View>
      )}

      {/* Job Info */}
      {job && (
        <View style={styles.jobInfo}>
          <Text style={styles.jobInfoText}>
            {job.service_leads?.lead_number} - {job.service_leads?.vehicle_number}
          </Text>
        </View>
      )}

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

      {/* Start Repair Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.startButton,
            (!canStartRepair() || uploading) && styles.startButtonDisabled,
          ]}
          onPress={handleStartRepair}
          disabled={!canStartRepair() || uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <>
              <Icon name="play" size={20} color={COLORS.white} />
              <Text style={styles.startButtonText}>Start Repair</Text>
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
            <Text style={styles.modalTitle}>Enter Odometer Reading</Text>
            <TextInput
              style={styles.odometerInput}
              placeholder="Enter odometer reading"
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
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.warning + '20',
    margin: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  warningText: {
    marginLeft: SPACING.sm,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    flex: 1,
  },
  jobInfo: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  jobInfoText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
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
  startButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  startButtonDisabled: {
    backgroundColor: COLORS.gray[300],
    opacity: 0.6,
  },
  startButtonText: {
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

