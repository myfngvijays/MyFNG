import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import DashboardHeader from '../../components/DashboardHeader';
import StatCard from '../../components/StatCard';
import LeadCard from '../../components/LeadCard';
import { COLORS, SPACING } from '../../constants/theme';

export default function CustomerDashboard() {
  const [userProfile, setUserProfile] = React.useState(null);

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (data) setUserProfile(data);
          });
      }
    });
  }, []);
  const [stats, setStats] = useState({
    totalBookings: 0,
    activeServices: 0,
    completedServices: 0,
  });
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      if (!userProfile?.id) return;

      // Fetch customer bookings
      const [total, active, completed] = await Promise.all([
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('customer_id', userProfile.id),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('customer_id', userProfile.id).in('status', ['pending', 'in_progress']),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('customer_id', userProfile.id).eq('status', 'completed'),
      ]);

      setStats({
        totalBookings: total.count || 0,
        activeServices: active.count || 0,
        completedServices: completed.count || 0,
      });

      // Fetch my bookings
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('*')
        .eq('customer_id', userProfile.id)
        .order('created_at', { ascending: false })
        .limit(10);

      setMyBookings(bookingsData || []);
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
    await supabase.auth.signOut();
  };

  return (
    <View style={styles.container}>
      <DashboardHeader
        name={userProfile?.full_name || 'Customer'}
        role="Customer"
        onLogout={handleLogout}
      />
      
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
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
                customerName="My Booking"
                vehicleModel={booking.vehicle_model || 'N/A'}
                serviceType={booking.service_type || 'Service'}
                status={booking.status || 'pending'}
                date={new Date(booking.created_at).toLocaleDateString()}
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

