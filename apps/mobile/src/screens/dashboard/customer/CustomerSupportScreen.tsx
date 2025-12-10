import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function CustomerSupportScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    category: 'GENERAL',
    priority: 'MEDIUM',
  });

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('email, phone')
        .eq('id', user.id)
        .single();

      if (!userProfile) return;

      // Fetch support tickets - adjust table name as needed
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .or(`customer_email.eq.${userProfile.email},customer_phone.eq.${userProfile.phone}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = table doesn't exist, use service_leads as fallback
        const { data: leadsData } = await supabase
          .from('service_leads')
          .select('id, lead_number, customer_name, status, created_at, complaint_details')
          .or(`customer_email.eq.${userProfile.email},customer_phone.eq.${userProfile.phone}`)
          .eq('status', 'COMPLAINT')
          .order('created_at', { ascending: false });

        setTickets((leadsData || []).map((lead: any) => ({
          id: lead.id,
          ticket_number: lead.lead_number,
          subject: lead.complaint_details || 'Service Complaint',
          description: lead.complaint_details || '',
          status: lead.status,
          created_at: lead.created_at,
          category: 'SERVICE',
          priority: 'MEDIUM',
        })));
      } else {
        setTickets(data || []);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTickets();
  };

  const handleCreateTicket = async () => {
    if (!newTicket.subject || !newTicket.description) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('email, phone, full_name')
        .eq('id', user.id)
        .single();

      if (!userProfile) return;

      // Create ticket - adjust table name as needed
      const { error } = await supabase
        .from('support_tickets')
        .insert([{
          customer_email: userProfile.email,
          customer_phone: userProfile.phone,
          customer_name: userProfile.full_name,
          subject: newTicket.subject,
          description: newTicket.description,
          category: newTicket.category,
          priority: newTicket.priority,
          status: 'OPEN',
        }]);

      if (error) throw error;

      Alert.alert('Success', 'Support ticket created successfully');
      setShowCreateForm(false);
      setNewTicket({ subject: '', description: '', category: 'GENERAL', priority: 'MEDIUM' });
      fetchTickets();
    } catch (error: any) {
      console.error('Error creating ticket:', error);
      Alert.alert('Error', error.message || 'Failed to create ticket');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'OPEN':
        return COLORS.warning;
      case 'IN_PROGRESS':
        return COLORS.info;
      case 'RESOLVED':
        return COLORS.success;
      case 'CLOSED':
        return COLORS.textSecondary;
      default:
        return COLORS.primary;
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading support tickets...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Support" onBack={() => navigation.goBack()} />
      
      {/* Create Ticket Button */}
      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateForm(!showCreateForm)}
        >
          <Text style={styles.createButtonText}>
            {showCreateForm ? 'Cancel' : '+ Create Ticket'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Create Ticket Form */}
      {showCreateForm && (
        <View style={styles.createForm}>
          <TextInput
            style={styles.formInput}
            placeholder="Subject"
            value={newTicket.subject}
            onChangeText={(text) => setNewTicket({ ...newTicket, subject: text })}
            placeholderTextColor={COLORS.textSecondary}
          />
          <TextInput
            style={[styles.formInput, styles.textArea]}
            placeholder="Describe your issue..."
            value={newTicket.description}
            onChangeText={(text) => setNewTicket({ ...newTicket, description: text })}
            multiline
            numberOfLines={4}
            placeholderTextColor={COLORS.textSecondary}
          />
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleCreateTicket}
          >
            <Text style={styles.submitButtonText}>Submit Ticket</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {tickets.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No support tickets found</Text>
            <Text style={styles.emptySubtext}>Create a ticket to get help</Text>
          </View>
        ) : (
          tickets.map((ticket, index) => (
            <View key={ticket.id || index} style={styles.ticketCard}>
              <View style={styles.ticketHeader}>
                <View style={styles.ticketLeft}>
                  <Text style={styles.ticketNumber}>
                    {ticket.ticket_number || `#${ticket.id}`}
                  </Text>
                  <Text style={styles.ticketSubject}>{ticket.subject}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(ticket.status) }
                  ]}
                >
                  <Text style={styles.statusText}>{ticket.status || 'OPEN'}</Text>
                </View>
              </View>
              
              <Text style={styles.ticketDescription} numberOfLines={2}>
                {ticket.description}
              </Text>
              
              <View style={styles.ticketFooter}>
                <Text style={styles.ticketDate}>
                  {new Date(ticket.created_at).toLocaleDateString()}
                </Text>
                <Text style={styles.ticketCategory}>{ticket.category}</Text>
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
  headerActions: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  createButton: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonText: {
    color: COLORS.white,
    fontSize: SIZES.md,
    fontWeight: '600',
  },
  createForm: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  formInput: {
    height: 40,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    fontSize: SIZES.sm,
    color: COLORS.text,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: SPACING.sm,
  },
  submitButton: {
    backgroundColor: COLORS.success,
    padding: SPACING.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: SIZES.md,
    fontWeight: '600',
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
    marginBottom: SPACING.xs,
  },
  emptySubtext: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
  },
  ticketCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  ticketLeft: {
    flex: 1,
  },
  ticketNumber: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  ticketSubject: {
    fontSize: SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textHeading,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: SIZES.xs,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  ticketDescription: {
    fontSize: SIZES.sm,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  ticketDate: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
  },
  ticketCategory: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
});
