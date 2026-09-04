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
import { isActivePickupBoyTask, isDeliveryStage, isUnassignedDeliveryTask } from '../../../lib/pickupTaskFlow';
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
  const [assignMode, setAssignMode] = useState<'pickup' | 'delivery'>('pickup');
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

      const rows = data || [];
      const ids = rows.map((t: any) => t.id);
      const { data: trackingRows } = ids.length
        ? await supabase
            .from('pickup_tracking')
            .select('lead_id, drop_assigned_to')
            .in('lead_id', ids)
        : { data: [] as any[] };
      const dropMap = new Map((trackingRows || []).map((r: any) => [r.lead_id, r.drop_assigned_to]));
      const withDrop = rows.map((t: any) => ({ ...t, drop_assigned_to: dropMap.get(t.id) || null }));

      const openPickup = withDrop.filter((t: any) => isActivePickupBoyTask(t) || isDeliveryStage(t));

      setTasks(openPickup);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  async function openAssignModal(task: any, mode: 'pickup' | 'delivery') {
    setAssignMode(mode);
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
      if (assignMode === 'delivery') {
        await apiFetch(`/api/workshop/leads/${assignTask.id}/reassign-delivery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pickup_boy_id: pickupBoyId }),
        });
        Alert.alert('Assigned', `Delivery assigned to ${pickupBoyName}`);
      } else {
        await apiFetch(`/api/workshop/leads/${assignTask.id}/assign-team`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pickup_boy_id: pickupBoyId }),
        });
        Alert.alert('Assigned', `Pickup assigned to ${pickupBoyName}`);
      }
      setAssignTask(null);
      if (workshopId) await fetchTasks(workshopId);
    } catch (e: any) {
      setAssignTask(null);
      Alert.alert('Error', e?.message || 'Failed to assign');
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
      case 'READY_FOR_DELIVERY':
      case 'COD_PENDING':
        return COLORS.info;
      case 'VEHICLE_DROPPED_AT_WORKSHOP':
      case 'DROPPED':
        return COLORS.success;
      default:
        return COLORS.gray[500];
    }
  };

  const pickupOpen = tasks.filter((t) => isActivePickupBoyTask(t));
  const deliveryOpen = tasks.filter((t) => isDeliveryStage(t));
  const unassignedCount = pickupOpen.filter((t) => !t.assigned_pickup_boy_id).length;
  const unassignedDelivery = deliveryOpen.filter((t) => isUnassignedDeliveryTask(t)).length;

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
        {unassignedCount} need pickup assign · {unassignedDelivery} need delivery assign
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
          const isDelivery = isDeliveryStage(task);
          const needsDeliveryAssign = isUnassignedDeliveryTask(task);
          const unassigned = !isDelivery && !task.assigned_pickup_boy_id;
          const badgeRaw = isDelivery
            ? String(task.status || 'READY_FOR_DELIVERY')
            : unassigned
              ? 'UNASSIGNED'
              : String(task.pickup_status || task.status || 'PENDING');
          const lineName = isDelivery
            ? needsDeliveryAssign
              ? 'Needs delivery assign'
              : 'Delivery assigned'
            : task.pickup_boy?.full_name || 'Unassigned';
          return (
            <View key={task.id} style={AC.listCard}>
              <View style={styles.cardTop}>
                <View style={styles.cardCopy}>
                  <Text style={AC.name} numberOfLines={2}>
                    {task.customer_name || 'Customer'}
                  </Text>
                  <Text style={styles.vehicleLine} numberOfLines={2}>
                    {[task.vehicle_number, task.vehicle_make, task.vehicle_model].filter(Boolean).join(' · ')}
                  </Text>
                  <Text
                    style={[
                      styles.assignHint,
                      (unassigned || needsDeliveryAssign) && { color: '#EA580C' },
                    ]}
                  >
                    {lineName}
                  </Text>
                </View>
                <View style={[AC.statusPill, styles.badge, { backgroundColor: getStatusColor(badgeRaw) }]}>
                  <Text style={[AC.statusPillTxt, styles.badgeTxt]}>{badgeRaw.replace(/_/g, ' ')}</Text>
                </View>
              </View>
              {unassigned ? (
                <TouchableOpacity style={styles.assignBtn} onPress={() => openAssignModal(task, 'pickup')}>
                  <Text style={styles.assignBtnTxt}>Assign pickup</Text>
                </TouchableOpacity>
              ) : null}
              {needsDeliveryAssign ? (
                <TouchableOpacity style={styles.assignBtn} onPress={() => openAssignModal(task, 'delivery')}>
                  <Text style={styles.assignBtnTxt}>Assign delivery</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })
      )}

      <PickupAssignModal
        visible={!!assignTask}
        title={assignMode === 'delivery' ? 'Assign delivery' : 'Assign pickup'}
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
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardCopy: { flex: 1, minWidth: 0, paddingRight: 4 },
  vehicleLine: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.gray[500],
  },
  assignHint: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: COLORS.gray[500],
  },
  badge: {
    flexShrink: 0,
    maxWidth: 132,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
  },
  badgeTxt: {
    fontSize: 9,
    lineHeight: 13,
    textAlign: 'center',
  },
  assignBtn: {
    marginTop: 14,
    backgroundColor: '#004AAD',
    borderRadius: 10,
    paddingVertical: 12,
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
