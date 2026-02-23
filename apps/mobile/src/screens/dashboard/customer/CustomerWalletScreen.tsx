import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function CustomerWalletScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  const load = async () => {
    try {
      const res = await apiFetch<{ wallet: any; transactions: any[] }>('/api/customer/wallet');
      setWallet(res.wallet || null);
      setTransactions(res.transactions || []);
    } catch (e) {
      console.error('Failed to load wallet', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <View style={styles.container}>
      <DashboardHeader title="Wallet" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        <View style={styles.balanceCard}>
          <View style={styles.balanceTop}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <Ionicons name="wallet-outline" size={20} color={COLORS.white} />
          </View>
          <Text style={styles.balanceValue}>₹{Number(wallet?.current_balance || 0).toFixed(2)}</Text>
          <Text style={styles.balanceHint}>Use wallet credits during checkout</Text>
        </View>

        <View style={styles.listCard}>
          <Text style={styles.sectionTitle}>Transactions</Text>
          {transactions.map((tx) => (
            <View key={tx.id} style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.txIconWrap, tx.transaction_type === 'CREDIT' ? styles.txCredit : styles.txDebit]}>
                  <Ionicons
                    name={tx.transaction_type === 'CREDIT' ? 'arrow-down-outline' : 'arrow-up-outline'}
                    size={14}
                    color={tx.transaction_type === 'CREDIT' ? '#166534' : '#991B1B'}
                  />
                </View>
                <View>
                  <Text style={styles.rowTitle}>{tx.source || 'Transaction'}</Text>
                  <Text style={styles.rowSub}>{new Date(tx.created_at).toLocaleString()}</Text>
                </View>
              </View>
              <View style={styles.rowRight}>
                <Text style={[styles.amount, tx.transaction_type === 'CREDIT' ? styles.credit : styles.debit]}>
                  {tx.transaction_type === 'CREDIT' ? '+' : '-'}₹{Number(tx.amount || 0).toFixed(2)}
                </Text>
                <Text style={styles.balanceAfter}>Bal: ₹{Number(tx.balance_after || 0).toFixed(2)}</Text>
              </View>
            </View>
          ))}
          {!loading && transactions.length === 0 && <Text style={styles.empty}>No wallet transactions</Text>}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl },
  balanceCard: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    borderRadius: 12,
    marginBottom: SPACING.md,
  },
  balanceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balanceLabel: { color: 'rgba(255,255,255,0.88)', fontSize: SIZES.sm, fontWeight: '700' },
  balanceValue: { marginTop: 10, fontSize: 34, fontWeight: '800', color: COLORS.white },
  balanceHint: { marginTop: 6, color: 'rgba(255,255,255,0.84)', fontSize: SIZES.xs },
  listCard: { backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: 10 },
  sectionTitle: { fontSize: SIZES.md, fontWeight: '700', color: COLORS.textHeading, marginBottom: SPACING.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  rowRight: { alignItems: 'flex-end' },
  txIconWrap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  txCredit: { backgroundColor: '#ECFDF3' },
  txDebit: { backgroundColor: '#FEF2F2' },
  rowTitle: { color: COLORS.textHeading, fontSize: SIZES.sm, fontWeight: '600' },
  rowSub: { color: COLORS.textSecondary, fontSize: SIZES.xs },
  amount: { fontWeight: '700', fontSize: SIZES.sm },
  balanceAfter: { color: COLORS.textSecondary, fontSize: SIZES.xs, marginTop: 2 },
  credit: { color: COLORS.success },
  debit: { color: COLORS.danger },
  empty: { color: COLORS.textSecondary, textAlign: 'center', marginVertical: SPACING.lg },
});

