import { formatDateTime } from "@/lib/dateFormat";
/**
 * SUB_ADMIN Escalations Screen
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { ENV } from '../../../config/environment';

export default function SubAdminEscalationsScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [escalations, setEscalations] = useState<any[]>([]);

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation?.goBack) {
        navigation.goBack();
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [navigation]);

  useEffect(() => {
    fetchEscalations();
  }, []);

  const fetchEscalations = async () => {
    try {
      setLoading(true);
      // Fetch escalations from database
      const { data, error } = await supabase
        .from('escalations')
        .select(`
          *,
          lead:service_leads!lead_id(lead_number, customer_name, customer_phone)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setEscalations(data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const renderEscalation = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.escalationCard}>
      <View style={styles.escalationHeader}>
        <Text style={styles.escalationNumber}>{item.escalation_number}</Text>
        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) }]}>
          <Text style={styles.priorityText}>{item.priority}</Text>
        </View>
      </View>
      <Text style={styles.escalationReason}>{item.escalation_reason}</Text>
      {item.lead && (
        <View style={styles.leadInfo}>
          <Text style={styles.leadText}>Lead: {item.lead.lead_number}</Text>
          <Text style={styles.customerText}>{item.lead.customer_name}</Text>
        </View>
      )}
      <Text style={styles.dateText}>
        {formatDateTime(item.created_at)}
      </Text>
    </TouchableOpacity>
  );

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'CRITICAL': '#DC2626',
      'URGENT': '#F59E0B',
      'HIGH': '#EF4444',
      'MEDIUM': '#3B82F6',
      'LOW': '#6B7280',
    };
    return colors[priority] || '#9CA3AF';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Escalations</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={escalations}
        renderItem={renderEscalation}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchEscalations} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyText}>No escalations</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  listContent: {
    padding: 16,
  },
  escalationCard: {
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
  escalationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  escalationNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  escalationReason: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  leadInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  leadText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  customerText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
});

