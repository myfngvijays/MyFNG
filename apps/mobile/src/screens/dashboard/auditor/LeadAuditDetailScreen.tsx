/**
 * Lead Audit Detail Screen - Auditor
 * Detailed audit interface with scoring and fraud detection
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function LeadAuditDetailScreen({ route, navigation }: any) {
  const leadId = route?.params?.leadId;
  const { userProfile } = useAuth();
  const [lead, setLead] = useState<any>(null);
  const [auditData, setAuditData] = useState({
    documentation_score: 0, quality_score: 0, process_compliance_score: 0, customer_satisfaction_score: 0,
    notes: '', fraud_indicators: [], audit_result: 'PASS'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLead();
  }, [leadId]);

  const fetchLead = async () => {
    try {
      const { data } = await supabase.from('leads').select('*, workshop:workshop_id(workshop_name), mechanic_jobs(*)').eq('id', leadId).single();
      setLead(data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const calculateOverallScore = () => {
    return Math.round((auditData.documentation_score + auditData.quality_score + auditData.process_compliance_score + auditData.customer_satisfaction_score) / 4);
  };

  const handleSubmitAudit = async () => {
    try {
      setLoading(true);
      const overallScore = calculateOverallScore();

      const { error } = await supabase.from('audit_logs').insert({
        lead_id: leadId,
        auditor_id: userProfile?.id,
        audit_type: 'LEAD_AUDIT',
        documentation_score: auditData.documentation_score,
        quality_score: auditData.quality_score,
        process_compliance_score: auditData.process_compliance_score,
        customer_satisfaction_score: auditData.customer_satisfaction_score,
        overall_score: overallScore,
        audit_result: overallScore >= 70 ? 'PASS' : 'FAIL',
        notes: auditData.notes,
        fraud_indicators: auditData.fraud_indicators,
      });

      if (error) throw error;

      // Update lead audit status
      await supabase.from('leads').update({ audit_status: overallScore >= 70 ? 'PASSED' : 'FAILED', audited_at: new Date().toISOString() }).eq('id', leadId);

      Alert.alert('Success', 'Audit submitted successfully');
      navigation?.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderScoreSlider = (label: string, value: number, onValueChange: (v: number) => void) => (
    <View style={styles.scoreSection}>
      <View style={styles.scoreHeader}>
        <Text style={styles.scoreLabel}>{label}</Text>
        <Text style={styles.scoreValue}>{value}/100</Text>
      </View>
      <View style={styles.scoreButtons}>
        {[0, 25, 50, 75, 100].map(score => (
          <TouchableOpacity key={score} style={[styles.scoreBtn, value === score && styles.scoreBtnActive]} onPress={() => onValueChange(score)}>
            <Text style={[styles.scoreBtnText, value === score && styles.scoreBtnTextActive]}>{score}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()}><Ionicons name="arrow-back" size={24} /></TouchableOpacity>
        <Text style={styles.title}>Lead Audit</Text>
      </View>

      <View style={styles.leadInfo}>
        <Text style={styles.leadNo}>{lead?.lead_number}</Text>
        <Text style={styles.customer}>{lead?.customer_name} • {lead?.vehicle_number}</Text>
        <Text style={styles.workshop}>{lead?.workshop?.workshop_name}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Audit Scores</Text>
        {renderScoreSlider('Documentation', auditData.documentation_score, (v) => setAuditData({ ...auditData, documentation_score: v }))}
        {renderScoreSlider('Quality of Work', auditData.quality_score, (v) => setAuditData({ ...auditData, quality_score: v }))}
        {renderScoreSlider('Process Compliance', auditData.process_compliance_score, (v) => setAuditData({ ...auditData, process_compliance_score: v }))}
        {renderScoreSlider('Customer Satisfaction', auditData.customer_satisfaction_score, (v) => setAuditData({ ...auditData, customer_satisfaction_score: v }))}
      </View>

      <View style={styles.overallCard}>
        <Text style={styles.overallLabel}>Overall Score</Text>
        <Text style={[styles.overallScore, { color: calculateOverallScore() >= 70 ? COLORS.success : COLORS.danger }]}>
          {calculateOverallScore()}/100
        </Text>
        <Text style={[styles.resultBadge, { backgroundColor: calculateOverallScore() >= 70 ? COLORS.success : COLORS.danger }]}>
          {calculateOverallScore() >= 70 ? 'PASS' : 'FAIL'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Audit Notes</Text>
        <TextInput style={styles.textArea} placeholder="Enter detailed audit notes..." value={auditData.notes} onChangeText={text => setAuditData({ ...auditData, notes: text })} multiline numberOfLines={6} />
      </View>

      <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitAudit} disabled={loading}>
        <Ionicons name="checkmark-done" size={24} color={COLORS.white} />
        <Text style={styles.submitText}>{loading ? 'Submitting...' : 'Submit Audit'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray[50] },
  header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, backgroundColor: COLORS.white, gap: SPACING.md },
  title: { fontSize: SIZES.xl, fontWeight: 'bold' },
  leadInfo: { backgroundColor: COLORS.white, padding: SPACING.lg, marginTop: SPACING.sm },
  leadNo: { fontSize: SIZES.lg, fontWeight: 'bold', color: COLORS.primary },
  customer: { fontSize: SIZES.sm, color: COLORS.gray[700], marginTop: 4 },
  workshop: { fontSize: SIZES.xs, color: COLORS.gray[500], marginTop: 4 },
  section: { backgroundColor: COLORS.white, margin: SPACING.md, padding: SPACING.lg, borderRadius: SIZES.sm },
  sectionTitle: { fontSize: SIZES.lg, fontWeight: 'bold', marginBottom: SPACING.md },
  scoreSection: { marginBottom: SPACING.lg },
  scoreHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  scoreLabel: { fontSize: SIZES.sm, color: COLORS.gray[700], fontWeight: '600' },
  scoreValue: { fontSize: SIZES.sm, color: COLORS.primary, fontWeight: 'bold' },
  scoreButtons: { flexDirection: 'row', gap: SPACING.xs },
  scoreBtn: { flex: 1, padding: SPACING.sm, borderRadius: SIZES.xs, backgroundColor: COLORS.gray[100], alignItems: 'center', borderWidth: 1, borderColor: COLORS.gray[300] },
  scoreBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  scoreBtnText: { fontSize: SIZES.sm, color: COLORS.gray[700] },
  scoreBtnTextActive: { color: COLORS.white, fontWeight: '600' },
  overallCard: { backgroundColor: COLORS.white, margin: SPACING.md, padding: SPACING.xl, borderRadius: SIZES.sm, alignItems: 'center', borderWidth: 2, borderColor: COLORS.primary },
  overallLabel: { fontSize: SIZES.md, color: COLORS.gray[600], marginBottom: SPACING.xs },
  overallScore: { fontSize: 48, fontWeight: 'bold', marginVertical: SPACING.sm },
  resultBadge: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: SIZES.sm, color: COLORS.white, fontSize: SIZES.md, fontWeight: 'bold' },
  textArea: { backgroundColor: COLORS.gray[50], borderWidth: 1, borderColor: COLORS.gray[300], borderRadius: SIZES.sm, padding: SPACING.md, fontSize: SIZES.sm, minHeight: 120, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: COLORS.success, margin: SPACING.md, padding: SPACING.lg, borderRadius: SIZES.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  submitText: { color: COLORS.white, fontSize: SIZES.md, fontWeight: 'bold' },
});

