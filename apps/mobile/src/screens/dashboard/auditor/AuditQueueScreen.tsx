/**
 * Audit Queue Screen - Auditor
 * Queue of leads pending audit
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function AuditQueueScreen({ navigation }: any) {
  const [refreshing, setRefreshing] = useState(false);
  const [queue, setQueue] = useState<any[]>([]);

  useEffect(() => {
    fetchQueue();
    const channel = supabase.channel('audit_queue').on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchQueue).subscribe();
    return () => { channel.unsubscribe(); };
  }, []);

  const fetchQueue = async () => {
    try {
      const { data } = await supabase.from('leads').select('*, workshop:workshop_id(workshop_name)').in('status', ['COMPLETED', 'QC_APPROVED']).is('audit_status', null).order('completed_at', { ascending: false });
      setQueue(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Audit Queue</Text>
        <Text style={styles.count}>{queue.length} Pending</Text>
      </View>
      <FlatList data={queue} keyExtractor={item => item.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchQueue(); }} />} renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => navigation?.navigate('AuditDetail', { id: item.id })}>
          <Text style={styles.leadNo}>{item.lead_number}</Text>
          <Text style={styles.vehicle}>{item.vehicle_number} - {item.vehicle_model}</Text>
          <Text style={styles.workshop}>{item.workshop?.workshop_name}</Text>
          <Text style={styles.date}>Completed: {new Date(item.completed_at).toLocaleDateString()}</Text>
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
  leadNo: { fontSize: SIZES.md, fontWeight: 'bold', color: COLORS.primary },
  vehicle: { fontSize: SIZES.sm, color: COLORS.gray[700], marginTop: 4 },
  workshop: { fontSize: SIZES.sm, color: COLORS.gray[600], marginTop: 4 },
  date: { fontSize: SIZES.xs, color: COLORS.gray[500], marginTop: 8 },
});

