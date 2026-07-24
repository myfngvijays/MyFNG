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
import { PENDING_REFERRAL_VOUCHER_KEY } from '../lib/referralVoucher';
import {
  FAMILY_ORDER,
  type FamilyKey,
  normalizeFamilyKey,
} from '../constants/referAndRise';
import { useReferAndRiseConfig } from '../hooks/useReferAndRiseConfig';

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
  redeemed_at: string | null;
  can_redeem: boolean;
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

  const locked = milestones
    .filter((m) => rewardedCount < m.referralCount)
    .map((m) => ({
      milestone_count: m.referralCount,
      referrals_needed: m.referralCount - rewardedCount,
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
  const [locked, setLocked] = useState<{ milestone_count: number; referrals_needed: number }[]>([]);
  const [pendingMilestone, setPendingMilestone] = useState<ClaimableItem | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<FamilyKey | null>(null);
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<any>('/api/customer/referral/rewards');
      setTotalRewarded(Number(res?.stats?.total_rewarded || 0));
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
      await apiFetch('/api/customer/referral/claim-reward', {
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
      Alert.alert('Reward Claimed', 'Your referral reward has been saved to My Rewards.');
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

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content}>
      <View style={s.hero}>
        <Text style={s.heroLabel}>MYFNG REFERRAL REWARDS</Text>
        <Text style={s.heroTitle}>My Rewards</Text>
        <Text style={s.heroSub}>
          {totalRewarded} successful referral{totalRewarded === 1 ? '' : 's'} · Choose one track per milestone
        </Text>
      </View>

      <View style={s.noteBox}>
        <Ionicons name="information-circle-outline" size={18} color="#B45309" />
        <Text style={s.noteText}>
          MYFNG Save service vouchers cannot be used with wallet balance on the same booking. Use either voucher or wallet — not both.
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
              <Text style={s.cardTitle}>Milestone unlocked — pick your reward</Text>
              <Text style={s.cardHint}>Tap to choose MYFNG Save, Care, Elite or Express</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {claimed.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Claimed Rewards</Text>
          {claimed.map((item) => {
            const fam = families[item.chosen_family as FamilyKey];
            return (
              <View key={item.id} style={s.card}>
                <View style={s.cardTop}>
                  <View style={[s.badge, { backgroundColor: (fam?.color || BRAND) + '18' }]}>
                    <Text style={[s.badgeText, { color: fam?.color || BRAND }]}>{item.category_name}</Text>
                  </View>
                  <Text style={s.milestoneTag}>{item.milestone_count} refs</Text>
                </View>
                <Text style={s.rewardText}>{item.reward_text}</Text>
                <View style={s.metaRow}>
                  <Text style={s.meta}>
                    {item.redeemed_at ? 'Redeemed' : item.can_redeem ? 'Available to use' : item.status}
                  </Text>
                  {item.blocks_wallet ? (
                    <Text style={s.walletNote}>No wallet on same booking</Text>
                  ) : null}
                </View>
                {item.can_redeem && !item.redeemed_at && (item.blocks_wallet || /voucher|discount/i.test(item.reward_text)) ? (
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
          })}
        </View>
      )}

      {locked.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Upcoming Milestones</Text>
          {locked.slice(0, 4).map((item) => (
            <View key={item.milestone_count} style={[s.card, s.cardLocked]}>
              <View style={s.cardTop}>
                <Text style={s.lockedTitle}>{item.milestone_count} Referrals</Text>
                <Ionicons name="lock-closed" size={16} color="#9CA3AF" />
              </View>
              <Text style={s.cardHint}>{item.referrals_needed} more referral{item.referrals_needed === 1 ? '' : 's'} needed</Text>
            </View>
          ))}
        </View>
      )}

      {onOpenReferAndRise ? (
        <TouchableOpacity style={s.linkBtn} onPress={onOpenReferAndRise}>
          <Text style={s.linkBtnText}>Open Refer & Rise →</Text>
        </TouchableOpacity>
      ) : null}

      <Modal visible={!!pendingMilestone} transparent animationType="slide" onRequestClose={() => setPendingMilestone(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>
              Milestone {pendingMilestone?.milestone_count} — Pick One Reward
            </Text>
            {pendingMilestone &&
              FAMILY_ORDER.map((key) => {
                const f = families[key];
                const selected = selectedFamily === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[s.pickRow, selected && s.pickRowSelected]}
                    onPress={() => setSelectedFamily(key)}
                  >
                    <View style={[s.pickIcon, { backgroundColor: f.color + '18' }]}>
                      <Ionicons name={f.icon} size={18} color={f.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.pickName}>{f.name}</Text>
                      <Text style={s.pickReward}>{pendingMilestone.rewards[key]}</Text>
                    </View>
                    {selected ? <Ionicons name="checkmark-circle" size={22} color={BRAND} /> : null}
                  </TouchableOpacity>
                );
              })}
            <TouchableOpacity
              style={[s.primaryBtn, (!selectedFamily || claiming) && { opacity: 0.5 }]}
              disabled={!selectedFamily || claiming}
              onPress={() => void handleClaim()}
            >
              <Text style={s.primaryBtnText}>{claiming ? 'Claiming…' : 'Confirm Reward'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setPendingMilestone(null)}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
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
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  meta: { fontSize: 11, color: '#10B981', fontWeight: '600' },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 16 },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  pickRowSelected: { borderColor: BRAND, backgroundColor: '#F0F7FF' },
  pickIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pickName: { fontSize: 14, fontWeight: '800', color: '#111827' },
  pickReward: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  cancelBtn: { alignItems: 'center', paddingVertical: 14 },
  cancelText: { color: '#6B7280', fontWeight: '600' },
});
