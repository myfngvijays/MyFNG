import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
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

const DOT_COUNT = 5;

export default function SplashScreen({
  onComplete,
  durationMs = 2400,
}: SplashScreenProps) {
  const logoFade = useRef(new Animated.Value(0)).current;
  const logoY = useRef(new Animated.Value(-30)).current;
  const carFade = useRef(new Animated.Value(0)).current;
  const carScale = useRef(new Animated.Value(0.7)).current;

  const pillLeftFade = useRef(new Animated.Value(0)).current;
  const pillLeftX = useRef(new Animated.Value(-30)).current;
  const pillRightFade = useRef(new Animated.Value(0)).current;
  const pillRightX = useRef(new Animated.Value(30)).current;
  const pillBob = useRef(new Animated.Value(0)).current;

  const serviceFade = useRef(new Animated.Value(0)).current;
  const badgeFade = useRef(new Animated.Value(0)).current;
  const badgeY = useRef(new Animated.Value(10)).current;

  const roadLeftFade = useRef(new Animated.Value(0)).current;
  const roadRightFade = useRef(new Animated.Value(0)).current;
  const dotsFade = useRef(new Animated.Value(0)).current;
  const dotsTravel = useRef(new Animated.Value(0)).current;

  const dotAnims = useMemo(
    () => Array.from({ length: DOT_COUNT }, () => new Animated.Value(0.2)),
    []
  );

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoFade, { toValue: 1, duration: 350, delay: 80, useNativeDriver: true }),
        Animated.timing(logoY, { toValue: 0, duration: 350, delay: 80, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(carFade, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(carScale, { toValue: 1, friction: 6, tension: 100, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(roadLeftFade, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(roadRightFade, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(dotsFade, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(pillLeftFade, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(pillLeftX, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(pillRightFade, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(pillRightX, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.timing(serviceFade, { toValue: 1, duration: 350, delay: 600, useNativeDriver: true }).start();
    Animated.parallel([
      Animated.timing(badgeFade, { toValue: 1, duration: 300, delay: 800, useNativeDriver: true }),
      Animated.timing(badgeY, { toValue: 0, duration: 300, delay: 800, useNativeDriver: true }),
    ]).start();

    // Continuous floating bob for both pills
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pillBob, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pillBob, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    bobLoop.start();

    // Continuous downward "travel" effect on dotted connector
    const dotsLoop = Animated.loop(
      Animated.timing(dotsTravel, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    dotsLoop.start();

    // Sequential dot pulse to create flowing effect
    const dotSequence = Animated.loop(
      Animated.stagger(
        180,
        dotAnims.map((d) =>
          Animated.sequence([
            Animated.timing(d, { toValue: 1, duration: 350, useNativeDriver: true }),
            Animated.timing(d, { toValue: 0.2, duration: 350, useNativeDriver: true }),
          ])
        )
      )
    );
    dotSequence.start();

    const timer = setTimeout(onComplete, durationMs);
    return () => {
      clearTimeout(timer);
      bobLoop.stop();
      dotsLoop.stop();
      dotSequence.stop();
    };
  }, [
    durationMs,
    onComplete,
    logoFade,
    logoY,
    carFade,
    carScale,
    pillLeftFade,
    pillLeftX,
    pillRightFade,
    pillRightX,
    pillBob,
    serviceFade,
    badgeFade,
    badgeY,
    roadLeftFade,
    roadRightFade,
    dotsFade,
    dotsTravel,
    dotAnims,
  ]);

  const pillBobY = pillBob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const pillBobYReverse = pillBob.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });

  return (
    <View style={s.container}>
      {/* Background watermark */}
      <Text style={s.watermark}>MyFNG</Text>

      {/* Logo + Subtitle */}
      <Animated.View style={[s.logoWrap, { opacity: logoFade, transform: [{ translateY: logoY }] }]}>
        <Image source={require('../../assets/logo.png')} style={s.logo} resizeMode="contain" />
        <Text style={s.subtitle}>India&apos;s #1 AI car service booking platform</Text>
      </Animated.View>

      {/* Car + Floating Pills + Road Lanes + Dotted Connector */}
      <View style={s.carSection}>
        {/* Diagonal road lane lines emanating from back of car */}
        <Animated.View
          style={[
            s.roadLineLeft,
            { opacity: roadLeftFade },
          ]}
        />
        <Animated.View
          style={[
            s.roadLineRight,
            { opacity: roadRightFade },
          ]}
        />

        <Animated.View
          style={[
            s.pillLeft,
            { opacity: pillLeftFade, transform: [{ translateX: pillLeftX }, { translateY: pillBobY }] },
          ]}
        >
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

        <Animated.View
          style={[
            s.pillRight,
            { opacity: pillRightFade, transform: [{ translateX: pillRightX }, { translateY: pillBobYReverse }] },
          ]}
        >
          <View style={[s.pillIcon, { backgroundColor: '#ECFDF5' }]}>
            <Ionicons name="locate" size={14} color="#10B981" />
          </View>
          <Text style={s.pillText}>Live Tracking</Text>
        </Animated.View>
      </View>

      {/* Animated dotted connector between car and active service icon */}
      <Animated.View style={[s.dotsConnector, { opacity: dotsFade }]} pointerEvents="none">
        {dotAnims.map((d, i) => (
          <Animated.View
            key={i}
            style={[
              s.connectorDot,
              {
                opacity: d,
                transform: [
                  {
                    scale: d.interpolate({ inputRange: [0.2, 1], outputRange: [0.7, 1.1] }),
                  },
                ],
              },
            ]}
          />
        ))}
      </Animated.View>

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
  carWrap: { width: 200, height: 160, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  carImage: { width: 200, height: 150 },

  roadLineLeft: {
    position: 'absolute',
    width: 2,
    height: 90,
    backgroundColor: 'rgba(37,99,235,0.55)',
    borderRadius: 2,
    bottom: -20,
    left: '38%',
    transform: [{ rotate: '18deg' }],
    zIndex: 0,
  },
  roadLineRight: {
    position: 'absolute',
    width: 2,
    height: 90,
    backgroundColor: 'rgba(37,99,235,0.55)',
    borderRadius: 2,
    bottom: -20,
    right: '38%',
    transform: [{ rotate: '-18deg' }],
    zIndex: 0,
  },

  dotsConnector: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 36,
    marginTop: -10,
    marginBottom: 4,
  },
  connectorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2563EB',
    marginVertical: 1,
  },

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
