import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

type LeadCardProps =
  | {
      // Newer/simple usage
      customerName: string;
      vehicleModel: string;
      serviceType: string;
      status: string;
      date: string;
      onPress?: () => void;
    }
  | {
      // Legacy usage from some dashboards
      leadNumber: string;
      customerName: string;
      vehicleNumber: string;
      status: string;
      serviceType: string;
      onPress?: () => void;
    };

export default function LeadCard({
  ...props
}: LeadCardProps) {
  const customerName = (props as any).customerName;
  const status = (props as any).status;
  const serviceType = (props as any).serviceType;
  const date = (props as any).date || (props as any).leadNumber || '';
  const vehicleModel = (props as any).vehicleModel || (props as any).vehicleNumber || '';
  const onPress = (props as any).onPress as (() => void) | undefined;

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return COLORS.warning;
      case 'in_progress':
        return COLORS.secondary;
      case 'completed':
        return COLORS.success;
      case 'cancelled':
        return COLORS.danger;
      default:
        return COLORS.gray[500];
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.header}>
        <Text style={styles.customerName}>{customerName}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) }]}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>

      <Text style={styles.vehicle}>{vehicleModel}</Text>
      <Text style={styles.service}>{serviceType}</Text>
      <Text style={styles.date}>{date}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  customerName: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.black,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  vehicle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[700],
    marginBottom: SPACING.xs,
  },
  service: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    marginBottom: SPACING.xs,
  },
  date: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[500],
  },
});
