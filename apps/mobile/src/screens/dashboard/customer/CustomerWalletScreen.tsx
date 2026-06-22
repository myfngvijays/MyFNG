import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import WalletScreenContent, { type WalletTxFilter } from '../../../components/WalletScreenContent';
import { apiFetch } from '../../../lib/api';

export default function CustomerWalletScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wallet, setWallet] = useState<any>(null);
  const [welcomeExpiresAt, setWelcomeExpiresAt] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [totals, setTotals] = useState({ earned_cashback: 0, referral_rewards: 0, reward_points: 0 });
  const [txFilter, setTxFilter] = useState<WalletTxFilter>('ALL');

  const load = async () => {
    try {
      const res = await apiFetch<{ wallet: any; transactions: any[]; totals?: typeof totals }>('/api/customer/wallet');
      setWallet(res.wallet || null);
      setWelcomeExpiresAt(res.wallet?.welcome_bonus_expires_at || null);
      setTransactions(res.transactions || []);
      setTotals({
        earned_cashback: Number(res.totals?.earned_cashback || 0),
        referral_rewards: Number(res.totals?.referral_rewards || 0),
        reward_points: Number(res.totals?.reward_points || 0),
      });
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
    <View style={{ flex: 1, backgroundColor: '#F0F7FF' }}>
      <DashboardHeader title="Wallet" onBack={() => navigation.goBack()} />
      <WalletScreenContent
        balance={Number(wallet?.spendable_balance ?? wallet?.current_balance ?? 0)}
        earnedCashback={totals.earned_cashback}
        referralRewards={totals.referral_rewards}
        rewardPoints={totals.reward_points}
        welcomeBonusExpiresAt={welcomeExpiresAt}
        transactions={transactions}
        txFilter={txFilter}
        onTxFilterChange={setTxFilter}
        onBookService={() => navigation.navigate('CustomerCart')}
        onBuyMembership={() => navigation.navigate('CustomerMembership')}
        loading={loading}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); load(); }}
      />
    </View>
  );
}
