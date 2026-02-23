import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { clearCustomerSessionToken } from '../../lib/customerSession';
import DashboardHeader from '../../components/DashboardHeader';
import { COLORS, SPACING } from '../../constants/theme';
import { formatDateDMY } from "@/lib/dateFormat";

export default function CustomerDashboard() {
  const navigation = useNavigation<any>();
  const [customer, setCustomer] = useState<any | null>(null);
  const [stats, setStats] = useState({
    totalBookings: 0,
    activeServices: 0,
    completedServices: 0,
  });
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const quickActions = [
    { key: 'orders', title: 'Order History', icon: 'receipt-outline', screen: 'CustomerOrders' },
    { key: 'vehicles', title: 'My Vehicles', icon: 'car-sport-outline', screen: 'CustomerVehicles' },
    { key: 'support', title: 'Help & Support', icon: 'help-circle-outline', screen: 'CustomerSupport' },
    { key: 'wallet', title: 'Wallet', icon: 'wallet-outline', screen: 'CustomerWallet' },
    { key: 'refer', title: 'Refer & Earn', icon: 'gift-outline', screen: 'CustomerRefer' },
    { key: 'profile', title: 'Profile', icon: 'person-circle-outline', screen: 'CustomerProfile' },
    { key: 'notifications', title: 'Notifications', icon: 'notifications-outline', screen: 'CustomerNotifications' },
    { key: 'membership', title: 'Membership', icon: 'ribbon-outline', screen: 'CustomerMembership' },
    { key: 'cart', title: 'Cart', icon: 'cart-outline', screen: 'CustomerCart' },
  ] as const;

  const fetchData = async () => {
    try {
      const [me, ordersRes] = await Promise.all([
        apiFetch<{ customer: any }>('/api/customer/auth/me'),
        apiFetch<{ orders: any[] }>('/api/customer/orders'),
      ]);
      const orders = ordersRes.orders || [];
      setCustomer(me.customer || null);
      setMyBookings(orders.slice(0, 8));
      setStats({
        totalBookings: orders.length,
        activeServices: orders.filter((o: any) => !['CLOSED', 'CANCELLED', 'COMPLETED'].includes(o.status)).length,
        completedServices: orders.filter((o: any) => ['COMPLETED', 'CLOSED'].includes(o.status)).length,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLogout = async () => {
    try {
      await apiFetch('/api/customer/auth/logout', { method: 'POST' });
    } catch (_e) {}
    await clearCustomerSessionToken();
    await supabase.auth.signOut();
  };

  return (
    <View style={styles.container}>
      <DashboardHeader
        name={customer?.full_name || 'Customer'}
        role="Customer"
        onLogout={handleLogout}
      />
      
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.profileBanner}>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{customer?.full_name || 'Customer'}</Text>
            <Text style={styles.profileSub}>{customer?.phone ? `+91 ${customer.phone}` : 'Welcome to MyFNG'}</Text>
          </View>
          <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('CustomerProfile')}>
            <Ionicons name="create-outline" size={16} color={COLORS.primary} />
            <Text style={styles.profileBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Quick Access</Text>
        <View style={styles.actionsGrid}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.key}
              style={styles.actionCard}
              onPress={() => navigation.navigate(action.screen)}
              activeOpacity={0.85}
            >
              <View style={styles.actionIconWrap}>
                <Ionicons name={action.icon as any} size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.actionTitle}>{action.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Service Snapshot</Text>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statPrimary]}>
            <Text style={styles.statLabel}>Total</Text>
            <Text style={styles.statValue}>{stats.totalBookings}</Text>
            <Text style={styles.statSub}>Bookings</Text>
          </View>
          <View style={[styles.statCard, styles.statWarning]}>
            <Text style={styles.statLabel}>Active</Text>
            <Text style={styles.statValue}>{stats.activeServices}</Text>
            <Text style={styles.statSub}>In progress</Text>
          </View>
          <View style={[styles.statCard, styles.statSuccess]}>
            <Text style={styles.statLabel}>Done</Text>
            <Text style={styles.statValue}>{stats.completedServices}</Text>
            <Text style={styles.statSub}>Completed</Text>
          </View>
        </View>

        {myBookings.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            {myBookings.map((booking) => (
              <View key={booking.id} style={styles.orderCard}>
                <View style={styles.orderTop}>
                  <Text style={styles.orderNumber}>{booking.lead_number || 'Order'}</Text>
                  <Text style={styles.orderStatus}>{booking.status || 'PENDING'}</Text>
                </View>
                <Text style={styles.orderMeta}>{booking.service_type || 'Service'} • {booking.vehicle_number || 'Vehicle TBD'}</Text>
                <Text style={styles.orderDate}>{formatDateDMY(booking.created_at)}</Text>
              </View>
            ))}
          </>
        )}

        {myBookings.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No bookings yet</Text>
            <Text style={styles.emptySubtext}>Book your first service!</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  profileBanner: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textHeading,
  },
  profileSub: {
    marginTop: 4,
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
  },
  profileBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.black,
    marginBottom: SPACING.md,
    marginTop: SPACING.md,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  actionCard: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textHeading,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  statPrimary: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  statWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statSuccess: {
    backgroundColor: '#ECFDF3',
    borderColor: '#86EFAC',
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  statValue: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textHeading,
  },
  statSub: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  orderCard: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  orderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textHeading,
  },
  orderStatus: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '700',
  },
  orderMeta: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  orderDate: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 6,
  },
  emptyState: {
    padding: SPACING.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.gray[600],
    marginBottom: SPACING.sm,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.gray[500],
  },
});

