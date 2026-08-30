/**
 * Pickup Delivery Tracking Screen - Workshop Supervisor
 * Track pickup boys and vehicle deliveries
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { COLORS, SIZES, SPACING, SHADOWS } from '../../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { AC } from '../../../components/workshop/advisorCrmUi';

export default function PickupDeliveryTrackingScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<any[]>([]);
  const [workshopId, setWorkshopId] = useState<string | null>(null);

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation?.goBack) {
        navigation.goBack();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [navigation]);

  useEffect(() => {
    initializeScreen();
  }, []);

  const initializeScreen = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('❌ No user found');
        setLoading(false);
        return;
      }

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('email', user.email)
        .single();

      if (!userProfile?.workshop_id) {
        console.log('❌ No workshop_id found');
        setLoading(false);
        return;
      }

      console.log('✅ Pickup Tracking - Workshop ID:', userProfile.workshop_id);
      setWorkshopId(userProfile.workshop_id);
      
      await fetchTasks(userProfile.workshop_id);
      setupRealtimeSubscription(userProfile.workshop_id);
    } catch (error) {
      console.error('❌ Error initializing screen:', error);
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = (wid: string) => {
    const channel = supabase
      .channel(`pickup_tracking_updates-${Date.now()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pickup_tracking'
      }, () => {
        console.log('Pickup tracking: Real-time update');
        fetchTasks(wid);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'service_leads'
      }, () => {
        fetchTasks(wid);
      })
      .subscribe();
    
    return () => {
      channel.unsubscribe();
    };
  };

  const fetchTasks = async (wid?: string) => {
    const workshopIdToUse = wid || workshopId;
    
    try {
      if (!workshopIdToUse) {
        console.log('❌ No workshop ID');
        setRefreshing(false);
        return;
      }

      console.log('🔍 Fetching pickup tasks for workshop:', workshopIdToUse);

      // ✅ FIX: Use service_leads with pickup info (correct table)
      const { data, error } = await supabase
        .from('service_leads')
        .select(`
          id,
          lead_number,
          customer_name,
          vehicle_number,
          vehicle_make,
          vehicle_model,
          pickup_required,
          pickup_status,
          assigned_pickup_boy_id,
          pickup_boy:assigned_pickup_boy_id(
            id,
            full_name
          )
        `)
        .eq('workshop_id', workshopIdToUse)
        .eq('pickup_required', true)
        .in('pickup_status', ['ASSIGNED', 'IN_TRANSIT', 'PICKED_UP', 'EN_ROUTE'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching tasks:', error);
        setRefreshing(false);
        setLoading(false);
        return;
      }

      console.log('✅ Found', data?.length || 0, 'active pickup tasks');

      setTasks(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ASSIGNED': return COLORS.info;
      case 'IN_TRANSIT': return COLORS.warning;
      case 'PICKED_UP': return COLORS.success;
      default: return COLORS.gray[500];
    }
  };

  return (
    <ScrollView
      style={AC.page}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            if (workshopId) fetchTasks(workshopId);
            else setRefreshing(false);
          }}
        />
      }
    >
      <Text style={AC.sub}>{tasks.length} active tasks</Text>
      
      {loading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      ) : tasks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No active pickup tasks</Text>
        </View>
      ) : (
        tasks.map(task => (
          <View key={task.id} style={AC.listCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <Text style={AC.name} numberOfLines={1}>
                {task.customer_name || 'Customer'}
              </Text>
              <View style={[AC.statusPill, { backgroundColor: getStatusColor(task.pickup_status) }]}>
                <Text style={AC.statusPillTxt}>{task.pickup_status}</Text>
              </View>
            </View>
            <Text style={AC.meta}>{task.vehicle_number}</Text>
            <Text style={AC.meta}>{task.pickup_boy?.full_name || 'Unassigned'}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.md, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: SIZES.xxl, fontWeight: 'bold' },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  emptyContainer: { padding: SPACING.xl, alignItems: 'center' },
  emptyText: { fontSize: SIZES.md, color: COLORS.gray[500] },
  card: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    padding: SPACING.md,
    borderRadius: 14,
    ...SHADOWS.small,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  info: { flex: 1, minWidth: 0 },
  leadNo: { fontSize: 16, fontWeight: '800', color: COLORS.textHeading },
  vehicle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  customer: { fontSize: SIZES.sm, color: COLORS.gray[700], marginTop: 2 },
  boy: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  badgeText: { color: COLORS.white, fontSize: 10, fontWeight: '800' },
});