import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import DashboardHeader from '../../components/DashboardHeader';
import { COLORS, SPACING } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

export default function DefaultDashboard({ userProfile, onLogout }: { userProfile: any; onLogout?: () => void }) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (onLogout) onLogout();
  };

  return (
    <View style={styles.container}>
      <DashboardHeader
        name={userProfile?.full_name || 'User'}
        role={userProfile?.role || 'User'}
        onLogout={handleLogout}
      />
      
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to MyFNG</Text>
        <Text style={styles.subtitle}>
          Your dashboard for role "{userProfile?.role}" is currently under development.
        </Text>
        <Text style={styles.info}>
          Contact your administrator for more information.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.gray[600],
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  info: {
    fontSize: 14,
    color: COLORS.gray[500],
    textAlign: 'center',
  },
});

