import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

/** Customer login art: white side-view car on a road, and a small speedometer. */

export function SideCar({ width = 170 }: { width?: number }) {
  const s = width / 170;
  return (
    <View style={{ width, height: 62 * s }}>
      {/* speed lines */}
      <View style={[styles.speedLine, { top: 22 * s, left: -44 * s, width: 34 * s }]} />
      <View style={[styles.speedLine, { top: 32 * s, left: -30 * s, width: 22 * s }]} />
      <View style={[styles.speedLine, { top: 42 * s, left: -40 * s, width: 30 * s }]} />
      {/* cabin */}
      <View
        style={[
          styles.cabin,
          { left: 38 * s, width: 82 * s, height: 30 * s, borderTopLeftRadius: 34 * s, borderTopRightRadius: 26 * s },
        ]}
      >
        <View style={[styles.window, { left: 14 * s, width: 28 * s, height: 16 * s, borderTopLeftRadius: 14 * s }]} />
        <View style={[styles.window, { left: 46 * s, width: 26 * s, height: 16 * s, borderTopRightRadius: 12 * s }]} />
      </View>
      {/* body */}
      <View style={[styles.body, { top: 26 * s, width, height: 24 * s, borderRadius: 12 * s }]}>
        <View style={[styles.headlight, { right: 2 * s, top: 6 * s, width: 7 * s, height: 6 * s }]} />
      </View>
      {/* wheels */}
      {[30, 126].map((x) => (
        <View key={x} style={[styles.wheel, { left: x * s, top: 38 * s, width: 24 * s, height: 24 * s, borderRadius: 12 * s }]}>
          <View style={[styles.hub, { width: 9 * s, height: 9 * s, borderRadius: 4.5 * s }]} />
        </View>
      ))}
    </View>
  );
}

/** Half-circle speedometer. `value` 0..max moves the needle and lights the ticks. */
export function Speedometer({ value, max = 10, size = 96 }: { value: number; max?: number; size?: number }) {
  const progress = Math.max(0, Math.min(1, value / max));
  const anim = useRef(new Animated.Value(progress)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: progress,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, progress]);

  const ticks = 9;
  const r = size / 2 - 6;
  const needleLen = r - 8;
  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '90deg'] });

  return (
    <View style={{ width: size, height: size / 2 + 10 }}>
      {Array.from({ length: ticks }).map((_, i) => {
        const deg = -90 + (180 / (ticks - 1)) * i;
        const lit = progress > 0 && i / (ticks - 1) <= progress;
        return (
          <View
            key={i}
            style={[
              styles.tick,
              {
                left: size / 2 - 2,
                top: size / 2 - 7,
                backgroundColor: lit ? (i >= ticks - 2 ? '#22C55E' : '#2457F5') : '#CBD5E1',
                transform: [{ rotate: `${deg}deg` }, { translateY: -r }],
              },
            ]}
          />
        );
      })}
      {/* Needle pivots at its bottom end (the dial centre). */}
      <Animated.View
        style={[
          styles.needleWrap,
          {
            left: size / 2 - 1.5,
            top: size / 2 - needleLen,
            height: needleLen,
            transform: [{ translateY: needleLen / 2 }, { rotate }, { translateY: -needleLen / 2 }],
          },
        ]}
      >
        <View style={styles.needle} />
      </Animated.View>
      <View style={[styles.pivot, { left: size / 2 - 6, top: size / 2 - 6 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  speedLine: { position: 'absolute', height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.55)' },
  cabin: { position: 'absolute', top: 2, backgroundColor: '#FFFFFF' },
  window: { position: 'absolute', top: 8, backgroundColor: '#C7D7FF', borderRadius: 3 },
  body: { position: 'absolute', left: 0, backgroundColor: '#FFFFFF' },
  headlight: { position: 'absolute', backgroundColor: '#FDBA35', borderRadius: 2 },
  wheel: { position: 'absolute', backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' },
  hub: { backgroundColor: '#E2E8F0' },
  tick: { position: 'absolute', width: 4, height: 14, borderRadius: 2 },
  needleWrap: { position: 'absolute', width: 3, alignItems: 'center' },
  needle: { flex: 1, width: 3, borderRadius: 2, backgroundColor: '#EF4444' },
  pivot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#0F172A' },
});
