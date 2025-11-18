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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../../constants/theme';
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

export default function PhotoUploadScreen({
  leadId,
  photoCategory,
  onBack,
  onComplete,
}: Props) {
  const [photos, setPhotos] = useState<PhotoState[]>([]);
  const [odometerReading, setOdometerReading] = useState('');
  const [fuelLevel, setFuelLevel] = useState<FuelLevel>('HALF');
  const [damageDescription, setDamageDescription] = useState('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    requestPermissions();
    getLocation();
    initializePhotos();
    fetchExistingPhotos();
  }, []);

  const initializePhotos = () => {
    const photoTypes: VehiclePhotoType[] = photoCategory === 'PICKUP'
      ? ['PICKUP_FRONT', 'PICKUP_LEFT', 'PICKUP_RIGHT', 'PICKUP_REAR', 'PICKUP_INTERIOR', 'PICKUP_ODOMETER', 'PICKUP_FUEL', 'PICKUP_DAMAGE']
      : ['DROP_FRONT', 'DROP_LEFT', 'DROP_RIGHT', 'DROP_REAR', 'DROP_INTERIOR', 'DROP_ODOMETER', 'AFTER_WORK'];

    setPhotos(
      photoTypes.map((type) => ({
        type,
        uri: null,
        uploaded: false,
        uploading: false,
      }))
    );
  };

  const fetchExistingPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicle_condition_photos')
        .select('photo_type, photo_url')
        .eq('lead_id', leadId)
        .like('photo_type', `${photoCategory}_%`);

      if (error) throw error;

      if (data && data.length > 0) {
        setPhotos((prevPhotos) =>
          prevPhotos.map((photo) => {
            const existing = data.find((d) => d.photo_type === photo.type);
            if (existing) {
              return { ...photo, uri: existing.photo_url, uploaded: true };
            }
            return photo;
          })
        );
      }
    } catch (error) {
      console.error('Error fetching existing photos:', error);
    }
  };

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();

    if (cameraStatus !== 'granted' || mediaStatus !== 'granted' || locationStatus !== 'granted') {
      Alert.alert('Permissions Required', 'Please grant camera, media library, and location permissions to continue');
    }
  };

  const getLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const takePhoto = async (index: number) => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const newPhotos = [...photos];
        newPhotos[index].uri = result.assets[0].uri;
        setPhotos(newPhotos);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
      console.error(error);
    }
  };

  const uploadPhoto = async (index: number) => {
    const photo = photos[index];
    if (!photo.uri || photo.uploaded || photo.uploading) return;

    const newPhotos = [...photos];
    newPhotos[index].uploading = true;
    setPhotos(newPhotos);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Create form data
      const formData = new FormData();
      const filename = photo.uri.split('/').pop() || 'photo.jpg';
      
      // @ts-ignore - React Native FormData handles this
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

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/pickup/${leadId}/upload-photos`,
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
      setPhotos(newPhotos);

      Alert.alert('Success', 'Photo uploaded successfully');
    } catch (error: any) {
      newPhotos[index].uploading = false;
      setPhotos(newPhotos);
      Alert.alert('Error', error.message || 'Failed to upload photo');
    }
  };

  const getPhotoLabel = (type: VehiclePhotoType): string => {
    const labels: Record<VehiclePhotoType, string> = {
      PICKUP_FRONT: 'Front View',
      PICKUP_LEFT: 'Left Side',
      PICKUP_RIGHT: 'Right Side',
      PICKUP_REAR: 'Rear View',
      PICKUP_INTERIOR: 'Interior',
      PICKUP_ODOMETER: 'Odometer',
      PICKUP_FUEL: 'Fuel Level',
      PICKUP_DAMAGE: 'Damages (if any)',
      DROP_FRONT: 'Front View',
      DROP_LEFT: 'Left Side',
      DROP_RIGHT: 'Right Side',
      DROP_REAR: 'Rear View',
      DROP_INTERIOR: 'Interior',
      DROP_ODOMETER: 'Odometer',
      AFTER_WORK: 'After Service',
    };
    return labels[type] || type;
  };

  const isRequired = (type: VehiclePhotoType): boolean => {
    if (photoCategory === 'PICKUP') {
      return ['PICKUP_FRONT', 'PICKUP_LEFT', 'PICKUP_RIGHT', 'PICKUP_INTERIOR'].includes(type);
    } else {
      return ['DROP_FRONT', 'DROP_INTERIOR', 'AFTER_WORK'].includes(type);
    }
  };

  const allRequiredPhotosUploaded = () => {
    return photos
      .filter((photo) => isRequired(photo.type))
      .every((photo) => photo.uploaded);
  };

  const handleComplete = () => {
    if (!allRequiredPhotosUploaded()) {
      Alert.alert('Error', 'Please upload all required photos');
      return;
    }

    Alert.alert('Success', 'All photos uploaded successfully!', [
      { text: 'OK', onPress: onComplete },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {photoCategory === 'PICKUP' ? 'Pickup' : 'Drop'} Photos
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>📸 Instructions:</Text>
          <Text style={styles.instructionText}>
            • Take clear photos in good lighting
          </Text>
          <Text style={styles.instructionText}>
            • Capture all angles of the vehicle
          </Text>
          <Text style={styles.instructionText}>
            • Photos marked with * are required
          </Text>
          <Text style={styles.instructionText}>
            • Upload photos immediately after taking
          </Text>
        </View>

        {/* Additional Info */}
        {photoCategory === 'PICKUP' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Vehicle Information</Text>
            
            <Text style={styles.label}>Odometer Reading (km)</Text>
            <TextInput
              style={styles.input}
              value={odometerReading}
              onChangeText={setOdometerReading}
              placeholder="Enter odometer reading"
              keyboardType="number-pad"
            />

            <Text style={styles.label}>Fuel Level</Text>
            <View style={styles.fuelOptions}>
              {(['EMPTY', 'QUARTER', 'HALF', 'THREE_QUARTER', 'FULL'] as FuelLevel[]).map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.fuelOption,
                    fuelLevel === level && styles.fuelOptionSelected,
                  ]}
                  onPress={() => setFuelLevel(level)}
                >
                  <Text
                    style={[
                      styles.fuelOptionText,
                      fuelLevel === level && styles.fuelOptionTextSelected,
                    ]}
                  >
                    {level.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Damage Description (if any)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={damageDescription}
              onChangeText={setDamageDescription}
              placeholder="Describe any visible damages"
              multiline
              numberOfLines={3}
            />
          </View>
        )}

        {/* Photo Grid */}
        <View style={styles.photoGrid}>
          {photos.map((photo, index) => (
            <View key={photo.type} style={styles.photoCard}>
              <View style={styles.photoHeader}>
                <Text style={styles.photoLabel}>
                  {getPhotoLabel(photo.type)}
                  {isRequired(photo.type) && (
                    <Text style={styles.required}> *</Text>
                  )}
                </Text>
                {photo.uploaded && (
                  <Text style={styles.uploadedBadge}>✓ Uploaded</Text>
                )}
              </View>

              {photo.uri ? (
                <View style={styles.photoPreview}>
                  <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                  {!photo.uploaded && (
                    <View style={styles.photoOverlay}>
                      <TouchableOpacity
                        style={styles.retakeButton}
                        onPress={() => takePhoto(index)}
                      >
                        <Text style={styles.retakeButtonText}>Retake</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.uploadButton,
                          photo.uploading && styles.uploadButtonDisabled,
                        ]}
                        onPress={() => uploadPhoto(index)}
                        disabled={photo.uploading}
                      >
                        {photo.uploading ? (
                          <ActivityIndicator color={COLORS.white} size="small" />
                        ) : (
                          <Text style={styles.uploadButtonText}>Upload</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.photoPlaceholder}
                  onPress={() => takePhoto(index)}
                >
                  <Text style={styles.photoPlaceholderIcon}>📷</Text>
                  <Text style={styles.photoPlaceholderText}>Take Photo</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Complete Button */}
        {allRequiredPhotosUploaded() && (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={handleComplete}
          >
            <Text style={styles.completeButtonText}>✓ All Photos Uploaded</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </View>
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
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  backButton: {
    padding: SPACING.sm,
  },
  backButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginLeft: SPACING.sm,
  },
  content: {
    flex: 1,
    padding: SPACING.md,
  },
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
  instructionText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.bodyText,
    marginBottom: 4,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.heading,
    marginBottom: SPACING.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    fontSize: FONT_SIZES.sm,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.white,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  fuelOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: SPACING.md,
  },
  fuelOption: {
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.sm,
    marginRight: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  fuelOptionSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  fuelOptionText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.bodyText,
  },
  fuelOptionTextSelected: {
    color: COLORS.white,
    fontWeight: '600',
  },
  photoGrid: {
    marginBottom: SPACING.md,
  },
  photoCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  photoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  photoLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.heading,
  },
  required: {
    color: COLORS.danger,
  },
  uploadedBadge: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.success,
    fontWeight: '600',
  },
  photoPreview: {
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: 200,
    borderRadius: BORDER_RADIUS.sm,
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  retakeButton: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.gray[600],
    alignItems: 'center',
  },
  retakeButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.white,
  },
  uploadButton: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  uploadButtonDisabled: {
    backgroundColor: COLORS.gray[300],
  },
  uploadButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.white,
  },
  photoPlaceholder: {
    height: 200,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 2,
    borderColor: COLORS.gray[300],
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray[50],
  },
  photoPlaceholderIcon: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  photoPlaceholderText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
  },
  completeButton: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  completeButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
  },
});

