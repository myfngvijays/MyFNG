import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import PrimeBanner from './PrimeBanner';
import { useMembershipCards } from '../hooks/useMembershipCards';
import { cardToBannerPlan } from '../lib/membershipCards';

type Props = {
  screen: 'home' | 'search' | 'rsa' | 'services';
  slot: string;
  navigation: any;
  style?: ViewStyle;
  /** Inside MembershipCardsBlock — no outer margin */
  inset?: boolean;
  spacing?: 'default' | 'compact' | 'none';
};

const AUTO_SWIPE_MS = 5000;
const CARD_GAP = 12;
const DEFAULT_CARD_WIDTH = 320;

export default function MembershipBannerSlot({ screen, slot, navigation, style, inset = false, spacing = 'default' }: Props) {
  const { getCardsForScreenSlot } = useMembershipCards();
  const cards = getCardsForScreenSlot(screen, slot);
  const scrollRef = useRef<ScrollView>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [cardWidth, setCardWidth] = useState(DEFAULT_CARD_WIDTH);
  const activeIdxRef = useRef(0);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userDraggingRef = useRef(false);

  const snapInterval = cardWidth + CARD_GAP;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== cardWidth) {
      setCardWidth(w);
    }
  };

  const scrollToIndex = useCallback(
    (idx: number, animated = true) => {
      const clamped = Math.max(0, Math.min(idx, cards.length - 1));
      scrollRef.current?.scrollTo({ x: clamped * snapInterval, animated });
      activeIdxRef.current = clamped;
      setActiveIdx(clamped);
    },
    [cards.length, snapInterval],
  );

  const clearAutoTimer = useCallback(() => {
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  }, []);

  const scheduleAutoSwipe = useCallback(() => {
    clearAutoTimer();
    if (cards.length <= 1) return;
    autoTimerRef.current = setTimeout(() => {
      if (userDraggingRef.current) {
        scheduleAutoSwipe();
        return;
      }
      const next = (activeIdxRef.current + 1) % cards.length;
      scrollToIndex(next, true);
      scheduleAutoSwipe();
    }, AUTO_SWIPE_MS);
  }, [cards.length, clearAutoTimer, scrollToIndex]);

  useEffect(() => {
    scheduleAutoSwipe();
    return clearAutoTimer;
  }, [scheduleAutoSwipe, clearAutoTimer]);

  if (!cards.length) return null;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (cards.length <= 1 || snapInterval <= 0) return;
    const idx = Math.round(e.nativeEvent.contentOffset.x / snapInterval);
    if (idx !== activeIdxRef.current && idx >= 0 && idx < cards.length) {
      activeIdxRef.current = idx;
      setActiveIdx(idx);
    }
  };

  const onScrollBeginDrag = () => {
    userDraggingRef.current = true;
    clearAutoTimer();
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    userDraggingRef.current = false;
    if (snapInterval <= 0) return;
    const idx = Math.round(e.nativeEvent.contentOffset.x / snapInterval);
    if (idx >= 0 && idx < cards.length) {
      activeIdxRef.current = idx;
      setActiveIdx(idx);
    }
    scheduleAutoSwipe();
  };

  const openCard = (card: (typeof cards)[0]) => {
    navigation.navigate('Settings', {
      subPage: 'Membership',
      membershipType: card.ctaMembershipType,
      ...(card.ctaPlanCode ? { planCode: card.ctaPlanCode } : {}),
    });
  };

  const renderBanner = (card: (typeof cards)[0]) => (
    <PrimeBanner
      plan={cardToBannerPlan(card)}
      animated={card.cardAnimated}
      style={styles.banner}
      onPress={() => openCard(card)}
    />
  );

  const wrapStyle = inset || spacing === 'none'
    ? styles.rootInset
    : spacing === 'compact'
      ? styles.rootCompact
      : styles.rootSpaced;

  if (cards.length === 1) {
    return (
      <View style={[wrapStyle, style]} onLayout={onLayout}>
        {renderBanner(cards[0])}
      </View>
    );
  }

  return (
    <View style={[wrapStyle, style]} onLayout={onLayout}>
      <ScrollView
        ref={scrollRef}
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={snapInterval}
        snapToAlignment="start"
        disableIntervalMomentum
        onScroll={onScroll}
        onScrollBeginDrag={onScrollBeginDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={16}
        contentContainerStyle={styles.row}
      >
        {cards.map((card, idx) => (
          <View
            key={card.id}
            style={[
              styles.cardWrap,
              { width: cardWidth },
              idx < cards.length - 1 ? styles.cardWrapGap : null,
            ]}
          >
            {renderBanner(card)}
          </View>
        ))}
      </ScrollView>
      <View style={styles.dotsRow}>
        {cards.map((card, idx) => (
          <View key={card.id} style={[styles.dot, idx === activeIdx ? styles.dotActive : null]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootSpaced: {
    width: '100%',
    marginTop: 20,
    marginBottom: 20,
    overflow: 'visible',
  },
  rootCompact: {
    width: '100%',
    marginTop: 8,
    marginBottom: 8,
    overflow: 'visible',
  },
  rootInset: {
    width: '100%',
    overflow: 'visible',
  },
  row: {
    alignItems: 'stretch',
  },
  cardWrap: {
    overflow: 'visible',
  },
  cardWrapGap: {
    marginRight: CARD_GAP,
  },
  banner: {
    width: '100%',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#D1D5DB',
  },
  dotActive: {
    width: 18,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#2563EB',
  },
});
