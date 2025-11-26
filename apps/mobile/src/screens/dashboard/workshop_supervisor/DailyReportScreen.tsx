/**
 * Daily Report Screen - Workshop Supervisor
 * End of day summary and reports
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function DailyReportScreen() {
  const { userProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [report, setReport] = useState({ completed: 0, pending: 0, qcPassed: 0, revenue: 0 });

  useEffect(() => {
    fetchDailyReport();
    
    // Setup realtime subscription
    const channel = supabase
      .channel('daily-report-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mechanic_jobs'
      }, () => {
        console.log('Daily Report: Real-time update received');
        fetchDailyReport();
      })
      .subscribe((status) => {
        console.log('Daily report subscription status:', status);
      });
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDailyReport = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase.from('mechanic_jobs').select('*').eq('workshop_id', userProfile?.workshop_id).gte('created_at', today);
      setReport({
        completed: data?.filter(j => j.status === 'COMPLETED').length || 0,
        pending: data?.filter(j => j.status === 'PENDING').length || 0,
        qcPassed: data?.filter(j => j.status === 'QC_APPROVED').length || 0,
        revenue: 0,
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDailyReport(); }} />}>
      <View style={styles.header}>
        <Text style={styles.title}>Daily Report</Text>
        <Text style={styles.date}>{new Date().toLocaleDateString()}</Text>
      </View>
      <View style={styles.grid}>
        <View style={styles.card}><Ionicons name="checkmark-circle" size={32} color={COLORS.success} /><Text style={styles.value}>{report.completed}</Text><Text style={styles.label}>Completed</Text></View>
        <View style={styles.card}><Ionicons name="time" size={32} color={COLORS.warning} /><Text style={styles.value}>{report.pending}</Text><Text style={styles.label}>Pending</Text></View>
        <View style={styles.card}><Ionicons name="shield-checkmark" size={32} color={COLORS.info} /><Text style={styles.value}>{report.qcPassed}</Text><Text style={styles.label}>QC Passed</Text></View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray[50] },
  header: { padding: SPACING.lg, backgroundColor: COLORS.white },
  title: { fontSize: SIZES.xxl, fontWeight: 'bold' },
  date: { fontSize: SIZES.sm, color: COLORS.gray[600], marginTop: SPACING.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: SPACING.md, gap: SPACING.md },
  card: { flex: 1, minWidth: '45%', backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: SIZES.sm, alignItems: 'center' },
  value: { fontSize: SIZES.xxl, fontWeight: 'bold', marginTop: SPACING.sm },
  label: { fontSize: SIZES.sm, color: COLORS.gray[600], marginTop: SPACING.xs },
});

