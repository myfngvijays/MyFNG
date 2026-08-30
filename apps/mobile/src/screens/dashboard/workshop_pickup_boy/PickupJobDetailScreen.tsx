import React, { useEffect, useState } from 'react';
import { formatDateTime, formatTime12h } from "@/lib/dateFormat";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
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
import { ENV } from '../../../config/environment';
import * as Location from 'expo-location';
import { useNotifications } from '../../../context/NotificationContext';

export default function PickupJobDetailScreen(props: any) {
  const hideChrome = !!(props as any)?.hideChrome;
  const navigation = useNavigation();
  const { pickupRefreshTick } = useNotifications();
  const route = (props as any)?.route;
  const leadId: string = (props as any)?.leadId || route?.params?.taskId || route?.params?.leadId;
  const onBack = (props as any)?.onBack || (() => (navigation as any).goBack?.());
  // Default handlers (can be overridden by parent props if needed)
  const onStartPickup = (props as any)?.onStartPickup;
  const onVerifyOTP = (props as any)?.onVerifyOTP;
  const onUploadPhotos = (props as any)?.onUploadPhotos;
  const onMarkPicked = (props as any)?.onMarkPicked;
  const onNavigate = (props as any)?.onNavigate;
  const onReportIncident = (props as any)?.onReportIncident;
  const [lead, setLead] = useState<ServiceLead | null>(null);
  const [tracking, setTracking] = useState<PickupTracking | null>(null);
  const [pickupPhotoCount, setPickupPhotoCount] = useState(0);
  const [dropPhotoCount, setDropPhotoCount] = useState(0);
  const [dropHandoverPhotoCount, setDropHandoverPhotoCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [locationPermGranted, setLocationPermGranted] = useState<boolean>(false);
  const [observationText, setObservationText] = useState('');
  const [savingObservation, setSavingObservation] = useState(false);

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

  // If a pickup-impacting notification arrives, refetch this lead.
  useEffect(() => {
    if (leadId) {
      fetchLeadDetails();
      fetchPhotoCount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupRefreshTick]);

  // Foreground GPS pings for route deviation/delay detection (Pickup/Workshop/Drop legs)
  useEffect(() => {
    let interval: any = null;
    let cancelled = false;

    const ensurePerm = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        setLocationPermGranted(status === 'granted');
      } catch {
        if (!cancelled) setLocationPermGranted(false);
      }
    };

    ensurePerm();

    const tick = async () => {
      try {
        if (!leadId || !locationPermGranted) return;
        if (!lead || !tracking) return;

        const isDelivery = isDeliveryLead(lead);
        const pickupStatus = String((tracking as any)?.pickup_status || (lead as any)?.pickup_status || '').toUpperCase();
        const dropStatus = String((tracking as any)?.drop_status || '').toUpperCase();

        const movingPickup = ['ON_THE_WAY', 'IN_TRANSIT', 'VEHICLE_IN_TRANSIT'].includes(pickupStatus);
        const movingDrop = ['OUT_FOR_DELIVERY', 'IN_TRANSIT', 'MOVING_TO_DROP'].includes(dropStatus);
        const shouldTrack = isDelivery ? movingDrop : movingPickup;
        if (!shouldTrack) return;

        const mode = isDelivery ? 'DROP' : pickupStatus === 'VEHICLE_IN_TRANSIT' ? 'WORKSHOP' : 'PICKUP';

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        await postJson(`/api/pickup/${leadId}/location`, {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          mode,
        });
      } catch {
        // ignore (best-effort)
      }
    };

    // Start periodic pings
    interval = setInterval(() => void tick(), 20000);
    void tick();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, locationPermGranted, (lead as any)?.status, (tracking as any)?.pickup_status, (tracking as any)?.drop_status]);

  const fetchLeadDetails = async () => {
    try {
      if (!leadId) return;
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
        .maybeSingle();

      // Tracking may not exist yet (especially in edge flows); treat as optional.
      if (!trackingError) {
        setTracking(trackingData as any);
      } else {
        setTracking(null);
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to fetch lead details');
    }
  };

  const fetchPhotoCount = async () => {
    if (!leadId) return;
    const { count: pickupCount } = await supabase
      .from('vehicle_condition_photos')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', leadId)
      .like('photo_type', 'PICKUP_%');

    const { count: dropCount } = await supabase
      .from('vehicle_condition_photos')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', leadId)
      .like('photo_type', 'DROP_%');

    setPickupPhotoCount(pickupCount || 0);
    setDropPhotoCount(dropCount || 0);

    const { count: handoverCount } = await supabase
      .from('vehicle_condition_photos')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', leadId)
      .eq('photo_type', 'DROP_HANDOVER');
    setDropHandoverPhotoCount(handoverCount || 0);
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

  const isDeliveryLead = (ld: any) => ['READY_FOR_DELIVERY', 'COD_PENDING'].includes(String(ld?.status || '').toUpperCase());

  const getAccessToken = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Not authenticated');
    return token;
  };

  const postJson = async (path: string, body?: any) => {
    const token = await getAccessToken();
    const res = await fetch(`${ENV.API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body || {}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'Request failed');
    return json;
  };

  const submitObservation = async () => {
    const text = String(observationText || '').trim();
    if (!text) {
      Alert.alert('Observation required', 'Please enter observation before submitting.');
      return;
    }
    setSavingObservation(true);
    try {
      await postJson(`/api/pickup/tasks/${leadId}/observation`, { observation: text });
      Alert.alert('Saved', 'Observation submitted.');
      setObservationText('');
      await fetchLeadDetails();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to submit observation');
    } finally {
      setSavingObservation(false);
    }
  };

  const handleStartNavigateFlow = async () => {
    try {
      await postJson(`/api/pickup/${leadId}/navigate`, {});
      Alert.alert('Success', 'Started. OTP generated (if applicable).');
      await fetchLeadDetails();
      await fetchPhotoCount();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to start');
    }
  };

  const handleMarkPicked = async () => {
    try {
      await postJson(`/api/pickup/${leadId}/mark-picked`, {});
      Alert.alert('Success', 'Marked as picked.');
      await fetchLeadDetails();
      await fetchPhotoCount();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to mark picked');
    }
  };

  const handleArrivedAtWorkshop = async () => {
    try {
      await postJson(`/api/pickup/tasks/${leadId}/arrived`, {});
      Alert.alert('Success', 'Marked as arrived at workshop.');
      await fetchLeadDetails();
      await fetchPhotoCount();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to mark arrived');
    }
  };

  const handleCompleteDelivery = async () => {
    try {
      // Guard: require receiver/handover proof photo before completing delivery.
      if ((dropHandoverPhotoCount || 0) < 1) {
        Alert.alert(
          'Receiver photo required',
          'Complete delivery se pehle receiver (handover) photo upload karo, taaki pata rahe vehicle kisko diya.',
          [
            { text: 'Cancel', style: 'cancel' as any },
            {
              text: 'Upload Photo',
              onPress: () =>
                (navigation as any).navigate?.('PickupPhotoUpload', { leadId, photoCategory: 'DROP' }),
            },
          ]
        );
        return;
      }
      await postJson(`/api/pickup/${leadId}/drop/complete`, {});
      Alert.alert('Success', 'Delivery completed.');
      await fetchLeadDetails();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to complete delivery');
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
    if (!lead) return null;

    const isDelivery = isDeliveryLead(lead);
    const otpVerified = isDelivery ? !!(tracking as any)?.drop_otp_verified_at : !!(tracking as any)?.pickup_otp_verified_at;
    const minPhotosOk = isDelivery ? dropPhotoCount >= 3 : pickupPhotoCount >= 4;

    // Delivery flow (READY_FOR_DELIVERY / COD_PENDING)
    if (isDelivery) {
      return (
        <>
          {!((tracking as any)?.drop_status) && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
              onPress={onNavigate || handleStartNavigateFlow}
            >
              <Text style={styles.actionButtonText}>🚚 Start Delivery</Text>
            </TouchableOpacity>
          )}

          {!!((tracking as any)?.drop_status) && !otpVerified && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.info }]}
              onPress={
                onVerifyOTP ||
                (() => (navigation as any).navigate?.('PickupOtp', { leadId, otpType: 'DROP' }))
              }
            >
              <Text style={styles.actionButtonText}>🔐 Verify Delivery OTP</Text>
            </TouchableOpacity>
          )}

          {otpVerified && (
            <>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.secondary }]}
                onPress={
                  onUploadPhotos ||
                  (() => (navigation as any).navigate?.('PickupPhotoUpload', { leadId, photoCategory: 'DROP' }))
                }
              >
                <Text style={styles.actionButtonText}>
                  📸 Upload Delivery Photos ({dropPhotoCount}/3+) • Receiver Photo ({dropHandoverPhotoCount}/1)
                </Text>
              </TouchableOpacity>
              {minPhotosOk && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: COLORS.success }]}
                  onPress={handleCompleteDelivery}
                >
                  <Text style={styles.actionButtonText}>✅ Complete Delivery</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </>
      );
    }

    // Pickup flow
    return (
      <>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
          onPress={onStartPickup || handleStartNavigateFlow}
        >
          <Text style={styles.actionButtonText}>🚗 Start / Navigate</Text>
        </TouchableOpacity>

        {!otpVerified && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: COLORS.info }]}
            onPress={
              onVerifyOTP || (() => (navigation as any).navigate?.('PickupOtp', { leadId, otpType: 'PICKUP' }))
            }
          >
            <Text style={styles.actionButtonText}>🔐 Verify Pickup OTP</Text>
          </TouchableOpacity>
        )}

        {otpVerified && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.secondary }]}
              onPress={
                onUploadPhotos ||
                (() => (navigation as any).navigate?.('PickupPhotoUpload', { leadId, photoCategory: 'PICKUP' }))
              }
            >
              <Text style={styles.actionButtonText}>📸 Upload Pickup Photos ({pickupPhotoCount}/4 min)</Text>
            </TouchableOpacity>
            {minPhotosOk && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.success }]}
                onPress={onMarkPicked || handleMarkPicked}
              >
                <Text style={styles.actionButtonText}>✅ Mark Vehicle Picked</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {String((lead as any)?.status || '').toUpperCase() === 'VEHICLE_IN_TRANSIT' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
            onPress={handleArrivedAtWorkshop}
          >
            <Text style={styles.actionButtonText}>🏁 Mark Arrived at Workshop</Text>
          </TouchableOpacity>
        )}
      </>
    );
  };

  if (!leadId || !lead) {
    return (
      <View style={styles.container}>
        {hideChrome ? null : (
          <View style={styles.header}>
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Loading...</Text>
          </View>
        )}
      </View>
    );
  }

  const deliveryMode = isDeliveryLead(lead as any);
  const statusForUi = deliveryMode
    ? String((tracking as any)?.drop_status || (lead as any)?.status || '')
    : String((tracking as any)?.pickup_status || (lead as any)?.status || '');

  const observationRequired = !deliveryMode && !!(lead as any)?.pickup_observation_required;
  const observationDone = !!String((lead as any)?.pickup_observation || '').trim();

  return (
    <View style={styles.container}>
      {hideChrome ? null : (
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{deliveryMode ? 'Delivery Details' : 'Pickup Details'}</Text>
        </View>
      )}

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
                { backgroundColor: getStatusColor(statusForUi) },
              ]}
            >
              <Text style={styles.statusText}>
                {getStatusLabel(statusForUi)}
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
          <Text style={styles.sectionTitle}>📍 {deliveryMode ? 'Customer Location' : 'Pickup Information'}</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Address:</Text>
            <Text style={styles.detailValue}>{(tracking as any)?.pickup_address || (lead as any)?.customer_address || '-'}</Text>
          </View>
          {!!(tracking as any)?.pickup_distance && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Distance:</Text>
              <Text style={styles.detailValue}>
                {(tracking as any).pickup_distance.toFixed(1)} km
              </Text>
            </View>
          )}
          {!!(tracking as any)?.pickup_time_window_start && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Pickup Window:</Text>
              <Text style={styles.detailValue}>
                {formatTime12h((tracking as any).pickup_time_window_start)} -{' '}
                {formatTime12h((tracking as any).pickup_time_window_end!)}
              </Text>
            </View>
          )}
          {!!(tracking as any)?.pickup_customer_instructions && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Instructions:</Text>
              <Text style={styles.detailValue}>
                {(tracking as any).pickup_customer_instructions}
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

        {/* Status Timeline */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📋 Status Timeline</Text>
          {!tracking ? (
            <Text style={styles.infoText}>No tracking yet. Tap “Start / Navigate” to begin.</Text>
          ) : (
          <View style={styles.timeline}>
            <View
              style={[
                styles.timelineItem,
                (tracking as any).pickup_assigned_at && styles.timelineItemCompleted,
              ]}
            >
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Assigned</Text>
                {(tracking as any).pickup_assigned_at && (
                  <Text style={styles.timelineTime}>
                    {formatDateTime((tracking as any).pickup_assigned_at)}
                  </Text>
                )}
              </View>
            </View>

            <View
              style={[
                styles.timelineItem,
                (tracking as any).pickup_start_time && styles.timelineItemCompleted,
              ]}
            >
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Pickup Started</Text>
                {(tracking as any).pickup_start_time && (
                  <Text style={styles.timelineTime}>
                    {formatDateTime((tracking as any).pickup_start_time)}
                  </Text>
                )}
              </View>
            </View>

            <View
              style={[
                styles.timelineItem,
                ((tracking as any).pickup_otp_verified_at || (tracking as any).drop_otp_verified_at) && styles.timelineItemCompleted,
              ]}
            >
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>OTP Verified</Text>
                {((tracking as any).pickup_otp_verified_at || (tracking as any).drop_otp_verified_at) && (
                  <Text style={styles.timelineTime}>
                    {formatDateTime(((tracking as any).drop_otp_verified_at || (tracking as any).pickup_otp_verified_at) as any)}
                  </Text>
                )}
              </View>
            </View>

            <View
              style={[
                styles.timelineItem,
                (tracking as any).pickup_picked_time && styles.timelineItemCompleted,
              ]}
            >
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Vehicle Picked</Text>
                {(tracking as any).pickup_picked_time && (
                  <Text style={styles.timelineTime}>
                    {formatDateTime((tracking as any).pickup_picked_time)}
                  </Text>
                )}
              </View>
            </View>

            <View
              style={[
                styles.timelineItem,
                (tracking as any).pickup_arrival_time && styles.timelineItemCompleted,
              ]}
            >
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Arrived at Workshop</Text>
                {(tracking as any).pickup_arrival_time && (
                  <Text style={styles.timelineTime}>
                    {formatDateTime((tracking as any).pickup_arrival_time)}
                  </Text>
                )}
              </View>
            </View>
          </View>
          )}
        </View>

        {/* Action Buttons */}
        {observationRequired && !observationDone && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>📝 Observation (Required)</Text>
            <Text style={{ color: COLORS.gray[700], marginBottom: SPACING.sm }}>
              Submit observation report to continue.
            </Text>
            <TextInput
              style={styles.observationInput}
              value={observationText}
              onChangeText={setObservationText}
              placeholder="Write observation (vehicle condition, issues, notes)..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: COLORS.primary, marginTop: SPACING.sm },
                savingObservation && { opacity: 0.7 },
              ]}
              onPress={submitObservation}
              disabled={savingObservation}
            >
              <Text style={styles.actionButtonText}>
                {savingObservation ? 'Saving...' : 'Submit Observation'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.actionsContainer}>{renderActionButton()}</View>

        {/* Report Incident Button */}
        <TouchableOpacity
          style={[styles.secondaryButton, { backgroundColor: COLORS.danger }]}
          onPress={onReportIncident || (() => (navigation as any).navigate?.('PickupIncident', { leadId }))}
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
  observationInput: {
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    minHeight: 90,
    fontSize: FONT_SIZES.sm,
    color: COLORS.heading,
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

