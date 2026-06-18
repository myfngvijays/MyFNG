import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
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
import type { AppMembershipPlan } from '../lib/membershipPlan';
import PrimeMembershipValueCard, {
  type GuestVehicleForm,
} from './PrimeMembershipValueCard';
import { apiFetch } from '../lib/api';
import { getCustomerSessionToken } from '../lib/customerSession';
import {
  isMembershipCartItem,
  membershipCartServiceLabel,
  membershipCartUnitPrice,
  planToCartMetadata,
  savePendingMembershipCart,
  type MembershipSecondVehicle,
} from '../lib/membershipCart';

type Props = {
  navigation: any;
  style?: ViewStyle;
};

const noop = () => {};
const SCREEN_W = Dimensions.get('window').width;
const CARD_GAP = 12;
const SIDE_PAD = 16;
const CARD_WIDTH = Math.round(SCREEN_W * 0.78);
const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;

function planPeriodLabel(plan: AppMembershipPlan) {
  const raw = String(plan.period || '').trim();
  if (!raw) return '/ year';
  return raw.startsWith('/') ? raw : ` / ${raw}`;
}

function planToPreviewProps(plan: AppMembershipPlan) {
  return {
    planName: plan.name,
    planPrice: plan.priceNum,
    addonPrice: plan.addOn?.priceNum,
    tagline: plan.tagline,
    valueCard: plan.valueCard,
    addonIcon: plan.addOn?.icon,
    addonIconUrl: plan.addOn?.iconUrl,
    addonTitle: plan.addOn?.title,
    addonDescription: plan.addOn?.description,
    footerNote: plan.footerNote,
    membershipType: plan.membershipType,
    accentColor: plan.accentColor,
    pricePeriodLabel: planPeriodLabel(plan),
  };
}

function RSAPlanCard({
  plan,
  isAdding,
  onAddToCart,
}: {
  plan: AppMembershipPlan;
  isAdding: boolean;
  onAddToCart: (
    plan: AppMembershipPlan,
    options: { addSecondCar: boolean; secondVehicle: MembershipSecondVehicle | null },
  ) => void;
}) {
  const [addSecondCar, setAddSecondCar] = useState(false);
  const [showSecondVehicleForm, setShowSecondVehicleForm] = useState(false);
  const [guestSecondForm, setGuestSecondForm] = useState<Pick<GuestVehicleForm, 'vehicleNumber' | 'make' | 'model' | 'carSearchDisplay'>>({
    vehicleNumber: '',
    make: '',
    model: '',
  });

  const handleAdd = () => {
    let secondVehicle: MembershipSecondVehicle | null = null;
    if (addSecondCar) {
      const vehicleNumber = guestSecondForm.vehicleNumber.trim().toUpperCase();
      const make = guestSecondForm.make.trim();
      const model = guestSecondForm.model.trim();
      if (!vehicleNumber || !make || !model) {
        Alert.alert('2nd Car Required', 'Please enter 2nd car number and search-select your car model.');
        return;
      }
      secondVehicle = { vehicle_number: vehicleNumber, make, model };
    }
    onAddToCart(plan, { addSecondCar, secondVehicle });
  };

  return (
    <View style={styles.cardWrap}>
      <PrimeMembershipValueCard
        preview
        previewInteractiveAddon
        style={styles.card}
        isLoggedIn={false}
        isActive={false}
        vehicles={[]}
        primaryVehicleKey={null}
        onPrimaryVehicleKeyChange={noop}
        addSecondCar={addSecondCar}
        onAddSecondCarChange={setAddSecondCar}
        secondVehicleKey={null}
        onSecondVehicleKeyChange={noop}
        showSecondVehicleForm={showSecondVehicleForm}
        onShowSecondVehicleFormChange={setShowSecondVehicleForm}
        guestForm={{ name: '', phone: '', vehicleNumber: '', make: '', model: '' }}
        onGuestFormChange={noop}
        guestSecondForm={guestSecondForm}
        onGuestSecondFormChange={(patch) => setGuestSecondForm((prev) => ({ ...prev, ...patch }))}
        onActivate={noop}
        previewCtaLabel={isAdding ? 'Adding...' : 'Add to Cart'}
        onPreviewPress={() => {
          if (!isAdding) handleAdd();
        }}
        {...planToPreviewProps(plan)}
      />
    </View>
  );
}

export default function RSAMembershipPlansSection({ navigation, style }: Props) {
  const { plans } = useAppMembershipPlans();
  const rsaPlans = plans.filter((p) => p.membershipType === 'RSA');
  const [addingPlanId, setAddingPlanId] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const addPlanToCart = useCallback(
    async (
      plan: AppMembershipPlan,
      options: { addSecondCar: boolean; secondVehicle: MembershipSecondVehicle | null },
    ) => {
      if (!plan.planId) {
        Alert.alert('Cart', 'Plan details not available. Please try again.');
        return;
      }
      const planKey = plan.planId || plan.planCode || plan.name;
      setAddingPlanId(planKey);
      try {
        const cartOptions = {
          addSecondCar: options.addSecondCar,
          addonPrice: plan.addOn?.priceNum,
          secondVehicle: options.secondVehicle,
        };
        const token = await getCustomerSessionToken();
        if (!token) {
          await savePendingMembershipCart(plan, cartOptions);
          navigation.navigate('Settings', { subPage: 'Cart' });
          Alert.alert('Login Required', 'Please login to add membership to your cart.');
          return;
        }

        const cartRes = await apiFetch<any>('/api/customer/cart').catch(() => null);
        const existingItems = Array.isArray(cartRes?.items) ? cartRes.items : [];
        for (const item of existingItems.filter(isMembershipCartItem)) {
          if (item?.id) {
            await apiFetch(`/api/customer/cart?item_id=${encodeURIComponent(String(item.id))}`, {
              method: 'DELETE',
            });
          }
        }

        await apiFetch('/api/customer/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_type: membershipCartServiceLabel(plan, options.addSecondCar),
            quantity: 1,
            unit_price: membershipCartUnitPrice(plan, cartOptions),
            metadata: planToCartMetadata(plan, cartOptions),
          }),
        });

        navigation.navigate('Settings', { subPage: 'Cart' });
        Alert.alert('Added to Cart', `${plan.name} membership has been added to your cart.`);
      } catch (err: any) {
        Alert.alert('Cart', err?.message || 'Could not add membership to cart.');
      } finally {
        setAddingPlanId(null);
      }
    },
    [navigation],
  );

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
        contentContainerStyle={styles.row}
      >
        {rsaPlans.map((plan) => {
          const planKey = plan.planId || plan.planCode || plan.name;
          return (
            <RSAPlanCard
              key={planKey}
              plan={plan}
              isAdding={addingPlanId === planKey}
              onAddToCart={addPlanToCart}
            />
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
  row: {
    paddingLeft: SIDE_PAD,
    paddingRight: SCREEN_W - CARD_WIDTH - SIDE_PAD,
    gap: CARD_GAP,
  },
  cardWrap: {
    width: CARD_WIDTH,
    maxHeight: 560,
  },
  card: {
    marginBottom: 0,
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
