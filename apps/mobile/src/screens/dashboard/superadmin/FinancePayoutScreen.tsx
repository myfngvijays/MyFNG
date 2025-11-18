import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  ScrollView
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING } from '../../../constants/theme';

export default function FinancePayoutScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'payouts' | 'refunds' | 'invoices' | 'overview'>('overview');

  const [financeOverview, setFinanceOverview] = useState({
    pendingPayouts: 0,
    pendingPayoutsAmount: 0,
    pendingRefunds: 0,
    pendingRefundsAmount: 0,
    todayRevenue: 0,
    monthlyRevenue: 0,
    outstandingAmount: 0,
  });

  const [payouts, setPayouts] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalNote, setApprovalNote] = useState('');

  useEffect(() => {
    fetchFinanceData();
  }, [activeTab]);

  const fetchFinanceData = async () => {
    try {
      // Fetch overview stats
      const [payoutsResult, refundsResult, revenueResult] = await Promise.all([
        supabase
          .from('workshop_payouts')
          .select('amount', { count: 'exact' })
          .eq('status', 'PENDING'),
        supabase
          .from('refund_requests')
          .select('amount', { count: 'exact' })
          .eq('status', 'PENDING'),
        supabase
          .from('service_leads')
          .select('invoice_amount')
          .eq('status', 'COMPLETED')
          .gte('created_at', new Date().toISOString().split('T')[0])
      ]);

      const pendingPayoutsSum = payoutsResult.data?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
      const pendingRefundsSum = refundsResult.data?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
      const todayRevenueSum = revenueResult.data?.reduce((sum, l) => sum + (l.invoice_amount || 0), 0) || 0;

      setFinanceOverview({
        pendingPayouts: payoutsResult.count || 0,
        pendingPayoutsAmount: pendingPayoutsSum,
        pendingRefunds: refundsResult.count || 0,
        pendingRefundsAmount: pendingRefundsSum,
        todayRevenue: todayRevenueSum,
        monthlyRevenue: 2450000, // Calculate from monthly data
        outstandingAmount: 185000,
      });

      // Fetch detailed lists based on active tab
      if (activeTab === 'payouts') {
        const { data } = await supabase
          .from('workshop_payouts')
          .select('*, workshop:workshops(name)')
          .eq('status', 'PENDING')
          .order('created_at', { ascending: false })
          .limit(50);
        setPayouts(data || []);
      } else if (activeTab === 'refunds') {
        const { data } = await supabase
          .from('refund_requests')
          .select('*, lead:service_leads(customer_name)')
          .eq('status', 'PENDING')
          .order('created_at', { ascending: false })
          .limit(50);
        setRefunds(data || []);
      } else if (activeTab === 'invoices') {
        const { data } = await supabase
          .from('service_leads')
          .select('id, customer_name, invoice_amount, invoice_id, status, created_at')
          .not('invoice_amount', 'is', null)
          .order('created_at', { ascending: false })
          .limit(50);
        setInvoices(data || []);
      }

    } catch (error) {
      console.error('Error fetching finance data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchFinanceData();
  };

  const handleApprovePayout = async (payoutId: string, amount: number) => {
    Alert.alert(
      'Approve Payout',
      `Approve payout of ₹${amount.toLocaleString()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('workshop_payouts')
                .update({
                  status: 'APPROVED',
                  approved_at: new Date().toISOString(),
                  approved_by: 'SUPER_ADMIN' // Should be current user ID
                })
                .eq('id', payoutId);

              if (!error) {
                Alert.alert('Success', 'Payout approved successfully');
                fetchFinanceData();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to approve payout');
            }
          }
        }
      ]
    );
  };

  const handleRejectPayout = async (payoutId: string) => {
    Alert.prompt(
      'Reject Payout',
      'Enter rejection reason:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async (reason) => {
            try {
              const { error } = await supabase
                .from('workshop_payouts')
                .update({
                  status: 'REJECTED',
                  rejection_reason: reason,
                  rejected_at: new Date().toISOString()
                })
                .eq('id', payoutId);

              if (!error) {
                Alert.alert('Rejected', 'Payout rejected');
                fetchFinanceData();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to reject payout');
            }
          }
        }
      ]
    );
  };

  const handleApproveRefund = async (refundId: string, amount: number) => {
    Alert.alert(
      'Approve Refund',
      `Approve refund of ₹${amount.toLocaleString()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('refund_requests')
                .update({
                  status: 'APPROVED',
                  approved_at: new Date().toISOString(),
                  approved_by: 'SUPER_ADMIN'
                })
                .eq('id', refundId);

              if (!error) {
                Alert.alert('Success', 'Refund approved successfully');
                fetchFinanceData();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to approve refund');
            }
          }
        }
      ]
    );
  };

  const renderOverview = () => (
    <ScrollView style={styles.overviewContainer}>
      {/* Revenue Cards */}
      <View style={styles.revenueSection}>
        <Text style={styles.sectionTitle}>💰 Revenue Overview</Text>
        
        <View style={styles.revenueCard}>
          <View style={styles.revenueItem}>
            <Text style={styles.revenueLabel}>Today's Revenue</Text>
            <Text style={[styles.revenueValue, { color: COLORS.green }]}>
              ₹{(financeOverview.todayRevenue / 1000).toFixed(1)}K
            </Text>
          </View>
          <View style={styles.revenueDivider} />
          <View style={styles.revenueItem}>
            <Text style={styles.revenueLabel}>Monthly Revenue</Text>
            <Text style={[styles.revenueValue, { color: COLORS.primary }]}>
              ₹{(financeOverview.monthlyRevenue / 100000).toFixed(1)}L
            </Text>
          </View>
        </View>
      </View>

      {/* Pending Actions */}
      <View style={styles.pendingSection}>
        <Text style={styles.sectionTitle}>⏳ Pending Approvals</Text>

        <TouchableOpacity
          style={[styles.pendingCard, { borderLeftColor: COLORS.orange }]}
          onPress={() => setActiveTab('payouts')}
        >
          <MaterialCommunityIcons name="cash-multiple" size={32} color={COLORS.orange} />
          <View style={styles.pendingInfo}>
            <Text style={styles.pendingCount}>{financeOverview.pendingPayouts}</Text>
            <Text style={styles.pendingLabel}>Pending Payouts</Text>
            <Text style={styles.pendingAmount}>
              ₹{(financeOverview.pendingPayoutsAmount / 1000).toFixed(1)}K
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pendingCard, { borderLeftColor: COLORS.red }]}
          onPress={() => setActiveTab('refunds')}
        >
          <MaterialCommunityIcons name="arrow-u-left-top" size={32} color={COLORS.red} />
          <View style={styles.pendingInfo}>
            <Text style={styles.pendingCount}>{financeOverview.pendingRefunds}</Text>
            <Text style={styles.pendingLabel}>Pending Refunds</Text>
            <Text style={styles.pendingAmount}>
              ₹{(financeOverview.pendingRefundsAmount / 1000).toFixed(1)}K
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Outstanding */}
      <View style={styles.outstandingCard}>
        <MaterialCommunityIcons name="alert-circle" size={24} color={COLORS.orange} />
        <View style={{ flex: 1, marginLeft: SPACING.md }}>
          <Text style={styles.outstandingLabel}>Outstanding Payments</Text>
          <Text style={styles.outstandingAmount}>
            ₹{(financeOverview.outstandingAmount / 1000).toFixed(1)}K
          </Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActionsSection}>
        <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity style={styles.quickActionCard} onPress={() => setActiveTab('invoices')}>
            <MaterialCommunityIcons name="file-document" size={28} color={COLORS.blue} />
            <Text style={styles.quickActionText}>Invoices</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickActionCard}>
            <MaterialCommunityIcons name="percent" size={28} color={COLORS.purple} />
            <Text style={styles.quickActionText}>GST Config</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickActionCard}>
            <MaterialCommunityIcons name="chart-line" size={28} color={COLORS.green} />
            <Text style={styles.quickActionText}>Reports</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickActionCard}>
            <MaterialCommunityIcons name="cog" size={28} color={COLORS.orange} />
            <Text style={styles.quickActionText}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  const renderPayoutCard = ({ item }: { item: any }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>{item.workshop?.name || 'Workshop'}</Text>
          <Text style={styles.itemSubtitle}>
            Payout ID: {item.id.substring(0, 8)}...
          </Text>
          <Text style={styles.itemDate}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.itemAmount}>
          <Text style={styles.amountValue}>₹{item.amount?.toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.itemActions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: COLORS.green + '20' }]}
          onPress={() => handleApprovePayout(item.id, item.amount)}
        >
          <MaterialCommunityIcons name="check" size={18} color={COLORS.green} />
          <Text style={[styles.actionBtnText, { color: COLORS.green }]}>Approve</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: COLORS.red + '20' }]}
          onPress={() => handleRejectPayout(item.id)}
        >
          <MaterialCommunityIcons name="close" size={18} color={COLORS.red} />
          <Text style={[styles.actionBtnText, { color: COLORS.red }]}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRefundCard = ({ item }: { item: any }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>{item.lead?.customer_name || 'Customer'}</Text>
          <Text style={styles.itemSubtitle}>
            Refund ID: {item.id.substring(0, 8)}...
          </Text>
          <Text style={styles.itemReason}>{item.reason || 'No reason provided'}</Text>
          <Text style={styles.itemDate}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.itemAmount}>
          <Text style={[styles.amountValue, { color: COLORS.red }]}>
            ₹{item.amount?.toLocaleString()}
          </Text>
        </View>
      </View>

      <View style={styles.itemActions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: COLORS.green + '20' }]}
          onPress={() => handleApproveRefund(item.id, item.amount)}
        >
          <MaterialCommunityIcons name="check" size={18} color={COLORS.green} />
          <Text style={[styles.actionBtnText, { color: COLORS.green }]}>Approve</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: COLORS.red + '20' }]}
        >
          <MaterialCommunityIcons name="close" size={18} color={COLORS.red} />
          <Text style={[styles.actionBtnText, { color: COLORS.red }]}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderInvoiceCard = ({ item }: { item: any }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>{item.customer_name}</Text>
          <Text style={styles.itemSubtitle}>Invoice: {item.invoice_id || 'N/A'}</Text>
          <Text style={styles.itemDate}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.itemAmount}>
          <Text style={styles.amountValue}>₹{item.invoice_amount?.toLocaleString()}</Text>
          <Text style={[styles.statusBadge, { backgroundColor: COLORS.green + '20', color: COLORS.green }]}>
            {item.status}
          </Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading finance data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Finance & Payout Control</Text>
        <TouchableOpacity onPress={onRefresh}>
          <MaterialCommunityIcons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
            Overview
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'payouts' && styles.tabActive]}
          onPress={() => setActiveTab('payouts')}
        >
          <Text style={[styles.tabText, activeTab === 'payouts' && styles.tabTextActive]}>
            Payouts ({financeOverview.pendingPayouts})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'refunds' && styles.tabActive]}
          onPress={() => setActiveTab('refunds')}
        >
          <Text style={[styles.tabText, activeTab === 'refunds' && styles.tabTextActive]}>
            Refunds ({financeOverview.pendingRefunds})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'invoices' && styles.tabActive]}
          onPress={() => setActiveTab('invoices')}
        >
          <Text style={[styles.tabText, activeTab === 'invoices' && styles.tabTextActive]}>
            Invoices
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'overview' ? (
        renderOverview()
      ) : activeTab === 'payouts' ? (
        <FlatList
          data={payouts}
          renderItem={renderPayoutCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="cash-check" size={64} color={COLORS.gray} />
              <Text style={styles.emptyTitle}>No Pending Payouts</Text>
              <Text style={styles.emptyText}>All payouts have been processed</Text>
            </View>
          }
        />
      ) : activeTab === 'refunds' ? (
        <FlatList
          data={refunds}
          renderItem={renderRefundCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="arrow-u-left-top" size={64} color={COLORS.gray} />
              <Text style={styles.emptyTitle}>No Pending Refunds</Text>
              <Text style={styles.emptyText}>All refunds have been processed</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={invoices}
          renderItem={renderInvoiceCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="file-document-outline" size={64} color={COLORS.gray} />
              <Text style={styles.emptyTitle}>No Invoices</Text>
              <Text style={styles.emptyText}>No invoices found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
  },
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    paddingTop: SPACING.xl,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginLeft: SPACING.md,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray + '30',
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  overviewContainer: {
    flex: 1,
  },
  revenueSection: {
    padding: SPACING.md,
    backgroundColor: '#fff',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  revenueCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: SPACING.md,
  },
  revenueItem: {
    flex: 1,
    alignItems: 'center',
  },
  revenueDivider: {
    width: 1,
    backgroundColor: COLORS.gray + '30',
    marginHorizontal: SPACING.md,
  },
  revenueLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  revenueValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  pendingSection: {
    padding: SPACING.md,
    backgroundColor: '#fff',
    marginBottom: SPACING.sm,
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.sm,
    borderLeftWidth: 4,
    gap: SPACING.md,
  },
  pendingInfo: {
    flex: 1,
  },
  pendingCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  pendingLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  pendingAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.orange,
    marginTop: 4,
  },
  outstandingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.orange + '15',
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: 12,
  },
  outstandingLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  outstandingAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.orange,
    marginTop: 4,
  },
  quickActionsSection: {
    padding: SPACING.md,
    backgroundColor: '#fff',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  quickActionCard: {
    width: '48%',
    aspectRatio: 1.5,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: SPACING.sm,
  },
  listContent: {
    padding: SPACING.md,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  itemSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  itemReason: {
    fontSize: 12,
    color: COLORS.orange,
    marginTop: 4,
    fontStyle: 'italic',
  },
  itemDate: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  itemAmount: {
    alignItems: 'flex-end',
  },
  amountValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.green,
  },
  statusBadge: {
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
    fontWeight: '600',
  },
  itemActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    gap: 4,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: SPACING.lg,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
});

