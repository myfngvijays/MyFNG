import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function HSMLeadDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { leadId } = route.params as any;
  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState<any>(null);

  useEffect(() => {
    fetchLeadDetail();
  }, [leadId]);

  const fetchLeadDetail = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_leads')
        .select('*, technician:users_login(full_name, phone), van:service_vans(van_number, driver_name)')
        .eq('id', leadId)
        .single();

      if (error) throw error;
      setLead(data);
    } catch (error) {
      console.error('Error fetching lead:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading lead details...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Lead Details" onBack={() => navigation.goBack()} />
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.leadNumber}>{lead?.lead_number}</Text>
          <Text style={styles.status}>{lead?.status}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <Text style={styles.infoText}>Name: {lead?.customer_name}</Text>
          <Text style={styles.infoText}>Phone: {lead?.customer_phone}</Text>
          <Text style={styles.infoText}>Email: {lead?.customer_email || 'N/A'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Address</Text>
          <Text style={styles.infoText}>{lead?.service_address || 'N/A'}</Text>
        </View>

        {lead?.technician && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assigned Technician</Text>
            <Text style={styles.infoText}>Name: {lead.technician.full_name}</Text>
            <Text style={styles.infoText}>Phone: {lead.technician.phone}</Text>
          </View>
        )}

        {lead?.van && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assigned Van</Text>
            <Text style={styles.infoText}>Van Number: {lead.van.van_number}</Text>
            <Text style={styles.infoText}>Driver: {lead.van.driver_name}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    margin: SPACING.md,
    marginTop: 0,
    borderRadius: 8,
  },
  leadNumber: {
    fontSize: SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    marginBottom: SPACING.xs,
  },
  status: {
    fontSize: SIZES.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    marginBottom: SPACING.sm,
  },
  infoText: {
    fontSize: SIZES.sm,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
});
