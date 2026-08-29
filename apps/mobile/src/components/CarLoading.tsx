import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator as RNActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { COLORS } from '../constants/theme';

type LoaderSize = 'full' | 'compact';

type Props = {
  label?: string;
  size?: LoaderSize;
};

const MIN_DEG = -120;
const MAX_DEG = 120;
const TICK_COUNT = 13;
const MAX_SPEED = 180;
const DIAL = { full: 118, compact: 86 } as const;

function tickColor(index: number) {
  const t = index / (TICK_COUNT - 1);
  if (t >= 0.82) return '#EF4444';
  if (t >= 0.64) return '#FF6B00';
  return '#7DD3FC';
}

function isOnAccentColor(color?: string | number) {
  const c = String(color || '').trim().toLowerCase();
  return c === '#fff' || c === '#ffffff' || c === 'white';
}

export default function CarLoading({ label, size = 'full' }: Props) {
  const compact = size === 'compact';
  const dial = DIAL[size];
  const sweep = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.45)).current;
  const [speed, setSpeed] = useState(0);

  const ticks = useMemo(
    () =>
      Array.from({ length: TICK_COUNT }, (_, i) => {
        const t = i / (TICK_COUNT - 1);
        return {
          deg: MIN_DEG + t * (MAX_DEG - MIN_DEG),
          major: i % 2 === 0,
          color: tickColor(i),
          value: Math.round(t * MAX_SPEED),
        };
      }),
    [],
  );

  useEffect(() => {
    const id = sweep.addListener(({ value }) => {
      setSpeed(Math.round(value * MAX_SPEED));
    });

    const sweepLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: 1150,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(sweep, {
          toValue: 0.22,
          duration: 520,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(sweep, {
          toValue: 0.62,
          duration: 380,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(sweep, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
    );
    sweepLoop.start();

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.35,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    glowLoop.start();

    return () => {
      sweep.removeListener(id);
      sweepLoop.stop();
      glowLoop.stop();
    };
  }, [glow, sweep]);

  const needleRotate = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [`${MIN_DEG}deg`, `${MAX_DEG}deg`],
  });

  const numberRadius = dial * 0.31;
  const cx = dial / 2;

  return (
    <View
      style={styles.wrap}
      accessibilityRole="progressbar"
      accessibilityLabel={label || 'Loading'}
    >
      <View style={[styles.dialOuter, { width: dial + 10, height: dial + 10, borderRadius: (dial + 10) / 2 }]}>
        <Animated.View
          style={[
            styles.glow,
            { opacity: glow, width: dial + 4, height: dial + 4, borderRadius: (dial + 4) / 2 },
          ]}
        />
        <View style={[styles.dial, compact && styles.dialCompact, { width: dial, height: dial, borderRadius: dial / 2 }]}>
          {ticks.map((tick) => (
            <View
              key={`tick-${tick.deg}`}
              pointerEvents="none"
              style={[
                styles.tickSpin,
                { width: dial, height: dial, transform: [{ rotate: `${tick.deg}deg` }] },
              ]}
            >
              <View
                style={[
                  styles.tick,
                  {
                    width: tick.major ? 2.5 : 1.5,
                    height: tick.major ? (compact ? 8 : 11) : compact ? 5 : 7,
                    backgroundColor: tick.color,
                    top: compact ? 6 : 8,
                  },
                ]}
              />
            </View>
          ))}

          {!compact
            ? ticks
                .filter((tick) => tick.major && tick.value % 90 === 0)
                .map((tick) => {
                  const rad = (tick.deg * Math.PI) / 180;
                  return (
                    <Text
                      key={`num-${tick.value}`}
                      style={[
                        styles.tickNum,
                        {
                          left: cx + numberRadius * Math.sin(rad) - 10,
                          top: cx - numberRadius * Math.cos(rad) - 7,
                        },
                      ]}
                    >
                      {tick.value}
                    </Text>
                  );
                })
            : null}

          <Animated.View
            pointerEvents="none"
            style={[styles.needleSpin, { width: dial, height: dial, transform: [{ rotate: needleRotate }] }]}
          >
            <View style={[styles.needle, compact && styles.needleCompact]} />
            <View style={[styles.needleTip, compact && styles.needleTipCompact]} />
          </Animated.View>

          <View style={[styles.hub, compact && styles.hubCompact]}>
            <View style={[styles.hubInner, compact && styles.hubInnerCompact]} />
          </View>

          <View style={[styles.readout, compact && styles.readoutCompact]}>
            <Text style={[styles.speed, compact && styles.speedCompact]}>{String(speed).padStart(3, '0')}</Text>
            <Text style={[styles.unit, compact && styles.unitCompact]}>km/h</Text>
          </View>
        </View>
      </View>
      {label ? <Text style={[styles.label, compact && styles.labelCompact]}>{label}</Text> : null}
    </View>
  );
}

/** Drop-in for RN ActivityIndicator: page/section loaders use the speedo; button/inline stay native. */
export function ActivityIndicator({
  size,
  color,
  style,
  animating = true,
  ...rest
}: React.ComponentProps<typeof RNActivityIndicator> & { style?: StyleProp<ViewStyle> }) {
  if (animating === false) return null;
  const inline = size === 'small' || (isOnAccentColor(color) && size !== 'large');
  if (inline) {
    return <RNActivityIndicator size={size} color={color} style={style} animating={animating} {...rest} />;
  }
  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center' }, style]}>
      <CarLoading size={size === 'large' ? 'full' : 'compact'} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialOuter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(0, 74, 173, 0.4)',
  },
  dial: {
    backgroundColor: '#071628',
    borderWidth: 4,
    borderColor: '#1E3A5F',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialCompact: {
    borderWidth: 3,
  },
  tickSpin: {
    position: 'absolute',
    alignItems: 'center',
  },
  tick: {
    position: 'absolute',
    borderRadius: 2,
  },
  tickNum: {
    position: 'absolute',
    width: 20,
    textAlign: 'center',
    color: '#93C5FD',
    fontSize: 8,
    fontWeight: '800',
  },
  needleSpin: {
    position: 'absolute',
    alignItems: 'center',
  },
  needle: {
    position: 'absolute',
    top: 14,
    width: 3,
    height: '36%',
    backgroundColor: COLORS.accent,
    borderRadius: 2,
  },
  needleCompact: {
    top: 11,
    width: 2.5,
    height: '34%',
  },
  needleTip: {
    position: 'absolute',
    top: 12,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FDBA74',
  },
  needleTipCompact: {
    top: 9,
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  hub: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  hubCompact: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  hubInner: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#071628',
  },
  hubInnerCompact: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  readout: {
    position: 'absolute',
    bottom: 14,
    alignItems: 'center',
  },
  readoutCompact: {
    bottom: 10,
  },
  speed: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.4,
  },
  speedCompact: {
    fontSize: 11,
  },
  unit: {
    marginTop: -1,
    color: '#93C5FD',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  unitCompact: {
    fontSize: 7,
  },
  label: {
    marginTop: 8,
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  labelCompact: {
    marginTop: 6,
    fontSize: 12,
  },
});
