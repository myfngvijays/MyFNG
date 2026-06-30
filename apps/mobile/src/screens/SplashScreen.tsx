import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SplashScreenProps = {
  onComplete: () => void;
  durationMs?: number;
};

const SERVICE_ITEMS = [
  { name: 'AC Service', icon: 'snow-outline' as const },
  { name: 'Brakes Service', icon: 'disc-outline' as const },
  { name: 'Periodic Service', icon: 'construct' as const },
  { name: 'Denting Service', icon: 'hammer-outline' as const },
  { name: 'Detailing Service', icon: 'sparkles-outline' as const },
];

// Appear: Same Day → Live Tracking → Free Pickup → Transparent Pricing → Genuine Parts → AI Booking
const USP_ITEMS = [
  { label: 'Same Day Servicing', icon: 'flash' as const, bg: '#FEF3C7', color: '#D97706', side: 'left' as const, roadY: 0.15 },
  { label: 'Live Tracking', icon: 'locate' as const, bg: '#ECFDF5', color: '#10B981', side: 'right' as const, roadY: 0.32 },
  { label: 'Free Pickup & Drop', icon: 'car-outline' as const, bg: '#F5F3FF', color: '#7C3AED', side: 'left' as const, roadY: 0.28 },
  { label: 'Transparent Pricing', icon: 'pricetag-outline' as const, bg: '#F0FDFA', color: '#0D9488', side: 'right' as const, roadY: 0.08 },
  { label: 'Genuine Parts', icon: 'shield-checkmark' as const, bg: '#FFF7ED', color: '#EA580C', side: 'right' as const, roadY: 0.2 },
  { label: 'AI Booking', icon: 'chatbubble-ellipses' as const, bg: '#EFF6FF', color: '#2563EB', side: 'left' as const, roadY: 0.4 },
];

const ROAD_DASH_COUNT = 12;
const SERVICE_SLOT = 62;
const ACTIVE_SERVICE_INDEX = 2; // Periodic Service — fixed center
const SPLASH_DURATION_MS = 5000;
const USP_INITIAL_DELAY_MS = 500;
const USP_STAGGER_MS = 520;
const USP_ENTER_DURATION_MS = 400;

/** Distance from screen edge — wider road (lower Y) keeps pills near the edges. */
function roadSideOffset(roadY: number) {
  return 1 + (1 - roadY) * 14;
}

