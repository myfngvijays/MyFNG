import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING } from '../../../constants/theme';

type ReferralEvent = {
  id: string;
  referral_code: string;
  status: string;
  created_at: string;
  referee?: { id: string; full_name: string | null; phone: string | null } | null;
};

type Props = {
  navigation: any;
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

function statusMeta(status: string) {
  switch (status) {
    case 'REWARDED':
      return { bg: '#DCFCE7', text: '#15803D', icon: 'checkmark-circle' as const, label: 'Completed' };
    case 'PENDING':
      return { bg: '#FEF3C7', text: '#B45309', icon: 'time' as const, label: 'Pending' };
    case 'REJECTED':
      return { bg: '#FEE2E2', text: '#DC2626', icon: 'close-circle' as const, label: 'Rejected' };
    default:
      return { bg: '#F3F4F6', text: '#6B7280', icon: 'help-circle' as const, label: status };
  }
}

export default function ReferAndRiseHistoryScreen({ navigation }: Props) {
  const [events, setEvents] = useState<ReferralEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'completed' | 'pending'>('all');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await apiFetch<{ events: ReferralEvent[] }>('/api/customer/referral');
      setEvents(res.events || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredEvents = events.filter((e) => {
    if (activeTab === 'completed') return e.status === 'REWARDED';
    if (activeTab === 'pending') return e.status === 'PENDING';
    return true;
  });

  const completedCount = events.filter((e) => e.status === 'REWARDED').length;
  const pendingCount = events.filter((e) => e.status === 'PENDING').length;

  return (
    <View style={styles.container}>
      <DashboardHeader title="Referral History" onBack={() => navigation.goBack()} />

      {/* Tabs */}
      <View style={styles.tabRow}>
        {[
          { key: 'all' as const, label: 'All', count: events.length },
          { key: 'completed' as const, label: 'Completed', count: completedCount },
          { key: 'pending' as const, label: 'Pending', count: pendingCount },
        ].map((tab) => (
          <View
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          >
            <Text
              style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              {tab.label} ({tab.count})
            </Text>
          </View>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[COLORS.primary]} />}
          showsVerticalScrollIndicator={false}
        >
          {filteredEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No referrals yet</Text>
              <Text style={styles.emptyDesc}>
                When you share your code and friends join, they'll appear here.
              </Text>
            </View>
          ) : (
            filteredEvents.map((event) => {
              const meta = statusMeta(event.status);
              const name = event.referee?.full_name || 'Friend';
              const phone = maskPhone(event.referee?.phone);
              return (
                <View key={event.id} style={styles.eventCard}>
                  <View style={styles.eventLeft}>
                    <View style={[styles.eventAvatar, { backgroundColor: meta.bg }]}>
                      <Ionicons name="person" size={16} color={meta.text} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.eventName}>{name}</Text>
                      {phone ? <Text style={styles.eventPhone}>{phone}</Text> : null}
                      <Text style={styles.eventDate}>
                        {event.status === 'REWARDED' ? 'Completed on ' : event.status === 'PENDING' ? 'Waiting for booking · ' : ''}
                        {formatDate(event.created_at)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.eventRight}>
                    <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                      <Ionicons name={meta.icon} size={12} color={meta.text} />
                      <Text style={[styles.statusText, { color: meta.text }]}>{meta.label}</Text>
                    </View>
                    {event.status === 'REWARDED' && (
                      <Text style={styles.rewardBadge}>Reward Earned</Text>
                    )}
                  </View>
                </View>
              );
            })
          )}

          {/* How Referrals Work */}
          {events.length > 0 && (
            <View style={styles.howCard}>
              <Text style={styles.howTitle}>How Referrals Work?</Text>
              {[
                { icon: 'share-outline' as const, text: 'Share your referral code' },
                { icon: 'arrow-forward-outline' as const, text: 'Friend books & completes service' },
                { icon: 'arrow-forward-outline' as const, text: 'You unlock milestone & choose reward' },
                { icon: 'gift-outline' as const, text: 'Enjoy & Repeat' },
              ].map((step, i) => (
                <View key={i} style={styles.howStep}>
                  <View style={styles.howStepDot}>
                    <Ionicons name={step.icon} size={12} color={COLORS.primary} />
                  </View>
                  <Text style={styles.howStepText}>{step.text}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: SPACING.md, paddingBottom: 40 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Tabs
  tabRow: {
    flexDirection: 'row', paddingHorizontal: SPACING.md, paddingTop: 12, paddingBottom: 4, gap: 8,
  },
  tab: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  tabTextActive: { color: '#FFFFFF' },

  // Events
  eventCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  eventLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  eventAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  eventName: { fontSize: 14, fontWeight: '700', color: COLORS.textHeading },
  eventPhone: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  eventDate: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  eventRight: { alignItems: 'flex-end', gap: 4 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
  },
  statusText: { fontSize: 10, fontWeight: '700' },
  rewardBadge: { fontSize: 9, fontWeight: '700', color: '#7C3AED' },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textHeading },
  emptyDesc: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 },

  // How it works
  howCard: {
    backgroundColor: '#F0F7FF', borderRadius: 14, padding: 16, marginTop: 16,
  },
  howTitle: { fontSize: 13, fontWeight: '800', color: COLORS.textHeading, marginBottom: 12 },
  howStep: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  howStepDot: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  howStepText: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
});
