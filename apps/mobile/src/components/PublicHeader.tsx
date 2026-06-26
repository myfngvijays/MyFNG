import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

type PublicHeaderProps = {
  city?: string;
  cartCount?: number;
  onPressSearch?: () => void;
  onPressCart?: () => void;
};

export default function PublicHeader({
  city = 'Mumbai',
  cartCount = 0,
  onPressSearch,
  onPressCart,
}: PublicHeaderProps) {
  const badgeCount = Math.max(0, cartCount);
  const badgeLabel = badgeCount > 9 ? '9+' : String(badgeCount);

  return (
      <View style={styles.header}>
        <View style={styles.leftWrap}>
          <View style={styles.logoWrap}>
            <Image source={require('../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
          </View>
          <View>
            <View style={styles.cityRow}>
              <Ionicons name="location" size={11} color={COLORS.primary} />
              <Text style={styles.cityText}>{city}</Text>
            </View>
          </View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={onPressSearch} activeOpacity={0.85}>
            <Ionicons name="search" size={20} color="#525252" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={onPressCart} activeOpacity={0.85}>
            <Ionicons name="cart-outline" size={20} color="#525252" />
            {badgeCount > 0 ? (
              <View style={[styles.cartBadge, badgeCount > 9 ? styles.cartBadgeWide : null]}>
                <Text style={styles.cartBadgeText} numberOfLines={1}>
                  {badgeLabel}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    backgroundColor: 'rgba(255,255,255,0.80)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  logoWrap: {
    width: 92,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 92,
    height: 30,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 8,
  },
  cityText: {
    fontSize: 10,
    color: '#737373',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  cartBadgeWide: {
    minWidth: 22,
    paddingHorizontal: 5,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 11,
    includeFontPadding: false,
    textAlign: 'center',
  },
});
