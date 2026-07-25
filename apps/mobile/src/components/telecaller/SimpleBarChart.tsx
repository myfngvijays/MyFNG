import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../../constants/theme';

type Point = { label: string; value: number; color?: string };

export default function SimpleBarChart({
  data,
  height = 120,
  title,
}: {
  data: Point[];
  height?: number;
  title?: string;
}) {
  const max = Math.max(1, ...data.map((d) => Number(d.value || 0)));

  return (
    <View style={styles.wrap}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={[styles.row, { height }]}>
        {data.map((d, i) => {
          const h = Math.max(4, Math.round((Number(d.value || 0) / max) * (height - 28)));
          return (
            <View key={`${d.label}-${i}`} style={styles.col}>
              <Text style={styles.value}>{d.value}</Text>
              <View style={[styles.barTrack, { height: height - 28 }]}>
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
              <Text style={styles.label} numberOfLines={1}>{d.label}</Text>
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
    padding: 14,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textHeading,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  col: {
    flex: 1,
    alignItems: 'center',
  },
  value: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  barTrack: {
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: '70%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    minHeight: 4,
  },
  label: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 6,
    fontWeight: '600',
  },
});
