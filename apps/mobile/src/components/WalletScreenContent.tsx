import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { buildWalletTerms, formatWalletUsageLimit, getWalletRules, loadWalletRules } from '../lib/wallet';
import { ENV } from '../config/environment';

export type WalletTxFilter = 'ALL' | 'CREDIT' | 'DEBIT';

const PAGE_PAD = 16;

type TxItem = {
  id?: string;
  transaction_type?: string;
  source?: string;
  amount?: number;
  balance_after?: number;
  created_at?: string;
  metadata?: { label?: string; service_name?: string; [key: string]: unknown };
};

type Props = {
  balance: number;
  rewardPoints?: number;
  earnedCashback: number;
  referralRewards: number;
  welcomeBonusExpiresAt?: string | null;
  transactions: TxItem[];
  txFilter: WalletTxFilter;
  onTxFilterChange: (filter: WalletTxFilter) => void;
  onBookService: () => void;
  onBuyMembership: () => void;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  scrollEnabled?: boolean;
};

type TxMeta = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  label: string;
};

function getTxMeta(tx: TxItem): TxMeta {
  const isCredit = tx.transaction_type === 'CREDIT';
  const isExpire = tx.transaction_type === 'EXPIRE';
  const src = String(tx.source || '').toUpperCase();
  const metaLabel = String(tx.metadata?.label || '');

  if (src.includes('WELCOME') || metaLabel.toLowerCase().includes('welcome')) {
    return { icon: 'gift', color: '#2563EB', bg: '#EFF6FF', label: 'Welcome Bonus Credited' };
  }
  if (isExpire) {
    return { icon: 'time', color: '#DC2626', bg: '#FEF2F2', label: 'Welcome Bonus Expired' };
  }
  if (src.includes('REFERRAL')) {
    return { icon: 'people', color: '#D97706', bg: '#FFFBEB', label: metaLabel || 'Referral Bonus' };
  }
  if (src.includes('CASHBACK')) {
    return {
      icon: 'sparkles',
      color: '#059669',
      bg: '#ECFDF5',
      label: metaLabel || (src.includes('MEMBERSHIP') ? 'Membership Cashback' : 'Cashback Credit'),
    };
  }
  if (src === 'MEMBERSHIP_REDEEM' || (src.includes('MEMBERSHIP') && !isCredit)) {
    return {
      icon: 'diamond',
      color: '#7C3AED',
      bg: '#F5F3FF',
      label: metaLabel || 'Used for Membership',
    };
  }
  if (src === 'ORDER_REDEEM' || src.includes('ORDER') || src.includes('BOOKING') || src.includes('SERVICE')) {
    return {
      icon: 'car-sport',
      color: '#DC2626',
      bg: '#FEF2F2',
      label: metaLabel || tx.metadata?.service_name || 'Used for Service Booking',
    };
  }
  if (isCredit) {
    return { icon: 'arrow-down', color: '#059669', bg: '#ECFDF5', label: metaLabel || 'Wallet Credit' };
  }
  return { icon: 'arrow-up', color: '#DC2626', bg: '#FEF2F2', label: metaLabel || 'Payment' };
}

