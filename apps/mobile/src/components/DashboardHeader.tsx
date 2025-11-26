import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';
import NotificationBell from './NotificationBell';

interface DashboardHeaderProps {
  name: string;
  role: string;
  onLogout: () => void;
  onNotificationPress?: () => void;
}

export default function DashboardHeader({ name, role, onLogout, onNotificationPress }: DashboardHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.leftSection}>
        <Text style={styles.greeting}>Welcome back,</Text>
        <Text style={styles.name}>{name || 'User'}</Text>
        <Text style={styles.role}>{role}</Text>
      </View>
      <View style={styles.rightSection}>
        {onNotificationPress && (
          <NotificationBell 
            onPress={onNotificationPress}
            size={22}
            color={COLORS.white}
          />
        )}
        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    paddingTop: SPACING.xxl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  leftSection: {
    flex: 1,
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

