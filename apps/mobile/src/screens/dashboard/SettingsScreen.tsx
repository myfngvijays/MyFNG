import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SIZES } from '../../constants/theme';
import { Icon } from '../../components/Icon';

export default function SettingsScreen() {
  const { logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            logout();
          },
        },
      ]
    );
  };

  const SettingItem = ({ icon, title, subtitle, onPress, showArrow = true }: any) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <View style={styles.settingIcon}>{icon}</View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {showArrow && <Icon name="chevron-right" color={COLORS.textGray} size={20} />}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* General Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>General</Text>
        
        <SettingItem
          icon={<Icon name="bell" color={COLORS.primary} size={24} />}
          title="Notifications"
          subtitle="Manage notification preferences"
          onPress={() => {/* Handle navigation */}}
        />
        
        <SettingItem
          icon={<Icon name="shield" color={COLORS.primary} size={24} />}
          title="Privacy & Security"
          subtitle="Control your privacy settings"
          onPress={() => {/* Handle navigation */}}
        />
      </View>

      {/* Support */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        
        <SettingItem
          icon={<Icon name="help" color={COLORS.primary} size={24} />}
          title="Help & Support"
          subtitle="Get help or contact us"
          onPress={() => {/* Handle navigation */}}
        />
      </View>

      {/* App Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>App Version</Text>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>GDPR Compliant</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>✓ Yes</Text>
          </View>
        </View>
      </View>

      {/* Logout */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Icon name="logout" color={COLORS.error} size={24} />
          <Text style={styles.logoutText}>Logout</Text>
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
  section: {
    marginTop: SIZES.lg,
    backgroundColor: COLORS.white,
    padding: SIZES.lg,
  },
  sectionTitle: {
    fontSize: SIZES.base,
    fontWeight: 'bold',
    color: COLORS.textGray,
    marginBottom: SIZES.sm,
    textTransform: 'uppercase',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SIZES.md,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: SIZES.md,
    fontWeight: '500',
    color: COLORS.textBody,
    marginBottom: SIZES.xs / 2,
  },
  settingSubtitle: {
    fontSize: SIZES.sm,
    color: COLORS.textGray,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: {
    fontSize: SIZES.md,
    color: COLORS.textBody,
  },
  infoValue: {
    fontSize: SIZES.md,
    color: COLORS.textGray,
  },
  badge: {
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: SIZES.sm,
    paddingVertical: SIZES.xs / 2,
    borderRadius: SIZES.radiusSm,
  },
  badgeText: {
    fontSize: SIZES.sm,
    color: COLORS.success,
    fontWeight: 'bold',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SIZES.md,
    gap: SIZES.sm,
  },
  logoutText: {
    fontSize: SIZES.md,
    color: COLORS.error,
    fontWeight: 'bold',
  },
});