function formatTxDate(value?: string) {
  if (!value) return '';
  const dt = new Date(value);
  const now = new Date();
  const time = dt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  if (dt.toDateString() === now.toDateString()) return `Today · ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dt.toDateString() === yesterday.toDateString()) return `Yesterday · ${time}`;
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function groupLabel(value?: string) {
  if (!value) return 'Earlier';
  const dt = new Date(value);
  const now = new Date();
  if (dt.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dt.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function WalletScreenContent({
  balance,
  rewardPoints = 0,
  earnedCashback,
  referralRewards,
  welcomeBonusExpiresAt = null,
  transactions,
  txFilter,
  onTxFilterChange,
  onBookService,
  onBuyMembership,
  loading = false,
  refreshing = false,
  onRefresh,
  scrollEnabled = true,
}: Props) {
  const [termsExpanded, setTermsExpanded] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [walletTerms, setWalletTerms] = useState(() => buildWalletTerms());
  const walletRules = getWalletRules();

  useEffect(() => {
    void loadWalletRules(ENV.API_URL).then((rules) => setWalletTerms(buildWalletTerms(rules)));
  }, []);

  useEffect(() => {
    setShowAllHistory(false);
  }, [txFilter]);

  const filteredTx = useMemo(
    () => transactions.filter((t) => {
      if (txFilter === 'ALL') return true;
      if (txFilter === 'CREDIT') return t.transaction_type === 'CREDIT';
      return t.transaction_type === 'DEBIT' || t.transaction_type === 'EXPIRE';
    }),
    [transactions, txFilter],
  );

  const visibleTx = useMemo(
    () => (showAllHistory ? filteredTx : filteredTx.slice(0, 5)),
    [filteredTx, showAllHistory],
  );

  const hasMoreHistory = filteredTx.length > 5;

  const groupedTx = useMemo(() => {
    const groups: { title: string; items: TxItem[] }[] = [];
    visibleTx.forEach((tx) => {
      const title = groupLabel(tx.created_at);
      const last = groups[groups.length - 1];
      if (last?.title === title) last.items.push(tx);
      else groups.push({ title, items: [tx] });
    });
    return groups;
  }, [visibleTx]);

  const totalSaved = earnedCashback + referralRewards;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      scrollEnabled={scrollEnabled}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        ) : undefined
      }
    >
      {/* Balance card */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceGlow} pointerEvents="none" />
        <View style={styles.balanceTop}>
          <View style={styles.walletPill}>
            <Ionicons name="wallet" size={14} color="#FFFFFF" />
            <Text style={styles.walletPillText}>MyFNG Wallet</Text>
          </View>
          <View style={styles.secureBadge}>
            <Ionicons name="shield-checkmark" size={13} color="#FFFFFF" />
          </View>
        </View>

        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmount}>₹{balance.toLocaleString('en-IN')}</Text>
        <Text style={styles.balanceHint}>
          Includes welcome bonus, cashback & referral · Use up to {formatWalletUsageLimit('SERVICE', walletRules)} on services · {formatWalletUsageLimit('MEMBERSHIP', walletRules)} on membership
        </Text>
        {welcomeBonusExpiresAt ? (
          <View style={styles.expiryPill}>
            <Ionicons name="time-outline" size={12} color="#F59E0B" />
            <Text style={styles.expiryText}>
              Welcome bonus expires {new Date(welcomeBonusExpiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </View>
        ) : null}

        <View style={styles.statsStrip}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>₹{earnedCashback.toLocaleString('en-IN')}</Text>
            <Text style={styles.statLabel}>Cashback</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>₹{referralRewards.toLocaleString('en-IN')}</Text>
            <Text style={styles.statLabel}>Referral</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{rewardPoints.toLocaleString('en-IN')}</Text>
            <Text style={styles.statLabel}>Points</Text>
          </View>
        </View>
        <Text style={styles.statsFootnote}>Rewards earned · added to Available Balance above</Text>
      </View>

      {/* Quick actions */}
      <View style={styles.actionsCard}>
        <TouchableOpacity style={styles.actionItem} activeOpacity={0.85} onPress={onBookService}>
          <View style={[styles.actionIcon, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="car-sport" size={22} color={COLORS.primary} />
          </View>
          <Text style={styles.actionLabel}>Book Service</Text>
        </TouchableOpacity>

        <View style={styles.actionDivider} />

        <TouchableOpacity style={styles.actionItem} activeOpacity={0.85} onPress={onBuyMembership}>
          <View style={[styles.actionIcon, { backgroundColor: '#F5F3FF' }]}>
            <Ionicons name="diamond" size={20} color="#7C3AED" />
          </View>
          <Text style={styles.actionLabel}>Membership</Text>
        </TouchableOpacity>

        <View style={styles.actionDivider} />

        <View style={styles.actionItem}>
          <View style={[styles.actionIcon, { backgroundColor: '#FFFBEB' }]}>
            <Ionicons name="sparkles" size={20} color="#D97706" />
          </View>
          <Text style={styles.actionLabel}>Rewards</Text>
        </View>
      </View>

      {totalSaved > 0 ? (
        <View style={styles.insightCard}>
          <View style={styles.insightIcon}>
            <Ionicons name="trending-up" size={16} color={COLORS.primary} />
          </View>
          <Text style={styles.insightText}>
            {"You've earned "}
            <Text style={styles.insightBold}>₹{totalSaved.toLocaleString('en-IN')}</Text>
            {' in rewards'}
          </Text>
        </View>
      ) : null}

      {/* Activity */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <Text style={styles.sectionCount}>{filteredTx.length} entries</Text>
      </View>

      <View style={styles.segmented}>
        {([
          { key: 'ALL' as const, label: 'All' },
          { key: 'CREDIT' as const, label: 'Credits' },
          { key: 'DEBIT' as const, label: 'Debits' },
        ]).map((tab) => {
          const active = txFilter === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.segment, active && styles.segmentActive]}
              activeOpacity={0.85}
              onPress={() => onTxFilterChange(tab.key)}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {!loading && groupedTx.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="receipt-outline" size={28} color="#94A3B8" />
          </View>
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptySub}>
            Cashback and referral credits will appear here
          </Text>
        </View>
      ) : (
        groupedTx.map((group) => (
          <View key={group.title} style={styles.txGroup}>
            <Text style={styles.txGroupTitle}>{group.title}</Text>
            <View style={styles.txCard}>
              {group.items.map((tx, idx) => {
                const meta = getTxMeta(tx);
                const isCredit = tx.transaction_type === 'CREDIT';
                const isExpire = tx.transaction_type === 'EXPIRE';
                const isLast = idx === group.items.length - 1;
                return (
                  <View key={tx.id || `${group.title}-${idx}`} style={[styles.txRow, isLast && styles.txRowLast]}>
                    <View style={[styles.txIcon, { backgroundColor: meta.bg }]}>
                      <Ionicons name={meta.icon} size={18} color={meta.color} />
                    </View>
                    <View style={styles.txBody}>
                      <Text style={styles.txTitle} numberOfLines={1}>{meta.label}</Text>
                      <Text style={styles.txSub}>{formatTxDate(tx.created_at)}</Text>
                    </View>
                    <View style={styles.txAmountCol}>
                      <Text style={[styles.txAmount, { color: isCredit ? '#059669' : isExpire ? '#DC2626' : '#DC2626' }]}>
                        {isCredit ? '+' : '-'}₹{Number(tx.amount || 0).toLocaleString('en-IN')}
                      </Text>
                      {tx.balance_after != null ? (
                        <Text style={styles.txBalance}>Bal ₹{Number(tx.balance_after).toLocaleString('en-IN')}</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ))
      )}

      {!loading && hasMoreHistory ? (
        <TouchableOpacity
          style={styles.showAllBtn}
          activeOpacity={0.85}
          onPress={() => setShowAllHistory((prev) => !prev)}
        >
          <Text style={styles.showAllText}>
            {showAllHistory ? 'Show less' : `Show all (${filteredTx.length})`}
          </Text>
          <Ionicons
            name={showAllHistory ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={COLORS.primary}
          />
        </TouchableOpacity>
      ) : null}

      <View style={styles.termsCard}>
        <Text style={styles.termsTitle}>Terms & Conditions</Text>
        <View style={styles.termRow}>
          <Text style={styles.termBullet}>•</Text>
          <Text style={styles.termText}>{walletTerms[0]}</Text>
        </View>
        {termsExpanded ? (
          walletTerms.slice(1).map((term, idx) => (
            <View key={idx + 1} style={styles.termRow}>
              <Text style={styles.termBullet}>•</Text>
              <Text style={styles.termText}>{term}</Text>
            </View>
          ))
        ) : null}
        <TouchableOpacity
          style={styles.termsToggle}
          activeOpacity={0.85}
          onPress={() => setTermsExpanded((prev) => !prev)}
        >
          <Text style={styles.termsToggleText}>
            {termsExpanded ? 'Show less' : 'View all terms'}
          </Text>
          <Ionicons
            name={termsExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={COLORS.primary}
          />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F0F7FF' },
  scrollContent: {
    paddingHorizontal: PAGE_PAD,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 14,
  },

  balanceCard: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: COLORS.primary,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  balanceGlow: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  balanceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  walletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  walletPillText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  secureBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  balanceLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.78)' },
  balanceAmount: {
    fontSize: 40,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 4,
    letterSpacing: -1,
  },
  balanceHint: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.65)',
    marginTop: 6,
    lineHeight: 17,
  },
  expiryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  expiryText: { fontSize: 11, fontWeight: '600', color: '#FDE68A' },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
    marginTop: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },
  statsFootnote: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 14,
  },

  actionsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E5EEF9',
    shadowColor: '#004AAD',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  actionItem: { flex: 1, alignItems: 'center', gap: 8 },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 12, fontWeight: '700', color: '#1E293B', textAlign: 'center' },
  actionDivider: { width: 1, height: 44, backgroundColor: '#EEF2F7' },

  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  insightIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightText: { flex: 1, fontSize: 13, fontWeight: '500', color: '#475569', lineHeight: 18 },
  insightBold: { fontWeight: '800', color: COLORS.primary },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  sectionCount: { fontSize: 12, fontWeight: '600', color: '#64748B' },

  segmented: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 3,
  },
  segment: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  segmentActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  segmentTextActive: { fontSize: 13, fontWeight: '800', color: COLORS.primary },

  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 36,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#E5EEF9',
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  emptySub: { fontSize: 13, fontWeight: '500', color: '#64748B', textAlign: 'center', marginTop: 6, lineHeight: 19 },

  txGroup: { gap: 8 },
  txGroupTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginLeft: 2,
  },
  txCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5EEF9',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  txRowLast: { borderBottomWidth: 0 },
  txIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txBody: { flex: 1, minWidth: 0 },
  txTitle: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  txSub: { fontSize: 11, fontWeight: '500', color: '#94A3B8', marginTop: 2 },
  showAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  showAllText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  txAmountCol: { alignItems: 'flex-end', marginLeft: 8, minWidth: 72 },
  txAmount: { fontSize: 14, fontWeight: '800' },
  txBalance: { fontSize: 11, fontWeight: '500', color: '#94A3B8', marginTop: 2 },

  termsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5EEF9',
    gap: 10,
  },
  termsTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  termRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  termBullet: { fontSize: 11, color: COLORS.primary, lineHeight: 16, fontStyle: 'italic' },
  termText: { flex: 1, fontSize: 11, fontWeight: '400', fontStyle: 'italic', color: '#475569', lineHeight: 16 },
  termsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 4,
    paddingVertical: 6,
  },
  termsToggleText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
});
