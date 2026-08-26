import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { COLORS } from '../../constants/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export function AdminSectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function AdminMetricCard({
  icon,
  label,
  value,
  iconBg = '#EFF6FF',
  iconColor = COLORS.primary,
  onPress,
}: {
  icon: IoniconName;
  label: string;
  value: string | number;
  iconBg?: string;
  iconColor?: string;
  onPress?: () => void;
}) {
  const body = (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.metricCopy}>
        <Text style={styles.metricValue} numberOfLines={1}>
          {value}
        </Text>
        <Text style={styles.metricLabel} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity style={styles.metricWrap} onPress={onPress} activeOpacity={0.85}>
        {body}
      </TouchableOpacity>
    );
  }
  return <View style={styles.metricWrap}>{body}</View>;
}

export function AdminDeptCard({
  icon,
  title,
  metrics,
}: {
  icon: IoniconName;
  title: string;
  metrics: { label: string; value: string | number; highlight?: boolean }[];
}) {
  return (
    <View style={styles.deptCard}>
      <View style={styles.deptHeader}>
        <View style={styles.deptIcon}>
          <Ionicons name={icon} size={16} color={COLORS.primary} />
        </View>
        <Text style={styles.deptTitle}>{title}</Text>
      </View>
      <View style={styles.deptMetrics}>
        {metrics.map((metric) => (
          <View key={metric.label} style={styles.deptMetricItem}>
            <Text style={[styles.deptMetricValue, metric.highlight && styles.deptHighlight]}>
              {metric.value}
            </Text>
            <Text style={styles.deptMetricLabel}>{metric.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function AdminQuickLink({
  icon,
  label,
  onPress,
}: {
  icon: IoniconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickLink} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.quickLinkIcon}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <Text style={styles.quickLinkLabel} numberOfLines={2}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function AdminMenuTile({
  icon,
  label,
  onPress,
}: {
  icon: IoniconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.menuTile} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.menuIcon}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <Text style={styles.menuLabel} numberOfLines={2}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.heading,
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  metricWrap: {
    width: '48%',
  },
  metricCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCopy: { flex: 1, minWidth: 0 },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  metricLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
    fontWeight: '600',
  },
  deptCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  deptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  deptIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deptTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  deptMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  deptMetricItem: {
    flex: 1,
    alignItems: 'center',
  },
  deptMetricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  deptHighlight: { color: '#059669' },
  deptMetricLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '600',
    textAlign: 'center',
  },
  quickLink: {
    width: '31%',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  quickLinkIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLinkLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.heading,
    textAlign: 'center',
  },
  menuTile: {
    width: '31%',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
});
