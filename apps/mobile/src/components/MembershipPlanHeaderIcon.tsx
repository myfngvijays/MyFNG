import React from 'react';
import { Image, Text, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { MembershipType } from '../lib/membershipPlacements';

type Props = {
  icon?: string;
  iconUrl?: string;
  membershipType?: MembershipType;
  size?: number;
  color?: string;
};

function resolveVectorIcon(icon: string) {
  if ((Ionicons.glyphMap as Record<string, number>)[icon]) {
    return { kind: 'ion' as const, name: icon };
  }
  return { kind: 'mci' as const, name: icon };
}

export default function MembershipPlanHeaderIcon({
  icon,
  iconUrl,
  membershipType = 'SERVICE',
  size = 20,
  color = '#FFFFFF',
}: Props) {
  if (iconUrl) {
    return (
      <Image
        source={{ uri: iconUrl }}
        style={{ width: size + 2, height: size + 2 }}
        resizeMode="contain"
      />
    );
  }

  if (icon) {
    const resolved = resolveVectorIcon(icon);
    if (resolved.kind === 'ion') {
      return (
        <Ionicons
          name={resolved.name as keyof typeof Ionicons.glyphMap}
          size={size}
          color={color}
        />
      );
    }
    return <MaterialCommunityIcons name={resolved.name as any} size={size} color={color} />;
  }

  return (
    <Text style={[styles.fallbackEmoji, { fontSize: size }]}>
      {membershipType === 'RSA' ? '🛟' : '👑'}
    </Text>
  );
}

const styles = StyleSheet.create({
  fallbackEmoji: {
    lineHeight: 22,
  },
});
