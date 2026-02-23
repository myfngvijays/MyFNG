import React, { useState, useEffect } from 'react';
import { formatDateDMY } from "@/lib/dateFormat";
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
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { apiFetch } from '../../../lib/api';
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
      const data = await apiFetch<{ tickets: any[] }>('/api/customer/support/tickets');
      setTickets(data.tickets || []);
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
      await apiFetch('/api/customer/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: newTicket.subject,
          description: newTicket.description,
          category: newTicket.category,
          severity: newTicket.priority,
        }),
      });

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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>Total Tickets</Text>
            <Text style={styles.summaryValue}>{tickets.length}</Text>
          </View>
          <View style={styles.summaryIconWrap}>
            <Ionicons name="chatbubbles-outline" size={20} color={COLORS.primary} />
          </View>
        </View>

        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateForm(!showCreateForm)}
        >
          <Ionicons name={showCreateForm ? 'close-outline' : 'add-outline'} size={18} color={COLORS.white} />
          <Text style={styles.createButtonText}>
            {showCreateForm ? 'Cancel' : 'Create Ticket'}
          </Text>
        </TouchableOpacity>

      {/* Create Ticket Form */}
      {showCreateForm && (
        <View style={styles.createForm}>
          <Text style={styles.formTitle}>Raise a new ticket</Text>
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
            <Ionicons name="send-outline" size={16} color={COLORS.white} />
            <Text style={styles.submitButtonText}>Submit Ticket</Text>
          </TouchableOpacity>
        </View>
      )}
      
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
                  {formatDateDMY(ticket.created_at)}
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
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  summaryCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 10,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: { color: COLORS.textSecondary, fontSize: SIZES.sm, fontWeight: '700' },
  summaryValue: { color: COLORS.textHeading, fontWeight: '800', fontSize: 26, marginTop: 4 },
  summaryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButton: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  createButtonText: {
    color: COLORS.white,
    fontSize: SIZES.md,
    fontWeight: '600',
  },
  createForm: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 10,
    marginBottom: SPACING.sm,
  },
  formTitle: { color: COLORS.textHeading, fontSize: SIZES.md, fontWeight: '700', marginBottom: SPACING.sm },
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
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
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
    borderRadius: 8,
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
