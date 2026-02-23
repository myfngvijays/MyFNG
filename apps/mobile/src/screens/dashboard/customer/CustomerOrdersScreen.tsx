import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
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

  return (
    <View style={styles.container}>
      <DashboardHeader title="Order History" onBack={() => navigation.goBack()} />
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        {orders.map((o) => (
          <View key={o.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.lead}>{o.lead_number}</Text>
              <Text style={styles.status}>{o.status}</Text>
            </View>
            <Text style={styles.meta}>{o.service_type || 'Service'} • {o.vehicle_number || 'Vehicle TBD'}</Text>
            <Text style={styles.meta}>{formatDateDMY(o.created_at)}</Text>
            <Text style={styles.amount}>₹{Number(o.actual_amount || 0).toFixed(2)}</Text>
          </View>
        ))}
        {!loading && orders.length === 0 && <Text style={styles.empty}>No orders found</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  card: { backgroundColor: COLORS.white, margin: SPACING.md, borderRadius: 10, padding: SPACING.md, borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lead: { fontSize: SIZES.md, fontWeight: '800', color: COLORS.textHeading },
  status: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.xs },
  meta: { color: COLORS.textSecondary, marginTop: 4 },
  amount: { color: COLORS.success, marginTop: 6, fontWeight: '700' },
  empty: { textAlign: 'center', marginTop: SPACING.xl, color: COLORS.textSecondary },
});

