/**
 * Complaints Management Screen - CSE Dashboard
 * Manage customer complaints with realtime updates
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function ComplaintsManagementScreen({ navigation }: any) {
  const [refreshing, setRefreshing] = useState(false);
  const [complaints, setComplaints] = useState<any[]>([]);

  useEffect(() => {
    fetchComplaints();
    const channel = supabase.channel('complaints').on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, fetchComplaints).subscribe();
    return () => { channel.unsubscribe(); };
  }, []);

  const fetchComplaints = async () => {
    try {
      const { data } = await supabase.from('complaints').select('*, lead:lead_id(lead_number, customer_name)').in('status', ['OPEN', 'IN_PROGRESS']).order('created_at', { ascending: false });
      setComplaints(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Complaints Management</Text>
        <Text style={styles.count}>{complaints.length} Active</Text>
      </View>
      <FlatList data={complaints} keyExtractor={item => item.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchComplaints(); }} />} renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => navigation?.navigate('ComplaintDetail', { id: item.id })}>
          <View style={styles.row}>
            <Ionicons name="warning" size={24} color={item.priority === 'HIGH' ? COLORS.danger : COLORS.warning} />
            <View style={styles.info}>
              <Text style={styles.subject}>{item.subject}</Text>
              <Text style={styles.lead}>{item.lead?.lead_number}</Text>
              <Text style={styles.customer}>{item.lead?.customer_name}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: item.status === 'OPEN' ? COLORS.danger : COLORS.warning }]}>
              <Text style={styles.badgeText}>{item.status}</Text>
            </View>
          </View>
        </TouchableOpacity>
      )} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray[50] },
  header: { padding: SPACING.lg, backgroundColor: COLORS.white },
  title: { fontSize: SIZES.xxl, fontWeight: 'bold' },
  count: { fontSize: SIZES.sm, color: COLORS.gray[600], marginTop: SPACING.xs },
  card: { backgroundColor: COLORS.white, margin: SPACING.md, padding: SPACING.md, borderRadius: SIZES.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  info: { flex: 1 },
  subject: { fontSize: SIZES.md, fontWeight: 'bold' },
  lead: { fontSize: SIZES.sm, color: COLORS.primary, marginTop: 4 },
  customer: { fontSize: SIZES.xs, color: COLORS.gray[500] },
  badge: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: SIZES.xs },
  badgeText: { color: COLORS.white, fontSize: SIZES.xs, fontWeight: '600' },
});