export default function SplashScreen({
  onComplete,
  durationMs = SPLASH_DURATION_MS,
}: SplashScreenProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  const logoFade = useRef(new Animated.Value(0)).current;
  const logoY = useRef(new Animated.Value(-20)).current;
  const sceneFade = useRef(new Animated.Value(0)).current;
  const carDrive = useRef(new Animated.Value(0)).current;
  const roadFlow = useRef(new Animated.Value(0)).current;
  const serviceFade = useRef(new Animated.Value(0)).current;
  const badgeFade = useRef(new Animated.Value(0)).current;

  const uspSlides = useMemo(() => USP_ITEMS.map(() => new Animated.Value(0)), []);
  const uspFades = useMemo(() => USP_ITEMS.map(() => new Animated.Value(0)), []);
  const dashAnims = useMemo(
    () => Array.from({ length: ROAD_DASH_COUNT }, () => new Animated.Value(0)),
    []
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoFade, { toValue: 1, duration: 380, delay: 50, useNativeDriver: true }),
      Animated.timing(logoY, { toValue: 0, duration: 380, delay: 50, useNativeDriver: true }),
    ]).start();

    Animated.timing(sceneFade, { toValue: 1, duration: 420, delay: 220, useNativeDriver: true }).start();

    USP_ITEMS.forEach((_usp, i) => {
      Animated.sequence([
        Animated.delay(USP_INITIAL_DELAY_MS + i * USP_STAGGER_MS),
        Animated.parallel([
          Animated.timing(uspSlides[i], {
            toValue: 1,
            duration: USP_ENTER_DURATION_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(uspFades[i], {
            toValue: 1,
            duration: USP_ENTER_DURATION_MS,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });

    Animated.timing(serviceFade, { toValue: 1, duration: 320, delay: 900, useNativeDriver: true }).start();
    Animated.timing(badgeFade, {
      toValue: 1,
      duration: 300,
      delay: 100,
      useNativeDriver: true,
    }).start();

    const driveLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(carDrive, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(carDrive, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    driveLoop.start();

    const roadLoop = Animated.loop(
      Animated.timing(roadFlow, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    roadLoop.start();

    const dashLoop = Animated.loop(
      Animated.stagger(
        70,
        dashAnims.map((d) =>
          Animated.sequence([
            Animated.timing(d, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(d, { toValue: 0.15, duration: 400, useNativeDriver: true }),
          ])
        )
      )
    );
    dashLoop.start();

    const timer = setTimeout(onComplete, durationMs);
    return () => {
      clearTimeout(timer);
      driveLoop.stop();
      roadLoop.stop();
      dashLoop.stop();
    };
  }, [
    durationMs,
    onComplete,
    logoFade,
    logoY,
    sceneFade,
    carDrive,
    roadFlow,
    serviceFade,
    badgeFade,
    uspSlides,
    uspFades,
    dashAnims,
  ]);

  const carBobY = carDrive.interpolate({ inputRange: [0, 1], outputRange: [2, -3] });
  const carScale = carDrive.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.015, 1] });
  const roadShift = roadFlow.interpolate({ inputRange: [0, 1], outputRange: [0, 32] });

  return (
    <View style={[s.container, { paddingBottom: insets.bottom + 6 }]}>
      <Text style={[s.watermark, { top: insets.top + screenHeight * 0.22 }]}>MyFNG</Text>

      <Animated.View
        style={[
          s.logoWrap,
          { paddingTop: insets.top + 4, opacity: logoFade, transform: [{ translateY: logoY }] },
        ]}
      >
        <Image source={require('../../assets/logo.png')} style={s.logo} resizeMode="contain" />
        <Text style={s.subtitle}>India&apos;s #1 AI car service booking platform</Text>
      </Animated.View>

      <Animated.View style={[s.roadScene, { opacity: sceneFade }]}>
        <View style={s.roadVanish} pointerEvents="none">
          <View style={s.roadEdgeLeft} />
          <View style={s.roadEdgeRight} />

          {Array.from({ length: ROAD_DASH_COUNT }).map((_, i) => (
            <Animated.View
              key={`dash-${i}`}
              style={[
                s.roadDash,
                {
                  top: `${6 + i * 7.2}%`,
                  opacity: dashAnims[i],
                  transform: [{ translateY: roadShift }],
                },
              ]}
            />
          ))}
        </View>

        {USP_ITEMS.map((usp, i) => {
          const slideFrom = usp.side === 'left' ? -90 : 90;
          const edge = roadSideOffset(usp.roadY);
          return (
            <Animated.View
              key={usp.label}
              style={[
                s.uspPill,
                {
                  top: `${usp.roadY * 100}%`,
                  left: usp.side === 'left' ? `${edge}%` : undefined,
                  right: usp.side === 'right' ? `${edge}%` : undefined,
                  opacity: uspFades[i],
                  zIndex: 4 + i,
                  transform: [
                    {
                      translateX: uspSlides[i].interpolate({
                        inputRange: [0, 1],
                        outputRange: [slideFrom, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={[s.uspIcon, { backgroundColor: usp.bg }]}>
                <Ionicons name={usp.icon} size={12} color={usp.color} />
              </View>
              <Text style={s.uspText}>{usp.label}</Text>
            </Animated.View>
          );
        })}

        <Animated.View
          style={[
            s.carWrap,
            {
              transform: [{ translateY: carBobY }, { scale: carScale }],
            },
          ]}
        >
          <Image source={require('../../assets/splash-car.png')} style={s.carImage} resizeMode="contain" />
        </Animated.View>
      </Animated.View>

      <View style={s.bottomBlock}>
        <Animated.View style={[s.serviceRow, { opacity: serviceFade }]}>
          {SERVICE_ITEMS.map((svc, i) => {
            const isCenter = i === ACTIVE_SERVICE_INDEX;
            return (
              <View key={svc.name} style={[s.serviceSlot, { width: SERVICE_SLOT }]}>
                <View
                  style={[
                    s.serviceIconBg,
                    isCenter ? s.serviceIconLarge : s.serviceIconSmall,
                  ]}
                >
                  <Ionicons
                    name={svc.icon}
                    size={isCenter ? 28 : 18}
                    color={isCenter ? '#FFFFFF' : '#9CA3AF'}
                  />
                </View>
                <Text
                  style={[s.serviceName, isCenter && s.serviceNameActive]}
                  numberOfLines={isCenter ? 2 : 1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                >
                  {svc.name}
                </Text>
              </View>
            );
          })}
        </Animated.View>

        <Animated.View style={[s.badge, { opacity: badgeFade }]}>
          <Text style={s.badgeText}>
            Trusted by <Text style={s.flag}>🇮🇳</Text>{' '}
            <Text style={s.badgeBold}>10000+ Car Owners</Text>
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F7FF',
  },
  watermark: {
    position: 'absolute',
    alignSelf: 'center',
    fontSize: 100,
    fontWeight: '900',
    color: 'rgba(37,99,235,0.04)',
    letterSpacing: -3,
  },
  logoWrap: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  logo: {
    width: 218,
    height: 68,
  },
  subtitle: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  roadScene: {
    flex: 1,
    width: '100%',
    minHeight: 200,
    marginTop: 2,
    overflow: 'hidden',
  },
  roadVanish: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
  },
  roadEdgeLeft: {
    position: 'absolute',
    bottom: 24,
    left: '12%',
    width: 3,
    height: '92%',
    backgroundColor: 'rgba(37,99,235,0.5)',
    borderRadius: 2,
    transform: [{ rotate: '10deg' }],
  },
  roadEdgeRight: {
    position: 'absolute',
    bottom: 24,
    right: '12%',
    width: 3,
    height: '92%',
    backgroundColor: 'rgba(37,99,235,0.5)',
    borderRadius: 2,
    transform: [{ rotate: '-10deg' }],
  },
  roadDash: {
    position: 'absolute',
    alignSelf: 'center',
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: 'rgba(37,99,235,0.4)',
  },
  uspPill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    maxWidth: 132,
  },
  uspIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uspText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#111827',
    flexShrink: 1,
  },
  carWrap: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    width: '94%',
    height: '62%',
    maxHeight: 268,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 2,
  },
  carImage: {
    width: '100%',
    height: '100%',
  },
  bottomBlock: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 4,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    minHeight: 104,
  },
  serviceSlot: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
    paddingHorizontal: 2,
  },
  serviceIconBg: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceIconLarge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    borderWidth: 0,
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  serviceIconSmall: {
    width: 46,
    height: 46,
    borderRadius: 16,
    opacity: 0.85,
  },
  serviceName: {
    fontSize: 7,
    fontWeight: '700',
    color: '#9CA3AF',
    textAlign: 'center',
    maxWidth: 60,
  },
  serviceNameActive: {
    fontSize: 8,
    color: '#2563EB',
    fontWeight: '800',
    maxWidth: 62,
    lineHeight: 10,
  },
  badge: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 22,
    paddingVertical: 9,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  badgeText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  badgeBold: {
    color: '#1F2937',
    fontWeight: '700',
  },
  flag: {
    fontSize: 13,
  },
});
