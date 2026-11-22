import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import { playLoginSound, releaseLoginSounds } from '../lib/loginSounds';

const BLUE = '#2457F5';

/**
 * Shown once right after a customer logs in: "Engine on!" plus what to do next.
 * "Add my car" opens the existing Add vehicle form (Settings → My Profile).
 */
export default function CustomerWelcomeScreen({ navigation, onDone }: any) {
  const insets = useSafeAreaInsets();
  const needle = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  // "Vroom" once as the needle swings; free the login sounds when leaving.
  useEffect(() => {
    playLoginSound('engine');
    return () => {
      setTimeout(releaseLoginSounds, 2000);
    };
  }, []);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(needle, { toValue: 1, duration: 900, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
  }, [needle, pop]);

  const goTo = (routes: { name: string; params?: object }[]) => {
    onDone?.();
    navigation.dispatch(CommonActions.reset({ index: routes.length - 1, routes }));
  };

  const ticks = 11;
  const r = 92;
  const rotate = needle.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '58deg'] });

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <StatusBar barStyle="light-content" backgroundColor={BLUE} />
      {/* faint stripes */}
      {Array.from({ length: 14 }).map((_, i) => (
        <View key={i} style={[styles.stripe, { top: 60 + i * 56 }]} />
      ))}

      <View style={styles.badge}>
        <Text style={styles.badgeText}>NUMBER VERIFIED</Text>
      </View>

      <View style={styles.dial}>
        {Array.from({ length: ticks }).map((_, i) => {
          const deg = -90 + (180 / (ticks - 1)) * i;
          const green = i >= ticks - 2;
          return (
            <View
              key={i}
              style={[
                styles.tick,
                {
                  backgroundColor: green ? '#4ADE80' : '#FFFFFF',
                  transform: [{ rotate: `${deg}deg` }, { translateY: -r }],
                },
              ]}
            />
          );
        })}
        <Animated.View style={[styles.needleWrap, { transform: [{ translateY: 36 }, { rotate }, { translateY: -36 }] }]}>
          <View style={styles.needle} />
        </Animated.View>
        <Animated.View style={[styles.check, { transform: [{ scale: pop }] }]}>
          <Ionicons name="checkmark" size={30} color="#16A34A" />
        </Animated.View>
      </View>

      <Text style={styles.title}>ENGINE ON!</Text>
      <Text style={styles.subtitle}>Welcome to MyFNG. Aapka account ready hai.</Text>

      <View style={styles.card}>
        <Text style={styles.cardHead}>WHAT&apos;S NEXT?</Text>
        {['Add your car', 'Choose a service', 'Book a doorstep pickup'].map((t, i) => (
          <View key={t} style={styles.stepRow}>
            <View style={[styles.stepNum, i === 0 && styles.stepNumActive]}>
              <Text style={[styles.stepNumText, i === 0 && styles.stepNumTextActive]}>{i + 1}</Text>
            </View>
            <Text style={styles.stepText}>{t}</Text>
          </View>
        ))}
      </View>

      <View style={{ flex: 1 }} />

      <TouchableOpacity
        style={styles.primary}
        activeOpacity={0.9}
        onPress={() => goTo([{ name: 'PublicHome' }, { name: 'Settings', params: { addVehicle: true } }])}
      >
        <Text style={styles.primaryText}>ADD MY CAR</Text>
        <Ionicons name="arrow-forward" size={20} color={BLUE} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => goTo([{ name: 'PublicHome' }])} hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}>
        <Text style={styles.skip}>Skip for now, home pe jao</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BLUE, paddingHorizontal: 22, alignItems: 'center', overflow: 'hidden' },
  stripe: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 8,
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  dial: { width: 220, height: 150, marginTop: 26, alignItems: 'center', justifyContent: 'flex-end' },
  // Tick centres sit on the dial centre (x 110, y 110); translateY pushes each out to the arc.
  tick: { position: 'absolute', bottom: 27, left: 106, width: 8, height: 26, borderRadius: 4 },
  needleWrap: { position: 'absolute', bottom: 40, left: 107, width: 6, height: 72, alignItems: 'center' },
  needle: { flex: 1, width: 6, borderRadius: 3, backgroundColor: '#FBBF24' },
  check: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { color: '#FFFFFF', fontSize: 44, fontWeight: '900', letterSpacing: 1, marginTop: 18 },
  subtitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'center', marginTop: 8, lineHeight: 22 },
  card: {
    alignSelf: 'stretch',
    marginTop: 26,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    padding: 16,
    gap: 12,
  },
  cardHead: { color: '#DCE6FF', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumActive: { backgroundColor: '#FFFFFF' },
  stepNumText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  stepNumTextActive: { color: BLUE },
  stepText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  primary: {
    alignSelf: 'stretch',
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryText: { color: BLUE, fontSize: 18, fontWeight: '900', letterSpacing: 1.5 },
  skip: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginTop: 16, textDecorationLine: 'underline' },
});
