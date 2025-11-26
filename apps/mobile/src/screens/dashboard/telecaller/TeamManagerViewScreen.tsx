/**
 * Team Manager View Screen - Telecaller
 * Manage team and assign leads
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function TeamManagerViewScreen({ navigation }: any) {
  const { userProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [unassignedLeads, setUnassignedLeads] = useState<any[]>([]);

  useEffect(() => {
    fetchTeamData();
    const channel = supabase.channel('team_manager').on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchTeamData).subscribe();
    return () => { channel.unsubscribe(); };
  }, []);

  const fetchTeamData = async () => {
    try {
      const { data: team } = await supabase.from('users_login').select('*, role:role_id(*)').eq('assigned_manager_id', userProfile?.id).eq('role.role_code', 'TELECALLER');
      const { data: leads } = await supabase.from('leads').select('*').eq('status', 'NEW').is('assigned_telecaller_id', null);
      setTeamMembers(team || []);
      setUnassignedLeads(leads || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Team Management</Text>
        <Text style={styles.subtitle}>{teamMembers.length} Team Members • {unassignedLeads.length} Unassigned</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Team Members</Text>
        <FlatList data={teamMembers} horizontal showsHorizontalScrollIndicator={false} keyExtractor={item => item.id} renderItem={({ item }) => (
          <View style={styles.memberCard}>
            <Ionicons name="person-circle" size={48} color={COLORS.primary} />
            <Text style={styles.memberName}>{item.full_name}</Text>
            <Text style={styles.memberPhone}>{item.phone}</Text>
          </View>
        )} />
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Unassigned Leads</Text>
        <FlatList data={unassignedLeads} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTeamData(); }} />} keyExtractor={item => item.id} renderItem={({ item }) => (
          <TouchableOpacity style={styles.leadCard}>
            <Text style={styles.leadNo}>{item.lead_number}</Text>
            <Text style={styles.leadInfo}>{item.customer_name} • {item.customer_phone}</Text>
          </TouchableOpacity>
        )} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray[50] },
  header: { padding: SPACING.lg, backgroundColor: COLORS.white },
  title: { fontSize: SIZES.xxl, fontWeight: 'bold' },
  subtitle: { fontSize: SIZES.sm, color: COLORS.gray[600], marginTop: SPACING.xs },
  section: { padding: SPACING.md },
  sectionTitle: { fontSize: SIZES.lg, fontWeight: 'bold', marginBottom: SPACING.md },
  memberCard: { backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: SIZES.sm, marginRight: SPACING.sm, alignItems: 'center', width: 120 },
  memberName: { fontSize: SIZES.sm, fontWeight: 'bold', marginTop: SPACING.xs, textAlign: 'center' },
  memberPhone: { fontSize: SIZES.xs, color: COLORS.gray[500] },
  leadCard: { backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: SIZES.sm, marginBottom: SPACING.sm },
  leadNo: { fontSize: SIZES.md, fontWeight: 'bold', color: COLORS.primary },
  leadInfo: { fontSize: SIZES.sm, color: COLORS.gray[600], marginTop: 4 },
});

