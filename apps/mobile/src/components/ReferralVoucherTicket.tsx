import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type VoucherTicketVariant = 'save' | 'care' | 'elite' | 'express' | 'promo';

const VARIANTS: Record<
  VoucherTicketVariant,
  { bg: string; border: string; accent: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  save: { bg: '#FFFBEB', border: '#FCD34D', accent: '#D97706', icon: 'wallet-outline' },
  care: { bg: '#FFF1F2', border: '#FDA4AF', accent: '#E11D48', icon: 'shield-checkmark-outline' },
  elite: { bg: '#FFF7ED', border: '#FDBA74', accent: '#EA580C', icon: 'diamond-outline' },
  express: { bg: '#ECFEFF', border: '#67E8F9', accent: '#0891B2', icon: 'flash-outline' },
  promo: { bg: '#EFF6FF', border: '#93C5FD', accent: '#2563EB', icon: 'pricetag-outline' },
};

type Props = {
  code: string;
  subtitle: string;
  rightLabel?: string;
  expiryLabel?: string;
  applied?: boolean;
  variant?: VoucherTicketVariant;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  notchColor?: string;
};

export function inferVoucherVariant(text: string, family?: string | null): VoucherTicketVariant {
  const key = String(family || '').toLowerCase();
  if (key.includes('save')) return 'save';
  if (key.includes('care')) return 'care';
  if (key.includes('elite')) return 'elite';
  if (key.includes('express')) return 'express';

  const hay = String(text || '').toLowerCase();
  if (/care|scan|alignment|wheel|consumable/i.test(hay)) return 'care';
  if (/express|priority|same-day|pickup/i.test(hay)) return 'express';
  if (/elite|prime|membership|ac gas|inspection/i.test(hay)) return 'elite';
  return 'save';
}

export function formatVoucherRightLabel(subtitle: string): string {
  const amountMatch = String(subtitle || '').match(/₹([\d,]+)/);
  if (amountMatch?.[1]) {
    return `₹${amountMatch[1]} OFF`;
  }
  if (/10%.*labour/i.test(subtitle)) return '10% LABOUR';
  if (/free/i.test(subtitle)) return 'FREE';
  return 'REWARD';
}

export function ReferralVoucherTicket({
  code,
  subtitle,
  rightLabel,
  expiryLabel,
  applied = false,
  variant = 'promo',
  onPress,
  disabled,
  style,
  notchColor = '#FFFFFF',
}: Props) {
  const palette = VARIANTS[variant];
  const appliedPalette = applied
    ? { bg: '#ECFDF5', border: '#34D399', accent: '#059669' }
    : palette;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      disabled={disabled || !onPress}
      style={[
        styles.wrap,
        {
          backgroundColor: appliedPalette.bg,
          borderColor: appliedPalette.border,
          shadowColor: appliedPalette.accent,
        },
        style,
      ]}
    >
      <View style={[styles.notch, styles.notchLeft, { backgroundColor: notchColor, borderColor: appliedPalette.border }]} />
      <View style={[styles.notch, styles.notchRight, { backgroundColor: notchColor, borderColor: appliedPalette.border }]} />

      <View style={styles.row}>
        <View style={styles.leftCol}>
          <View style={styles.codeRow}>
            <Ionicons name={appliedPalette.icon} size={16} color={appliedPalette.accent} />
            <Text style={[styles.code, { color: appliedPalette.accent }]} numberOfLines={1}>
              {code}
            </Text>
          </View>
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
          {expiryLabel ? <Text style={styles.expiry}>{expiryLabel}</Text> : null}
        </View>

        <View style={styles.rightCol}>
          <Text style={styles.rightLabel}>{rightLabel || formatVoucherRightLabel(subtitle)}</Text>
          <Text style={[styles.action, { color: appliedPalette.accent }]}>
            {applied ? '✓ APPLIED' : 'TAP TO APPLY'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    paddingVertical: 14,
    paddingHorizontal: 16,
    position: 'relative',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  notch: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    top: '50%',
    marginTop: -8,
    borderWidth: 1.5,
  },
  notchLeft: { left: -9 },
  notchRight: { right: -9 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  leftCol: { flex: 1, minWidth: 0, paddingRight: 4 },
  rightCol: { alignItems: 'flex-end', justifyContent: 'center', minWidth: 92 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  code: { fontSize: 15, fontWeight: '900', letterSpacing: 0.3, flexShrink: 1 },
  subtitle: { fontSize: 12, color: '#475569', lineHeight: 17, marginTop: 4 },
  expiry: { fontSize: 10, color: '#D97706', fontWeight: '700', marginTop: 4 },
  rightLabel: { fontSize: 16, fontWeight: '900', color: '#0F172A', textAlign: 'right' },
  action: { fontSize: 10, fontWeight: '800', marginTop: 6, letterSpacing: 0.5 },
});

type VoucherListProps = {
  children: React.ReactNode[];
  viewAllLabel?: string;
};

/** Shows the first voucher; tap View All to expand the rest vertically. */
export function ReferralVoucherList({ children, viewAllLabel = 'View All' }: VoucherListProps) {
  const [expanded, setExpanded] = useState(false);
  const items = React.Children.toArray(children).filter(Boolean);
  if (items.length === 0) return null;

  const visible = expanded ? items : items.slice(0, 1);

  return (
    <View style={listStyles.wrap}>
      {visible.map((child, index) => (
        <View key={index} style={listStyles.item}>
          {child}
        </View>
      ))}
      {items.length > 1 ? (
        <TouchableOpacity
          style={listStyles.viewAllBtn}
          onPress={() => setExpanded((v) => !v)}
          activeOpacity={0.85}
        >
          <Text style={listStyles.viewAllText}>
            {expanded ? 'Show Less' : `${viewAllLabel} (${items.length})`}
          </Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#2563EB" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const listStyles = StyleSheet.create({
  wrap: { width: '100%' },
  item: { width: '100%', marginBottom: 10 },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#93C5FD',
    backgroundColor: '#F8FAFC',
  },
  viewAllText: { fontSize: 12, fontWeight: '800', color: '#2563EB', letterSpacing: 0.3 },
});
