/**
 * CSE Dashboard Screen - React Native
 * Customer Service Executive Mobile App
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  RefreshControl,
  Alert,
  BackHandler,
} from 'react-native';
import { supabase } from '../../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';

export default function CSEDashboardScreen({ navigation }: any) {
  const { logout } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('follow_up');
  const [searchText, setSearchText] = useState('');
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // On dashboard, back button can exit app or do nothing
      return false; // Allow default behavior (exit app)
    });
    return () => backHandler.remove();
  }, []);

  const [stats, setStats] = useState({
    total: 0,
    pendingFollowUps: 0,
    readyToClose: 0,
    closedToday: 0,
  });

  // Call data
  const [satisfactionScore, setSatisfactionScore] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [callNotes, setCallNotes] = useState('');

  // Close data
  const [finalScore, setFinalScore] = useState(5);
  const [closureNotes, setClosureNotes] = useState('');

  useEffect(() => {
    fetchData();
  }, [filter]);

  async function fetchData() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_leads')
        .select(`
          *,
          workshop:workshops!workshop_id(name)
        `)
        .in('status', ['INVOICE_GENERATED', 'AWAITING_PAYMENT', 'PAYMENT_COMPLETED', 'DELIVERED', 'COMPLETED', 'CLOSED'])
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      let filtered = data || [];
      if (filter === 'follow_up') {
        filtered = filtered.filter(l => l.follow_up_required && l.status !== 'CLOSED');
      } else if (filter === 'completed') {
        filtered = filtered.filter(l => ['COMPLETED', 'DELIVERED'].includes(l.status) && !l.closed_at);
      } else if (filter === 'closed') {
        filtered = filtered.filter(l => l.status === 'CLOSED');
      }

      setLeads(filtered);

      // Calculate stats
      setStats({
        total: filtered.length,
        pendingFollowUps: data?.filter(l => l.follow_up_required && l.status !== 'CLOSED').length || 0,
        readyToClose: data?.filter(l => ['COMPLETED', 'DELIVERED'].includes(l.status) && !l.closed_at).length || 0,
        closedToday: data?.filter(l => {
          if (!l.closed_at) return false;
          const closedDate = new Date(l.closed_at);
          const today = new Date();
          return closedDate.toDateString() === today.toDateString();
        }).length || 0,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleFinalCall() {
    if (!selectedLead) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      const { error } = await supabase
        .from('service_leads')
        .update({
          cse_assigned_id: userProfile?.id,
          cse_followup_completed: true,
          customer_satisfaction_score: satisfactionScore,
          customer_feedback: feedback,
          cse_followup_notes: callNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedLead.id);

      if (error) throw error;

      Alert.alert('Success', 'Final call logged successfully!');
      setShowCallModal(false);
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  }

  async function handleCloseLead() {
    if (!selectedLead || !closureNotes) {
      Alert.alert('Error', 'Closure notes are required');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      const { error } = await supabase
        .from('service_leads')
        .update({
          status: 'CLOSED',
          closed_by_id: userProfile?.id,
          closed_at: new Date().toISOString(),
          closure_notes: closureNotes,
          customer_rating: finalScore,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedLead.id);

      if (error) throw error;

      Alert.alert('Success', '🎉 Lead closed successfully!');
      setShowCloseModal(false);
      setSelectedLead(null);
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  }

  const renderStatCard = (title: string, value: number, icon: string, color: string) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Ionicons name={icon as any} size={32} color={color} />
    </View>
  );

  const renderLeadItem = ({ item }: any) => (
    <View style={styles.leadCard}>
      <View style={styles.leadHeader}>
        <Text style={styles.leadNumber}>{item.lead_number}</Text>
        <View style={[styles.statusBadge, getStatusColor(item.status)]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.leadInfo}>
        <Text style={styles.customerName}>{item.customer_name}</Text>
        <Text style={styles.phone}>{item.customer_phone}</Text>
        {item.workshop && (
          <Text style={styles.workshop}>🏢 {item.workshop.name}</Text>
        )}
      </View>

      {item.customer_satisfaction_score && (
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={16} color="#FCD34D" />
          <Text style={styles.ratingText}>{item.customer_satisfaction_score}/5</Text>
        </View>
      )}

      <View style={styles.actionButtons}>
        {!item.cse_followup_completed && (
          <TouchableOpacity
            style={[styles.button, styles.callButton]}
            onPress={() => {
              setSelectedLead(item);
              setSatisfactionScore(5);
              setFeedback('');
              setCallNotes('');
              setShowCallModal(true);
            }}
          >
            <Ionicons name="call" size={16} color="#FFF" />
            <Text style={styles.buttonText}>Final Call</Text>
          </TouchableOpacity>
        )}
        
        {item.status !== 'CLOSED' && item.cse_followup_completed && (
          <TouchableOpacity
            style={[styles.button, styles.closeButton]}
            onPress={() => {
              setSelectedLead(item);
              setFinalScore(5);
              setClosureNotes('');
              setShowCloseModal(true);
            }}
          >
            <Ionicons name="checkmark-circle" size={16} color="#FFF" />
            <Text style={styles.buttonText}>Close Lead</Text>
          </TouchableOpacity>
        )}

        {item.customer_feedback && (
          <TouchableOpacity
            style={[styles.button, styles.feedbackButton]}
            onPress={() => Alert.alert('Customer Feedback', item.customer_feedback)}
          >
            <Ionicons name="chatbubble" size={16} color="#FFF" />
            <Text style={styles.buttonText}>Feedback</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  function getStatusColor(status: string) {
    switch (status) {
      case 'CLOSED': return { backgroundColor: '#6B7280' };
      case 'COMPLETED':
      case 'DELIVERED': return { backgroundColor: '#10B981' };
      case 'PAYMENT_COMPLETED': return { backgroundColor: '#3B82F6' };
      default: return { backgroundColor: '#F59E0B' };
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>CSE Dashboard</Text>
          <Text style={styles.headerSubtitle}>Customer Service Executive</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <Ionicons name="person-circle" size={32} color="#3B82F6" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => {
              Alert.alert(
                'Logout',
                'Are you sure you want to logout?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                      await supabase.auth.signOut();
                      logout();
                    },
                  },
                ]
              );
            }}
          >
            <Ionicons name="log-out-outline" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActionsContainer}>
        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => navigation.navigate('CSECallPanel')}
        >
          <Ionicons name="call" size={24} color="#10B981" />
          <Text style={styles.quickActionText}>Call Panel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => navigation.navigate('CSETickets')}
        >
          <Ionicons name="document-text" size={24} color="#3B82F6" />
          <Text style={styles.quickActionText}>Tickets</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => navigation.navigate('CSEFollowUps')}
        >
          <Ionicons name="time" size={24} color="#F59E0B" />
          <Text style={styles.quickActionText}>Follow-ups</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => navigation.navigate('ComplaintsManagement')}
        >
          <Ionicons name="alert-circle" size={24} color="#EF4444" />
          <Text style={styles.quickActionText}>Complaints</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsContainer}>
        {renderStatCard('Total', stats.total, 'list', '#8B5CF6')}
        {renderStatCard('Follow-ups', stats.pendingFollowUps, 'time', '#F59E0B')}
        {renderStatCard('Ready', stats.readyToClose, 'checkmark-circle', '#10B981')}
        {renderStatCard('Closed Today', stats.closedToday, 'trophy', '#3B82F6')}
      </ScrollView>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'follow_up' && styles.filterActive]}
          onPress={() => setFilter('follow_up')}
        >
          <Text style={[styles.filterText, filter === 'follow_up' && styles.filterTextActive]}>
            Follow-up
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'completed' && styles.filterActive]}
          onPress={() => setFilter('completed')}
        >
          <Text style={[styles.filterText, filter === 'completed' && styles.filterTextActive]}>
            Ready to Close
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'closed' && styles.filterActive]}
          onPress={() => setFilter('closed')}
        >
          <Text style={[styles.filterText, filter === 'closed' && styles.filterTextActive]}>
            Closed
          </Text>
        </TouchableOpacity>
      </View>

      {/* Leads List */}
      <FlatList
        data={leads}
        renderItem={renderLeadItem}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            fetchData();
          }} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-done-circle" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>No leads found</Text>
          </View>
        }
      />

      {/* Final Call Modal */}
      <Modal visible={showCallModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Final Call - {selectedLead?.lead_number}</Text>
              <Text style={styles.modalSubtitle}>{selectedLead?.customer_name}</Text>

              <Text style={styles.label}>Satisfaction Score *</Text>
              <View style={styles.scoreButtons}>
                {[1, 2, 3, 4, 5].map(score => (
                  <TouchableOpacity
                    key={score}
                    style={[
                      styles.scoreButton,
                      satisfactionScore === score && styles.scoreButtonActive
                    ]}
                    onPress={() => setSatisfactionScore(score)}
                  >
                    <Text style={[
                      styles.scoreButtonText,
                      satisfactionScore === score && styles.scoreButtonTextActive
                    ]}>
                      {score}⭐
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Customer Feedback</Text>
              <TextInput
                style={styles.textArea}
                value={feedback}
                onChangeText={setFeedback}
                multiline
                numberOfLines={3}
                placeholder="What did the customer say?"
              />

              <Text style={styles.label}>Call Notes</Text>
              <TextInput
                style={styles.textArea}
                value={callNotes}
                onChangeText={setCallNotes}
                multiline
                numberOfLines={3}
                placeholder="Internal notes about the call"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.primaryButton]}
                  onPress={handleFinalCall}
                >
                  <Text style={styles.modalButtonText}>Log Call</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.secondaryButton]}
                  onPress={() => setShowCallModal(false)}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Close Lead Modal */}
      <Modal visible={showCloseModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Close Lead - {selectedLead?.lead_number}</Text>
              
              <Text style={styles.label}>Final Satisfaction Score *</Text>
              <View style={styles.scoreButtons}>
                {[1, 2, 3, 4, 5].map(score => (
                  <TouchableOpacity
                    key={score}
                    style={[
                      styles.scoreButton,
                      finalScore === score && styles.scoreButtonActive
                    ]}
                    onPress={() => setFinalScore(score)}
                  >
                    <Text style={[
                      styles.scoreButtonText,
                      finalScore === score && styles.scoreButtonTextActive
                    ]}>
                      {score}⭐
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Closure Notes *</Text>
              <TextInput
                style={styles.textArea}
                value={closureNotes}
                onChangeText={setClosureNotes}
                multiline
                numberOfLines={4}
                placeholder="Final summary and closure notes"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.successButton]}
                  onPress={handleCloseLead}
                  disabled={!closureNotes}
                >
                  <Text style={styles.modalButtonText}>🎉 Close Lead</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.secondaryButton]}
                  onPress={() => setShowCloseModal(false)}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#8B5CF6',
    padding: 20,
    paddingTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#E9D5FF',
    marginTop: 4,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileButton: {
    padding: 4,
  },
  logoutButton: {
    padding: 4,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quickActionText: {
    fontSize: 12,
    color: '#111827',
    marginTop: 6,
    fontWeight: '600',
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 140,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  statTitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFF',
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  filterActive: {
    backgroundColor: '#8B5CF6',
  },
  filterText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFF',
  },
  listContent: {
    padding: 16,
  },
  leadCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  leadNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  leadInfo: {
    marginBottom: 12,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  phone: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  workshop: {
    fontSize: 12,
    color: '#8B5CF6',
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  callButton: {
    backgroundColor: '#3B82F6',
  },
  closeButton: {
    backgroundColor: '#10B981',
  },
  feedbackButton: {
    backgroundColor: '#8B5CF6',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  scoreButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  scoreButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
  },
  scoreButtonActive: {
    backgroundColor: '#FCD34D',
  },
  scoreButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  scoreButtonTextActive: {
    color: '#111827',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 14,
    color: '#111827',
  },
  modalButtons: {
    marginTop: 20,
    gap: 10,
  },
  modalButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
  },
  successButton: {
    backgroundColor: '#10B981',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
  },
  modalButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
});

