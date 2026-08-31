/**
 * Pickup Delivery Tracking — Advisor assigns pickup boy, then tracks the job.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  BackHandler,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { supabase } from '../../../lib/supabase';
import { apiFetch } from '../../../lib/api';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { AC } from '../../../components/workshop/advisorCrmUi';
import { isActivePickupBoyTask, isActiveDeliveryBoyTask } from '../../../lib/pickupTaskFlow';
import { fetchWorkshopPickupBoys, type PickupBoyOption } from '../../../lib/fetchWorkshopPickupBoys';
import PickupAssignModal from '../../../components/workshop/PickupAssignModal';

export default function PickupDeliveryTrackingScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<any[]>([]);
  const [pickupBoys, setPickupBoys] = useState<PickupBoyOption[]>([]);
  const [pickupBoysLoading, setPickupBoysLoading] = useState(false);
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  const [assignTask, setAssignTask] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (assignTask) {
        setAssignTask(null);
        return true;
      }
      if (navigation?.goBack) {
        navigation.goBack();
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [navigation, assignTask]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void initializeScreen().then((fn) => {
      cleanup = fn;
    });
    return () => cleanup?.();
  }, []);

  const initializeScreen = async (): Promise<(() => void) | undefined> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('email', user.email)
        .single();

      if (!userProfile?.workshop_id) {
        setLoading(false);
        return;
      }

      setWorkshopId(userProfile.workshop_id);
      await fetchTasks(userProfile.workshop_id);
      return setupRealtimeSubscription(userProfile.workshop_id);
    } catch (error) {
      console.error('Error initializing screen:', error);
      setLoading(false);
      return undefined;
    }
  };

  const setupRealtimeSubscription = (wid: string) => {
    const channel = supabase
      .channel(`pickup_tracking_updates-${Date.now()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pickup_tracking',
      }, () => fetchTasks(wid))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'service_leads',
      }, () => fetchTasks(wid))
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  const fetchTasks = async (wid?: string) => {
    const workshopIdToUse = wid || workshopId;

    try {
      if (!workshopIdToUse) {
        setRefreshing(false);
        return;
      }

      const [{ data, error }] = await Promise.all([
        supabase
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
            status,
            assigned_pickup_boy_id,
            pickup_boy:assigned_pickup_boy_id(
              id,
              full_name
            )
          `)
          .eq('workshop_id', workshopIdToUse)
          .eq('pickup_required', true)
          .is('deleted_at', null)
          .not('status', 'in', '(REJECTED,CANCELLED)')
          .order('created_at', { ascending: false }),
      ]);

      if (error) {
        setRefreshing(false);
        setLoading(false);
        return;
      }

      const openPickup = (data || []).filter(
        (t: any) => isActivePickupBoyTask(t) || isActiveDeliveryBoyTask(t),
      );

      setTasks(openPickup);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  async function openAssignModal(task: any) {
    setAssignTask(task);
    if (!workshopId) return;
    setPickupBoysLoading(true);
    try {
      setPickupBoys(await fetchWorkshopPickupBoys(workshopId));
    } finally {
      setPickupBoysLoading(false);
    }
  }

  async function assignPickupBoy(pickupBoyId: string, pickupBoyName: string) {
    if (!assignTask) return;
    try {
      setSaving(true);
      await apiFetch(`/api/workshop/leads/${assignTask.id}/assign-team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickup_boy_id: pickupBoyId }),
      });
      setAssignTask(null);
      if (workshopId) await fetchTasks(workshopId);
      Alert.alert('Assigned', `Pickup assigned to ${pickupBoyName}`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to assign pickup boy');
    } finally {
      setSaving(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch (String(status || '').toUpperCase()) {
      case 'ASSIGNED':
        return COLORS.info;
      case 'IN_TRANSIT':
      case 'EN_ROUTE':
        return COLORS.warning;
      case 'PICKED_UP':
        return COLORS.success;
      default:
        return COLORS.gray[500];
    }
  };

  const unassignedCount = tasks.filter((t) => !t.assigned_pickup_boy_id).length;

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
      <Text style={AC.sub}>
        {unassignedCount} need pickup assign · {tasks.length} open
      </Text>

      {loading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      ) : tasks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No pickup jobs waiting</Text>
        </View>
      ) : (
        tasks.map((task) => {
          const unassigned = !task.assigned_pickup_boy_id;
          return (
            <View key={task.id} style={AC.listCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <Text style={AC.name} numberOfLines={1}>
                  {task.customer_name || 'Customer'}
                </Text>
                <View style={[AC.statusPill, { backgroundColor: getStatusColor(task.pickup_status) }]}>
                  <Text style={AC.statusPillTxt}>
                    {unassigned ? 'UNASSIGNED' : String(task.pickup_status || 'PENDING').replace(/_/g, ' ')}
                  </Text>
                </View>
              </View>
              <Text style={AC.meta}>
                {[task.vehicle_number, task.vehicle_make, task.vehicle_model].filter(Boolean).join(' · ')}
              </Text>
              <Text style={[AC.meta, unassigned && { color: '#EA580C', fontWeight: '700' }]}>
                {task.pickup_boy?.full_name || 'Unassigned'}
              </Text>
              {unassigned ? (
                <TouchableOpacity style={styles.assignBtn} onPress={() => openAssignModal(task)}>
                  <Text style={styles.assignBtnTxt}>Assign pickup</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })
      )}

      <PickupAssignModal
        visible={!!assignTask}
        leadLabel={assignTask?.customer_name}
        pickupBoys={pickupBoys}
        loading={pickupBoysLoading}
        saving={saving}
        onSelect={(boy) => assignPickupBoy(boy.id, boy.full_name)}
        onClose={() => setAssignTask(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  emptyContainer: { padding: SPACING.xl, alignItems: 'center' },
  emptyText: { fontSize: SIZES.md, color: COLORS.gray[500] },
  assignBtn: {
    marginTop: 10,
    backgroundColor: '#004AAD',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  assignBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    maxHeight: '70%',
  },
  boyRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  boyName: { fontSize: 16, fontWeight: '700', color: '#023D95' },
  cancelBtn: { paddingVertical: 16, alignItems: 'center' },
  cancelTxt: { fontSize: 15, fontWeight: '700', color: COLORS.gray[500] },
});
