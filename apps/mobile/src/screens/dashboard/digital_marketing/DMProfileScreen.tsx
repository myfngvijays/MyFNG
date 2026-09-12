import React, { useEffect, useState } from 'react';
import { formatDateDMY, formatDateTime } from '@/lib/dateFormat';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { apiFetch } from '../../../lib/api';
import { COLORS } from '../../../constants/theme';

type UserProfile = {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  profile_image: string | null;
  department: string | null;
  is_active: boolean;
  created_at: string;
  last_login?: string | null;
  role?: { role_name: string; role_code: string };
};

export default function DMProfileScreen() {
  const navigation = useNavigation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loginTotal, setLoginTotal] = useState(0);
  const [loginRecent, setLoginRecent] = useState<any[]>([]);
  const [loginLoading, setLoginLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');

  useEffect(() => {
    void fetchProfile();
    void fetchLoginHistory();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<any>('/api/profile');
      const p = data?.profile;
      if (p) {
        setProfile(p);
        setFullName(p.full_name || '');
        setPhone(p.phone || '');
        setDepartment(p.department || '');
      }
    } catch {
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchLoginHistory = async () => {
    setLoginLoading(true);
    try {
      const data = await apiFetch<any>('/api/profile/login-history');
      setLoginTotal(Number(data?.total || 0));
      setLoginRecent(Array.isArray(data?.recent) ? data.recent : []);
    } catch {
      setLoginTotal(0);
      setLoginRecent([]);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiFetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          phone,
          department,
          profile_image: null,
        }),
      });
      Alert.alert('Success', 'Profile updated');
      setIsEditing(false);
      await fetchProfile();
    } catch {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setDepartment(profile.department || '');
    }
    setIsEditing(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Profile not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => (navigation as any).goBack()}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>My Profile</Text>
          <Text style={styles.headerSubtitle}>Same layout as Telecaller profile</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.imageSection}>
        <View style={styles.imageContainer}>
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>
              {(profile.full_name || 'M').charAt(0).toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: profile.is_active ? COLORS.success : COLORS.danger }]}>
          <Text style={styles.statusText}>{profile.is_active ? 'Active' : 'Inactive'}</Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        {!isEditing ? (
          <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.saveButton} onPress={() => void handleSave()} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={saving}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personal Information</Text>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Full Name</Text>
          {isEditing ? (
            <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />
          ) : (
            <Text style={styles.fieldValue}>{profile.full_name}</Text>
          )}
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Email Address</Text>
          <Text style={styles.fieldValue}>{profile.email}</Text>
          <Text style={styles.fieldHint}>Email cannot be changed</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Phone Number</Text>
          {isEditing ? (
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          ) : (
            <Text style={styles.fieldValue}>{profile.phone || 'Not provided'}</Text>
          )}
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Department</Text>
          {isEditing ? (
            <TextInput style={styles.input} value={department} onChangeText={setDepartment} />
          ) : (
            <Text style={styles.fieldValue}>{profile.department || 'Not specified'}</Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Information</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Role:</Text>
          <Text style={styles.infoValue}>{profile.role?.role_name || 'Digital Marketing'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Role Code:</Text>
          <Text style={styles.infoValue}>{profile.role?.role_code || 'DIGITAL_MARKETING'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Member Since:</Text>
          <Text style={styles.infoValue}>{formatDateDMY(profile.created_at)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.loginHeader}>
          <Text style={styles.sectionTitle}>Login History</Text>
          <Text style={styles.loginTotal}>{loginLoading ? '…' : `${loginTotal} total`}</Text>
        </View>
        {loginLoading ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : loginRecent.length === 0 ? (
          <Text style={styles.statsHint}>No login history yet</Text>
        ) : (
          loginRecent.slice(0, 20).map((row) => (
            <View key={String(row.id)} style={styles.loginRow}>
              <Text style={styles.loginTime}>{formatDateTime(row.logged_in_at)}</Text>
              <Text style={styles.loginPlatform}>{String(row.platform || 'web')}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: 10, fontSize: 16, color: COLORS.textSecondary },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  errorText: { fontSize: 16, color: COLORS.danger },
  header: {
    backgroundColor: COLORS.primary,
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  backArrow: { color: '#fff', fontSize: 28, lineHeight: 30, marginTop: -4 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.white },
  headerSubtitle: { fontSize: 12, color: COLORS.white, marginTop: 2, opacity: 0.9 },
  imageSection: { alignItems: 'center', marginTop: -30, marginBottom: 20 },
  imageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.white,
    padding: 4,
    elevation: 5,
  },
  placeholderImage: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: { fontSize: 48, fontWeight: 'bold', color: COLORS.white },
  statusBadge: { marginTop: 10, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  statusText: { color: COLORS.white, fontSize: 12, fontWeight: '600' },
  actionButtons: { paddingHorizontal: 20, marginBottom: 20 },
  editButton: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  editButtonText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  editActions: { flexDirection: 'row', gap: 10 },
  saveButton: { flex: 1, backgroundColor: COLORS.success, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  saveButtonText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  cancelButton: { flex: 1, backgroundColor: COLORS.danger, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  cancelButtonText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  section: {
    backgroundColor: COLORS.white,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 15 },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  fieldValue: { fontSize: 16, color: COLORS.textPrimary, fontWeight: '500' },
  fieldHint: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: { fontSize: 14, color: COLORS.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  loginHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  loginTotal: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  loginTime: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, flex: 1 },
  loginPlatform: { fontSize: 12, color: COLORS.textSecondary, textTransform: 'capitalize' },
  statsHint: { fontSize: 12, color: COLORS.textSecondary },
});
