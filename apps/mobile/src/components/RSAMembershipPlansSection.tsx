import React, { useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useAppMembershipPlans } from '../hooks/useAppMembershipPlans';
import type { RsaPlacementSlot } from '../lib/membershipPlacements';
import MembershipPlanCartCard from './MembershipPlanCartCard';

type Props = {
  navigation: any;
  style?: ViewStyle;
  slot: RsaPlacementSlot;
};

const SCREEN_W = Dimensions.get('window').width;
const CARD_GAP = 12;
const SIDE_PAD = 16;
const CARD_WIDTH = Math.round(SCREEN_W * 0.78);
const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;

export default function RSAMembershipPlansSection({ navigation, style, slot }: Props) {
  const { getPlansForSlot } = useAppMembershipPlans();
  const rsaPlans = getPlansForSlot('rsa', slot).filter((p) => p.membershipType === 'RSA');
  const [addingPlanId, setAddingPlanId] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const onCarouselScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / SNAP_INTERVAL);
    if (idx !== activeIdx && idx >= 0 && idx < rsaPlans.length) {
      setActiveIdx(idx);
    }
  };

  if (!rsaPlans.length) return null;

  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.heading}>Best Plans for You</Text>
      <Text style={styles.subheading}>Subscription packages which suit your car and your pocket.</Text>
      <Text style={styles.swipeHint}>Swipe to see more plans →</Text>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={SNAP_INTERVAL}
        snapToAlignment="start"
        disableIntervalMomentum
        onScroll={onCarouselScroll}
        scrollEventThrottle={16}
        style={styles.carousel}
        contentContainerStyle={styles.row}
      >
        {rsaPlans.map((plan) => {
          const planKey = plan.planId || plan.planCode || plan.name;
          return (
            <View key={planKey} style={styles.cardWrap}>
              <MembershipPlanCartCard
                plan={plan}
                navigation={navigation}
                isAdding={addingPlanId === planKey}
                onAddingChange={(adding) => setAddingPlanId(adding ? planKey : null)}
              />
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.dotsRow}>
        {rsaPlans.map((plan, idx) => {
          const planKey = plan.planId || plan.planCode || plan.name;
          const accent = plan.accentColor || '#F97316';
          return (
            <View
              key={planKey}
              style={[
                styles.dot,
                idx === activeIdx ? [styles.dotActive, { backgroundColor: accent, width: 18 }] : null,
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 28,
    marginBottom: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 4,
  },
  subheading: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
    lineHeight: 18,
  },
  swipeHint: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
    marginBottom: 12,
  },
  carousel: {
    flexGrow: 0,
  },
  row: {
    paddingLeft: SIDE_PAD,
    paddingRight: SCREEN_W - CARD_WIDTH - SIDE_PAD,
    gap: CARD_GAP,
    alignItems: 'flex-start',
  },
  cardWrap: {
    width: CARD_WIDTH,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#D1D5DB',
  },
  dotActive: {
    height: 7,
    borderRadius: 999,
  },
});
