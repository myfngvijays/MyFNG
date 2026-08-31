import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  BackHandler,
  Linking,
} from 'react-native';
import { takeGpsStampedPhoto } from '../../../lib/gpsPhotoStamp';
import * as Location from 'expo-location';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../constants/theme';
import { AC } from '../../../components/workshop/advisorCrmUi';
import { ENV } from '../../../config/environment';
import type { IncidentType } from '../../../../../shared/types';

interface Props {
  leadId: string;
  onBack: () => void;
  onSuccess: () => void;
  hideChrome?: boolean;
}

export default function IncidentReportScreen({ leadId, onBack, onSuccess, hideChrome = false }: Props) {
  // Handle hardware back button
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
  const [incidentType, setIncidentType] = useState<IncidentType | ''>('');
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [description, setDescription] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [advisorName, setAdvisorName] = useState('');
  const [advisorPhone, setAdvisorPhone] = useState('');

  useEffect(() => {
    const loadAdvisor = async () => {
      try {
        const { data: lead } = await supabase
          .from('service_leads')
          .select('assigned_supervisor_id, workshop_id')
          .eq('id', leadId)
          .maybeSingle();

        if (lead?.assigned_supervisor_id) {
          const { data: advisor } = await supabase
            .from('users_login')
            .select('full_name, phone')
            .eq('id', lead.assigned_supervisor_id)
            .maybeSingle();
          if (advisor?.phone) {
            setAdvisorPhone(String(advisor.phone));
            setAdvisorName(String(advisor.full_name || 'Advisor'));
            return;
          }
        }

        if (lead?.workshop_id) {
          const { data: staff } = await supabase
            .from('users_login')
            .select('full_name, phone, role:roles!role_id(role_code)')
            .eq('workshop_id', lead.workshop_id)
            .eq('is_active', true);

          const advisor = (staff || []).find(
            (s: any) => s?.role?.role_code === 'WORKSHOP_SUPERVISOR' && s?.phone,
          );
          if (advisor) {
            setAdvisorPhone(String(advisor.phone));
            setAdvisorName(String(advisor.full_name || 'Advisor'));
          }
        }
      } catch {
        // best-effort
      }
    };
    void loadAdvisor();
  }, [leadId]);

  const callAdvisor = () => {
    if (!advisorPhone) {
      Alert.alert('No number', 'Advisor contact not available.');
      return;
    }
    Linking.openURL(`tel:${advisorPhone}`).catch(() =>
      Alert.alert('Error', 'Could not start call'),
    );
  };

  const incidentTypes: { type: IncidentType; label: string; icon: string }[] = [
    { type: 'WRONG_CUSTOMER', label: 'Wrong Customer', icon: '👤' },
    { type: 'VEHICLE_NOT_AVAILABLE', label: 'Vehicle Not Available', icon: '🚗' },
    { type: 'CUSTOMER_REFUSED', label: 'Customer Refused', icon: '🚫' },
    { type: 'WRONG_ADDRESS', label: 'Wrong Address', icon: '📍' },
    { type: 'CUSTOMER_AGGRESSIVE', label: 'Customer Aggressive', icon: '⚠️' },
    { type: 'SAFETY_ISSUE', label: 'Safety Issue', icon: '🛑' },
    { type: 'ACCIDENT', label: 'Accident', icon: '💥' },
    { type: 'VEHICLE_DAMAGE', label: 'Vehicle Damage', icon: '🔧' },
    { type: 'OTHER', label: 'Other', icon: '📝' },
  ];

  const takePhoto = async () => {
    try {
      const stampedUri = await takeGpsStampedPhoto();
      if (stampedUri) setPhotos([...photos, stampedUri]);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to take photo');
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    newPhotos.splice(index, 1);
    setPhotos(newPhotos);
  };

  const handleSubmit = async () => {
    if (!incidentType) {
      Alert.alert('Error', 'Please select incident type');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please provide description');
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Get current location
      const location = await Location.getCurrentPositionAsync({});

      // Upload photos first
      const photoUrls: string[] = [];
      for (const photoUri of photos) {
        const filename = photoUri.split('/').pop() || 'incident.jpg';
        const filePath = `incidents/${leadId}/${Date.now()}_${filename}`;

        const response = await fetch(photoUri);
        const blob = await response.blob();

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('photos')
          .upload(filePath, blob, {
            contentType: 'image/jpeg',
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('photos')
          .getPublicUrl(filePath);

        photoUrls.push(publicUrlData.publicUrl);
      }

      // Create incident report
      const response = await fetch(
        `${ENV.API_URL}/api/pickup/${leadId}/report-incident`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            incident_type: incidentType,
            description,
            severity,
            location_address: locationAddress || null,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            photo_urls: photoUrls,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to report incident');
      }

      Alert.alert(
        'Incident Reported',
        'Admin and supervisor have been notified. They will contact you shortly.',
        [{ text: 'OK', onPress: onSuccess }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to report incident');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {!hideChrome && (
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report Incident</Text>
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {hideChrome ? (
          <TouchableOpacity onPress={onBack} style={styles.shellBack}>
            <Text style={styles.shellBackTxt}>← Back</Text>
          </TouchableOpacity>
        ) : null}

        {/* Warning */}
        <View style={styles.warningCard}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningText}>
            Report any issues immediately. Admin and supervisor will be notified.
          </Text>
        </View>

        {/* Incident Type */}
        <View style={AC.whiteCard}>
          <Text style={styles.sectionTitle}>Select Incident Type</Text>
          <View style={styles.typeGrid}>
            {incidentTypes.map((type) => (
              <TouchableOpacity
                key={type.type}
                style={[
                  styles.typeCard,
                  incidentType === type.type && styles.typeCardSelected,
                ]}
                onPress={() => setIncidentType(type.type)}
                activeOpacity={0.85}
              >
                <Text style={styles.typeIcon}>{type.icon}</Text>
                <Text
                  style={[
                    styles.typeLabel,
                    incidentType === type.type && styles.typeLabelSelected,
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Severity */}
        <View style={AC.whiteCard}>
          <Text style={styles.sectionTitle}>Severity Level</Text>
          <View style={styles.severityRow}>
            {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((level) => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.severityButton,
                  severity === level && styles.severityButtonSelected,
                  severity === level && { backgroundColor: getSeverityColor(level) },
                ]}
                onPress={() => setSeverity(level)}
              >
                <Text
                  style={[
                    styles.severityText,
                    severity === level && styles.severityTextSelected,
                  ]}
                >
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Description */}
        <View style={AC.whiteCard}>
          <Text style={styles.sectionTitle}>Description *</Text>
          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the incident in detail..."
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        {/* Location */}
        <View style={AC.whiteCard}>
          <Text style={styles.sectionTitle}>Location Address (Optional)</Text>
          <TextInput
            style={styles.input}
            value={locationAddress}
            onChangeText={setLocationAddress}
            placeholder="Enter location if different from pickup address"
            multiline
          />
        </View>

        {/* Photos */}
        <View style={AC.whiteCard}>
          <Text style={styles.sectionTitle}>Photos (Optional)</Text>
          <Text style={styles.helperText}>
            Camera opens with GPS stamp — location, coordinates, date & time on photo
          </Text>

          <View style={styles.photoGrid}>
            {photos.map((photoUri, index) => (
              <View key={index} style={styles.photoContainer}>
                <Image source={{ uri: photoUri }} style={styles.photoImage} />
                <TouchableOpacity
                  style={styles.removePhotoButton}
                  onPress={() => removePhoto(index)}
                >
                  <Text style={styles.removePhotoText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            {photos.length < 5 && (
              <TouchableOpacity style={styles.addPhotoButton} onPress={takePhoto}>
                <Text style={styles.addPhotoIcon}>📷</Text>
                <Text style={styles.addPhotoText}>Add Photo</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (loading || !incidentType || !description.trim()) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={loading || !incidentType || !description.trim()}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.submitButtonText}>Submit Incident Report</Text>
          )}
        </TouchableOpacity>

        {/* Emergency Contact */}
        <View style={styles.emergencyCard}>
          <Text style={styles.emergencyTitle}>🆘 Emergency Contact</Text>
          <Text style={styles.emergencyText}>
            For urgent safety issues, contact your service advisor:
          </Text>
          {advisorPhone ? (
            <TouchableOpacity onPress={callAdvisor} activeOpacity={0.85}>
              <Text style={styles.emergencyPhone}>
                Advisor{advisorName ? ` (${advisorName})` : ''}: {advisorPhone}
              </Text>
              <Text style={styles.tapCall}>Tap to call →</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.emergencyText}>Advisor number loading…</Text>
          )}
        </View>

        <View style={{ height: SPACING.xxl + 32 }} />
      </ScrollView>
    </View>
  );
}

const getSeverityColor = (severity: string) => {
  const colors: Record<string, string> = {
    LOW: COLORS.info,
    MEDIUM: COLORS.warning,
    HIGH: '#FF8C00',
    CRITICAL: COLORS.danger,
  };
  return colors[severity] || COLORS.gray[500];
};

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
  },
  scrollContent: {
    paddingBottom: SPACING.xxl + 24,
  },
  shellBack: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  shellBackTxt: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '800',
  },
  warningCard: {
    backgroundColor: COLORS.danger + '15',
    borderRadius: 14,
    padding: SPACING.md,
    marginHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.danger,
    ...SHADOWS.small,
  },
  warningIcon: {
    fontSize: 24,
    marginRight: SPACING.sm,
  },
  warningText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.danger,
    fontWeight: '600',
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
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: SPACING.sm,
  },
  typeCard: {
    width: '31.5%',
    minHeight: 92,
    paddingVertical: SPACING.sm,
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: COLORS.gray[200],
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  typeCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  typeIcon: {
    fontSize: 26,
    marginBottom: 4,
  },
  typeLabel: {
    fontSize: 10,
    color: COLORS.bodyText,
    textAlign: 'center',
    fontWeight: '700',
  },
  typeLabelSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  severityRow: {
    flexDirection: 'row',
    gap: 6,
  },
  severityButton: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
  },
  severityButtonSelected: {
    borderColor: 'transparent',
  },
  severityText: {
    fontSize: 10,
    color: COLORS.bodyText,
    fontWeight: '800',
  },
  severityTextSelected: {
    color: COLORS.white,
  },
  textArea: {
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    fontSize: FONT_SIZES.sm,
    backgroundColor: COLORS.white,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    fontSize: FONT_SIZES.sm,
    backgroundColor: COLORS.white,
  },
  helperText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[500],
    marginBottom: SPACING.md,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  photoContainer: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: BORDER_RADIUS.sm,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  addPhotoButton: {
    width: 100,
    height: 100,
    borderWidth: 2,
    borderColor: COLORS.gray[300],
    borderStyle: 'dashed',
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray[50],
  },
  addPhotoIcon: {
    fontSize: 32,
    marginBottom: SPACING.xs,
  },
  addPhotoText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[500],
  },
  submitButton: {
    marginHorizontal: 16,
    padding: SPACING.md,
    borderRadius: 12,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.gray[300],
  },
  submitButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
  },
  emergencyCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: SPACING.md,
    marginHorizontal: 16,
    marginBottom: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.danger,
    ...SHADOWS.small,
  },
  emergencyTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginBottom: SPACING.sm,
  },
  emergencyText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.bodyText,
    marginBottom: SPACING.xs,
  },
  emergencyPhone: {
    fontSize: FONT_SIZES.md,
    color: COLORS.danger,
    fontWeight: '800',
    marginTop: 4,
  },
  tapCall: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '700',
    marginTop: 4,
  },
});

