import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type SplashScreenProps = {
  onComplete: () => void;
  durationMs?: number;
};

const SERVICE_ITEMS = [
  { name: 'AC Service', icon: 'snow-outline' as const },
  { name: 'Brakes', icon: 'disc-outline' as const },
  { name: 'Periodic Service', icon: 'construct' as const, active: true },
  { name: 'Engine', icon: 'pulse-outline' as const },
  { name: 'Oil Change', icon: 'water-outline' as const },
];

export default function SplashScreen({
  onComplete,
  durationMs = 6000,
}: SplashScreenProps) {
  const logoFade = useRef(new Animated.Value(0)).current;
  const logoY = useRef(new Animated.Value(-30)).current;
  const carFade = useRef(new Animated.Value(0)).current;
  const carScale = useRef(new Animated.Value(0.7)).current;
  const pillLeftFade = useRef(new Animated.Value(0)).current;
  const pillLeftX = useRef(new Animated.Value(-30)).current;
  const pillRightFade = useRef(new Animated.Value(0)).current;
  const pillRightX = useRef(new Animated.Value(30)).current;
  const serviceFade = useRef(new Animated.Value(0)).current;
  const badgeFade = useRef(new Animated.Value(0)).current;
  const badgeY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoFade, { toValue: 1, duration: 700, delay: 200, useNativeDriver: true }),
        Animated.timing(logoY, { toValue: 0, duration: 700, delay: 200, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(carFade, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(carScale, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(pillLeftFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(pillLeftX, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(pillRightFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(pillRightX, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.timing(serviceFade, { toValue: 1, duration: 700, delay: 1400, useNativeDriver: true }).start();
    Animated.parallel([
      Animated.timing(badgeFade, { toValue: 1, duration: 600, delay: 1800, useNativeDriver: true }),
      Animated.timing(badgeY, { toValue: 0, duration: 600, delay: 1800, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(onComplete, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onComplete, logoFade, logoY, carFade, carScale, pillLeftFade, pillLeftX, pillRightFade, pillRightX, serviceFade, badgeFade, badgeY]);

  return (
    <View style={s.container}>
      {/* Background watermark */}
      <Text style={s.watermark}>MyFNG</Text>

      {/* Logo + Subtitle */}
      <Animated.View style={[s.logoWrap, { opacity: logoFade, transform: [{ translateY: logoY }] }]}>
        <Image source={require('../../assets/logo.png')} style={s.logo} resizeMode="contain" />
        <Text style={s.subtitle}>India&apos;s #1 AI car service booking platform</Text>
      </Animated.View>

      {/* Car + Floating Pills */}
      <View style={s.carSection}>
        <Animated.View style={[s.pillLeft, { opacity: pillLeftFade, transform: [{ translateX: pillLeftX }] }]}>
          <View style={s.pillIcon}>
            <Ionicons name="chatbubble-ellipses" size={14} color="#2563EB" />
          </View>
          <Text style={s.pillText}>AI Booking</Text>
        </Animated.View>

        <Animated.View style={[s.carWrap, { opacity: carFade, transform: [{ scale: carScale }] }]}>
          <Image
            source={require('../../assets/splash-car.png')}
            style={s.carImage}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View style={[s.pillRight, { opacity: pillRightFade, transform: [{ translateX: pillRightX }] }]}>
          <View style={[s.pillIcon, { backgroundColor: '#ECFDF5' }]}>
            <Ionicons name="locate" size={14} color="#10B981" />
          </View>
          <Text style={s.pillText}>Live Tracking</Text>
        </Animated.View>
      </View>

      {/* Service Icons Row */}
      <Animated.View style={[s.serviceRow, { opacity: serviceFade }]}>
        {SERVICE_ITEMS.map((svc) => (
          <View key={svc.name} style={s.serviceItem}>
            <View style={[s.serviceIconBg, svc.active && s.serviceIconBgActive]}>
              <Ionicons name={svc.icon} size={svc.active ? 26 : 22} color={svc.active ? '#FFFFFF' : '#9CA3AF'} />
            </View>
            <Text style={[s.serviceName, svc.active && s.serviceNameActive]}>{svc.name}</Text>
          </View>
        ))}
      </Animated.View>

      {/* Trust Badge */}
      <Animated.View style={[s.badge, { opacity: badgeFade, transform: [{ translateY: badgeY }] }]}>
        <Text style={s.badgeText}>
          Trusted by <Text style={s.badgeBold}>10000+ Car Owners</Text>
        </Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F7FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  watermark: {
    position: 'absolute',
    top: '30%',
    fontSize: 100,
    fontWeight: '900',
    color: 'rgba(37,99,235,0.04)',
    letterSpacing: -3,
  },

  logoWrap: { alignItems: 'center', marginBottom: 16 },
  logo: { width: 220, height: 70 },
  subtitle: {
    color: '#6B7280', fontSize: 11, marginTop: 4,
    textAlign: 'center', fontWeight: '700', letterSpacing: -0.3,
  },

  carSection: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    minHeight: 160,
  },
  carWrap: { width: 200, height: 160, alignItems: 'center', justifyContent: 'center' },
  carImage: { width: 200, height: 150 },

  pillLeft: {
    position: 'absolute',
    left: 8,
    top: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    zIndex: 2,
  },
  pillRight: {
    position: 'absolute',
    right: 8,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    zIndex: 2,
  },
  pillIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center',
  },
  pillText: { fontSize: 11, fontWeight: '800', color: '#111827' },

  serviceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
    marginTop: 8,
  },
  serviceItem: { alignItems: 'center', gap: 8 },
  serviceIconBg: {
    width: 56, height: 56, borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
  },
  serviceIconBgActive: {
    width: 72, height: 72,
    backgroundColor: '#2563EB', borderWidth: 0,
    shadowColor: '#2563EB', shadowOpacity: 0.4,
    shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  serviceName: { fontSize: 9, fontWeight: '700', color: '#9CA3AF' },
  serviceNameActive: { color: '#2563EB' },

  badge: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 16,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  badgeText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  badgeBold: { color: '#1F2937', fontWeight: '700' },
});
