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

function displayTitle(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return 'Membership';
  if (trimmed.length <= 16) return trimmed;
  const parts = trimmed.split(/\s+/);
  if (parts.length <= 1) return trimmed;
  const mid = Math.ceil(parts.length / 2);
  return `${parts.slice(0, mid).join(' ')}\n${parts.slice(mid).join(' ')}`;
}

function displayBadge(plan: PrimeBannerPlan | undefined, isRsa: boolean) {
  const raw = String(plan?.badge || '').trim().toUpperCase();
  if (isRsa) {
    if (!raw || raw === 'MEMBERSHIP') return 'RSA';
    return raw.length > 10 ? raw.slice(0, 10) : raw;
  }
  return raw && raw !== 'MEMBERSHIP' ? raw : 'PRIME';
}

function formatBenefitSub(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('+') ? trimmed : `+ ${trimmed}`;
}

export default function PrimeBanner({ onPress, style, animated = false, plan }: PrimeBannerProps) {
  const colorAnim = useRef(new Animated.Value(0)).current;
  const isRsa = plan?.membershipType === 'RSA';

  const title = displayTitle(plan?.name || (isRsa ? 'RSA Membership' : PRIME_MEMBERSHIP.name));
  const badge = displayBadge(plan, isRsa);
  const benefitLine1 = plan?.benefitLine1 || '10% off on all services';
  const benefitLine2 = plan?.benefitLine2 || '5% cashback to wallet';
  const originalPrice = plan?.originalPrice || PRIME_MEMBERSHIP.originalPrice;
  const price = plan?.price || PRIME_MEMBERSHIP.price;
  const periodRaw = plan?.period?.replace(/^\//, '').trim() || 'year';
  const period = periodRaw === 'year' ? 'per yr' : `per ${periodRaw}`;

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

      <View style={styles.mainRow}>
        <View style={styles.titleCol}>
          <View style={styles.badgePill}>
            {isRsa ? (
              <Image source={RSA_ICON_RED_SOURCE} style={styles.rsaBadgeIcon} resizeMode="contain" />
            ) : (
              <Ionicons name="diamond" size={8} color="#FFD166" />
            )}
            <Text style={styles.badgePillText} numberOfLines={1}>
              {badge}
            </Text>
          </View>
          <Text style={styles.title} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>
            {title}
          </Text>
        </View>

        <View style={styles.benefitCol}>
          <Text style={styles.benefit} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
            {benefitLine1}
          </Text>
          {benefitLine2 ? (
            <Text style={styles.benefitSub} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {formatBenefitSub(benefitLine2)}
            </Text>
          ) : null}
        </View>

        <View style={styles.priceCol}>
          {originalPrice ? <Text style={styles.originalPrice}>{originalPrice}</Text> : null}
          <Text style={styles.price} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {price}
          </Text>
          <Text style={styles.period}>{period}</Text>
        </View>

        <View style={styles.arrow}>
          <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
        </View>
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
    minHeight: 84,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  decor1: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    top: -36,
    left: -24,
  },
  decor2: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    bottom: -24,
    right: 48,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleCol: {
    width: 68,
    flexShrink: 0,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
    maxWidth: 68,
  },
  badgePillText: {
    fontSize: 7,
    fontWeight: '800',
    color: '#FFD166',
    letterSpacing: 0.4,
  },
  rsaBadgeIcon: {
    width: 9,
    height: 9,
  },
  title: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 16,
  },
  benefitCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  benefit: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 13,
  },
  benefitSub: {
    marginTop: 2,
    fontSize: 8,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.86)',
    lineHeight: 11,
  },
  priceCol: {
    width: 58,
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
  originalPrice: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
    textDecorationLine: 'line-through',
    lineHeight: 11,
  },
  price: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFD166',
    lineHeight: 19,
  },
  period: {
    fontSize: 8,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 10,
    marginTop: 1,
  },
  arrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
