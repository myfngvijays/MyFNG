import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';
import { formatDateDMY } from "@/lib/dateFormat";

export default function CustomerOrdersScreen({ navigation }: any) {
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await apiFetch<{ orders: any[] }>('/api/customer/orders');
      setOrders(res.orders || []);
    } catch (e) {
      console.error('Failed to load orders', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const activeCount = orders.filter((o: any) => !['CLOSED', 'CANCELLED', 'COMPLETED'].includes(String(o.status || '').toUpperCase())).length;

  const getStatusMeta = (statusRaw: string) => {
    const status = String(statusRaw || '').toUpperCase();
    if (['COMPLETED', 'CLOSED'].includes(status)) return { bg: '#ECFDF3', text: '#166534', label: status || 'COMPLETED' };
    if (['CANCELLED'].includes(status)) return { bg: '#FEF2F2', text: '#991B1B', label: status };
    return { bg: '#EFF6FF', text: '#1E3A8A', label: status || 'PENDING' };
  };

  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const resolveServiceName = (order: any) => {
    const fromApi = String(order?.service_display || '').trim();
    if (fromApi) return fromApi;

    const raw = String(order?.service_type || '').trim();
    if (raw && !uuidLike.test(raw)) return raw;

    const fallback = String(order?.description || '').trim();
    return fallback || 'Service';
  };

  const resolveDisplayAmount = (order: any) => {
    if (order?.amount_display !== null && order?.amount_display !== undefined) {
      return Number(order.amount_display);
    }
    const actual = Number(order?.actual_amount || 0);
    const estimated = Number(order?.estimated_amount || 0);
    if (actual > 0) return actual;
    if (estimated > 0) return estimated;
    return null;
  };

  return (
    <View style={styles.container}>
      <DashboardHeader title="Order History" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, styles.summaryPrimary]}>
            <Text style={styles.summaryLabel}>Total Orders</Text>
            <Text style={styles.summaryValue}>{orders.length}</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryAccent]}>
            <Text style={styles.summaryLabel}>Active</Text>
            <Text style={styles.summaryValue}>{activeCount}</Text>
          </View>
        </View>

        {orders.map((o) => {
          const amount = resolveDisplayAmount(o);
          return (
            <TouchableOpacity
              key={o.id}
              style={styles.card}
              activeOpacity={0.9}
              onPress={() => navigation.navigate('CustomerOrderDetail', { orderId: o.id, leadNumber: o.lead_number })}
            >
              <View style={styles.topRow}>
                <View style={styles.titleWrap}>
                  <Ionicons name="receipt-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.lead}>{o.lead_number || 'Order'}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: getStatusMeta(o.status).bg }]}>
                  <Text style={[styles.statusText, { color: getStatusMeta(o.status).text }]}>{getStatusMeta(o.status).label}</Text>
                </View>
              </View>
              <Text style={styles.meta}>{resolveServiceName(o)}</Text>
              <Text style={styles.meta}>{o.vehicle_number || 'Vehicle TBD'} • {formatDateDMY(o.created_at)}</Text>
              <Text style={styles.amount}>
                Amount: {amount !== null ? `₹${amount.toFixed(2)}` : 'Pending'}
              </Text>
            </TouchableOpacity>
          );
        })}
        {!loading && orders.length === 0 && <Text style={styles.empty}>No orders found</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: SPACING.md },
  summaryCard: { flex: 1, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1 },
  summaryPrimary: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  summaryAccent: { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' },
  summaryLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '700' },
  summaryValue: { marginTop: 6, fontSize: 24, fontWeight: '800', color: COLORS.textHeading },
  card: { backgroundColor: COLORS.white, borderRadius: 10, padding: SPACING.md, marginBottom: SPACING.sm },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lead: { fontSize: SIZES.md, fontWeight: '800', color: COLORS.textHeading },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontWeight: '700', fontSize: 11 },
  meta: { color: COLORS.textSecondary, marginTop: 6, fontSize: SIZES.sm },
  amount: { color: COLORS.success, marginTop: 8, fontWeight: '700' },
  empty: { textAlign: 'center', marginTop: SPACING.xl, color: COLORS.textSecondary, fontSize: SIZES.md },
});

