import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

interface StatCardProps {
  title?: string;
  value: string | number;
  subtitle?: string;
  color?: string;
  icon?: React.ReactNode;

  // Legacy prop name used by some screens
  label?: string;
}

export default function StatCard({ title, label, value, subtitle, color = COLORS.primary, icon }: StatCardProps) {
  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={styles.title}>{title || label}</Text>
          <Text style={[styles.value, { color }]}>{value}</Text>
        </View>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
      </View>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderLeftWidth: 4,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.bodyText,
    marginBottom: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flex: 1,
    paddingRight: SPACING.sm,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[500],
  },
});
