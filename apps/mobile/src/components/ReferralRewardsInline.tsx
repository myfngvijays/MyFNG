import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PENDING_REFERRAL_VOUCHER_KEY, formatRewardExpiryLabel } from '../lib/referralVoucher';
import {
  FAMILY_ORDER,
  type FamilyKey,
  normalizeFamilyKey,
} from '../constants/referAndRise';
import { useReferAndRiseConfig } from '../hooks/useReferAndRiseConfig';
import { ReferralVoucherTicket, inferVoucherVariant, ReferralVoucherList } from './ReferralVoucherTicket';

const BRAND = '#004AAD';

type ClaimableItem = {
  milestone_count: number;
  rewards: Record<FamilyKey, string>;
};

type ClaimedItem = {
  id: string;
  milestone_count: number;
  chosen_family: FamilyKey;
  category_name: string;
  reward_text: string;
  reward_type: string;
  voucher_amount: number | null;
  blocks_wallet: boolean;
  status: string;
  claimed_at: string;
  expires_at?: string | null;
  coupon_code?: string | null;
  redeemed_at: string | null;
  can_redeem: boolean;
  expired?: boolean;
  uses_label?: string | null;
  uses_remaining?: number | null;
  membership_activated?: boolean;
};

type LockedItem = {
  milestone_count: number;
  referrals_needed: number;
  rewards?: Record<FamilyKey, string>;
};

function buildRewardsFromReferralApi(
  referralRes: any,
  milestones: { referralCount: number; rewards: Record<FamilyKey, string> }[],
  families: Record<FamilyKey, { name: string }>,
) {
  const rewardedCount = Number(referralRes?.stats?.total_rewarded || 0);
  const picks: Record<string, string> = referralRes?.refer_and_rise?.picks || {};
  const claimedMilestones = new Set(Object.keys(picks).map(Number));

  const claimable = milestones
    .filter((m) => rewardedCount >= m.referralCount && !claimedMilestones.has(m.referralCount))
    .map((m) => ({ milestone_count: m.referralCount, rewards: m.rewards }));

  const claimed: ClaimedItem[] = Object.entries(picks).map(([count, famRaw]) => {
    const milestoneCount = Number(count);
    const family = normalizeFamilyKey(String(famRaw)) || (famRaw as FamilyKey);
    const rewardText = milestones.find((m) => m.referralCount === milestoneCount)?.rewards[family as FamilyKey] || '';
    return {
      id: `pick-${milestoneCount}`,
      milestone_count: milestoneCount,
      chosen_family: family as FamilyKey,
      category_name: families[family as FamilyKey]?.name || String(famRaw),
      reward_text: rewardText,
      reward_type: family === 'myfngSave' && /voucher|discount/i.test(rewardText) ? 'voucher' : 'service',
      voucher_amount: null,
      blocks_wallet: family === 'myfngSave' && /voucher|discount/i.test(rewardText),
      status: 'CLAIMED',
      claimed_at: new Date().toISOString(),
      redeemed_at: null,
      can_redeem: true,
    };
  });

  const locked: LockedItem[] = milestones
    .filter((m) => rewardedCount < m.referralCount)
    .map((m) => ({
      milestone_count: m.referralCount,
      referrals_needed: m.referralCount - rewardedCount,
      rewards: m.rewards,
    }));

  return { rewardedCount, claimable, claimed, locked };
}

type Props = {
  isLoggedIn: boolean;
  onLogin: () => void;
  onOpenReferAndRise?: () => void;
  onUseVoucher?: (claimId: string) => void;
};

