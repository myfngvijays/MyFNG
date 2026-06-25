import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { COLORS } from '../constants/theme';

type SectionHeadingProps = {
  title: string;
  subtitle?: string;
  rightAccessory?: React.ReactNode;
  style?: ViewStyle;
  /** inline = inside a padded section block; section = standalone block in scroll (default) */
  spacing?: 'section' | 'inline' | 'compact';
  light?: boolean;
};

export default function SectionHeading({
  title,
  subtitle,
  rightAccessory,
  style,
  spacing = 'section',
  light = false,
}: SectionHeadingProps) {
  const lineColor = light ? 'rgba(255,255,255,0.35)' : '#DBEAFE';
  const titleColor = light ? '#FFFFFF' : COLORS.primary;
  const subtitleColor = light ? 'rgba(255,255,255,0.82)' : COLORS.gray[500];
  const spacingStyle =
    spacing === 'inline'
      ? styles.wrapInline
      : spacing === 'compact'
        ? styles.wrapCompact
        : styles.wrapSection;

  return (
    <View style={[spacingStyle, style]}>
      <View style={styles.titleRow}>
        <View style={[styles.line, { backgroundColor: lineColor }]} />
        <Text style={[styles.title, { color: titleColor }]} numberOfLines={2}>
          {title}
        </Text>
        <View style={[styles.line, { backgroundColor: lineColor }]} />
      </View>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: subtitleColor }]}>{subtitle}</Text>
      ) : null}
      {rightAccessory ? <View style={styles.accessoryWrap}>{rightAccessory}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapSection: {
    marginTop: 24,
    marginBottom: 14,
  },
  wrapInline: {
    marginTop: 0,
    marginBottom: 12,
  },
  wrapCompact: {
    marginTop: 0,
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  line: {
    flex: 1,
    height: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
    flexShrink: 1,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 2,
    lineHeight: 16,
    paddingHorizontal: 8,
  },
  accessoryWrap: {
    marginTop: 8,
    alignItems: 'center',
  },
});
