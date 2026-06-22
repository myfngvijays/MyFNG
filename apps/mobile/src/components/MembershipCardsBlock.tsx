import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import MembershipBannerSlot from './MembershipBannerSlot';
import MembershipValueCardSlot from './MembershipValueCardSlot';
import type { MembershipType } from '../lib/membershipPlacements';

/** Consistent vertical spacing for membership promo blocks across all screens */
export const MEMBERSHIP_BLOCK_SPACING = {
  marginTop: 20,
  marginBottom: 20,
  gap: 12,
} as const;

type Screen = 'home' | 'search' | 'rsa' | 'services';

type Props = {
  screen: Screen;
  slot: string;
  navigation: any;
  style?: ViewStyle;
  membershipType?: MembershipType;
  /** Promo banner only — no full value card */
  bannerOnly?: boolean;
  spacing?: 'default' | 'compact';
};

/**
 * Wraps value card + promo banner (or banner alone) with uniform spacing
 * so cards never stick to the section above/below.
 */
export default function MembershipCardsBlock({
  screen,
  slot,
  navigation,
  style,
  membershipType = 'SERVICE',
  bannerOnly = false,
  spacing = 'default',
}: Props) {
  const blockStyle = spacing === 'compact' ? styles.blockCompact : styles.block;

  return (
    <View style={[blockStyle, style]}>
      {!bannerOnly ? (
        <MembershipValueCardSlot
          screen={screen}
          slot={slot}
          navigation={navigation}
          membershipType={membershipType}
        />
      ) : null}
      <MembershipBannerSlot
        screen={screen}
        slot={slot}
        navigation={navigation}
        inset
        spacing={spacing === 'compact' ? 'compact' : 'none'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    width: '100%',
    marginTop: MEMBERSHIP_BLOCK_SPACING.marginTop,
    marginBottom: MEMBERSHIP_BLOCK_SPACING.marginBottom,
    gap: MEMBERSHIP_BLOCK_SPACING.gap,
  },
  blockCompact: {
    width: '100%',
    marginTop: 8,
    marginBottom: 8,
    gap: MEMBERSHIP_BLOCK_SPACING.gap,
  },
});
