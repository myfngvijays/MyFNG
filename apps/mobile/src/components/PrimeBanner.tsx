import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PRIME_MEMBERSHIP } from '../constants/publicAppData';
import { COLORS } from '../constants/theme';

type PrimeBannerProps = {
  onPress: () => void;
  style?: ViewStyle;
};

export default function PrimeBanner({ onPress, style }: PrimeBannerProps) {
  return (
    <TouchableOpacity style={[styles.banner, style]} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.decor1} />
      <View style={styles.decor2} />
      <View style={styles.left}>
        <View style={styles.badgePill}>
          <Ionicons name="diamond" size={9} color="#FFD166" />
          <Text style={styles.badgePillText}>PRIME</Text>
        </View>
        <Text style={styles.title}>MyFNG{'\n'}Prime</Text>
      </View>
      <View style={styles.center}>
        <Text style={styles.benefit} numberOfLines={2}>
          10% off on all services
        </Text>
        <Text style={styles.benefitSub} numberOfLines={2}>
          + 5% cashback to wallet
        </Text>
      </View>
      <View style={styles.priceBlock}>
        <Text style={styles.originalPrice}>{PRIME_MEMBERSHIP.originalPrice}</Text>
        <Text style={styles.price}>{PRIME_MEMBERSHIP.price}</Text>
        <Text style={styles.period}>per year</Text>
      </View>
      <View style={styles.arrow}>
        <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
      </View>
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
