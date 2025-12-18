import { formatDateTime } from "@/lib/dateFormat";
/**
 * CSE Lead Detail Screen
 * Detailed view of lead with complaint handling
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function CSELeadDetailScreen({ route }: any) {
  const leadId = route?.params?.leadId;
  const [refreshing, setRefreshing] = useState(false);
  const [lead, setLead] = useState<any>(null);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [complaintData, setComplaintData] = useState({ subject: '', description: '', priority: 'MEDIUM' });

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('cse_lead').on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `id=eq.${leadId}` }, fetchData).subscribe();
    return () => { channel.unsubscribe(); };
  }, [leadId]);

  const fetchData = async () => {
    try {
      const { data: leadData } = await supabase.from('leads').select('*, workshop:workshop_id(workshop_name)').eq('id', leadId).single();
      const { data: complaintsData } = await supabase.from('complaints').select('*').eq('lead_id', leadId).order('created_at', { ascending: false });
      setLead(leadData);
      setComplaints(complaintsData || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateComplaint = async () => {
    try {
      const { error } = await supabase.from('complaints').insert({
        lead_id: leadId,
        subject: complaintData.subject,
        description: complaintData.description,
        priority: complaintData.priority,
        status: 'OPEN',
      });
      if (error) throw error;
      Alert.alert('Success', 'Complaint created');
      setShowComplaintForm(false);
      setComplaintData({ subject: '', description: '', priority: 'MEDIUM' });
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}>
      <View style={styles.header}>
        <Text style={styles.title}>Lead Details</Text>
        <Text style={styles.leadNo}>{lead?.lead_number}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Customer Information</Text>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Name:</Text><Text style={styles.infoValue}>{lead?.customer_name}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Phone:</Text><Text style={styles.infoValue}>{lead?.customer_phone}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Vehicle:</Text><Text style={styles.infoValue}>{lead?.vehicle_number}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Status:</Text><Text style={[styles.badge, { color: COLORS.primary }]}>{lead?.status}</Text></View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Complaints ({complaints.length})</Text>
          <TouchableOpacity onPress={() => setShowComplaintForm(!showComplaintForm)}><Ionicons name="add-circle" size={24} color={COLORS.primary} /></TouchableOpacity>
        </View>

        {showComplaintForm && (
          <View style={styles.form}>
            <TextInput style={styles.input} placeholder="Subject" value={complaintData.subject} onChangeText={text => setComplaintData({ ...complaintData, subject: text })} />
            <TextInput style={styles.input} placeholder="Description" value={complaintData.description} onChangeText={text => setComplaintData({ ...complaintData, description: text })} multiline />
            <View style={styles.priorityRow}>
              {['LOW', 'MEDIUM', 'HIGH'].map(p => (
                <TouchableOpacity key={p} style={[styles.priorityBtn, complaintData.priority === p && styles.priorityBtnActive]} onPress={() => setComplaintData({ ...complaintData, priority: p })}>
                  <Text style={[styles.priorityText, complaintData.priority === p && styles.priorityTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.submitBtn} onPress={handleCreateComplaint}><Text style={styles.submitText}>Create Complaint</Text></TouchableOpacity>
          </View>
        )}

        {complaints.map(complaint => (
          <View key={complaint.id} style={styles.complaintCard}>
            <View style={styles.complaintHeader}>
              <Text style={styles.complaintSubject}>{complaint.subject}</Text>
              <View style={[styles.badge, { backgroundColor: complaint.status === 'OPEN' ? COLORS.danger : COLORS.success }]}>
                <Text style={styles.badgeText}>{complaint.status}</Text>
              </View>
            </View>
            <Text style={styles.complaintDesc}>{complaint.description}</Text>
            <Text style={styles.complaintDate}>{formatDateTime(complaint.created_at)}</Text>
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
  section: { backgroundColor: COLORS.white, margin: SPACING.md, padding: SPACING.lg, borderRadius: SIZES.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  sectionTitle: { fontSize: SIZES.lg, fontWeight: 'bold' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  infoLabel: { fontSize: SIZES.sm, color: COLORS.gray[600] },
  infoValue: { fontSize: SIZES.sm, color: COLORS.gray[900], fontWeight: '600' },
  badge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: SIZES.xs },
  badgeText: { color: COLORS.white, fontSize: SIZES.xs, fontWeight: '600' },
  form: { backgroundColor: COLORS.gray[50], padding: SPACING.md, borderRadius: SIZES.sm, marginBottom: SPACING.md },
  input: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.gray[300], borderRadius: SIZES.sm, padding: SPACING.sm, marginBottom: SPACING.sm },
  priorityRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  priorityBtn: { flex: 1, padding: SPACING.sm, borderRadius: SIZES.xs, backgroundColor: COLORS.white, alignItems: 'center', borderWidth: 1, borderColor: COLORS.gray[300] },
  priorityBtnActive: { backgroundColor: COLORS.warning, borderColor: COLORS.warning },
  priorityText: { fontSize: SIZES.sm, color: COLORS.gray[700] },
  priorityTextActive: { color: COLORS.white, fontWeight: '600' },
  submitBtn: { backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: SIZES.sm, alignItems: 'center' },
  submitText: { color: COLORS.white, fontSize: SIZES.md, fontWeight: '600' },
  complaintCard: { backgroundColor: COLORS.gray[50], padding: SPACING.md, borderRadius: SIZES.sm, marginBottom: SPACING.sm },
  complaintHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  complaintSubject: { fontSize: SIZES.md, fontWeight: 'bold', flex: 1 },
  complaintDesc: { fontSize: SIZES.sm, color: COLORS.gray[600], marginBottom: SPACING.xs },
  complaintDate: { fontSize: SIZES.xs, color: COLORS.gray[500] },
});

