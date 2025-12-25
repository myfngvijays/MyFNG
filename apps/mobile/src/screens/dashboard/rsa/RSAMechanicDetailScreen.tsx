import React, { useState, useEffect } from 'react';
import { formatDateTime } from "@/lib/dateFormat";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
} from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../../constants/theme';
import { Icon } from '../../../components/Icon';
import BottomNav from '../../../components/BottomNav';

export default function RSAMechanicDetailScreen({ navigation, route }: any) {
  const { mechanicId } = route.params;
  const { userProfile } = useAuth();
  
  const [mechanic, setMechanic] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);

  useEffect(() => {
    fetchMechanicDetail();
    fetchAssignments();
  }, [mechanicId]);

  const fetchMechanicDetail = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('company_mechanic_rsa')
        .select('*')
        .eq('id', mechanicId)
        .single();

      if (error) throw error;
      setMechanic(data);
    } catch (error) {
      console.error('Error fetching mechanic:', error);
      Alert.alert('Error', 'Failed to load mechanic details');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('rsa_leads')
        .select('id, customer_name, contact_number, vehicle_number, lead_status, requested_at')
        .eq('assigned_mechanic_id', mechanicId)
        .order('requested_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchMechanicDetail(), fetchAssignments()]);
    setRefreshing(false);
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleToggleAvailability = async () => {
    if (!mechanic) return;

    try {
      const { error } = await supabase
        .from('company_mechanic_rsa')
        .update({ is_available: !mechanic.is_available })
        .eq('id', mechanicId);

      if (error) throw error;
      setMechanic({ ...mechanic, is_available: !mechanic.is_available });
      Alert.alert('Success', `Mechanic marked as ${!mechanic.is_available ? 'Available' : 'Busy'}`);
    } catch (error: any) {
      console.error('Error updating availability:', error);
      Alert.alert('Error', 'Failed to update availability');
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading mechanic details...</Text>
      </View>
    );
  }

  if (!mechanic) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="alert-circle" size={48} color={COLORS.error} />
        <Text style={styles.errorText}>Mechanic not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mechanic Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: mechanic.is_available
                  ? COLORS.success + '20'
                  : COLORS.error + '20',
              },
            ]}
          >
            {mechanic.is_available ? (
              <Icon name="check-circle" size={20} color={COLORS.success} />
            ) : (
              <Icon name="x-circle" size={20} color={COLORS.error} />
            )}
            <Text
              style={[
                styles.statusText,
                {
                  color: mechanic.is_available ? COLORS.success : COLORS.error,
                },
              ]}
            >
              {mechanic.is_available ? 'Available' : 'Busy'}
            </Text>
          </View>
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.label}>Mechanic Name</Text>
            <Text style={styles.value}>{mechanic.mechanic_name}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Mechanic Code</Text>
            <Text style={styles.value}>{mechanic.mechanic_code}</Text>
          </View>

          {mechanic.timing && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Availability Timing</Text>
              <Text style={styles.value}>{mechanic.timing}</Text>
            </View>
          )}
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          
          <TouchableOpacity
            style={styles.contactRow}
            onPress={() => handleCall(mechanic.number)}
          >
            <Icon name="phone" size={20} color={COLORS.primary} />
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Primary Number</Text>
              <Text style={styles.contactValue}>{mechanic.number}</Text>
            </View>
          </TouchableOpacity>

          {mechanic.alternate_number1 && (
            <TouchableOpacity
              style={styles.contactRow}
              onPress={() => handleCall(mechanic.alternate_number1)}
            >
              <Icon name="phone" size={20} color={COLORS.gray[500]} />
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Alternate Number 1</Text>
                <Text style={styles.contactValue}>{mechanic.alternate_number1}</Text>
              </View>
            </TouchableOpacity>
          )}

          {mechanic.alternate_number2 && (
            <TouchableOpacity
              style={styles.contactRow}
              onPress={() => handleCall(mechanic.alternate_number2)}
            >
              <Icon name="phone" size={20} color={COLORS.gray[500]} />
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Alternate Number 2</Text>
                <Text style={styles.contactValue}>{mechanic.alternate_number2}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Service Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Information</Text>
          
          {mechanic.service_tag && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Primary Service</Text>
              <Text style={styles.value}>{mechanic.service_tag}</Text>
            </View>
          )}

          {mechanic.service_tag2 && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Secondary Service</Text>
              <Text style={styles.value}>{mechanic.service_tag2}</Text>
            </View>
          )}

          {mechanic.service_tag3 && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Tertiary Service</Text>
              <Text style={styles.value}>{mechanic.service_tag3}</Text>
            </View>
          )}

          {mechanic.service_areas && mechanic.service_areas.length > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Service Areas</Text>
              <Text style={styles.value}>{mechanic.service_areas.join(', ')}</Text>
            </View>
          )}

          {mechanic.current_location && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Current Location</Text>
              <Text style={styles.value}>{mechanic.current_location}</Text>
            </View>
          )}
        </View>

        {/* Performance Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Icon name="star" size={24} color={COLORS.warning} />
              <Text style={styles.statValue}>
                {mechanic.rating ? mechanic.rating.toFixed(1) : '0.0'}
              </Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>

            <View style={styles.statCard}>
              <Icon name="check-circle" size={24} color={COLORS.success} />
              <Text style={styles.statValue}>
                {mechanic.total_jobs_completed || 0}
              </Text>
              <Text style={styles.statLabel}>Jobs Completed</Text>
            </View>
          </View>
        </View>

        {/* Recent Assignments */}
        {assignments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Assignments</Text>
            {assignments.map((assignment) => (
              <TouchableOpacity
                key={assignment.id}
                style={styles.assignmentCard}
                onPress={() => {
                  navigation.navigate('RSALeadDetail', { leadId: assignment.id });
                }}
              >
                <View style={styles.assignmentHeader}>
                  <Text style={styles.assignmentName}>{assignment.customer_name}</Text>
                  <View
                    style={[
                      styles.assignmentStatus,
                      {
                        backgroundColor: assignment.lead_status === 'completed'
                          ? COLORS.success + '20'
                          : COLORS.warning + '20',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.assignmentStatusText,
                        {
                          color: assignment.lead_status === 'completed'
                            ? COLORS.success
                            : COLORS.warning,
                        },
                      ]}
                    >
                      {assignment.lead_status}
                    </Text>
                  </View>
                </View>
                {assignment.vehicle_number && (
                  <Text style={styles.assignmentVehicle}>
                    Vehicle: {assignment.vehicle_number}
                  </Text>
                )}
                <Text style={styles.assignmentDate}>
                  {formatDateTime(assignment.requested_at)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: mechanic.is_available
                  ? COLORS.error
                  : COLORS.success,
              },
            ]}
            onPress={handleToggleAvailability}
          >
            <Icon
              name={mechanic.is_available ? 'x-circle' : 'check-circle'}
              size={20}
              color={COLORS.white}
            />
            <Text style={styles.actionButtonText}>
              Mark as {mechanic.is_available ? 'Busy' : 'Available'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab="mechanics"
        onTabChange={(tab) => {
          if (tab === 'dashboard') {
            navigation.goBack();
            navigation.goBack(); // Go back twice to reach dashboard
          } else if (tab === 'add_mechanic') {
            navigation.goBack();
            navigation.navigate('AddMechanic', {});
          }
        }}
        tabs={[
          { id: 'dashboard', label: 'Dashboard', icon: 'home' },
          { id: 'mechanics', label: 'Mechanics', icon: 'wrench' },
          { id: 'add_mechanic', label: 'Add', icon: 'plus' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontFamily: 'Poppins',
  },
  errorText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.error,
    marginTop: SPACING.md,
    fontFamily: 'Poppins',
    fontWeight: '600',
  },
  header: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    paddingTop: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.white,
    fontFamily: 'Poppins',
  },
  scrollView: {
    flex: 1,
    paddingBottom: 100, // Space for bottom nav
  },
  statusContainer: {
    padding: SPACING.md,
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
  },
  statusText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    fontFamily: 'Poppins',
  },
  section: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    marginHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.gray[100],
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.textHeading,
    marginBottom: SPACING.md,
    fontFamily: 'Poppins',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    fontFamily: 'Poppins',
    flex: 1,
  },
  value: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textBody,
    fontFamily: 'Poppins',
    flex: 1,
    textAlign: 'right',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    fontFamily: 'Poppins',
  },
  contactValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontFamily: 'Poppins',
    fontWeight: '600',
    marginTop: SPACING.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.gray[50],
    borderRadius: BORDER_RADIUS.md,
  },
  statValue: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.textHeading,
    marginTop: SPACING.xs,
    fontFamily: 'Poppins',
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    fontFamily: 'Poppins',
  },
  assignmentCard: {
    backgroundColor: COLORS.gray[50],
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  assignmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  assignmentName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textHeading,
    fontFamily: 'Poppins',
    flex: 1,
  },
  assignmentStatus: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  assignmentStatusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    fontFamily: 'Poppins',
  },
  assignmentVehicle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    fontFamily: 'Poppins',
  },
  assignmentDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
    fontFamily: 'Poppins',
  },
  actionSection: {
    padding: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    fontFamily: 'Poppins',
  },
  backButtonText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    fontFamily: 'Poppins',
    marginTop: SPACING.md,
  },
});

