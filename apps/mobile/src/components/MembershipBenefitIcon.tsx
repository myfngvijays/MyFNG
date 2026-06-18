import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

export type BenefitIconProps = {
  icon?: string;
  iconUrl?: string;
  iconClass?: string;
  size?: number;
  color?: string;
};

export default function MembershipBenefitIcon({
  icon,
  iconUrl,
  size = 15,
  color = COLORS.primary,
}: BenefitIconProps) {
  if (iconUrl) {
    return (
      <Image
        source={{ uri: iconUrl }}
        style={{ width: size + 3, height: size + 3 }}
        resizeMode="contain"
      />
    );
  }

  const ionName = icon && (Ionicons.glyphMap as Record<string, number>)[icon] ? icon : 'star';
  return <Ionicons name={ionName as keyof typeof Ionicons.glyphMap} size={size} color={color} />;
}

export const benefitIconStyles = StyleSheet.create({
  wrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#E6F0FB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
