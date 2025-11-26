/**
 * Close Complaint Screen - CSE
 * Resolution workflow for closing complaints
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function CloseComplaintScreen({ route, navigation }: any) {
  const complaintId = route?.params?.complaintId;
  const { userProfile } = useAuth();
  const [complaint, setComplaint] = useState<any>(null);
  const [resolution, setResolution] = useState('');
  const [satisfactionRating, setSatisfactionRating] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchComplaint();
  }, [complaintId]);

  const fetchComplaint = async () => {
    try {
      const { data } = await supabase.from('complaints').select('*, lead:lead_id(lead_number, customer_name)').eq('id', complaintId).single();
      setComplaint(data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleClose = async () => {
    try {
      if (!resolution.trim()) {
        Alert.alert('Error', 'Please enter resolution details');
        return;
      }

      setLoading(true);

      const { error } = await supabase.from('complaints').update({
        status: 'CLOSED',
        resolution: resolution,
        resolved_by: userProfile?.id,
        resolved_at: new Date().toISOString(),
        satisfaction_rating: satisfactionRating,
      }).eq('id', complaintId);

      if (error) throw error;

      Alert.alert('Success', 'Complaint closed successfully');
      navigation?.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()}><Ionicons name="arrow-back" size={24} /></TouchableOpacity>
        <Text style={styles.title}>Close Complaint</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Complaint Details</Text>
        <View style={styles.infoRow}><Text style={styles.label}>Lead:</Text><Text style={styles.value}>{complaint?.lead?.lead_number}</Text></View>
        <View style={styles.infoRow}><Text style={styles.label}>Customer:</Text><Text style={styles.value}>{complaint?.lead?.customer_name}</Text></View>
        <View style={styles.infoRow}><Text style={styles.label}>Subject:</Text><Text style={styles.value}>{complaint?.subject}</Text></View>
        <View style={styles.descBox}>
          <Text style={styles.label}>Description:</Text>
          <Text style={styles.description}>{complaint?.description}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resolution</Text>
        <TextInput style={styles.textArea} placeholder="Enter resolution details..." value={resolution} onChangeText={setResolution} multiline numberOfLines={6} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Customer Satisfaction</Text>
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map(rating => (
            <TouchableOpacity key={rating} onPress={() => setSatisfactionRating(rating)} style={styles.starBtn}>
              <Ionicons name={satisfactionRating >= rating ? 'star' : 'star-outline'} size={40} color={COLORS.warning} />
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.ratingText}>
          {satisfactionRating === 0 ? 'Rate customer satisfaction' :
           satisfactionRating === 1 ? 'Very Unsatisfied' :
           satisfactionRating === 2 ? 'Unsatisfied' :
           satisfactionRating === 3 ? 'Neutral' :
           satisfactionRating === 4 ? 'Satisfied' :
           'Very Satisfied'}
        </Text>
      </View>

      <TouchableOpacity style={styles.closeBtn} onPress={handleClose} disabled={loading}>
        <Ionicons name="checkmark-circle" size={24} color={COLORS.white} />
        <Text style={styles.closeBtnText}>{loading ? 'Closing...' : 'Close Complaint'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray[50] },
  header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, backgroundColor: COLORS.white, gap: SPACING.md },
  title: { fontSize: SIZES.xl, fontWeight: 'bold' },
  section: { backgroundColor: COLORS.white, margin: SPACING.md, padding: SPACING.lg, borderRadius: SIZES.sm },
  sectionTitle: { fontSize: SIZES.lg, fontWeight: 'bold', marginBottom: SPACING.md },
  infoRow: { flexDirection: 'row', marginBottom: SPACING.sm },
  label: { fontSize: SIZES.sm, color: COLORS.gray[600], width: 100 },
  value: { fontSize: SIZES.sm, color: COLORS.gray[900], fontWeight: '600', flex: 1 },
  descBox: { marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.gray[200] },
  description: { fontSize: SIZES.sm, color: COLORS.gray[700], marginTop: SPACING.xs, lineHeight: 20 },
  textArea: { backgroundColor: COLORS.gray[50], borderWidth: 1, borderColor: COLORS.gray[300], borderRadius: SIZES.sm, padding: SPACING.md, fontSize: SIZES.sm, minHeight: 120, textAlignVertical: 'top' },
  ratingRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: SPACING.md },
  starBtn: { padding: SPACING.xs },
  ratingText: { fontSize: SIZES.sm, color: COLORS.gray[600], textAlign: 'center', fontWeight: '600' },
  closeBtn: { backgroundColor: COLORS.success, margin: SPACING.md, padding: SPACING.lg, borderRadius: SIZES.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  closeBtnText: { color: COLORS.white, fontSize: SIZES.md, fontWeight: 'bold' },
});

