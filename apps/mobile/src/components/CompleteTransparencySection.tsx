import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import SectionHeading from './SectionHeading';

export const TRANSPARENCY_FEATURES = [
  {
    title: 'Photo/Video Updates',
    subtitle: 'Live service tracking',
    icon: 'eye' as const,
    accent: '#2563EB',
    accentBg: '#DBEAFE',
  },
  {
    title: 'Clear Estimates',
    subtitle: 'No hidden costs',
    icon: 'document-text' as const,
    accent: '#059669',
    accentBg: '#D1FAE5',
  },
  {
    title: 'MY FNG Service Guarantee',
    subtitle: '100% quality assurance',
    icon: 'shield-checkmark' as const,
    accent: '#7C3AED',
    accentBg: '#EDE9FE',
  },
  {
    title: 'Same-Day Service',
    subtitle: 'Quick turnaround time',
    icon: 'flash' as const,
    accent: '#EA580C',
    accentBg: '#FFEDD5',
  },
] as const;

type Props = {
  headingSpacing?: 'section' | 'inline';
  showHeading?: boolean;
};

export default function CompleteTransparencySection({
  headingSpacing = 'section',
  showHeading = true,
}: Props) {
  return (
    <View style={styles.wrap}>
      {showHeading ? (
        <SectionHeading
          spacing={headingSpacing}
          title="Complete Transparency"
          subtitle="Clear pricing, live updates and service guarantee"
        />
      ) : null}

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View style={styles.panelBadge}>
            <Ionicons name="sparkles" size={14} color={COLORS.primary} />
            <Text style={styles.panelBadgeText}>Why you can trust every booking</Text>
          </View>
        </View>

        {TRANSPARENCY_FEATURES.map((item, index) => (
          <View
            key={item.title}
            style={[styles.row, index < TRANSPARENCY_FEATURES.length - 1 ? styles.rowDivider : null]}
          >
            <View style={[styles.iconWrap, { backgroundColor: item.accentBg }]}>
              <Ionicons name={item.icon} size={20} color={item.accent} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                {item.subtitle}
              </Text>
            </View>
            <View style={[styles.tickWrap, { backgroundColor: `${item.accent}14` }]}>
              <Ionicons name="checkmark" size={14} color={item.accent} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E0ECFF',
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  panelHeader: {
    backgroundColor: '#F8FBFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8F0FE',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  panelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  panelBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 16,
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    lineHeight: 14,
  },
  tickWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
