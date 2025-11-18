import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { User, Mail, Phone, Briefcase, Building2, Calendar } from 'lucide-react-native';
import { useAuthStore } from '../../store/authStore';
import { COLORS, SIZES, SHADOWS } from '../../constants/theme';

export default function ProfileScreen() {
  const { userProfile } = useAuthStore();

  const InfoRow = ({ icon, label, value }: any) => (
    <View style={styles.infoRow}>
      <View style={styles.iconContainer}>{icon}</View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || 'Not provided'}</Text>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <User color={COLORS.white} size={40} />
        </View>
        <Text style={styles.name}>{userProfile?.full_name}</Text>
        <Text style={styles.role}>{userProfile?.role?.role_name}</Text>
      </View>

      {/* Profile Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personal Information</Text>
        
        <InfoRow
          icon={<Mail color={COLORS.primary} size={20} />}
          label="Email"
          value={userProfile?.email}
        />
        
        <InfoRow
          icon={<Phone color={COLORS.primary} size={20} />}
          label="Phone"
          value={userProfile?.phone}
        />
        
        <InfoRow
          icon={<Briefcase color={COLORS.primary} size={20} />}
          label="Role"
          value={userProfile?.role?.role_name}
        />
        
        {userProfile?.department && (
          <InfoRow
            icon={<Building2 color={COLORS.primary} size={20} />}
            label="Department"
            value={userProfile?.department}
          />
        )}
        
        {userProfile?.workshop && (
          <InfoRow
            icon={<Building2 color={COLORS.primary} size={20} />}
            label="Workshop"
            value={userProfile?.workshop?.name}
          />
        )}
        
        <InfoRow
          icon={<Calendar color={COLORS.primary} size={20} />}
          label="Member Since"
          value={new Date(userProfile?.created_at || '').toLocaleDateString('en-IN')}
        />
      </View>

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Edit Profile</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Change Password</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Privacy Settings</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: SIZES.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    alignItems: 'center',
    padding: SIZES.xxl,
    backgroundColor: COLORS.white,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SIZES.md,
    ...SHADOWS.medium,
  },
  name: {
    fontSize: SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    marginBottom: SIZES.xs,
  },
  role: {
    fontSize: SIZES.md,
    color: COLORS.textGray,
  },
  section: {
    marginTop: SIZES.lg,
    backgroundColor: COLORS.white,
    padding: SIZES.lg,
  },
  sectionTitle: {
    fontSize: SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    marginBottom: SIZES.md,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  iconContainer: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: {
    flex: 1,
    marginLeft: SIZES.sm,
  },
  infoLabel: {
    fontSize: SIZES.sm,
    color: COLORS.textGray,
    marginBottom: SIZES.xs,
  },
  infoValue: {
    fontSize: SIZES.md,
    color: COLORS.textBody,
    fontWeight: '500',
  },
  actionButton: {
    paddingVertical: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  actionButtonText: {
    fontSize: SIZES.md,
    color: COLORS.primary,
    fontWeight: '500',
  },
});

