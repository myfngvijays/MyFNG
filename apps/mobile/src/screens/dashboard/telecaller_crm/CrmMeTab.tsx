import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING, SHADOWS } from '../../../constants/theme';
import { formatDateDMY } from '../../../lib/dateFormat';

const AANSH_SESSION_KEY = 'myfng:aansh_session';

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

type Props = {
  navigation: any;
  active?: boolean;
  isLeadManager?: boolean;
};

export default function CrmMeTab({ navigation, active = true, isLeadManager = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [attendance, setAttendance] = useState<any>(null);
  const [aansh, setAansh] = useState<{ aansh_id: number; expires_at?: string } | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [profileImage, setProfileImage] = useState('');

  const loadAansh = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(AANSH_SESSION_KEY);
      if (!raw) {
        setAansh(null);
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed?.session_token && parsed?.aansh_id != null) {
        setAansh({ aansh_id: Number(parsed.aansh_id), expires_at: parsed.expires_at });
      } else {
        setAansh(null);
      }
    } catch {
      setAansh(null);
    }
  }, []);

  const loadAttendance = useCallback(async () => {
    try {
      const res = await apiFetch<any>('/api/telecaller/crm/attendance');
      setAttendance(res);
    } catch (e: any) {
      setAttendance({
        is_punched_in: false,
        history: [],
        warning: e?.message,
      });
    }
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profileData } = await supabase
        .from('users_login')
        .select(`*, role:roles(role_name, role_code)`)
        .eq('id', user.id)
        .maybeSingle();
      if (profileData) {
        setProfile(profileData);
        const parts = splitFullName(profileData.full_name || '');
        setFirstName(parts.first);
        setLastName(parts.last);
        setPhone(profileData.phone || '');
        setDepartment(profileData.department || '');
        setProfileImage(profileData.profile_image || '');
      }
    } catch {
      /* ignore */
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadAttendance(), loadAansh(), loadProfile()]);
    setLoading(false);
  }, [loadAttendance, loadAansh, loadProfile]);

  useEffect(() => {
    if (!active) return;
    refreshAll();
  }, [active, refreshAll]);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      loadAttendance();
      loadAansh();
    }, 10000);
    return () => clearInterval(t);
  }, [active, loadAttendance, loadAansh]);

  const punch = async (action: 'punch_in' | 'punch_out') => {
    setPunching(true);
    try {
      await apiFetch('/api/telecaller/crm/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      Alert.alert('Done', action === 'punch_in' ? 'Punched in' : 'Punched out');
      await loadAttendance();
    } catch (e: any) {
      const msg = String(e?.message || '');
      Alert.alert(
        'Attendance',
        msg.includes('282_telecaller') ||
          msg.includes('telecaller_attendance') ||
          msg.includes('relation')
          ? 'Attendance table missing. Run database/282_telecaller_crm_advanced.sql on Supabase, then try again.'
          : msg || 'Failed',
      );
    } finally {
      setPunching(false);
    }
  };

  const handleSave = async (imageOverride?: string) => {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const image = imageOverride !== undefined ? imageOverride : profileImage;
      const { error } = await supabase
        .from('users_login')
        .update({
          full_name: joinName(firstName, lastName),
          phone,
          department,
          profile_image: image || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (error) throw error;
      if (imageOverride === undefined) {
        Alert.alert('Saved', 'Profile updated');
        setIsEditing(false);
      }
      await loadProfile();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      const parts = splitFullName(profile.full_name || '');
      setFirstName(parts.first);
      setLastName(parts.last);
      setPhone(profile.phone || '');
      setDepartment(profile.department || '');
      setProfileImage(profile.profile_image || '');
    }
    setIsEditing(false);
  };

  const pickProfileImage = async () => {
    if (Platform.OS === 'ios') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to upload DP.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.55,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const mime = asset.mimeType || 'image/jpeg';
    const dataUrl = asset.base64
      ? `data:${mime};base64,${asset.base64}`
      : asset.uri;
    setProfileImage(dataUrl);
    if (!isEditing) {
      await handleSave(dataUrl);
      Alert.alert('Saved', 'Photo updated');
    }
  };

  const logout = async () => {
    if (attendance?.is_punched_in) {
      try {
        await apiFetch('/api/telecaller/crm/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'punch_out' }),
        });
      } catch {
        /* continue */
      }
    }
    await supabase.auth.signOut();
  };

  const history = Array.isArray(attendance?.history) ? attendance.history : [];
  const punchedIn = Boolean(attendance?.is_punched_in);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refreshAll} colors={[COLORS.primary]} />
      }
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>My Profile</Text>
          <Text style={styles.sub}>Profile & attendance together</Text>
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

      {isLeadManager ? (
        <View style={styles.mgrLinks}>
          <TouchableOpacity
            style={styles.mgrLink}
            onPress={() => navigation.navigate('LeadManagerFloor')}
          >
            <Ionicons name="people-outline" size={18} color={COLORS.primary} />
            <Text style={styles.mgrLinkText}>Live floor</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.mgrLink}
            onPress={() => navigation.navigate('LeadManagerTeamWhatsApp')}
          >
            <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
            <Text style={styles.mgrLinkText}>Team WA</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.mgrLink}
            onPress={() => navigation.navigate('LeadManagerWhatsAppDnd')}
          >
            <Ionicons name="ban-outline" size={18} color="#DC2626" />
            <Text style={styles.mgrLinkText}>WA DND</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Profile card — MyFNG premium blue */}
      <View style={styles.premiumCard}>
        <View style={styles.premiumTop}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarBox}>
              <View style={styles.avatar}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarText}>
                    {(firstName || lastName || profile?.full_name || '?').charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.cameraBtn}
                onPress={pickProfileImage}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#023D95" size="small" />
                ) : (
                  <Ionicons name="camera" size={16} color="#023D95" />
                )}
              </TouchableOpacity>
            </View>
            <View style={[styles.floorBadge, punchedIn ? styles.floorOn : styles.floorOff]}>
              <Text
                style={[styles.floorBadgeText, punchedIn ? styles.floorOnText : styles.floorOffText]}
              >
                {punchedIn ? 'On Floor' : 'Off Duty'}
              </Text>
            </View>
            <Text style={styles.premiumHint}>Tap camera to upload DP</Text>
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
              <Text style={styles.premiumLabel}>Department</Text>
              {isEditing ? (
                <TextInput
                  style={styles.premiumInput}
                  value={department}
                  onChangeText={setDepartment}
                  placeholderTextColor="rgba(255,255,255,0.5)"
                />
              ) : (
                <Text style={styles.premiumValue}>
                  {profile?.department || 'Not specified'}
                </Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.premiumMeta}>
          <View style={{ flex: 1 }}>
            <Text style={styles.metaLabel}>Role</Text>
            <Text style={styles.metaValue}>{profile?.role?.role_name || 'Telecaller'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.metaLabel}>Since</Text>
            <Text style={styles.metaValue}>
              {profile?.created_at ? formatDateDMY(profile.created_at) : '—'}
            </Text>
          </View>
        </View>
      </View>

      {/* Attendance */}
      <Text style={styles.section}>Attendance</Text>
      <Text style={styles.subTight}>Punch in when you start calling. Punch out when you leave.</Text>

      {attendance?.warning ? (
        <View style={styles.warnBox}>
          <Ionicons name="warning-outline" size={18} color={COLORS.orange} />
          <Text style={styles.warnText}>{attendance.warning}</Text>
        </View>
      ) : null}

      <View style={[styles.statusCard, punchedIn ? styles.on : styles.off]}>
        <Ionicons
          name={punchedIn ? 'checkmark-circle' : 'time-outline'}
          size={28}
          color={punchedIn ? COLORS.green : COLORS.orange}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.statusTitle}>
            {punchedIn ? 'Currently On Floor' : 'Currently Off Duty'}
          </Text>
          {punchedIn && attendance?.open_session?.punch_in_at ? (
            <Text style={styles.statusMeta}>
              Punched in since{' '}
              {new Date(attendance.open_session.punch_in_at).toLocaleString('en-IN')}
            </Text>
          ) : (
            <Text style={styles.statusMeta}>No open punch session</Text>
          )}
        </View>
      </View>

      {aansh ? (
        <View style={styles.aanshCard}>
          <Ionicons name="headset-outline" size={18} color={COLORS.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.aanshTitle}>SARV Aansh {aansh.aansh_id}</Text>
            <Text style={styles.aanshMeta}>Dialer claimed (independent of punch)</Text>
          </View>
        </View>
      ) : (
        <View style={styles.aanshIdle}>
          <Text style={styles.aanshMeta}>No Aansh dialer selected — claim from Home</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.punchBtn, punchedIn ? styles.punchOut : styles.punchIn]}
        disabled={punching}
        onPress={() => punch(punchedIn ? 'punch_out' : 'punch_in')}
      >
        {punching ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.punchText}>{punchedIn ? 'Punch Out' : 'Punch In'}</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.section}>Recent Timings</Text>
      {history.length === 0 ? (
        <Text style={styles.empty}>No attendance records yet. Tap Punch In to start.</Text>
      ) : (
        history.slice(0, 7).map((row: any) => (
          <View key={row.id} style={styles.row}>
            <Text style={styles.rowDate}>{row.work_date}</Text>
            <Text style={styles.rowTime}>
              In:{' '}
              {row.punch_in_at
                ? new Date(row.punch_in_at).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'}{' '}
              · Out:{' '}
              {row.punch_out_at
                ? new Date(row.punch_out_at).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'}
            </Text>
          </View>
        ))
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Ionicons name="log-out-outline" size={18} color={COLORS.white} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: SPACING.md, paddingTop: 4, paddingBottom: 40 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.textHeading },
  sub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  subTight: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 10 },
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
  mgrLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  mgrLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mgrLinkText: { fontSize: 12, fontWeight: '800', color: COLORS.textPrimary },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    ...SHADOWS.small,
  },
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
  avatarBox: { position: 'relative', width: 76, height: 76 },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  avatarImg: { width: 76, height: 76, borderRadius: 38 },
  avatarText: { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
  cameraBtn: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FACC15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
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
  label: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 2 },
  value: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  hint: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    backgroundColor: '#F8FAFC',
  },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  section: {
    marginTop: 18,
    marginBottom: 4,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textHeading,
  },
  warnBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  warnText: { flex: 1, fontSize: 12, color: '#9A3412', fontWeight: '600', lineHeight: 17 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    ...SHADOWS.small,
  },
  on: { borderWidth: 1, borderColor: COLORS.green + '40' },
  off: { borderWidth: 1, borderColor: COLORS.orange + '40' },
  statusTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  statusMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  aanshCard: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EAF2FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  aanshIdle: {
    marginTop: 10,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  aanshTitle: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  aanshMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  punchBtn: {
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  punchIn: { backgroundColor: COLORS.green },
  punchOut: { backgroundColor: COLORS.red },
  punchText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  empty: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },
  row: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    ...SHADOWS.small,
  },
  rowDate: { fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  rowTime: { fontSize: 12, color: COLORS.textSecondary },
  logoutBtn: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.red,
    padding: 14,
    borderRadius: 12,
  },
  logoutText: { color: '#fff', fontWeight: '700' },
});
