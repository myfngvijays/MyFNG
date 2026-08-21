import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/theme';

type Point = { label: string; value: number; color?: string };

export default function SimpleBarChart({
  data,
  height = 140,
  title,
}: {
  data: Point[];
  height?: number;
  title?: string;
}) {
  const max = Math.max(1, ...data.map((d) => Number(d.value || 0)));
  const barArea = Math.max(48, height - 44);

  return (
    <View style={styles.wrap}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={[styles.row, { minHeight: height }]}>
        {data.map((d, i) => {
          const h = Math.max(4, Math.round((Number(d.value || 0) / max) * (barArea - 4)));
          return (
            <View key={`${d.label}-${i}`} style={styles.col}>
              <Text style={styles.value}>{d.value}</Text>
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
              <Text style={styles.label} numberOfLines={1}>
                {d.label}
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
    minHeight: 4,
  },
  label: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 8,
    fontWeight: '600',
    textAlign: 'center',
  },
});
