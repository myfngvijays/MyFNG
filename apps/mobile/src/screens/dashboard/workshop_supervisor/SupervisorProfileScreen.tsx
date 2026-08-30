import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { COLORS, SPACING, SHADOWS } from '../../../constants/theme';
import { formatDateDMY, formatDateTime } from '../../../lib/dateFormat';

function splitFullName(full: string): { first: string; last: string } {
  const t = String(full || '').trim();
  if (!t) return { first: '', last: '' };
  const i = t.indexOf(' ');
  if (i < 0) return { first: t, last: '' };
  return { first: t.slice(0, i), last: t.slice(i + 1).trim() };
}

function joinName(first: string, last: string): string {
  return [first, last]
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join(' ');
}

export default function SupervisorProfileScreen() {
  const { refreshUserProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [loginTotal, setLoginTotal] = useState(0);
  const [loginRecent, setLoginRecent] = useState<any[]>([]);
  const [loginLoading, setLoginLoading] = useState(true);

  const fetchUserProfile = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from('users_login')
        .select(
          `
          *,
          role:role_id(role_name, role_code),
          workshop:workshops(name, city, address, state, pincode)
        `,
        )
        .eq('id', user.id)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);
        const fromCols = joinName(profileData.first_name || '', profileData.last_name || '');
        const parts = fromCols
          ? { first: String(profileData.first_name || '').trim(), last: String(profileData.last_name || '').trim() }
          : splitFullName(profileData.full_name || '');
        setFirstName(parts.first);
        setLastName(parts.last);
        setPhone(profileData.phone || '');
        await refreshUserProfile();
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }, [refreshUserProfile]);

  const fetchLoginHistory = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchUserProfile();
    fetchLoginHistory();
  }, [fetchUserProfile, fetchLoginHistory]);

  const handleSave = async () => {
    if (!profile?.id) return;
    setSaving(true);
    try {
      const fullName = joinName(firstName, lastName);
      await apiFetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone,
        }),
      });
      await refreshUserProfile();
      Alert.alert('Saved', 'Name updated on Home and menu too');
      setIsEditing(false);
      await fetchUserProfile();
    } catch {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      const fromCols = joinName(profile.first_name || '', profile.last_name || '');
      const parts = fromCols
        ? { first: String(profile.first_name || '').trim(), last: String(profile.last_name || '').trim() }
        : splitFullName(profile.full_name || '');
      setFirstName(parts.first);
      setLastName(parts.last);
      setPhone(profile.phone || '');
    }
    setIsEditing(false);
  };

  const workshop = profile?.workshop;
  const workshopLine = [workshop?.address, workshop?.city, workshop?.state, workshop?.pincode]
    .filter(Boolean)
    .join(', ');
  const active = profile?.is_active !== false;

  if (loading && !profile) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => {
            setLoading(true);
            fetchUserProfile();
            fetchLoginHistory();
          }}
          colors={[COLORS.primary]}
        />
      }
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sub}>Name, phone, and workshop details</Text>
        </View>
        {!isEditing ? (
          <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditing(true)}>
            <Ionicons name="create-outline" size={16} color="#fff" />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.saveBtn} onPress={() => handleSave()} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.editBtnText}>Save</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} disabled={saving}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.premiumCard}>
        <View style={styles.premiumTop}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Image
                source={require('../../../../assets/profile-default.png')}
                style={styles.avatarLogo}
                resizeMode="cover"
              />
            </View>
            <View style={[styles.floorBadge, active ? styles.floorOn : styles.floorOff]}>
              <Text style={[styles.floorBadgeText, active ? styles.floorOnText : styles.floorOffText]}>
                {active ? 'Active' : 'Inactive'}
              </Text>
            </View>
            <Text style={styles.premiumHint}>MyFNG brand icon</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.premiumLabel}>First Name</Text>
            {isEditing ? (
              <TextInput
                style={styles.premiumInput}
                value={firstName}
                onChangeText={setFirstName}
                placeholderTextColor="rgba(255,255,255,0.5)"
              />
            ) : (
              <Text style={styles.premiumValue}>{firstName || '—'}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.premiumLabel}>Last Name</Text>
            {isEditing ? (
              <TextInput
                style={styles.premiumInput}
                value={lastName}
                onChangeText={setLastName}
                placeholderTextColor="rgba(255,255,255,0.5)"
              />
            ) : (
              <Text style={styles.premiumValue}>{lastName || '—'}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.premiumLabel}>Email</Text>
            <Text style={styles.premiumValue} numberOfLines={2}>
              {profile?.email || '—'}
            </Text>
            <Text style={styles.premiumHint}>Email cannot be changed</Text>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.premiumLabel}>Phone</Text>
              {isEditing ? (
                <TextInput
                  style={styles.premiumInput}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                />
              ) : (
                <Text style={styles.premiumValue}>{profile?.phone || 'Not provided'}</Text>
              )}
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.premiumLabel}>Workshop</Text>
              <Text style={styles.premiumValue} numberOfLines={2}>
                {workshop?.name || 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.premiumMeta}>
          <View style={{ flex: 1 }}>
            <Text style={styles.metaLabel}>Role</Text>
            <Text style={styles.metaValue}>{profile?.role?.role_name || 'Workshop Advisor'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.metaLabel}>Since</Text>
            <Text style={styles.metaValue}>
              {profile?.created_at ? formatDateDMY(profile.created_at) : '—'}
            </Text>
          </View>
        </View>
        {workshopLine ? (
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={14} color={COLORS.primary} />
            <Text style={styles.addressText}>{workshopLine}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.loginCard}>
        <View style={styles.loginHeader}>
          <Text style={styles.loginTitle}>Login History</Text>
          <Text style={styles.loginTotal}>{loginLoading ? '…' : `${loginTotal} total`}</Text>
        </View>
        {loginLoading ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : loginRecent.length === 0 ? (
          <Text style={styles.loginEmpty}>No login history yet. Sign in again to start recording.</Text>
        ) : (
          loginRecent.slice(0, 20).map((row) => (
            <View key={String(row.id)} style={styles.loginRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.loginTime}>{formatDateTime(row.logged_in_at)}</Text>
                {row.location_label || row.city || row.device_label ? (
                  <Text style={styles.loginMeta} numberOfLines={1}>
                    {[row.location_label || row.city, row.device_label].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.loginPlatform}>{String(row.platform || 'app').replace(/_/g, ' ')}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: SPACING.md, paddingTop: 4, paddingBottom: 40 },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    gap: 8,
  },
  loadingText: { color: COLORS.textSecondary, fontSize: 14 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  sub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  editActions: { flexDirection: 'row', gap: 6 },
  saveBtn: {
    backgroundColor: COLORS.green,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 56,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  editBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  cancelBtnText: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 13 },
  premiumCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,74,173,0.25)',
    ...SHADOWS.small,
  },
  premiumTop: {
    backgroundColor: '#004AAD',
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 14,
  },
  premiumMeta: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#F0F7FF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,74,173,0.12)',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F0F7FF',
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  addressText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#023D95' },
  premiumLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(219,234,254,0.95)',
    marginBottom: 2,
  },
  premiumValue: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  premiumHint: { fontSize: 10, color: 'rgba(191,219,254,0.85)', marginTop: 2 },
  premiumInput: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  metaLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(0,74,173,0.7)', marginBottom: 2 },
  metaValue: { fontSize: 14, fontWeight: '800', color: '#023D95' },
  avatarWrap: { alignItems: 'center', marginBottom: 12 },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  avatarLogo: { width: 76, height: 76 },
  floorBadge: {
    marginTop: 10,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  floorOn: {
    backgroundColor: 'rgba(52,211,153,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(110,231,183,0.5)',
  },
  floorOff: {
    backgroundColor: 'rgba(251,191,36,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.5)',
  },
  floorBadgeText: { fontSize: 11, fontWeight: '800' },
  floorOnText: { color: '#D1FAE5' },
  floorOffText: { color: '#FEF3C7' },
  fieldRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  fieldHalf: { flex: 1, minWidth: 0 },
  field: { marginBottom: 12 },
  loginCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,74,173,0.12)',
    ...SHADOWS.small,
  },
  loginHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  loginTitle: { fontSize: 16, fontWeight: '800', color: '#023D95' },
  loginTotal: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  loginEmpty: { fontSize: 13, color: COLORS.textSecondary, paddingVertical: 8 },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  loginTime: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  loginMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  loginPlatform: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'capitalize' },
});
