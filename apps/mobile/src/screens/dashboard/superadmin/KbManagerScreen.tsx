import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';

export default function KbManagerScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <DashboardHeader title="KB Manager" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Text style={styles.title}>KB Manager</Text>
        <Text style={styles.subtitle}>This module is web-only placeholder in the current backend.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { padding: SPACING.md },
  title: { fontSize: SIZES.lg, fontWeight: '700', color: COLORS.textHeading },
  subtitle: { marginTop: SPACING.sm, color: COLORS.textSecondary },
});
