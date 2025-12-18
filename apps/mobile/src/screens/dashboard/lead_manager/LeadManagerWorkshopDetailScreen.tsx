import { formatDateDMY } from "@/lib/dateFormat";
/**
 * Lead Manager Workshop Detail Screen - Mobile
 * Detailed view of a specific workshop
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  RefreshControl,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';

interface Workshop {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contact_person: string;
  phone: string;
  email: string;
  gst_number: string | null;
  is_verified: boolean;
  audit_score: number | null;
  created_at: string;
}

interface Stats {
  total_leads: number;
  accepted_leads: number;
  completed_leads: number;
  acceptance_rate: number;
  completion_rate: number;
}

interface RecentJob {
  id: string;
  lead_number: string;
  customer_name: string;
  customer_phone: string;
  vehicle_make: string;
  vehicle_model: string;
  status: string;
  created_at: string;
}

export default function LeadManagerWorkshopDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { workshopId } = route.params as { workshopId: string };

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [stats, setStats] = useState<Stats>({
    total_leads: 0,
    accepted_leads: 0,
    completed_leads: 0,
    acceptance_rate: 0,
    completion_rate: 0,
  });
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);

  useEffect(() => {
    fetchWorkshopDetails();
  }, []);

  const fetchWorkshopDetails = async () => {
    try {
      await Promise.all([
        fetchWorkshop(),
        fetchStats(),
        fetchRecentJobs(),
      ]);
    } catch (error) {
      console.error('Error fetching workshop details:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchWorkshop = async () => {
    const { data, error } = await supabase
      .from('workshops')
      .select('*')
      .eq('id', workshopId)
      .single();

    if (error) throw error;
    setWorkshop(data);
  };

  const fetchStats = async () => {
    const { count: totalLeads } = await supabase
      .from('service_leads')
      .select('*', { count: 'exact', head: true })
      .eq('workshop_id', workshopId);

    const { count: acceptedLeads } = await supabase
      .from('service_leads')
      .select('*', { count: 'exact', head: true })
      .eq('workshop_id', workshopId)
      .eq('status', 'ACCEPTED');

    const { count: completedLeads } = await supabase
      .from('service_leads')
      .select('*', { count: 'exact', head: true })
      .eq('workshop_id', workshopId)
      .eq('status', 'COMPLETED');

    const acceptanceRate = totalLeads > 0 ? (acceptedLeads / totalLeads) * 100 : 0;
    const completionRate = acceptedLeads > 0 ? (completedLeads / acceptedLeads) * 100 : 0;

    setStats({
      total_leads: totalLeads || 0,
      accepted_leads: acceptedLeads || 0,
      completed_leads: completedLeads || 0,
      acceptance_rate: parseFloat(acceptanceRate.toFixed(2)),
      completion_rate: parseFloat(completionRate.toFixed(2)),
    });
  };

  const fetchRecentJobs = async () => {
    const { data, error } = await supabase
      .from('service_leads')
      .select('id, lead_number, customer_name, customer_phone, vehicle_make, vehicle_model, status, created_at')
      .eq('workshop_id', workshopId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    setRecentJobs(data || []);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchWorkshopDetails();
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`);
  };

  const getStatusBadge = (status: string) => {
    let color = '#6B7280';
    switch (status) {
      case 'NEW': color = '#3B82F6'; break;
      case 'VALIDATED': color = '#6366F1'; break;
      case 'ASSIGNED_TO_WORKSHOP': color = '#8B5CF6'; break;
      case 'ACCEPTED': color = '#10B981'; break;
      case 'IN_PROGRESS': color = '#F59E0B'; break;
      case 'COMPLETED': color = '#14B8A6'; break;
      case 'REJECTED':
      case 'CANCELLED': color = '#EF4444'; break;
      case 'INCOMPLETE': color = '#F97316'; break;
    }
    return { backgroundColor: color + '20', color };
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={styles.loadingText}>Loading workshop details...</Text>
      </View>
    );
  }

  if (!workshop) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color="#EF4444" />
        <Text style={styles.errorText}>Workshop not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backIcon} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{workshop.name}</Text>
          <View style={styles.headerBadges}>
            {workshop.is_verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
            {workshop.audit_score !== null && (
              <View style={styles.scoreBadge}>
                <Ionicons name="star" size={16} color="#F59E0B" />
                <Text style={styles.scoreText}>Score: {workshop.audit_score}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: '#EFF6FF' }]}>
          <Ionicons name="briefcase" size={24} color="#3B82F6" />
          <Text style={styles.statValue}>{stats.total_leads}</Text>
          <Text style={styles.statLabel}>Total Jobs</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#F0FDF4' }]}>
          <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          <Text style={styles.statValue}>{stats.accepted_leads}</Text>
          <Text style={styles.statLabel}>Accepted</Text>
          <Text style={styles.statBadge}>{stats.acceptance_rate}%</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#ECFDF5' }]}>
          <Ionicons name="checkmark-done" size={24} color="#14B8A6" />
          <Text style={styles.statValue}>{stats.completed_leads}</Text>
          <Text style={styles.statLabel}>Completed</Text>
          <Text style={styles.statBadge}>{stats.completion_rate}%</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
          <Ionicons name="time" size={24} color="#F59E0B" />
          <Text style={styles.statValue}>{stats.accepted_leads - stats.completed_leads}</Text>
          <Text style={styles.statLabel}>Active Jobs</Text>
        </View>
      </View>

      {/* Workshop Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏢 Workshop Information</Text>
        
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="location" size={20} color="#6B7280" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.infoValue}>
                {workshop.address}, {workshop.city}, {workshop.state} - {workshop.pincode}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="person" size={20} color="#6B7280" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Contact Person</Text>
              <Text style={styles.infoValue}>{workshop.contact_person}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.infoRow} onPress={() => handleCall(workshop.phone)}>
            <Ionicons name="call" size={20} color="#3B82F6" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={[styles.infoValue, { color: '#3B82F6' }]}>{workshop.phone}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#3B82F6" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.infoRow} onPress={() => handleEmail(workshop.email)}>
            <Ionicons name="mail" size={20} color="#3B82F6" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={[styles.infoValue, { color: '#3B82F6' }]}>{workshop.email}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#3B82F6" />
          </TouchableOpacity>

          {workshop.gst_number && (
            <View style={styles.infoRow}>
              <Ionicons name="document-text" size={20} color="#6B7280" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>GST Number</Text>
                <Text style={styles.infoValue}>{workshop.gst_number}</Text>
              </View>
            </View>
          )}

          <View style={styles.infoRow}>
            <Ionicons name="calendar" size={20} color="#6B7280" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Registered</Text>
              <Text style={styles.infoValue}>
                {formatDateDMY(workshop.created_at)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Recent Jobs */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 Recent Jobs ({recentJobs.length})</Text>
        
        {recentJobs.length === 0 ? (
          <View style={styles.emptyJobs}>
            <Ionicons name="briefcase-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>No jobs yet</Text>
          </View>
        ) : (
          recentJobs.map((job) => {
            const statusStyle = getStatusBadge(job.status);
            return (
              <View key={job.id} style={styles.jobCard}>
                <View style={styles.jobHeader}>
                  <Text style={styles.jobNumber}>#{job.lead_number}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.backgroundColor }]}>
                    <Text style={[styles.statusText, { color: statusStyle.color }]}>
                      {job.status.replace(/_/g, ' ')}
                    </Text>
                  </View>
                </View>
                <Text style={styles.jobCustomer}>
                  {job.customer_name} - {job.customer_phone}
                </Text>
                <Text style={styles.jobVehicle}>
                  {job.vehicle_make} {job.vehicle_model}
                </Text>
                <Text style={styles.jobDate}>
                  Created: {formatDateDMY(job.created_at)}
                </Text>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
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
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#EF4444',
    marginTop: 15,
  },
  backButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#FF6B00',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#FF6B00',
    padding: 20,
    paddingTop: 60,
  },
  backIcon: {
    marginBottom: 15,
  },
  headerContent: {
    gap: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  headerBadges: {
    flexDirection: 'row',
    gap: 10,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
  },
  statCard: {
    width: '47%',
    margin: '1.5%',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 10,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 5,
  },
  statBadge: {
    fontSize: 11,
    color: '#10B981',
    marginTop: 5,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#FFF',
    margin: 15,
    marginTop: 0,
    padding: 15,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 15,
  },
  infoCard: {
    gap: 15,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  emptyJobs: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 10,
  },
  jobCard: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  jobNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  jobCustomer: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 4,
  },
  jobVehicle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  jobDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
});

