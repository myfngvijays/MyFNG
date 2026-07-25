import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';
import NotificationBell from './NotificationBell';

interface DashboardHeaderProps {
  // Default (dashboard) mode
  name?: string;
  role?: string;
  onLogout?: () => void;
  onNotificationPress?: () => void;

  // Simple header mode (used by some role sub-screens)
  title?: string;
  onBack?: () => void;
  /** When true, skip status-bar padding (parent already has SafeArea). */
  embedded?: boolean;

  // Legacy aliases used by some dashboards
  userName?: string;
  userRole?: string;
  userProfile?: any;
  subtitle?: string;
}

export default function DashboardHeader({
  name,
  role,
  onLogout,
  onNotificationPress,
  title,
  onBack,
  embedded = false,
  userName,
  userRole,
  userProfile,
  subtitle,
}: DashboardHeaderProps) {
  // Simple header: back + title (no welcome, no logout)
  if (title) {
    return (
      <View style={[styles.simpleHeader, embedded && styles.simpleHeaderEmbedded]}>
        <View style={styles.leftSection}>
          <View style={styles.simpleRow}>
            {onBack && !embedded ? (
              <TouchableOpacity onPress={onBack} style={styles.backButton}>
                <Ionicons name="arrow-back" size={20} color={COLORS.white} />
              </TouchableOpacity>
            ) : null}
            <Text style={styles.simpleTitle}>{title}</Text>
          </View>
        </View>
        <View style={styles.rightSection}>
          {onNotificationPress && (
            <NotificationBell onPress={onNotificationPress} size={22} color={COLORS.white} />
          )}
          {onLogout && (
            <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.header}>
      <View style={styles.leftSection}>
        <Text style={styles.greeting}>Welcome back,</Text>
        <Text style={styles.name}>{name || userName || userProfile?.full_name || 'User'}</Text>
        <Text style={styles.role}>{role || userRole || userProfile?.role?.role_name || subtitle || ''}</Text>
      </View>
      <View style={styles.rightSection}>
        {onNotificationPress && (
          <NotificationBell 
            onPress={onNotificationPress}
            size={22}
            color={COLORS.white}
          />
        )}
        {onLogout && (
          <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    paddingTop: SPACING.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  simpleHeader: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    paddingTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  simpleHeaderEmbedded: {
    paddingTop: SPACING.sm,
  },
  leftSection: {
    flex: 1,
  },
  simpleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  simpleTitle: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.white,
    fontWeight: '700',
    fontFamily: 'Poppins',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  greeting: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.white,
    opacity: 0.95,
    fontFamily: 'Poppins',
  },
  name: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.white,
    marginTop: SPACING.xs,
    fontFamily: 'Poppins',
  },
  role: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.white,
    opacity: 0.95,
    marginTop: 2,
    fontFamily: 'Poppins',
  },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 24,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    fontFamily: 'Poppins',
  },
});

