import React, { useEffect, useState } from 'react';
import {
import { formatDateTime, formatTime12h } from "@/lib/dateFormat";
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  RefreshControl,
  BackHandler,
} from 'react-native';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../../constants/theme';
import type { PickupTracking, ServiceLead } from '../../../../../shared/types';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useNavigation } from '@react-navigation/native';

interface Props {
  leadId: string;
  onBack: () => void;
  onStartPickup: () => void;
  onVerifyOTP: () => void;
  onUploadPhotos: () => void;
  onMarkPicked: () => void;
  onNavigate: () => void;
  onReportIncident: () => void;
}

export default function PickupJobDetailScreen({
  leadId,
  onBack,
  onStartPickup,
  onVerifyOTP,
  onUploadPhotos,
  onMarkPicked,
  onNavigate,
  onReportIncident,
}: Props) {
  const navigation = useNavigation();
  const [lead, setLead] = useState<ServiceLead | null>(null);
  const [tracking, setTracking] = useState<PickupTracking | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (onBack) {
        onBack();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [onBack]);

  useEffect(() => {
    fetchLeadDetails();
    fetchPhotoCount();

    // ✅ FIX: Setup realtime subscription
    let channel: RealtimeChannel;

    const setupRealtimeSubscription = () => {
      channel = supabase
        .channel('pickup-job-detail')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'service_leads',
            filter: `id=eq.${leadId}`
          },
            (payload) => {
              fetchLeadDetails();
              fetchPhotoCount();
            }
          )
          .subscribe();
    };

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [leadId]);

  const fetchLeadDetails = async () => {
    try {
      // Fetch lead
      const { data: leadData, error: leadError } = await supabase
        .from('service_leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (leadError) throw leadError;
      setLead(leadData);

      // Fetch pickup tracking
      const { data: trackingData, error: trackingError } = await supabase
        .from('pickup_tracking')
        .select('*')
        .eq('lead_id', leadId)
        .single();

      if (trackingError) throw trackingError;
      setTracking(trackingData);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to fetch lead details');
    }
  };

  const fetchPhotoCount = async () => {
    const { count } = await supabase
      .from('vehicle_condition_photos')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', leadId)
      .like('photo_type', 'PICKUP_%');

    setPhotoCount(count || 0);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLeadDetails();
    await fetchPhotoCount();
    setRefreshing(false);
  };

  const handleCallCustomer = () => {
    if (lead?.customer_phone) {
      Linking.openURL(`tel:${lead.customer_phone}`);
    }
  };

  const handleNavigateToLocation = () => {
    if (tracking?.pickup_latitude && tracking?.pickup_longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${tracking.pickup_latitude},${tracking.pickup_longitude}`;
      Linking.openURL(url);
    } else if (tracking?.pickup_address) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tracking.pickup_address)}`;
      Linking.openURL(url);
    }
  };

  const getStatusColor = (status: string) => {
    const statusMap: Record<string, string> = {
      PENDING: COLORS.warning,
      OTP_VERIFIED: COLORS.info,
      PICKED: COLORS.primary,
      IN_TRANSIT: COLORS.primary,
      ARRIVED_AT_WORKSHOP: COLORS.success,
      DROPPED: COLORS.success,
      FAILED_PICKUP: COLORS.danger,
    };
    return statusMap[status] || COLORS.gray[500];
  };

  const getStatusLabel = (status: string) => {
    const labelMap: Record<string, string> = {
      NOT_ASSIGNED: 'Not Assigned',
      PENDING: 'Pickup Pending',
      OTP_VERIFIED: 'OTP Verified',
      PICKED: 'Vehicle Picked',
      IN_TRANSIT: 'In Transit',
      ARRIVED_AT_WORKSHOP: 'Arrived at Workshop',
      DROPPED: 'Dropped',
      FAILED_PICKUP: 'Failed',
    };
    return labelMap[status] || status;
  };

  const renderActionButton = () => {
    if (!tracking) return null;

    switch (tracking.pickup_status) {
      case 'NOT_ASSIGNED':
      case 'PENDING':
        return (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
            onPress={onStartPickup}
          >
            <Text style={styles.actionButtonText}>🚗 Start Pickup</Text>
          </TouchableOpacity>
        );

      case 'OTP_VERIFIED':
        return (
          <>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.secondary }]}
              onPress={onUploadPhotos}
            >
              <Text style={styles.actionButtonText}>
                📸 Upload Photos ({photoCount}/4 minimum)
              </Text>
            </TouchableOpacity>
            {photoCount >= 4 && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.success }]}
                onPress={onMarkPicked}
              >
                <Text style={styles.actionButtonText}>✅ Mark Vehicle Picked</Text>
              </TouchableOpacity>
            )}
          </>
        );

      case 'PICKED':
        return (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
            onPress={() => {
              Alert.alert('In Transit', 'Vehicle is being transported to workshop');
            }}
          >
            <Text style={styles.actionButtonText}>🚗 In Transit to Workshop</Text>
          </TouchableOpacity>
        );

      default:
        return null;
    }
  };

  if (!lead || !tracking) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pickup Details</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Lead Number & Status */}
        <View style={styles.card}>
          <View style={styles.leadHeader}>
            <Text style={styles.leadNumber}>Lead #{lead.lead_number}</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(tracking.pickup_status) },
              ]}
            >
              <Text style={styles.statusText}>
                {getStatusLabel(tracking.pickup_status)}
              </Text>
            </View>
          </View>
        </View>

        {/* Customer Details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>👤 Customer Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Name:</Text>
            <Text style={styles.detailValue}>{lead.customer_name}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Phone:</Text>
            <TouchableOpacity onPress={handleCallCustomer}>
              <Text style={[styles.detailValue, styles.linkText]}>
                📞 {lead.customer_phone}
              </Text>
            </TouchableOpacity>
          </View>
          {lead.customer_email && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email:</Text>
              <Text style={styles.detailValue}>{lead.customer_email}</Text>
            </View>
          )}
        </View>

        {/* Vehicle Details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🚗 Vehicle Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Registration:</Text>
            <Text style={styles.detailValue}>{lead.vehicle_number}</Text>
          </View>
          {lead.vehicle_make && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Make/Model:</Text>
              <Text style={styles.detailValue}>
                {lead.vehicle_make} {lead.vehicle_model}
              </Text>
            </View>
          )}
          {lead.service_type && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Service Type:</Text>
              <Text style={styles.detailValue}>{lead.service_type}</Text>
            </View>
          )}
        </View>

        {/* Pickup Information */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📍 Pickup Information</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Address:</Text>
            <Text style={styles.detailValue}>{tracking.pickup_address}</Text>
          </View>
          {tracking.pickup_distance && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Distance:</Text>
              <Text style={styles.detailValue}>
                {tracking.pickup_distance.toFixed(1)} km
              </Text>
            </View>
          )}
          {tracking.pickup_time_window_start && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Pickup Window:</Text>
              <Text style={styles.detailValue}>
                {formatTime12h(tracking.pickup_time_window_start)} -{' '}
                {formatTime12h(tracking.pickup_time_window_end!)}
              </Text>
            </View>
          )}
          {tracking.pickup_customer_instructions && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Instructions:</Text>
              <Text style={styles.detailValue}>
                {tracking.pickup_customer_instructions}
              </Text>
            </View>
          )}

          {/* Navigate Button */}
          <TouchableOpacity
            style={[styles.secondaryButton, { marginTop: SPACING.md }]}
            onPress={handleNavigateToLocation}
          >
            <Text style={styles.secondaryButtonText}>🗺️ Navigate to Location</Text>
          </TouchableOpacity>
        </View>

        {/* OTP Section */}
        {tracking.pickup_status === 'PENDING' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🔐 OTP Verification</Text>
            <Text style={styles.infoText}>
              Ask customer for the pickup OTP to proceed
            </Text>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.info }]}
              onPress={onVerifyOTP}
            >
              <Text style={styles.actionButtonText}>Enter OTP</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Status Timeline */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📋 Status Timeline</Text>
          <View style={styles.timeline}>
            <View
              style={[
                styles.timelineItem,
                tracking.pickup_assigned_at && styles.timelineItemCompleted,
              ]}
            >
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Assigned</Text>
                {tracking.pickup_assigned_at && (
                  <Text style={styles.timelineTime}>
                    {formatDateTime(tracking.pickup_assigned_at)}
                  </Text>
                )}
              </View>
            </View>

            <View
              style={[
                styles.timelineItem,
                tracking.pickup_start_time && styles.timelineItemCompleted,
              ]}
            >
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Pickup Started</Text>
                {tracking.pickup_start_time && (
                  <Text style={styles.timelineTime}>
                    {formatDateTime(tracking.pickup_start_time)}
                  </Text>
                )}
              </View>
            </View>

            <View
              style={[
                styles.timelineItem,
                tracking.pickup_otp_verified_at && styles.timelineItemCompleted,
              ]}
            >
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>OTP Verified</Text>
                {tracking.pickup_otp_verified_at && (
                  <Text style={styles.timelineTime}>
                    {formatDateTime(tracking.pickup_otp_verified_at)}
                  </Text>
                )}
              </View>
            </View>

            <View
              style={[
                styles.timelineItem,
                tracking.pickup_picked_time && styles.timelineItemCompleted,
              ]}
            >
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Vehicle Picked</Text>
                {tracking.pickup_picked_time && (
                  <Text style={styles.timelineTime}>
                    {formatDateTime(tracking.pickup_picked_time)}
                  </Text>
                )}
              </View>
            </View>

            <View
              style={[
                styles.timelineItem,
                tracking.pickup_arrival_time && styles.timelineItemCompleted,
              ]}
            >
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Arrived at Workshop</Text>
                {tracking.pickup_arrival_time && (
                  <Text style={styles.timelineTime}>
                    {formatDateTime(tracking.pickup_arrival_time)}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>{renderActionButton()}</View>

        {/* Report Incident Button */}
        <TouchableOpacity
          style={[styles.secondaryButton, { backgroundColor: COLORS.danger }]}
          onPress={onReportIncident}
        >
          <Text style={[styles.secondaryButtonText, { color: COLORS.white }]}>
            ⚠️ Report Incident
          </Text>
        </TouchableOpacity>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  backButton: {
    padding: SPACING.sm,
  },
  backButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginLeft: SPACING.sm,
  },
  content: {
    flex: 1,
    padding: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leadNumber: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.heading,
  },
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.white,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginBottom: SPACING.sm,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: SPACING.xs,
  },
  detailLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    fontWeight: '600',
    width: 100,
  },
  detailValue: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.bodyText,
  },
  linkText: {
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  infoText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    marginBottom: SPACING.md,
  },
  timeline: {
    paddingLeft: SPACING.md,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    opacity: 0.4,
  },
  timelineItemCompleted: {
    opacity: 1,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    marginTop: 4,
    marginRight: SPACING.sm,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.heading,
  },
  timelineTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  actionsContainer: {
    marginBottom: SPACING.md,
  },
  actionButton: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  actionButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
  },
  secondaryButton: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  secondaryButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
});

