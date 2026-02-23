import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { apiFetch } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { clearCustomerSessionToken } from '../../lib/customerSession';
import DashboardHeader from '../../components/DashboardHeader';
import StatCard from '../../components/StatCard';
import LeadCard from '../../components/LeadCard';
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
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('CustomerOrders')}>
            <Text style={styles.actionTitle}>Order History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('CustomerWallet')}>
            <Text style={styles.actionTitle}>Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('CustomerVehicles')}>
            <Text style={styles.actionTitle}>My Vehicles</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('CustomerSupport')}>
            <Text style={styles.actionTitle}>Support</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('CustomerRefer')}>
            <Text style={styles.actionTitle}>Refer & Earn</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('CustomerCart')}>
            <Text style={styles.actionTitle}>Cart</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('CustomerNotifications')}>
            <Text style={styles.actionTitle}>Notifications</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('CustomerMembership')}>
            <Text style={styles.actionTitle}>Membership</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('CustomerProfile')}>
            <Text style={styles.actionTitle}>Profile</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>My Services</Text>
        
        <StatCard
          title="Total Bookings"
          value={stats.totalBookings}
          subtitle="All time bookings"
          color={COLORS.primary}
        />
        
        <StatCard
          title="Active Services"
          value={stats.activeServices}
          subtitle="Currently ongoing"
          color={COLORS.warning}
        />
        
        <StatCard
          title="Completed Services"
          value={stats.completedServices}
          subtitle="Successfully finished"
          color={COLORS.success}
        />

        {myBookings.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recent Bookings</Text>
            {myBookings.map((booking) => (
              <LeadCard
                key={booking.id}
                customerName={booking.lead_number || 'Order'}
                vehicleModel={booking.vehicle_model || 'N/A'}
                serviceType={booking.service_type || 'Service'}
                status={booking.status || 'pending'}
                date={formatDateDMY(booking.created_at)}
              />
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
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
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textHeading,
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