export default function ReferralRewardsInline({ isLoggedIn, onLogin, onOpenReferAndRise, onUseVoucher }: Props) {
  const remote = useReferAndRiseConfig();
  const [loading, setLoading] = useState(true);
  const [totalRewarded, setTotalRewarded] = useState(0);
  const [claimable, setClaimable] = useState<ClaimableItem[]>([]);
  const [claimed, setClaimed] = useState<ClaimedItem[]>([]);
  const [locked, setLocked] = useState<LockedItem[]>([]);
  const [pendingMilestone, setPendingMilestone] = useState<ClaimableItem | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<FamilyKey | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [rewardExpiryDays, setRewardExpiryDays] = useState(365);

  const load = useCallback(async () => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<any>('/api/customer/referral/rewards');
      setTotalRewarded(Number(res?.stats?.total_rewarded || 0));
      setRewardExpiryDays(Number(res?.reward_expiry_days) || 365);
      setClaimable(Array.isArray(res?.claimable) ? res.claimable : []);
      setClaimed(Array.isArray(res?.claimed) ? res.claimed : []);
      setLocked(Array.isArray(res?.locked) ? res.locked : []);
    } catch (primaryErr) {
      try {
        const referralRes = await apiFetch<any>('/api/customer/referral');
        const built = buildRewardsFromReferralApi(referralRes, remote.milestones, remote.families);
        setTotalRewarded(built.rewardedCount);
        setClaimable(built.claimable);
        setClaimed(built.claimed);
        setLocked(built.locked);
      } catch {
        Alert.alert('Error', 'Could not load referral rewards.');
      }
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, remote.milestones, remote.families]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleClaim = async () => {
    if (!pendingMilestone || !selectedFamily) return;
    setClaiming(true);
    try {
      const res = await apiFetch<any>('/api/customer/referral/claim-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referralCount: pendingMilestone.milestone_count,
          family: selectedFamily,
        }),
      });
      setPendingMilestone(null);
      setSelectedFamily(null);
      await load();
      if (res?.membership_activated) {
        Alert.alert(
          'Membership Activated',
          `Your ${res.membership_plan_name || 'Prime'} membership is now active on your account.`,
        );
      } else {
        Alert.alert('Reward Claimed', 'Your reward is saved. Use it from My Rewards or at booking checkout.');
      }
    } catch (e: any) {
      Alert.alert('Claim Failed', e?.message || 'Please try again.');
    } finally {
      setClaiming(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <View style={s.center}>
        <Ionicons name="gift-outline" size={48} color={BRAND} />
        <Text style={s.title}>Referral Rewards</Text>
        <Text style={s.sub}>Login to view and claim your milestone rewards.</Text>
        <TouchableOpacity style={s.primaryBtn} onPress={onLogin}>
          <Text style={s.primaryBtnText}>Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={BRAND} />
      </View>
    );
  }

  const families = remote.families;
  const nextLocked = locked[0] || null;
  const activeVouchers = claimed.filter((item) => item.can_redeem && !item.redeemed_at && !item.expired);
  const redeemedOrExpired = claimed.filter((item) => item.redeemed_at || item.expired || !item.can_redeem);

  const renderClaimedCard = (item: ClaimedItem, showUseBtn: boolean) => {
    const fam = families[item.chosen_family as FamilyKey];
    const expiryLabel = formatRewardExpiryLabel({
      expiresAt: item.expires_at,
      claimedAt: item.claimed_at,
      defaultDays: rewardExpiryDays,
    });
    const isActive = showUseBtn && item.can_redeem && !item.redeemed_at && !item.expired;

    if (isActive) {
      const usesHint = item.uses_label ? `${item.uses_label}` : null;
      return (
        <ReferralVoucherTicket
          key={item.id}
          code={item.coupon_code || `M${item.milestone_count}`}
          subtitle={item.reward_text}
          expiryLabel={
            usesHint
              ? expiryLabel
                ? `${usesHint} · ${expiryLabel}`
                : usesHint
              : expiryLabel || undefined
          }
          variant={inferVoucherVariant(item.reward_text, item.chosen_family)}
          notchColor="#F8FAFC"
          onPress={async () => {
            try {
              await AsyncStorage.setItem(PENDING_REFERRAL_VOUCHER_KEY, item.id);
            } catch {
              // ignore
            }
            onUseVoucher?.(item.id);
          }}
        />
      );
    }

    return (
      <View key={item.id} style={s.card}>
        <View style={s.cardTop}>
          <View style={[s.badge, { backgroundColor: (fam?.color || BRAND) + '18' }]}>
            <Text style={[s.badgeText, { color: fam?.color || BRAND }]}>{item.category_name}</Text>
          </View>
          <Text style={s.milestoneTag}>Milestone #{item.milestone_count}</Text>
        </View>
        <Text style={s.rewardText}>{item.reward_text}</Text>
        {item.coupon_code ? (
          <Text style={s.couponCode}>Voucher: {item.coupon_code}</Text>
        ) : null}
        <View style={s.metaRow}>
          <Text style={[s.meta, item.expired ? s.metaExpired : null]}>
            {item.redeemed_at ? 'Used on booking' : item.expired ? 'Expired' : 'Ready to use'}
          </Text>
          {!item.redeemed_at && expiryLabel ? (
            <Text style={[s.expiryText, item.expired ? s.metaExpired : null]}>{expiryLabel}</Text>
          ) : null}
        </View>
        {showUseBtn && item.can_redeem && !item.redeemed_at && !item.expired ? (
          <TouchableOpacity
            style={s.useBtn}
            onPress={async () => {
              try {
                await AsyncStorage.setItem(PENDING_REFERRAL_VOUCHER_KEY, item.id);
              } catch {
                // ignore
              }
              onUseVoucher?.(item.id);
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="cart-outline" size={16} color="#FFFFFF" />
            <Text style={s.useBtnText}>Use on Booking</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };
  const nextLockedRewards =
    nextLocked?.rewards ||
    remote.milestones.find((m) => m.referralCount === nextLocked?.milestone_count)?.rewards;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content}>
      <View style={s.hero}>
        <Text style={s.heroLabel}>MYFNG REFERRAL REWARDS</Text>
        <Text style={s.heroTitle}>My Rewards</Text>
        <Text style={s.heroSub}>
          {totalRewarded} successful referral{totalRewarded === 1 ? '' : 's'} · Choose one track per milestone
        </Text>
      </View>

      {claimable.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Ready to Claim ({claimable.length})</Text>
          {claimable.map((item) => (
            <TouchableOpacity
              key={item.milestone_count}
              style={[s.card, s.cardClaimable]}
              onPress={() => {
                setPendingMilestone(item);
                setSelectedFamily(null);
              }}
            >
              <View style={s.cardTop}>
                <View style={s.badge}>
                  <Text style={s.badgeText}>{item.milestone_count} Referrals</Text>
                </View>
                <Ionicons name="gift" size={20} color={BRAND} />
              </View>
              <Text style={s.cardTitle}>Milestone unlocked - pick your reward</Text>
              <Text style={s.cardHint}>Tap to choose MYFNG Save, Care, Elite or Express</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {activeVouchers.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Your Vouchers ({activeVouchers.length})</Text>
          <Text style={s.sectionHint}>Use these at booking checkout · Valid for {rewardExpiryDays} days from claim</Text>
          <ReferralVoucherList viewAllLabel="View All">
            {activeVouchers.map((item) => renderClaimedCard(item, true))}
          </ReferralVoucherList>
        </View>
      )}

      {redeemedOrExpired.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Past Rewards</Text>
          {redeemedOrExpired.map((item) => renderClaimedCard(item, false))}
        </View>
      )}

      {nextLocked && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Next Milestone</Text>
          <View style={[s.card, s.cardLocked]}>
            <View style={s.cardTop}>
              <Text style={s.lockedTitle}>{nextLocked.milestone_count} Referrals</Text>
              <Ionicons name="lock-closed" size={16} color="#9CA3AF" />
            </View>
            <Text style={s.cardHint}>
              {nextLocked.referrals_needed} more referral{nextLocked.referrals_needed === 1 ? '' : 's'} needed · pick one of 4 tracks
            </Text>
            {nextLockedRewards ? (
              <View style={s.upcomingRewardsList}>
                {FAMILY_ORDER.map((key) => (
                  <View key={key} style={s.upcomingRewardLine}>
                    <View style={[s.upcomingRewardIcon, { backgroundColor: families[key].color + '18' }]}>
                      <Ionicons name={families[key].icon} size={11} color={families[key].color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.upcomingRewardTrack, { color: families[key].color }]}>{families[key].name}</Text>
                      <Text style={s.upcomingRewardText}>{nextLockedRewards[key]}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      )}

      {onOpenReferAndRise ? (
        <TouchableOpacity style={s.linkBtn} onPress={onOpenReferAndRise}>
          <Text style={s.linkBtnText}>Open Refer & Rise →</Text>
        </TouchableOpacity>
      ) : null}

      <Modal
        visible={!!pendingMilestone}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setPendingMilestone(null);
          setSelectedFamily(null);
        }}
      >
        <View style={s.modalOverlay}>
          <TouchableOpacity
            style={s.modalScrim}
            activeOpacity={1}
            onPress={() => {
              setPendingMilestone(null);
              setSelectedFamily(null);
            }}
          />
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false} bounces={false} style={s.modalScroll}>
              <Text style={s.modalTitle}>
                Milestone #{pendingMilestone?.milestone_count} Unlocked
              </Text>
              <Text style={s.modalDesc}>
                Pick <Text style={{ fontWeight: '700', color: '#FFFFFF' }}>one</Text> reward — it tells us what you care about.
              </Text>
              {pendingMilestone &&
                FAMILY_ORDER.map((key) => {
                  const f = families[key];
                  const selected = selectedFamily === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        s.pickRow,
                        { borderColor: f.color + '55' },
                        selected && {
                          borderColor: '#4DA6FF',
                          backgroundColor: '#0066FF22',
                          borderWidth: 2.5,
                        },
                      ]}
                      onPress={() => setSelectedFamily(key)}
                      activeOpacity={0.85}
                    >
                      <View style={s.pickRowInner}>
                        <View style={[s.pickIcon, { backgroundColor: f.color + '1A' }]}>
                          <Ionicons name={f.icon} size={18} color={f.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={s.pickTitleRow}>
                            <Text style={s.pickName}>{f.name}</Text>
                            <Text style={[s.pickTag, { color: f.color }]}>{f.tag}</Text>
                          </View>
                          <Text style={s.pickReward}>{pendingMilestone.rewards[key]}</Text>
                        </View>
                        {selected ? <Ionicons name="checkmark-circle" size={22} color="#4DA6FF" /> : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              <TouchableOpacity
                style={[s.modalConfirmBtn, (!selectedFamily || claiming) && { opacity: 0.4 }]}
                disabled={!selectedFamily || claiming}
                onPress={() => void handleClaim()}
                activeOpacity={0.85}
              >
                <Text style={s.modalConfirmText}>{claiming ? 'Claiming…' : 'Confirm Selection'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => {
                  setPendingMilestone(null);
                  setSelectedFamily(null);
                }}
                activeOpacity={0.8}
              >
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F8FAFC' },
  hero: { marginBottom: 12 },
  heroLabel: { fontSize: 11, fontWeight: '700', color: BRAND, letterSpacing: 0.8 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#111827', marginTop: 4 },
  heroSub: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  title: { fontSize: 20, fontWeight: '800', color: '#111827', marginTop: 12 },
  sub: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8, marginBottom: 16 },
  noteBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  noteText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 10 },
  sectionHint: { fontSize: 12, color: '#6B7280', marginTop: -6, marginBottom: 10, lineHeight: 18 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardClaimable: { borderColor: BRAND + '55', backgroundColor: '#F0F7FF' },
  cardLocked: { opacity: 0.75 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badge: { backgroundColor: BRAND + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '700', color: BRAND },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardHint: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  rewardText: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 4 },
  couponCode: { fontSize: 11, fontWeight: '700', color: BRAND, marginTop: 6 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, flexWrap: 'wrap', gap: 4 },
  meta: { fontSize: 11, color: '#10B981', fontWeight: '600' },
  metaExpired: { color: '#9CA3AF' },
  expiryText: { fontSize: 11, color: '#D97706', fontWeight: '700' },
  walletNote: { fontSize: 10, color: '#B45309', fontWeight: '600' },
  useBtn: {
    marginTop: 12,
    backgroundColor: BRAND,
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  useBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  milestoneTag: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  lockedTitle: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  upcomingRewardsList: { marginTop: 12, gap: 8 },
  upcomingRewardLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  upcomingRewardIcon: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  upcomingRewardTrack: { fontSize: 11, fontWeight: '800' },
  upcomingRewardText: { fontSize: 11, color: '#6B7280', marginTop: 2, lineHeight: 16 },
  primaryBtn: {
    backgroundColor: BRAND,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  linkBtn: { alignItems: 'center', paddingVertical: 12 },
  linkBtnText: { color: BRAND, fontWeight: '700', fontSize: 14 },
  ticketWrap: { marginBottom: 10 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,15,40,0.65)' },
  modalSheet: {
    backgroundColor: '#001840',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '88%',
    borderTopWidth: 1,
    borderColor: '#1A3A6B',
    zIndex: 10,
    elevation: 10,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 4,
    backgroundColor: '#1A3A6B',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  modalScroll: { paddingHorizontal: 20, paddingBottom: 34 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  modalDesc: { fontSize: 13, color: '#93B4E0', marginBottom: 14 },
  pickRow: {
    backgroundColor: '#002060',
    borderWidth: 1.5,
    borderColor: '#1A3A6B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  pickRowInner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  pickTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  pickIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pickName: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', flex: 1 },
  pickTag: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  pickReward: { fontSize: 12, color: '#C7D9F5', lineHeight: 18 },
  modalConfirmBtn: {
    backgroundColor: '#0066FF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  modalConfirmText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  cancelBtn: { alignItems: 'center', paddingVertical: 14 },
  cancelText: { color: '#93B4E0', fontWeight: '600', fontSize: 13 },
});
