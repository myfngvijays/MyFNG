import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function PendingLeadsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);

  useEffect(() => {
    fetchPendingLeads();
  }, []);

  const fetchPendingLeads = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's workshop
      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('id', user.id)
        .single();

      if (!userProfile?.workshop_id) return;

      const { data, error } = await supabase
        .from('service_leads')
        .select('*')
        .eq('workshop_id', userProfile.workshop_id)
        .eq('status', 'ASSIGNED')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching pending leads:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPendingLeads();
  };

  const handleAcceptLead = async (leadId: string) => {
    Alert.alert(
      'Accept Lead',
      'Are you sure you want to accept this lead?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('service_leads')
                .update({
                  status: 'ACCEPTED',
                  accepted_at: new Date().toISOString(),
                })
                .eq('id', leadId);

              if (error) throw error;
              Alert.alert('Success', 'Lead accepted');
              fetchPendingLeads();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to accept lead');
            }
          },
        },
      ]
    );
  };

  const handleRejectLead = async (leadId: string) => {
    Alert.alert(
      'Reject Lead',
      'Are you sure you want to reject this lead?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('service_leads')
                .update({
                  status: 'REJECTED',
                  rejected_at: new Date().toISOString(),
                })
                .eq('id', leadId);

              if (error) throw error;
              Alert.alert('Success', 'Lead rejected');
              fetchPendingLeads();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to reject lead');
            }
          },
        },
      ]
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading pending leads...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Pending Leads" onBack={() => navigation.goBack()} />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {leads.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No pending leads</Text>
          </View>
        ) : (
          leads.map((lead, index) => (
            <View key={lead.id || index} style={styles.leadCard}>
              <View style={styles.leadHeader}>
                <Text style={styles.leadNumber}>{lead.lead_number}</Text>
                <Text style={styles.leadDate}>
                  {new Date(lead.created_at).toLocaleDateString()}
                </Text>
              </View>
              
              <Text style={styles.customerName}>{lead.customer_name}</Text>
              <Text style={styles.customerPhone}>{lead.customer_phone}</Text>
              {lead.vehicle_number && (
                <Text style={styles.vehicleNumber}>Vehicle: {lead.vehicle_number}</Text>
              )}
              
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => handleRejectLead(lead.id)}
                >
                  <Text style={styles.rejectButtonText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.acceptButton]}
                  onPress={() => handleAcceptLead(lead.id)}
                >
                  <Text style={styles.acceptButtonText}>Accept</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
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
  emptyContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
  },
  leadCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  leadNumber: {
    fontSize: SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    flex: 1,
  },
  leadDate: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
  },
  customerName: {
    fontSize: SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  customerPhone: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  vehicleNumber: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  actionButton: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: COLORS.danger,
  },
  acceptButton: {
    backgroundColor: COLORS.success,
  },
  rejectButtonText: {
    color: COLORS.white,
    fontSize: SIZES.sm,
    fontWeight: '600',
  },
  acceptButtonText: {
    color: COLORS.white,
    fontSize: SIZES.sm,
    fontWeight: '600',
  },
});
