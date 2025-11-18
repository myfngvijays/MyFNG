import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';

export default function WorkshopProfileScreen({ workshopId }) {
  const [workshop, setWorkshop] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    gst_number: '',
    services_offered: '',
  });

  useEffect(() => {
    fetchWorkshopProfile();
  }, [workshopId]);

  const fetchWorkshopProfile = async () => {
    if (!workshopId) return;

    try {
      const { data, error } = await supabase
        .from('workshops')
        .select('*')
        .eq('id', workshopId)
        .single();

      if (error) throw error;

      setWorkshop(data);
      setFormData({
        name: data.name || '',
        contact_person: data.contact_person || '',
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        pincode: data.pincode || '',
        gst_number: data.gst_number || '',
        services_offered: data.services_offered || '',
      });
    } catch (error) {
      console.error('Error fetching workshop:', error);
      Alert.alert('Error', 'Failed to load workshop profile');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWorkshopProfile();
    setRefreshing(false);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.contact_person || !formData.phone) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('workshops')
        .update({
          ...formData,
          updated_at: new Date().toISOString()
        })
        .eq('id', workshopId);

      if (error) throw error;

      Alert.alert('Success', 'Workshop profile updated successfully');
      setEditing(false);
      fetchWorkshopProfile();
    } catch (error: any) {
      console.error('Error updating workshop:', error);
      Alert.alert('Error', error.message || 'Failed to update workshop profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: workshop.name || '',
      contact_person: workshop.contact_person || '',
      phone: workshop.phone || '',
      email: workshop.email || '',
      address: workshop.address || '',
      city: workshop.city || '',
      state: workshop.state || '',
      pincode: workshop.pincode || '',
      gst_number: workshop.gst_number || '',
      services_offered: workshop.services_offered || '',
    });
    setEditing(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading workshop profile...</Text>
      </View>
    );
  }

  if (!workshop) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No workshop profile found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Workshop Profile</Text>
        <Text style={styles.subtitle}>Manage workshop information</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {/* Workshop Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Verification Status</Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: workshop.is_verified ? COLORS.success : COLORS.warning }
            ]}>
              <Text style={styles.statusText}>
                {workshop.is_verified ? '✓ Verified' : '⏳ Pending'}
              </Text>
            </View>
          </View>
          {workshop.audit_score && (
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Audit Score</Text>
              <Text style={styles.scoreText}>⭐ {workshop.audit_score}/5</Text>
            </View>
          )}
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <View style={styles.field}>
            <Text style={styles.label}>Workshop Name *</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({...formData, name: text})}
                placeholder="Enter workshop name"
                placeholderTextColor={COLORS.gray[400]}
              />
            ) : (
              <Text style={styles.value}>{workshop.name}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Contact Person *</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={formData.contact_person}
                onChangeText={(text) => setFormData({...formData, contact_person: text})}
                placeholder="Enter contact person name"
                placeholderTextColor={COLORS.gray[400]}
              />
            ) : (
              <Text style={styles.value}>{workshop.contact_person}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Phone *</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={formData.phone}
                onChangeText={(text) => setFormData({...formData, phone: text})}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
                placeholderTextColor={COLORS.gray[400]}
              />
            ) : (
              <Text style={styles.value}>📞 {workshop.phone}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={formData.email}
                onChangeText={(text) => setFormData({...formData, email: text})}
                placeholder="Enter email"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={COLORS.gray[400]}
              />
            ) : (
              <Text style={styles.value}>✉️ {workshop.email || 'Not provided'}</Text>
            )}
          </View>
        </View>

        {/* Address Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address</Text>
          
          <View style={styles.field}>
            <Text style={styles.label}>Street Address</Text>
            {editing ? (
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.address}
                onChangeText={(text) => setFormData({...formData, address: text})}
                placeholder="Enter street address"
                multiline
                numberOfLines={3}
                placeholderTextColor={COLORS.gray[400]}
              />
            ) : (
              <Text style={styles.value}>{workshop.address || 'Not provided'}</Text>
            )}
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1, marginRight: SPACING.sm }]}>
              <Text style={styles.label}>City</Text>
              {editing ? (
                <TextInput
                  style={styles.input}
                  value={formData.city}
                  onChangeText={(text) => setFormData({...formData, city: text})}
                  placeholder="City"
                  placeholderTextColor={COLORS.gray[400]}
                />
              ) : (
                <Text style={styles.value}>{workshop.city || 'N/A'}</Text>
              )}
            </View>

            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>State</Text>
              {editing ? (
                <TextInput
                  style={styles.input}
                  value={formData.state}
                  onChangeText={(text) => setFormData({...formData, state: text})}
                  placeholder="State"
                  placeholderTextColor={COLORS.gray[400]}
                />
              ) : (
                <Text style={styles.value}>{workshop.state || 'N/A'}</Text>
              )}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Pincode</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={formData.pincode}
                onChangeText={(text) => setFormData({...formData, pincode: text})}
                placeholder="Enter pincode"
                keyboardType="number-pad"
                placeholderTextColor={COLORS.gray[400]}
              />
            ) : (
              <Text style={styles.value}>{workshop.pincode || 'Not provided'}</Text>
            )}
          </View>
        </View>

        {/* Business Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business Information</Text>
          
          <View style={styles.field}>
            <Text style={styles.label}>GST Number</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={formData.gst_number}
                onChangeText={(text) => setFormData({...formData, gst_number: text})}
                placeholder="Enter GST number"
                autoCapitalize="characters"
                placeholderTextColor={COLORS.gray[400]}
              />
            ) : (
              <Text style={styles.value}>{workshop.gst_number || 'Not provided'}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Services Offered</Text>
            {editing ? (
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.services_offered}
                onChangeText={(text) => setFormData({...formData, services_offered: text})}
                placeholder="Enter services offered"
                multiline
                numberOfLines={3}
                placeholderTextColor={COLORS.gray[400]}
              />
            ) : (
              <Text style={styles.value}>{workshop.services_offered || 'Not provided'}</Text>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        {editing ? (
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={[styles.button, styles.editButton]}
            onPress={() => setEditing(true)}
          >
            <Text style={styles.editButtonText}>✏️ Edit Profile</Text>
          </TouchableOpacity>
        )}
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
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[600],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
  },
  header: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.white,
    opacity: 0.9,
    marginTop: SPACING.xs,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl + SPACING.lg,
  },
  statusCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statusLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.white,
    fontWeight: '600',
  },
  scoreText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  section: {
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
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginBottom: SPACING.md,
  },
  field: {
    marginBottom: SPACING.md,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.heading,
    marginBottom: SPACING.xs,
  },
  value: {
    fontSize: FONT_SIZES.md,
    color: COLORS.bodyText,
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.bodyText,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  button: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: COLORS.primary,
    marginTop: SPACING.lg,
  },
  editButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: COLORS.gray[200],
  },
  cancelButtonText: {
    color: COLORS.gray[700],
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
});

