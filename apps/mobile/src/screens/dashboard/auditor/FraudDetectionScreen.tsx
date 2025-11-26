/**
 * Fraud Detection Screen - Auditor
 * Monitor and investigate potential fraud cases
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function FraudDetectionScreen({ navigation }: any) {
  const [refreshing, setRefreshing] = useState(false);
  const [cases, setCases] = useState<any[]>([]);

  useEffect(() => {
    fetchFraudCases();
    const channel = supabase.channel('fraud_cases').on('postgres_changes', { event: '*', schema: 'public', table: 'fraud_cases' }, fetchFraudCases).subscribe();
    return () => { channel.unsubscribe(); };
  }, []);

  const fetchFraudCases = async () => {
    try {
      const { data } = await supabase.from('fraud_cases').select('*, lead:lead_id(lead_number, workshop:workshop_id(workshop_name))').eq('status', 'INVESTIGATING').order('created_at', { ascending: false });
      setCases(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Fraud Detection</Text>
        <Text style={styles.count}>{cases.length} Active Cases</Text>
      </View>
      <FlatList data={cases} keyExtractor={item => item.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchFraudCases(); }} />} renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => navigation?.navigate('FraudDetail', { id: item.id })}>
          <View style={styles.row}>
            <Ionicons name="shield-checkmark" size={24} color={COLORS.danger} />
            <View style={styles.info}>
              <Text style={styles.caseType}>{item.fraud_type}</Text>
              <Text style={styles.leadNo}>{item.lead?.lead_number}</Text>
              <Text style={styles.workshop}>{item.lead?.workshop?.workshop_name}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: COLORS.danger }]}>
              <Text style={styles.badgeText}>{item.severity}</Text>
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
  caseType: { fontSize: SIZES.md, fontWeight: 'bold' },
  leadNo: { fontSize: SIZES.sm, color: COLORS.primary, marginTop: 4 },
  workshop: { fontSize: SIZES.xs, color: COLORS.gray[500] },
  badge: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: SIZES.xs },
  badgeText: { color: COLORS.white, fontSize: SIZES.xs, fontWeight: '600' },
});

