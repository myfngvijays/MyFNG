import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
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
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceValue}>₹{Number(wallet?.current_balance || 0).toFixed(2)}</Text>
        </View>
        <View style={styles.listCard}>
          <Text style={styles.sectionTitle}>Transactions</Text>
          {transactions.map((tx) => (
            <View key={tx.id} style={styles.row}>
              <View>
                <Text style={styles.rowTitle}>{tx.source || 'TXN'}</Text>
                <Text style={styles.rowSub}>{new Date(tx.created_at).toLocaleString()}</Text>
              </View>
              <Text style={[styles.amount, tx.transaction_type === 'CREDIT' ? styles.credit : styles.debit]}>
                {tx.transaction_type === 'CREDIT' ? '+' : '-'}₹{Number(tx.amount || 0).toFixed(2)}
              </Text>
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
  balanceCard: { backgroundColor: COLORS.white, margin: SPACING.md, padding: SPACING.lg, borderRadius: 10 },
  balanceLabel: { color: COLORS.textSecondary, fontSize: SIZES.sm },
  balanceValue: { marginTop: 6, fontSize: SIZES.xxl, fontWeight: 'bold', color: COLORS.textHeading },
  listCard: { backgroundColor: COLORS.white, marginHorizontal: SPACING.md, marginBottom: SPACING.md, padding: SPACING.md, borderRadius: 10 },
  sectionTitle: { fontSize: SIZES.md, fontWeight: '700', color: COLORS.textHeading, marginBottom: SPACING.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowTitle: { color: COLORS.textHeading, fontWeight: '600' },
  rowSub: { color: COLORS.textSecondary, fontSize: SIZES.xs },
  amount: { fontWeight: '700' },
  credit: { color: COLORS.success },
  debit: { color: COLORS.danger },
  empty: { color: COLORS.textSecondary, textAlign: 'center', marginVertical: SPACING.lg },
});

