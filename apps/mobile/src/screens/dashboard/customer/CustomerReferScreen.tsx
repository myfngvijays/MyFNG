import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Share,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { ENV } from '../../../config/environment';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

type ReferralEvent = {
  id: string;
  referral_code: string;
  status: string;
  created_at: string;
  referee?: { id: string; full_name: string | null; phone: string | null } | null;
};

type ReferralReward = {
  id: string;
  reward_amount: number;
  reward_type: string;
  status: string;
  created_at: string;
};

type ReferralStats = {
  total_referred: number;
  total_rewarded: number;
  total_earned: number;
};

function formatDate(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

function maskPhone(phone: string | null | undefined) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits.length < 10) return digits;
  return `${digits.slice(0, 2)}****${digits.slice(-4)}`;
}

function statusColor(status: string) {
  switch (status) {
    case 'REWARDED':
      return { bg: '#DCFCE7', text: '#15803D' };
    case 'PENDING':
      return { bg: '#FEF3C7', text: '#B45309' };
    case 'REJECTED':
      return { bg: '#FEE2E2', text: '#DC2626' };
    default:
      return { bg: '#F3F4F6', text: '#6B7280' };
  }
}

export default function CustomerReferScreen({ navigation }: any) {
  const [code, setCode] = useState('');
  const [events, setEvents] = useState<ReferralEvent[]>([]);
  const [rewards, setRewards] = useState<ReferralReward[]>([]);
  const [stats, setStats] = useState<ReferralStats>({ total_referred: 0, total_rewarded: 0, total_earned: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{
        code: any;
        events: ReferralEvent[];
        rewards: ReferralReward[];
        stats: ReferralStats;
      }>('/api/customer/referral');
      setCode(res.code?.code || '');
      setEvents(res.events || []);
      setRewards(res.rewards || []);
      if (res.stats) setStats(res.stats);
    } catch (e: any) {
      setError(e?.message || 'Failed to load referral data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const copyCode = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareCode = () => {
    const c = code || 'MYFNG';
    Share.share({
      message: `Join MyFNG – India's #1 AI-powered car service platform! Use my referral code *${c}* to get ₹1,500 wallet bonus instantly.\n\n📱 Download Now:\n▶️ Android: ${ENV.PLAYSTORE_URL}\n🍎 iOS: ${ENV.APPSTORE_URL}\n\nApply my code after signup & get instant wallet bonus!`,
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <DashboardHeader title="Refer & Earn" onBack={() => navigation.goBack()} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Refer & Earn" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[COLORS.primary]} />}
      >
        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="warning-outline" size={18} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => load()} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Hero - Your Code */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="gift" size={22} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.heroLabel}>Your Referral Code</Text>
              <Text style={styles.heroCode}>{code || 'Generating...'}</Text>
            </View>
          </View>
          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.copyBtn} onPress={copyCode} activeOpacity={0.8}>
              <Ionicons name={copied ? 'checkmark-circle' : 'copy-outline'} size={16} color="#7C3AED" />
              <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtn} onPress={shareCode} activeOpacity={0.8}>
              <Ionicons name="share-social" size={16} color="#FFFFFF" />
              <Text style={styles.shareBtnText}>Share & Invite</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.total_referred}</Text>
            <Text style={styles.statLabel}>Referred</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#15803D' }]}>{stats.total_rewarded}</Text>
            <Text style={styles.statLabel}>Rewarded</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#7C3AED' }]}>₹{stats.total_earned}</Text>
            <Text style={styles.statLabel}>Earned</Text>
          </View>
        </View>

        {/* Referral History */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people" size={18} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Referral History</Text>
            {events.length > 0 ? (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{events.length}</Text>
              </View>
            ) : null}
          </View>

          {events.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="people-outline" size={36} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No referrals yet</Text>
              <Text style={styles.emptyDesc}>Share your code with friends to start earning rewards!</Text>
            </View>
          ) : (
            events.map((event) => {
              const sc = statusColor(event.status);
              const friendName = event.referee?.full_name || 'Friend';
              const friendPhone = maskPhone(event.referee?.phone);
              return (
                <View key={event.id} style={styles.eventRow}>
                  <View style={styles.eventIcon}>
                    <Ionicons
                      name={event.status === 'REWARDED' ? 'checkmark-circle' : event.status === 'REJECTED' ? 'close-circle' : 'time'}
                      size={20}
                      color={sc.text}
                    />
                  </View>
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventName}>{friendName}</Text>
                    {friendPhone ? <Text style={styles.eventPhone}>{friendPhone}</Text> : null}
                    <Text style={styles.eventDate}>{formatDate(event.created_at)}</Text>
                  </View>
                  <View style={[styles.eventStatusPill, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.eventStatusText, { color: sc.text }]}>{event.status}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Rewards History */}
        {rewards.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="wallet" size={18} color="#7C3AED" />
              <Text style={styles.sectionTitle}>Rewards Earned</Text>
            </View>
            {rewards.map((reward) => (
              <View key={reward.id} style={styles.rewardRow}>
                <View style={styles.rewardLeft}>
                  <Ionicons name="gift" size={18} color="#7C3AED" />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={styles.rewardAmount}>+₹{Number(reward.reward_amount).toLocaleString('en-IN')}</Text>
                    <Text style={styles.rewardDate}>{formatDate(reward.created_at)}</Text>
                  </View>
                </View>
                <View style={[styles.eventStatusPill, { backgroundColor: reward.status === 'CREDITED' ? '#DCFCE7' : '#F3F4F6' }]}>
                  <Text style={[styles.eventStatusText, { color: reward.status === 'CREDITED' ? '#15803D' : '#6B7280' }]}>
                    {reward.status}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* How it works */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle" size={18} color="#6B7280" />
            <Text style={styles.sectionTitle}>How it works</Text>
          </View>
          {[
            { icon: 'share-social' as const, text: 'Share your referral code with friends' },
            { icon: 'person-add' as const, text: 'Friend signs up & applies your code' },
            { icon: 'wallet' as const, text: 'Friend gets instant wallet bonus' },
            { icon: 'car-sport' as const, text: 'When friend completes first booking, you earn reward!' },
          ].map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepIcon}>
                <Ionicons name={step.icon} size={16} color={COLORS.primary} />
              </View>
              <Text style={styles.stepText}>{step.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: 40 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: COLORS.textSecondary, fontSize: 13 },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    marginBottom: SPACING.md,
    gap: 8,
  },
  errorText: { flex: 1, color: '#DC2626', fontSize: 12, fontWeight: '600' },
  retryBtn: { backgroundColor: '#DC2626', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  retryText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  heroCard: {
    backgroundColor: '#7C3AED',
    borderRadius: 16,
    padding: 18,
    marginBottom: SPACING.md,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
  heroCode: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1, marginTop: 2 },
  heroActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  copyBtnText: { color: '#7C3AED', fontWeight: '800', fontSize: 13 },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  shareBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: SPACING.md },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  statNumber: { fontSize: 20, fontWeight: '900', color: COLORS.textHeading },
  statLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, marginTop: 2, textTransform: 'uppercase' },
  card: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 14,
    marginBottom: SPACING.md,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textHeading },
  countBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 'auto',
  },
  countText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  emptyWrap: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textHeading },
  emptyDesc: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  eventIcon: { width: 32, alignItems: 'center' },
  eventInfo: { flex: 1, marginLeft: 6 },
  eventName: { fontSize: 14, fontWeight: '700', color: COLORS.textHeading },
  eventPhone: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  eventDate: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  eventStatusPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  eventStatusText: { fontWeight: '800', fontSize: 10, textTransform: 'uppercase' },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rewardLeft: { flexDirection: 'row', alignItems: 'center' },
  rewardAmount: { fontSize: 15, fontWeight: '800', color: '#15803D' },
  rewardDate: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  stepIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, lineHeight: 17 },
});
