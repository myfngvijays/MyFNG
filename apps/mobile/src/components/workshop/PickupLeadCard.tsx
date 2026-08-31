import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';

export type PickupLeadCardProps = {
  leadNumber?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  vehicleNumber?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  taskType: 'PICKUP' | 'DELIVERY';
  statusLabel: string;
  statusColor: string;
  address?: string | null;
  footerText?: string | null;
  onPress?: () => void;
  showChevron?: boolean;
};

export default function PickupLeadCard({
  leadNumber,
  customerName,
  customerPhone,
  vehicleNumber,
  vehicleMake,
  vehicleModel,
  taskType,
  statusLabel,
  statusColor,
  address,
  footerText,
  onPress,
  showChevron = true,
}: PickupLeadCardProps) {
  const vehicleLine = [vehicleNumber, vehicleMake, vehicleModel].filter(Boolean).join(' · ');
  const typeColor = taskType === 'PICKUP' ? '#EA580C' : '#0284C7';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88} disabled={!onPress}>
      <View style={styles.navyBar}>
        <Text style={styles.leadNumber} numberOfLines={1}>
          {leadNumber || 'Lead'}
        </Text>
        <View style={[styles.typeChip, { backgroundColor: `${typeColor}33` }]}>
          <Ionicons
            name={taskType === 'PICKUP' ? 'car-outline' : 'navigate-outline'}
            size={11}
            color="#fff"
          />
          <Text style={styles.typeChipTxt}>{taskType}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.customerName} numberOfLines={1}>
            {customerName || 'Customer'}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusTxt, { color: statusColor }]} numberOfLines={1}>
              {statusLabel}
            </Text>
          </View>
        </View>

        {vehicleLine ? (
          <Text style={styles.vehicleLine} numberOfLines={1}>
            {vehicleLine}
          </Text>
        ) : null}

        {address ? (
          <View style={styles.addressBox}>
            <Ionicons name="location-outline" size={14} color={COLORS.primary} />
            <Text style={styles.addressTxt} numberOfLines={2}>
              {address}
            </Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          {footerText ? (
            <View style={styles.footerLeft}>
              <Ionicons name="time-outline" size={13} color={COLORS.textSecondary} />
              <Text style={styles.footerTxt} numberOfLines={1}>
                {footerText}
              </Text>
            </View>
          ) : (
            <View style={styles.footerLeft} />
          )}

          <View style={styles.footerActions}>
            {customerPhone ? (
              <TouchableOpacity
                style={styles.callBtn}
                onPress={() => Linking.openURL(`tel:${customerPhone}`)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="call-outline" size={15} color={COLORS.primary} />
              </TouchableOpacity>
            ) : null}
            {showChevron && onPress ? (
              <Ionicons name="chevron-forward" size={18} color={COLORS.gray[400]} />
            ) : null}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
    ...SHADOWS.small,
  },
  navyBar: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  leadNumber: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  typeChipTxt: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.4,
  },
  body: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  customerName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textHeading,
    letterSpacing: -0.2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: '46%',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusTxt: {
    fontSize: 10,
    fontWeight: '800',
    flexShrink: 1,
  },
  vehicleLine: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F0F7FF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  addressTxt: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textBody,
    lineHeight: 17,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
    paddingTop: 10,
    gap: 8,
  },
  footerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
  },
  footerTxt: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
