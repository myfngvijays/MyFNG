import { formatDateTime } from "@/lib/dateFormat";
/**
 * Track Booking Screen - Customer
 * Real-time tracking of service booking
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function TrackBookingScreen({ route }: any) {
  const leadId = route?.params?.leadId;
  const [refreshing, setRefreshing] = useState(false);
  const [lead, setLead] = useState<any>(null);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchLeadDetails();
    const channel = supabase.channel('lead_tracking').on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `id=eq.${leadId}` }, fetchLeadDetails).subscribe();
    return () => { channel.unsubscribe(); };
  }, [leadId]);

  const fetchLeadDetails = async () => {
    try {
      const { data: leadData } = await supabase.from('leads').select('*, workshop:workshop_id(workshop_name)').eq('id', leadId).single();
      const { data: history } = await supabase.from('lead_status_history').select('*').eq('lead_id', leadId).order('changed_at', { ascending: false });
      setLead(leadData);
      setStatusHistory(history || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchLeadDetails(); }} />}>
      <View style={styles.header}>
        <Text style={styles.title}>Track Booking</Text>
        <Text style={styles.leadNo}>{lead?.lead_number}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Vehicle</Text>
        <Text style={styles.value}>{lead?.vehicle_number} - {lead?.vehicle_model}</Text>
        <Text style={styles.label}>Status</Text>
        <Text style={[styles.badge, { color: COLORS.primary }]}>{lead?.status}</Text>
        <Text style={styles.label}>Workshop</Text>
        <Text style={styles.value}>{lead?.workshop?.workshop_name || 'Not assigned'}</Text>
      </View>
      <View style={styles.timeline}>
        <Text style={styles.timelineTitle}>Status History</Text>
        {statusHistory.map((item, idx) => (
          <View key={idx} style={styles.timelineItem}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineStatus}>{item.new_status}</Text>
              <Text style={styles.timelineDate}>{formatDateTime(item.changed_at)}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray[50] },
  header: { padding: SPACING.lg, backgroundColor: COLORS.white },
  title: { fontSize: SIZES.xxl, fontWeight: 'bold' },
  leadNo: { fontSize: SIZES.md, color: COLORS.primary, marginTop: SPACING.xs },
  card: { backgroundColor: COLORS.white, margin: SPACING.md, padding: SPACING.lg, borderRadius: SIZES.sm },
  label: { fontSize: SIZES.sm, color: COLORS.gray[600], marginTop: SPACING.md },
  value: { fontSize: SIZES.md, color: COLORS.gray[900], marginTop: SPACING.xs },
  badge: { fontSize: SIZES.md, fontWeight: 'bold', marginTop: SPACING.xs },
  timeline: { padding: SPACING.lg },
  timelineTitle: { fontSize: SIZES.lg, fontWeight: 'bold', marginBottom: SPACING.md },
  timelineItem: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, gap: SPACING.sm },
  timelineContent: { flex: 1 },
  timelineStatus: { fontSize: SIZES.md, fontWeight: '600' },
  timelineDate: { fontSize: SIZES.xs, color: COLORS.gray[500], marginTop: 4 },
});

