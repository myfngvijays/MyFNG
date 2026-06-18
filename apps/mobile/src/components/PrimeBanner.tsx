import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PRIME_MEMBERSHIP } from '../constants/publicAppData';
import { COLORS } from '../constants/theme';
import type { MembershipType } from '../lib/membershipPlacements';
import { RSA_ICON_RED_SOURCE } from '../lib/serviceIcons';

const CYCLE_BLUE = COLORS.primary;
const CYCLE_RED = '#DC2626';
const RSA_CYCLE_DARK = '#991B1B';

export type PrimeBannerPlan = {
  name: string;
  badge?: string;
  price: string;
  originalPrice?: string;
  period?: string;
  benefitLine1?: string;
  benefitLine2?: string;
  membershipType?: MembershipType;
};

type PrimeBannerProps = {
  onPress: () => void;
  style?: ViewStyle;
  animated?: boolean;
  plan?: PrimeBannerPlan;
};

function splitTitle(name: string) {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length <= 10) return trimmed;
  const parts = trimmed.split(/\s+/);
  if (parts.length <= 1) return trimmed;
  const mid = Math.ceil(parts.length / 2);
  return `${parts.slice(0, mid).join(' ')}\n${parts.slice(mid).join(' ')}`;
}

function displayBadge(plan: PrimeBannerPlan | undefined, isRsa: boolean) {
  const raw = String(plan?.badge || '').trim().toUpperCase();
  if (isRsa) {
    if (!raw || raw === 'MEMBERSHIP') return 'RSA MEMBERSHIP';
    return raw;
  }
  return raw || 'PRIME';
}

export default function PrimeBanner({ onPress, style, animated = false, plan }: PrimeBannerProps) {
  const colorAnim = useRef(new Animated.Value(0)).current;
  const isRsa = plan?.membershipType === 'RSA';

  const title = splitTitle(plan?.name || (isRsa ? 'RSA Membership' : PRIME_MEMBERSHIP.name));
  const badge = displayBadge(plan, isRsa);
  const benefitLine1 = plan?.benefitLine1 || '10% off on all services';
  const benefitLine2 = plan?.benefitLine2 || '5% cashback to wallet';
  const originalPrice = plan?.originalPrice || PRIME_MEMBERSHIP.originalPrice;
  const price = plan?.price || PRIME_MEMBERSHIP.price;
  const period = plan?.period ? `per ${plan.period}` : 'per year';

  useEffect(() => {
    if (!animated) return;

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
  }, [animated, colorAnim]);

  const backgroundColor = colorAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: isRsa
      ? [CYCLE_RED, RSA_CYCLE_DARK, CYCLE_RED]
      : [CYCLE_BLUE, CYCLE_RED, CYCLE_BLUE],
  });

  const staticBackground = isRsa ? CYCLE_RED : COLORS.primary;

  const content = (
    <>
      <View style={styles.decor1} />
      <View style={styles.decor2} />
      <View style={styles.left}>
        <View style={styles.badgePill}>
          {isRsa ? (
            <Image source={RSA_ICON_RED_SOURCE} style={styles.rsaBadgeIcon} resizeMode="contain" />
          ) : (
            <Ionicons name="diamond" size={9} color="#FFD166" />
          )}
          <Text style={styles.badgePillText}>{badge}</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.center}>
        <Text style={styles.benefit} numberOfLines={2}>
          {benefitLine1}
        </Text>
        <Text style={styles.benefitSub} numberOfLines={2}>
          {benefitLine2 ? (benefitLine2.startsWith('+') ? benefitLine2 : `+ ${benefitLine2}`) : ''}
        </Text>
      </View>
      <View style={styles.priceBlock}>
        {originalPrice ? <Text style={styles.originalPrice}>{originalPrice}</Text> : null}
        <Text style={styles.price}>{price}</Text>
        <Text style={styles.period}>{period}</Text>
      </View>
      <View style={styles.arrow}>
        <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
      </View>
    </>
  );

  if (!animated) {
    return (
      <TouchableOpacity style={[styles.banner, { backgroundColor: staticBackground }, style]} activeOpacity={0.9} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
      <Animated.View style={[styles.banner, style, { backgroundColor }]}>{content}</Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: 88,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  decor1: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    top: -40,
    left: -30,
  },
  decor2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    bottom: -20,
    right: 60,
  },
  left: {
    width: 78,
    marginRight: 6,
    justifyContent: 'flex-start',
    paddingTop: 6,
    flexShrink: 0,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginBottom: 5,
    marginTop: -2,
  },
  badgePillText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFD166',
    letterSpacing: 0.8,
  },
  rsaBadgeIcon: {
    width: 11,
    height: 11,
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  center: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingRight: 4,
  },
  benefit: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 14,
  },
  benefitSub: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 12,
  },
  priceBlock: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginRight: 6,
    flexShrink: 0,
  },
  originalPrice: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.72)',
    textDecorationLine: 'line-through',
    lineHeight: 12,
    marginBottom: 1,
  },
  price: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFD166',
    lineHeight: 22,
  },
  period: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 11,
  },
  arrow: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
