import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  /** Web-style panel line, e.g. "Super Admin Control Panel" */
  panelLabel?: string;
  onMenuPress?: () => void;
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
  panelLabel,
  onMenuPress,
}: DashboardHeaderProps) {
  const insets = useSafeAreaInsets();
  const topPad = embedded ? SPACING.sm : Math.max(insets.top, 12) + 10;

  // Simple header: back + title (no welcome, no logout)
  if (title) {
    return (
      <View style={[styles.simpleHeader, embedded && styles.simpleHeaderEmbedded, { paddingTop: topPad }]}>
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
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={onLogout}
              accessibilityRole="button"
              accessibilityLabel="Logout"
            >
              <Ionicons name="power-outline" size={20} color={COLORS.white} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  const displayName = name || userName || userProfile?.full_name || 'User';
  const displayRole = role || userRole || userProfile?.role?.role_name || subtitle || '';
  const showRole = Boolean(displayRole && displayRole !== displayName);

  return (
    <View style={[styles.header, { paddingTop: topPad }]}>
      <View style={styles.leftSection}>
        <View style={styles.nameRow}>
          {onMenuPress ? (
            <TouchableOpacity
              style={styles.menuBtn}
              onPress={onMenuPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Open menu"
            >
              <Ionicons name="menu" size={24} color={COLORS.white} />
            </TouchableOpacity>
          ) : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.greeting}>Welcome back</Text>
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
            </Text>
            {showRole ? (
              <Text style={styles.role} numberOfLines={1}>
                {displayRole}
              </Text>
            ) : null}
            {panelLabel ? <Text style={styles.panelLabel}>{panelLabel}</Text> : null}
          </View>
        </View>
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
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={onLogout}
            accessibilityRole="button"
            accessibilityLabel="Logout"
          >
            <Ionicons name="power-outline" size={20} color={COLORS.white} />
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
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
    paddingTop: 12,
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
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
    paddingTop: 4,
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
  panelLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: '#FDE68A',
    fontFamily: 'Poppins',
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
});

