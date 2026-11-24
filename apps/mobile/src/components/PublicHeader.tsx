import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

type PublicHeaderProps = {
  city?: string;
  cartCount?: number;
  onPressSearch?: () => void;
  onPressCart?: () => void;
  /** Brand-blue header with white logo (logged-in home, joins the greeting card). */
  variant?: 'light' | 'blue';
  /** Hide the city line (e.g. when the greeting below already shows it). */
  hideCity?: boolean;
  /** Shows a notifications bell next to search when provided. */
  onPressBell?: () => void;
  hasUnread?: boolean;
};

export const PUBLIC_HEADER_BLUE = '#2754C8';

export default function PublicHeader({
  city = 'Mumbai',
  cartCount = 0,
  onPressSearch,
  onPressCart,
  variant = 'light',
  hideCity = false,
  onPressBell,
  hasUnread = false,
}: PublicHeaderProps) {
  const blue = variant === 'blue';
  const iconColor = blue ? '#FFFFFF' : '#525252';
  const badgeCount = Math.max(0, cartCount);
  const badgeLabel = badgeCount > 9 ? '9+' : String(badgeCount);

  return (
      <View style={[styles.header, blue && styles.headerBlue]}>
        <View style={styles.leftWrap}>
          <View style={styles.logoWrap}>
            <Image
              source={blue ? require('../../assets/logo-white.png') : require('../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          {hideCity ? null : (
            <View>
              <View style={styles.cityRow}>
                <Ionicons name="location" size={11} color={blue ? '#FFFFFF' : COLORS.primary} />
                <Text style={[styles.cityText, blue && styles.cityTextBlue]}>{city}</Text>
              </View>
            </View>
          )}
        </View>
        <View style={styles.actions}>
          {onPressBell ? (
            <TouchableOpacity
              style={[styles.actionButton, blue && styles.actionButtonBlue]}
              onPress={onPressBell}
              activeOpacity={0.85}
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={20} color={iconColor} />
              {hasUnread ? <View style={[styles.bellDot, blue && styles.cartBadgeBlue]} /> : null}
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={[styles.actionButton, blue && styles.actionButtonBlue]} onPress={onPressSearch} activeOpacity={0.85}>
            <Ionicons name="search" size={20} color={iconColor} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, blue && styles.actionButtonBlue]} onPress={onPressCart} activeOpacity={0.85}>
            <Ionicons name="cart-outline" size={20} color={iconColor} />
            <View style={[styles.cartBadge, blue && styles.cartBadgeBlue, badgeCount > 9 ? styles.cartBadgeWide : null]}>
              <Text style={styles.cartBadgeText} numberOfLines={1}>
                {badgeLabel}
              </Text>
            </View>
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
  headerBlue: {
    backgroundColor: PUBLIC_HEADER_BLUE,
    borderBottomWidth: 0,
  },
  cityTextBlue: {
    color: 'rgba(255,255,255,0.9)',
  },
  actionButtonBlue: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  cartBadgeBlue: {
    borderColor: PUBLIC_HEADER_BLUE,
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
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#F59E0B',
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
