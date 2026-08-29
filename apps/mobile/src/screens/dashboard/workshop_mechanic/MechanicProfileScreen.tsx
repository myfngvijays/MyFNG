import React, { useEffect, useState } from 'react';
import { formatDateDMY } from "@/lib/dateFormat";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { supabase } from '../../../lib/supabase';
import { COLORS, FONTS } from '../../../constants/theme';
import DashboardHeader from '../../../components/DashboardHeader';
import BottomNav from '../../../components/BottomNav';
import { useNavigation } from '@react-navigation/native';

interface MechanicProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  profile_image: string | null;
  workshop_id: string | null;
  workshop_name: string | null;
  created_at: string;
}

interface PerformanceMetrics {
  total_jobs_completed: number;
  jobs_this_month: number;
  avg_efficiency: number;
  on_time_completion: number;
  total_work_hours: number;
  customer_rating: number;
}

export default function MechanicProfileScreen({ navigation, embedInShell = false }: any) {
  const [profile, setProfile] = useState<MechanicProfile | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    total_jobs_completed: 0,
    jobs_this_month: 0,
    avg_efficiency: 0,
    on_time_completion: 0,
    total_work_hours: 0,
    customer_rating: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
  });

  useEffect(() => {
    fetchProfile();
    fetchMetrics();
  }, []);

  async function fetchProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile, error } = await supabase
        .from('users_login')
        .select(`
          id,
          full_name,
          email,
          phone,
          profile_image,
          workshop_id,
          created_at,
          workshops:workshop_id (
            name
          )
        `)
        .eq('email', user.email)
        .single();

      if (error) throw error;

      if (userProfile) {
        const profileData: MechanicProfile = {
          id: userProfile.id,
          full_name: userProfile.full_name,
          email: userProfile.email,
          phone: userProfile.phone,
          profile_image: userProfile.profile_image,
          workshop_id: userProfile.workshop_id,
          workshop_name: (userProfile.workshops as any)?.name || null,
          created_at: userProfile.created_at,
        };

        setProfile(profileData);
        setFormData({
          full_name: profileData.full_name,
          phone: profileData.phone || '',
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function fetchMetrics() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!userProfile) return;

      // Total completed jobs
      const { count: totalCompleted } = await supabase
        .from('mechanic_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('mechanic_id', userProfile.id)
        .eq('mechanic_status', 'COMPLETED');

      // Jobs this month
      const firstDayOfMonth = new Date();
      firstDayOfMonth.setDate(1);
      firstDayOfMonth.setHours(0, 0, 0, 0);

      const { count: thisMonthCount } = await supabase
        .from('mechanic_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('mechanic_id', userProfile.id)
        .eq('mechanic_status', 'COMPLETED')
        .gte('completed_at', firstDayOfMonth.toISOString());

      // Performance data
      const { data: performanceData } = await supabase
        .from('mechanic_jobs')
        .select('efficiency_score, actual_work_duration')
        .eq('mechanic_id', userProfile.id)
        .eq('mechanic_status', 'COMPLETED');

      let avgEfficiency = 0;
      let totalHours = 0;
      let onTimePercentage = 0;

      if (performanceData && performanceData.length > 0) {
        const totalEfficiency = performanceData.reduce((sum, job) => sum + (job.efficiency_score || 0), 0);
        avgEfficiency = totalEfficiency / performanceData.length;

        const totalMinutes = performanceData.reduce((sum, job) => sum + (job.actual_work_duration || 0), 0);
        totalHours = Math.round(totalMinutes / 60);

        const onTimeJobs = performanceData.filter((j) => (j.efficiency_score || 0) >= 80).length;
        onTimePercentage = Math.round((onTimeJobs / performanceData.length) * 100);
      }

      setMetrics({
        total_jobs_completed: totalCompleted || 0,
        jobs_this_month: thisMonthCount || 0,
        avg_efficiency: Math.round(avgEfficiency),
        on_time_completion: onTimePercentage,
        total_work_hours: totalHours,
        customer_rating: 4.5,
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  }

  async function handleSave() {
    if (!profile) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from('users_login')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) throw error;

      Alert.alert('Success', 'Profile updated successfully!');
      setEditing(false);
      fetchProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setFormData({
      full_name: profile?.full_name || '',
      phone: profile?.phone || '',
    });
    setEditing(false);
  }

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile();
    fetchMetrics();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        {embedInShell ? null : (
          <DashboardHeader name="Mechanic" role="Workshop Mechanic" onLogout={() => {}} />
        )}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.container}>
        {embedInShell ? null : (
          <DashboardHeader name="Mechanic" role="Workshop Mechanic" onLogout={() => {}} />
        )}
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Profile not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {embedInShell ? null : (
        <DashboardHeader
          name={profile.full_name}
          role="Workshop Mechanic"
          onLogout={async () => {
            await supabase.auth.signOut();
            // Auth state change will automatically navigate to Login
          }}
        />
      )}

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{profile.full_name.charAt(0).toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.profileName}>{profile.full_name}</Text>
          <Text style={styles.profileRole}>Workshop Mechanic</Text>

          <View style={styles.quickStats}>
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatLabel}>Member Since</Text>
              <Text style={styles.quickStatValue}>
                {formatDateDMY(profile.created_at)}
              </Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatLabel}>Total Jobs</Text>
              <Text style={styles.quickStatValue}>{metrics.total_jobs_completed}</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatLabel}>Rating</Text>
              <Text style={styles.quickStatValue}>⭐ {metrics.customer_rating.toFixed(1)}</Text>
            </View>
          </View>
        </View>

        {/* Performance Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance Overview</Text>
          <View style={styles.metricsGrid}>
            <View style={[styles.metricCard, { backgroundColor: '#DBEAFE' }]}>
              <Text style={styles.metricIcon}>✅</Text>
              <Text style={styles.metricLabel}>This Month</Text>
              <Text style={styles.metricValue}>{metrics.jobs_this_month}</Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: '#D1FAE5' }]}>
              <Text style={styles.metricIcon}>📈</Text>
              <Text style={styles.metricLabel}>Efficiency</Text>
              <Text style={styles.metricValue}>{metrics.avg_efficiency}%</Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: '#E9D5FF' }]}>
              <Text style={styles.metricIcon}>⏰</Text>
              <Text style={styles.metricLabel}>On-Time</Text>
              <Text style={styles.metricValue}>{metrics.on_time_completion}%</Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: '#FEF3C7' }]}>
              <Text style={styles.metricIcon}>🔧</Text>
              <Text style={styles.metricLabel}>Total Jobs</Text>
              <Text style={styles.metricValue}>{metrics.total_jobs_completed}</Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: '#BFDBFE' }]}>
              <Text style={styles.metricIcon}>⏱️</Text>
              <Text style={styles.metricLabel}>Work Hours</Text>
              <Text style={styles.metricValue}>{metrics.total_work_hours}h</Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: '#FEE2E2' }]}>
              <Text style={styles.metricIcon}>🏆</Text>
              <Text style={styles.metricLabel}>Rating</Text>
              <Text style={styles.metricValue}>{metrics.customer_rating.toFixed(1)}/5</Text>
            </View>
          </View>
        </View>

        {/* Profile Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Profile Information</Text>
            {!editing ? (
              <TouchableOpacity style={styles.editButton} onPress={() => setEditing(true)}>
                <Text style={styles.editButtonText}>✏️ Edit</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={saving}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
                  <Text style={styles.saveButtonText}>{saving ? '💾 Saving...' : '💾 Save'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.profileFields}>
            {/* Full Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>👤 Full Name</Text>
              {editing ? (
                <TextInput
                  style={styles.fieldInput}
                  value={formData.full_name}
                  onChangeText={(text) => setFormData({ ...formData, full_name: text })}
                  placeholder="Enter full name"
                  placeholderTextColor={COLORS.textSecondary}
                />
              ) : (
                <Text style={styles.fieldValue}>{profile.full_name}</Text>
              )}
            </View>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>✉️ Email</Text>
              <Text style={styles.fieldValue}>{profile.email}</Text>
              <Text style={styles.fieldNote}>Email cannot be changed</Text>
            </View>

            {/* Phone */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>📞 Phone Number</Text>
              {editing ? (
                <TextInput
                  style={styles.fieldInput}
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  placeholder="Enter phone number"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="phone-pad"
                />
              ) : (
                <Text style={styles.fieldValue}>{profile.phone || 'Not provided'}</Text>
              )}
            </View>

            {/* Workshop */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>🏢 Workshop</Text>
              <Text style={styles.fieldValue}>{profile.workshop_name || 'Not assigned'}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {embedInShell ? null : (
        <BottomNav
          activeTab="profile"
          onTabPress={(tab) => {
            if (tab === 'dashboard') navigation.navigate('Dashboard');
            else if (tab === 'history') navigation.navigate('JobHistory');
          }}
          tabs={[
            { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
            { id: 'history', label: 'History', icon: '📋' },
            { id: 'profile', label: 'Profile', icon: '👤' },
          ]}
        />
      )}
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
  },
  content: {
    flex: 1,
  },
  profileHeader: {
    backgroundColor: COLORS.white,
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontFamily: FONTS.family,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  profileName: {
    fontSize: 24,
    fontFamily: FONTS.family,
    fontWeight: 'bold',
    color: '#023D95',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    fontFamily: FONTS.family,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  quickStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
  },
  quickStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  quickStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
  },
  quickStatLabel: {
    fontSize: 12,
    fontFamily: FONTS.family,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  quickStatValue: {
    fontSize: 16,
    fontFamily: FONTS.family,
    fontWeight: 'bold',
    color: '#023D95',
  },
  section: {
    backgroundColor: COLORS.white,
    padding: 16,
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: FONTS.family,
    fontWeight: 'bold',
    color: '#023D95',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    width: '48%',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  metricIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 12,
    fontFamily: FONTS.family,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 20,
    fontFamily: FONTS.family,
    fontWeight: 'bold',
    color: '#023D95',
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
  },
  editButtonText: {
    fontSize: 14,
    fontFamily: FONTS.family,
    color: COLORS.white,
    fontWeight: '600',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    fontSize: 14,
    fontFamily: FONTS.family,
    color: COLORS.textPrimary,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
  },
  saveButtonText: {
    fontSize: 14,
    fontFamily: FONTS.family,
    color: COLORS.white,
    fontWeight: '600',
  },
  profileFields: {
    gap: 16,
  },
  fieldGroup: {
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: FONTS.family,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  fieldValue: {
    fontSize: 16,
    fontFamily: FONTS.family,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 8,
  },
  fieldInput: {
    fontSize: 16,
    fontFamily: FONTS.family,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fieldNote: {
    fontSize: 12,
    fontFamily: FONTS.family,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: FONTS.family,
    color: COLORS.textSecondary,
  },
});

