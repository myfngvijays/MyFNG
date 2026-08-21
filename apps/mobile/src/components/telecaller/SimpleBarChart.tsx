import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/theme';

type Point = { label: string; value: number; color?: string; fullLabel?: string };

export default function SimpleBarChart({
  data,
  height = 140,
  title,
  layout = 'auto',
}: {
  data: Point[];
  height?: number;
  title?: string;
  /** vertical = classic columns; horizontal = label + bar (best for long names); auto picks by count */
  layout?: 'vertical' | 'horizontal' | 'auto';
}) {
  const max = Math.max(1, ...data.map((d) => Number(d.value || 0)));
  const useHorizontal =
    layout === 'horizontal' || (layout === 'auto' && data.length > 5);

  if (useHorizontal) {
    return (
      <View style={styles.wrap}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        <View style={styles.hList}>
          {data.map((d, i) => {
            const value = Number(d.value || 0);
            const pct = Math.max(value > 0 ? 6 : 0, Math.round((value / max) * 100));
            const name = String(d.fullLabel || d.label || '').trim() || '—';
            return (
              <View key={`${name}-${i}`} style={styles.hRow}>
                <Text style={styles.hLabel} numberOfLines={2}>
                  {name}
                </Text>
                <View style={styles.hTrack}>
                  <View
                    style={[
                      styles.hBar,
                      {
                        width: `${pct}%`,
                        backgroundColor: d.color || COLORS.primary,
                        opacity: value > 0 ? 1 : 0.25,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.hValue}>{value}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  const barArea = Math.max(48, height - 44);

  return (
    <View style={styles.wrap}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={[styles.row, { minHeight: height }]}>
        {data.map((d, i) => {
          const value = Number(d.value || 0);
          const h = Math.max(value > 0 ? 8 : 3, Math.round((value / max) * (barArea - 4)));
          return (
            <View key={`${d.label}-${i}`} style={styles.col}>
              <Text style={styles.value}>{value}</Text>
              <View style={[styles.barTrack, { height: barArea }]}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: h,
                      backgroundColor: d.color || COLORS.primary,
                    },
                  ]}
                />
              </View>
              <Text style={styles.label} numberOfLines={2}>
                {d.fullLabel || d.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textHeading,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 4,
  },
  col: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 2,
  },
  value: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 6,
    textAlign: 'center',
  },
  barTrack: {
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: '55%',
    maxWidth: 28,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    minHeight: 3,
  },
  label: {
    fontSize: 9,
    color: COLORS.textSecondary,
    marginTop: 8,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 11,
  },
  hList: {
    gap: 10,
  },
  hRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hLabel: {
    width: 108,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textHeading,
    lineHeight: 15,
  },
  hTrack: {
    flex: 1,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  hBar: {
    height: 14,
    borderRadius: 7,
    minWidth: 0,
  },
  hValue: {
    width: 36,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textHeading,
  },
});
