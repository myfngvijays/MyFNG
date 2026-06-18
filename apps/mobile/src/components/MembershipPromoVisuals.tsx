import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { RSA_ICON_RED_SOURCE } from '../lib/serviceIcons';

const PRIME_CYCLE_BLUE = COLORS.primary;
const PRIME_CYCLE_RED = '#DC2626';
const RSA_CYCLE_DARK = '#991B1B';

export function PrimeMembershipIcon({ size = 46, compact = false }: { size?: number; compact?: boolean }) {
  const colorAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(colorAnim, {
        toValue: 1,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [colorAnim]);

  const backgroundColor = colorAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [PRIME_CYCLE_BLUE, PRIME_CYCLE_RED, PRIME_CYCLE_BLUE],
  });

  const iconSize = compact ? 14 : 22;

  return (
    <Animated.View
      style={[
        compact ? styles.membershipResultIconWrap : styles.membershipIconWrap,
        { width: size, height: size, borderRadius: size / 2, backgroundColor },
      ]}
    >
      <View
        style={{
          position: 'absolute',
          width: size * 0.95,
          height: size * 0.95,
          borderRadius: size * 0.48,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.12)',
          top: -size * 0.28,
          right: -size * 0.18,
        }}
      />
      <Ionicons name="diamond" size={iconSize} color="#FFD166" />
    </Animated.View>
  );
}

export function RSAMembershipIcon({ size = 46, compact = false }: { size?: number; compact?: boolean }) {
  const colorAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(colorAnim, {
        toValue: 1,
        duration: 5000,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [colorAnim]);

  const backgroundColor = colorAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [PRIME_CYCLE_RED, RSA_CYCLE_DARK, PRIME_CYCLE_RED],
  });

  const iconSize = compact ? size * 0.52 : size * 0.58;

  return (
    <Animated.View
      style={[
        compact ? styles.membershipResultIconWrap : styles.membershipIconWrap,
        { width: size, height: size, borderRadius: size / 2, backgroundColor },
      ]}
    >
      <View
        style={{
          position: 'absolute',
          width: size * 0.95,
          height: size * 0.95,
          borderRadius: size * 0.48,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.14)',
          top: -size * 0.28,
          right: -size * 0.18,
        }}
      />
      <Image source={RSA_ICON_RED_SOURCE} style={{ width: iconSize, height: iconSize }} resizeMode="contain" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  membershipIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    overflow: 'hidden',
  },
  membershipResultIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
