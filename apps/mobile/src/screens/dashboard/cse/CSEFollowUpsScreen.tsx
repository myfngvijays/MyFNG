import { formatDateTime } from "@/lib/dateFormat";
/**
 * CSE Follow-ups Screen
 * Manage customer follow-ups with reminders
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function CSEFollowUpsScreen({ navigation }: any) {
  const { userProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [filter, setFilter] = useState('PENDING');

  useEffect(() => {
    fetchFollowUps();
    const channel = supabase.channel('followups').on('postgres_changes', { event: '*', schema: 'public', table: 'follow_ups' }, fetchFollowUps).subscribe();
    return () => { channel.unsubscribe(); };
  }, [filter]);

  const fetchFollowUps = async () => {
    try {
      let query = supabase.from('follow_ups').select('*, lead:lead_id(lead_number, customer_name, customer_phone)').eq('assigned_to', userProfile?.id).order('scheduled_date', { ascending: true });
      
      if (filter !== 'ALL') {
        query = query.eq('status', filter);
      }

      const { data } = await query;
      setFollowUps(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleComplete = async (id: string) => {
    try {
      const { error } = await supabase.from('follow_ups').update({ status: 'COMPLETED', completed_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      Alert.alert('Success', 'Follow-up completed');
      fetchFollowUps();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return COLORS.danger;
      case 'MEDIUM': return COLORS.warning;
      case 'LOW': return COLORS.info;
      default: return COLORS.gray[500];
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Follow-ups</Text>
        <Text style={styles.count}>{followUps.length} Tasks</Text>
      </View>

      <View style={styles.filters}>
        {['PENDING', 'COMPLETED', 'ALL'].map(status => (
          <TouchableOpacity key={status} style={[styles.filterBtn, filter === status && styles.filterBtnActive]} onPress={() => setFilter(status)}>
            <Text style={[styles.filterText, filter === status && styles.filterTextActive]}>{status}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList data={followUps} keyExtractor={item => item.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchFollowUps(); }} />} renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(item.priority) }]} />
            <View style={styles.cardInfo}>
              <Text style={styles.leadNo}>{item.lead?.lead_number}</Text>
              <Text style={styles.customer}>{item.lead?.customer_name}</Text>
              <Text style={styles.phone}>{item.lead?.customer_phone}</Text>
            </View>
            {item.status === 'PENDING' && (
              <TouchableOpacity style={styles.completeBtn} onPress={() => handleComplete(item.id)}>
                <Ionicons name="checkmark-circle" size={32} color={COLORS.success} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.notes}>{item.notes}</Text>
          <View style={styles.dateRow}>
            <Ionicons name="calendar" size={16} color={COLORS.gray[500]} />
            <Text style={styles.date}>{formatDateTime(item.scheduled_date)}</Text>
          </View>
        </View>
      )} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray[50] },
  header: { padding: SPACING.lg, backgroundColor: COLORS.white },
  title: { fontSize: SIZES.xxl, fontWeight: 'bold' },
  count: { fontSize: SIZES.sm, color: COLORS.gray[600], marginTop: SPACING.xs },
  filters: { flexDirection: 'row', padding: SPACING.md, gap: SPACING.sm },
  filterBtn: { flex: 1, padding: SPACING.sm, borderRadius: SIZES.xs, backgroundColor: COLORS.white, alignItems: 'center', borderWidth: 1, borderColor: COLORS.gray[300] },
  filterBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: SIZES.sm, color: COLORS.gray[700], fontWeight: '600' },
  filterTextActive: { color: COLORS.white },
  card: { backgroundColor: COLORS.white, margin: SPACING.md, marginTop: 0, padding: SPACING.md, borderRadius: SIZES.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  priorityDot: { width: 12, height: 12, borderRadius: 6 },
  cardInfo: { flex: 1 },
  leadNo: { fontSize: SIZES.md, fontWeight: 'bold', color: COLORS.primary },
  customer: { fontSize: SIZES.sm, color: COLORS.gray[700], marginTop: 4 },
  phone: { fontSize: SIZES.xs, color: COLORS.gray[500], marginTop: 2 },
  completeBtn: { padding: SPACING.xs },
  notes: { fontSize: SIZES.sm, color: COLORS.gray[600], marginBottom: SPACING.sm },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  date: { fontSize: SIZES.xs, color: COLORS.gray[500] },
});

