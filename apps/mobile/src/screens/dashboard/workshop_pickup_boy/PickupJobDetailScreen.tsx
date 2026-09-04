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
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../constants/theme';
import { AC } from '../../../components/workshop/advisorCrmUi';
import type { PickupTracking, ServiceLead } from '../../../../../shared/types';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ENV } from '../../../config/environment';
import { openInAppPickupNavigation, resolvePickupNavFromLead } from '../../../lib/pickupNavigation';
import * as Location from 'expo-location';
import { useNotifications } from '../../../context/NotificationContext';
import { isDeliveryJob } from '../../../lib/pickupTaskFlow';

function asDeliveryLead(lead: any, tracking: any) {
  return {
    ...lead,
    drop_assigned_to: tracking?.drop_assigned_to ?? lead?.drop_assigned_to,
    drop_status: tracking?.drop_status ?? lead?.drop_status,
    drop_otp_verified_at: tracking?.drop_otp_verified_at ?? lead?.drop_otp_verified_at,
    drop_completed_time: tracking?.drop_completed_time ?? lead?.drop_completed_time,
  };
}

function isDummyPickupLead(lead: any): boolean {
  const num = String(lead?.lead_number || '').toUpperCase();
  return num.startsWith('L-DUM') || lead?.created_from === 'DUMMY_SEED';
}

function getPickupFlowState(lead: any, tracking: any, pickupPhotoCount: number) {
  const ld = lead || {};
  const tr = tracking || {};
  const dummy = isDummyPickupLead(ld);
  const trackingStatus = String(tr.pickup_status || '').toUpperCase();
  const leadPickupStatus = String(ld.pickup_status || '').toUpperCase();
  const leadStatus = String(ld.status || '').toUpperCase();
  const pickupStatus = trackingStatus || leadPickupStatus || leadStatus;

  const WORKSHOP_STATUSES = ['VEHICLE_DROPPED_AT_WORKSHOP', 'ARRIVED_AT_WORKSHOP', 'DROPPED'];
  const otpVerified =
    !!(tr.pickup_otp_verified_at || ld.pickup_otp_verified_at) ||
    ['OTP_VERIFIED', 'VEHICLE_IN_TRANSIT', ...WORKSHOP_STATUSES].includes(pickupStatus) ||
    WORKSHOP_STATUSES.includes(leadStatus);
  const vehiclePicked =
    !!tr.pickup_picked_time ||
    ['VEHICLE_IN_TRANSIT', 'PICKED_UP', 'PICKED', ...WORKSHOP_STATUSES].includes(pickupStatus) ||
    ['VEHICLE_IN_TRANSIT', ...WORKSHOP_STATUSES].includes(leadStatus);
  const atWorkshop =
    !!tr.pickup_arrival_time ||
    !!ld.pickup_arrival_time ||
    WORKSHOP_STATUSES.includes(trackingStatus) ||
    WORKSHOP_STATUSES.includes(leadPickupStatus) ||
    WORKSHOP_STATUSES.includes(leadStatus);
  const started =
    ['ON_THE_WAY', 'OTP_VERIFIED', 'VEHICLE_IN_TRANSIT', 'IN_TRANSIT', 'PICKED_UP', 'PICKED', ...WORKSHOP_STATUSES].includes(
      pickupStatus,
    ) || !!tr.pickup_start_time;
  return {
    pickupStatus,
    otpVerified,
    vehiclePicked,
    atWorkshop,
    started,
    photosOk: dummy || pickupPhotoCount >= 4,
    isDummy: dummy,
  };
}

export default function PickupJobDetailScreen(props: any) {
  const hideChrome = !!(props as any)?.hideChrome;
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
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

  useFocusEffect(
    React.useCallback(() => {
      if (leadId) {
        void fetchLeadDetails();
        void fetchPhotoCount();
      }
    }, [leadId]),
  );

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

        const isDelivery = isDeliveryJob(asDeliveryLead(lead, tracking));
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
    const deliveryMode = isDeliveryJob(asDeliveryLead(lead, tracking));
    const ok = openInAppPickupNavigation(
      navigation,
      resolvePickupNavFromLead(lead, tracking, deliveryMode),
    );
    if (!ok) {
      Alert.alert('Address missing', 'No location available for navigation.');
    }
  };

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
    if (!res.ok) throw new Error(json?.details || json?.error || 'Request failed');
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
      const delivery = isDeliveryJob(asDeliveryLead(lead, tracking));
      await postJson(delivery ? `/api/pickup/tasks/${leadId}/drop/start` : `/api/pickup/${leadId}/navigate`, {});
      Alert.alert('Success', delivery ? 'Delivery started. OTP generated.' : 'Started. OTP generated (if applicable).');
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
      READY_FOR_DELIVERY: COLORS.info,
      ASSIGNED: COLORS.info,
      OUT_FOR_DELIVERY: COLORS.primary,
      DELIVERED: COLORS.success,
      FAILED_PICKUP: COLORS.danger,
    };
    return statusMap[status] || COLORS.gray[500];
  };

  const getStatusLabel = (status: string) => {
    const labelMap: Record<string, string> = {
      NOT_ASSIGNED: 'Not Assigned',
      ON_THE_WAY: 'On the way',
      PENDING: 'Pickup Pending',
      OTP_VERIFIED: 'OTP Verified',
      PICKED: 'Vehicle Picked',
      IN_TRANSIT: 'In Transit',
      ARRIVED_AT_WORKSHOP: 'Arrived at Workshop',
      DROPPED: 'Dropped',
      FAILED_PICKUP: 'Failed',
      READY_FOR_DELIVERY: 'Ready for Delivery',
      OUT_FOR_DELIVERY: 'Out for Delivery',
      ARRIVED_AT_CUSTOMER: 'At Customer',
      DELIVERED: 'Delivered',
      ASSIGNED: 'Assigned',
    };
    return labelMap[status] || status;
  };

  const renderFlowSteps = (
    steps: { key: string; label: string; done: boolean; onPress?: () => void }[],
  ) => {
    return (
      <View style={styles.stepRow}>
        {steps.map((s, i) => {
          const inner = (
            <>
              <View style={[styles.stepDot, s.done && styles.stepDotDone]}>
                <Text style={[styles.stepDotTxt, s.done && styles.stepDotTxtDone]}>
                  {s.done ? '✓' : i + 1}
                </Text>
              </View>
              <Text style={[styles.stepLab, s.done && styles.stepLabDone]}>{s.label}</Text>
            </>
          );
          if (s.onPress) {
            return (
              <TouchableOpacity
                key={s.key}
                style={styles.stepItem}
                onPress={s.onPress}
                activeOpacity={0.75}
              >
                {inner}
              </TouchableOpacity>
            );
          }
          return (
            <View key={s.key} style={styles.stepItem}>
              {inner}
            </View>
          );
        })}
      </View>
    );
  };

  const renderActionButton = () => {
    if (!lead) return null;

    const ld = lead as any;
    const tr = tracking as any;
    const isDelivery = isDeliveryJob(asDeliveryLead(ld, tr));
    const dropStatus = String(tr?.drop_status || '').toUpperCase();
    const leadStatus = String(ld?.status || '').toUpperCase();
    const dropOtpVerified = !!(tr?.drop_otp_verified_at || ld?.drop_otp_verified_at);
    const dropDone =
      dropOtpVerified ||
      dropStatus === 'DELIVERED' ||
      Boolean(tr?.drop_completed_time) ||
      leadStatus === 'DELIVERED' ||
      leadStatus === 'DELIVERED_TO_CUSTOMER';
    const dropStarted = Boolean(tr?.drop_start_time) || Boolean(dropStatus);
    const flow = getPickupFlowState(ld, tr, pickupPhotoCount);
    const otpVerified = isDelivery ? dropOtpVerified : flow.otpVerified;
    const minPhotosOk = isDelivery ? isDummyPickupLead(ld) || dropPhotoCount >= 3 : flow.photosOk;

    if (isDelivery) {
      const goDropOtp = () => {
        if (onVerifyOTP) {
          onVerifyOTP();
          return;
        }
        (navigation as any).navigate?.('PickupOtp', { leadId, otpType: 'DROP' });
      };
      return (
        <View style={AC.whiteCard}>
          <Text style={styles.nextTitle}>Delivery steps</Text>
          {renderFlowSteps([
            { key: 'nav', label: 'Navigate', done: dropStarted || dropDone },
            { key: 'otp', label: 'OTP', done: dropOtpVerified || dropDone, onPress: goDropOtp },
            { key: 'photos', label: 'Photos', done: minPhotosOk || dropDone },
            { key: 'done', label: 'Delivered', done: dropDone },
          ])}

          {dropDone ? (
            <View style={styles.doneBanner}>
              <Text style={styles.doneBannerTxt}>✓ Delivered to customer</Text>
            </View>
          ) : (
            <>
              {!dropStarted && (
                <TouchableOpacity
                  style={[styles.flowBtn, { backgroundColor: COLORS.primary }]}
                  onPress={onNavigate || handleStartNavigateFlow}
                >
                  <Text style={styles.flowBtnTxt}>Start Delivery / Navigate</Text>
                </TouchableOpacity>
              )}
              {dropStarted && !otpVerified && (
                <TouchableOpacity
                  style={[styles.flowBtn, { backgroundColor: '#0284C7' }]}
                  onPress={goDropOtp}
                >
                  <Text style={styles.flowBtnTxt}>Verify Delivery OTP</Text>
                </TouchableOpacity>
              )}
              {otpVerified && (
                <>
                  <TouchableOpacity
                    style={[styles.flowBtn, { backgroundColor: '#EA580C' }]}
                    onPress={
                      onUploadPhotos ||
                      (() =>
                        (navigation as any).navigate?.('PickupPhotoUpload', {
                          leadId,
                          photoCategory: 'DROP',
                        }))
                    }
                  >
                    <Text style={styles.flowBtnTxt}>
                      Upload Delivery Photos ({dropPhotoCount}/3+) • Receiver ({dropHandoverPhotoCount}/1)
                    </Text>
                  </TouchableOpacity>
                  {minPhotosOk ? (
                    <TouchableOpacity
                      style={[styles.flowBtn, { backgroundColor: COLORS.success }]}
                      onPress={handleCompleteDelivery}
                    >
                      <Text style={styles.flowBtnTxt}>Complete Delivery</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.flowHint}>Upload delivery photos, then complete delivery</Text>
                  )}
                </>
              )}
            </>
          )}
        </View>
      );
    }

    const goOtp = () => {
      if (onVerifyOTP) {
        onVerifyOTP();
        return;
      }
      (navigation as any).navigate?.('PickupOtp', { leadId, otpType: 'PICKUP' });
    };

    return (
      <View style={AC.whiteCard}>
        <Text style={styles.nextTitle}>Next Steps</Text>
        {renderFlowSteps([
          { key: 'nav', label: 'Navigate', done: flow.started },
          { key: 'otp', label: 'OTP', done: flow.otpVerified, onPress: goOtp },
          { key: 'photos', label: 'Photos', done: flow.photosOk },
          { key: 'workshop', label: 'Workshop', done: flow.atWorkshop },
        ])}

        {!otpVerified && (
          <>
            <TouchableOpacity
              style={[styles.flowBtn, { backgroundColor: COLORS.primary }]}
              onPress={onStartPickup || handleStartNavigateFlow}
            >
              <Text style={styles.flowBtnTxt}>Start Pickup / Navigate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.flowBtn, { backgroundColor: '#0284C7' }]}
              onPress={goOtp}
            >
              <Text style={styles.flowBtnTxt}>Verify Pickup OTP</Text>
            </TouchableOpacity>
          </>
        )}

        {otpVerified && !flow.vehiclePicked && (
          <>
            <TouchableOpacity
              style={[styles.flowBtn, { backgroundColor: '#EA580C' }]}
              onPress={
                onUploadPhotos ||
                (() => (navigation as any).navigate?.('PickupPhotoUpload', { leadId, photoCategory: 'PICKUP' }))
              }
            >
              <Text style={styles.flowBtnTxt}>
                Upload Vehicle Photos ({pickupPhotoCount}/4 min)
              </Text>
            </TouchableOpacity>
            {minPhotosOk ? (
              <TouchableOpacity
                style={[styles.flowBtn, { backgroundColor: COLORS.success }]}
                onPress={onMarkPicked || handleMarkPicked}
              >
                <Text style={styles.flowBtnTxt}>Mark Vehicle Picked</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.flowHint}>
                {flow.isDummy
                  ? 'Dummy lead — photos optional; tap Mark Vehicle Picked when ready'
                  : 'Minimum 4 photos uploaded (server) — then mark picked'}
              </Text>
            )}
          </>
        )}

        {otpVerified && flow.vehiclePicked && !flow.atWorkshop && (
          <TouchableOpacity
            style={[styles.flowBtn, { backgroundColor: COLORS.primary }]}
            onPress={handleArrivedAtWorkshop}
          >
            <Text style={styles.flowBtnTxt}>🏁 Mark Arrived at Workshop</Text>
          </TouchableOpacity>
        )}

        {flow.atWorkshop && (
          <View style={styles.doneBanner}>
            <Text style={styles.doneBannerTxt}>✓ Vehicle dropped at workshop</Text>
          </View>
        )}
      </View>
    );
  };

  if (!leadId || !lead) {
    return (
      <View style={styles.container}>
        {hideChrome ? (
          <TouchableOpacity onPress={onBack} style={styles.shellBack}>
            <Text style={styles.shellBackTxt}>← Back</Text>
          </TouchableOpacity>
        ) : (
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

  const deliveryMode = isDeliveryJob(asDeliveryLead(lead as any, tracking as any));
  const ld = lead as any;
  const tr = tracking as any;
  const statusForUi = deliveryMode
    ? String(
        tr?.drop_status ||
          (tr?.drop_otp_verified_at || String(ld?.status || '').toUpperCase() === 'DELIVERED'
            ? 'DELIVERED'
            : ld?.status) ||
          'READY_FOR_DELIVERY',
      ).toUpperCase()
    : String(tr?.pickup_status || ld?.status || '');

  const observationRequired = !deliveryMode && !!(lead as any)?.pickup_observation_required;
  const observationDone = !!String((lead as any)?.pickup_observation || '').trim();

  return (
    <View style={styles.container}>
      {hideChrome ? null : (
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{deliveryMode ? 'Delivery Details' : 'Task Details'}</Text>
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {hideChrome ? (
          <TouchableOpacity onPress={onBack} style={styles.shellBack}>
            <Text style={styles.shellBackTxt}>← Back</Text>
          </TouchableOpacity>
        ) : null}

        {/* Hero — advisor navy card */}
        <View style={[AC.navy, { marginBottom: 16 }]}>
          <View style={AC.navyRow}>
            <Text style={AC.navyName} numberOfLines={1}>
              {lead.customer_name || 'Customer'}
            </Text>
            <View style={AC.navyBadge}>
              <Text style={AC.navyBadgeTxt}>{getStatusLabel(statusForUi).toUpperCase()}</Text>
            </View>
          </View>
          <Text style={AC.navyMeta}>Lead #{lead.lead_number}</Text>
          <Text style={AC.navyMeta}>
            {lead.vehicle_number || '—'}
            {lead.vehicle_make ? ` · ${lead.vehicle_make} ${lead.vehicle_model || ''}` : ''}
          </Text>
          {lead.service_type ? <Text style={AC.navyMeta}>{lead.service_type}</Text> : null}
          {lead.customer_phone ? (
            <TouchableOpacity onPress={handleCallCustomer} style={styles.heroCallBtn}>
              <Text style={AC.navyBtnTxt}>Call Customer</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Next steps — right after hero so pickup boy sees what to do */}
        {observationRequired && !observationDone ? (
          <View style={AC.whiteCard}>
            <Text style={styles.nextTitle}>📝 Observation (Required)</Text>
            <Text style={styles.flowHint}>Submit observation report to continue.</Text>
            <TextInput
              style={styles.observationInput}
              value={observationText}
              onChangeText={setObservationText}
              placeholder="Vehicle condition, issues, notes..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.flowBtn, { backgroundColor: COLORS.primary, marginTop: SPACING.sm }]}
              onPress={submitObservation}
              disabled={savingObservation}
            >
              <Text style={styles.flowBtnTxt}>
                {savingObservation ? 'Saving...' : 'Submit Observation'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          renderActionButton()
        )}

        <Text style={[AC.section, styles.detailsHeading]}>Details</Text>

        {/* Customer Details */}
        <View style={AC.whiteCard}>
          <Text style={styles.cardTitle}>Customer</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Name</Text>
            <Text style={styles.detailValue} numberOfLines={2}>
              {lead.customer_name}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Phone</Text>
            <TouchableOpacity onPress={handleCallCustomer} style={styles.detailValueTouch}>
              <Text style={[styles.detailValue, styles.linkText]}>{lead.customer_phone}</Text>
            </TouchableOpacity>
          </View>
          {lead.customer_email && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email</Text>
              <Text style={styles.detailValue} numberOfLines={2}>
                {lead.customer_email}
              </Text>
            </View>
          )}
        </View>

        {/* Vehicle Details */}
        <View style={AC.whiteCard}>
          <Text style={styles.cardTitle}>Vehicle</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Registration</Text>
            <Text style={styles.detailValue}>{lead.vehicle_number}</Text>
          </View>
          {lead.vehicle_make && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Make/Model</Text>
              <Text style={styles.detailValue} numberOfLines={2}>
                {lead.vehicle_make} {lead.vehicle_model}
              </Text>
            </View>
          )}
          {lead.service_type && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Service</Text>
              <Text style={styles.detailValue} numberOfLines={2}>
                {lead.service_type}
              </Text>
            </View>
          )}
        </View>

        {/* Pickup Information */}
        <View style={AC.whiteCard}>
          <View style={styles.locationHead}>
            <Text style={[styles.cardTitle, styles.locationTitle]} numberOfLines={2}>
              {deliveryMode ? 'Delivery Location' : 'Pickup Location'}
            </Text>
            <TouchableOpacity
              style={styles.dirBtn}
              onPress={handleNavigateToLocation}
              activeOpacity={0.85}
            >
              <Text style={styles.dirBtnTxt}>🧭 Directions</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Address</Text>
            <Text style={styles.detailValue} numberOfLines={3}>
              {(tracking as any)?.pickup_address || (lead as any)?.customer_address || '-'}
            </Text>
          </View>
          {!!(tracking as any)?.pickup_distance && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Distance</Text>
              <Text style={styles.detailValue}>
                {(tracking as any).pickup_distance.toFixed(1)} km
              </Text>
            </View>
          )}
          {!!(tracking as any)?.pickup_time_window_start && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Window</Text>
              <Text style={styles.detailValue}>
                {formatTime12h((tracking as any).pickup_time_window_start)} -{' '}
                {formatTime12h((tracking as any).pickup_time_window_end!)}
              </Text>
            </View>
          )}
          {!!(tracking as any)?.pickup_customer_instructions && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Notes</Text>
              <Text style={styles.detailValue} numberOfLines={4}>
                {(tracking as any).pickup_customer_instructions}
              </Text>
            </View>
          )}

        </View>

        {/* Status Timeline */}
        <View style={AC.whiteCard}>
          <Text style={styles.cardTitle}>Timeline</Text>
          {deliveryMode ? (
            <View style={styles.timeline}>
              {[
                {
                  title: 'Delivery assigned',
                  done: !!(tr?.drop_assigned_to || tr?.drop_assigned_at),
                  at: tr?.drop_assigned_at,
                },
                {
                  title: 'Out for delivery',
                  done: !!(tr?.drop_start_time || tr?.drop_status),
                  at: tr?.drop_start_time || tr?.drop_out_for_delivery_at,
                },
                {
                  title: 'Delivery OTP verified',
                  done: !!(tr?.drop_otp_verified_at || ld?.drop_otp_verified_at),
                  at: tr?.drop_otp_verified_at || ld?.drop_otp_verified_at,
                },
                {
                  title: 'Delivered to customer',
                  done:
                    String(tr?.drop_status || '').toUpperCase() === 'DELIVERED' ||
                    String(ld?.status || '').toUpperCase() === 'DELIVERED' ||
                    !!tr?.drop_completed_time,
                  at: tr?.drop_completed_time || tr?.drop_otp_verified_at || ld?.delivered_at,
                },
              ].map((step) => (
                <View
                  key={step.title}
                  style={[styles.timelineItem, step.done && styles.timelineItemCompleted]}
                >
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTitle}>{step.title}</Text>
                    {step.at ? (
                      <Text style={styles.timelineTime}>{formatDateTime(step.at)}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : !tracking && !(lead as any)?.pickup_otp_verified_at ? (
            <Text style={styles.infoText}>Start pickup to begin tracking.</Text>
          ) : (
          <View style={styles.timeline}>
            <View
              style={[
                styles.timelineItem,
                (tr?.pickup_assigned_at || ld?.assigned_pickup_boy_id) && styles.timelineItemCompleted,
              ]}
            >
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Assigned</Text>
                {tr?.pickup_assigned_at ? (
                  <Text style={styles.timelineTime}>{formatDateTime(tr.pickup_assigned_at)}</Text>
                ) : null}
              </View>
            </View>

            <View
              style={[
                styles.timelineItem,
                (tr?.pickup_start_time || ['ON_THE_WAY', 'OTP_VERIFIED', 'VEHICLE_IN_TRANSIT'].includes(String(ld?.pickup_status || ld?.status || '').toUpperCase())) &&
                  styles.timelineItemCompleted,
              ]}
            >
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Pickup Started</Text>
                {tr?.pickup_start_time ? (
                  <Text style={styles.timelineTime}>{formatDateTime(tr.pickup_start_time)}</Text>
                ) : null}
              </View>
            </View>

            <View
              style={[
                styles.timelineItem,
                (tr?.pickup_otp_verified_at || ld?.pickup_otp_verified_at) &&
                  styles.timelineItemCompleted,
              ]}
            >
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Pickup OTP Verified</Text>
                {(tr?.pickup_otp_verified_at || ld?.pickup_otp_verified_at) && (
                  <Text style={styles.timelineTime}>
                    {formatDateTime((tr?.pickup_otp_verified_at || ld?.pickup_otp_verified_at) as any)}
                  </Text>
                )}
              </View>
            </View>

            <View
              style={[
                styles.timelineItem,
                tr?.pickup_picked_time && styles.timelineItemCompleted,
              ]}
            >
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Vehicle Picked</Text>
                {tr?.pickup_picked_time ? (
                  <Text style={styles.timelineTime}>{formatDateTime(tr.pickup_picked_time)}</Text>
                ) : null}
              </View>
            </View>

            <View
              style={[
                styles.timelineItem,
                tr?.pickup_arrival_time && styles.timelineItemCompleted,
              ]}
            >
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Arrived at Workshop</Text>
                {tr?.pickup_arrival_time ? (
                  <Text style={styles.timelineTime}>{formatDateTime(tr.pickup_arrival_time)}</Text>
                ) : null}
              </View>
            </View>
          </View>
          )}
        </View>

        {/* Report Incident */}
        <TouchableOpacity
          style={styles.incidentBtn}
          onPress={onReportIncident || (() => (navigation as any).navigate?.('PickupIncident', { leadId }))}
          activeOpacity={0.85}
        >
          <Text style={styles.incidentBtnTxt}>⚠️ Report Incident</Text>
        </TouchableOpacity>

        <View style={{ height: SPACING.xxl + insets.bottom }} />
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
  },
  scrollContent: {
    paddingBottom: SPACING.xxl + 32,
  },
  shellBack: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  shellBackTxt: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '800',
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
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.heading,
    marginBottom: SPACING.sm,
  },
  nextTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.heading,
    marginBottom: SPACING.sm,
  },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    paddingHorizontal: 4,
  },
  stepItem: { alignItems: 'center', flex: 1 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepDotDone: { backgroundColor: COLORS.success },
  stepDotTxt: { fontSize: 12, fontWeight: '800', color: COLORS.gray[600] },
  stepDotTxtDone: { color: COLORS.white },
  stepLab: { fontSize: 10, fontWeight: '700', color: COLORS.gray[500] },
  stepLabDone: { color: COLORS.success },
  flowBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: SPACING.sm,
    ...SHADOWS.small,
  },
  flowBtnTxt: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
    color: COLORS.white,
  },
  flowBtnOutline: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  flowBtnOutlineTxt: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
    color: COLORS.primary,
  },
  flowHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[600],
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  doneBanner: {
    backgroundColor: '#DCFCE7',
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
  },
  doneBannerTxt: {
    color: '#166534',
    fontWeight: '800',
    fontSize: FONT_SIZES.sm,
  },
  heroCallBtn: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  detailsHeading: {
    marginTop: 16,
    marginBottom: 10,
  },
  locationHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: SPACING.sm,
  },
  locationTitle: {
    flex: 1,
    minWidth: 0,
    marginBottom: 0,
  },
  dirBtn: {
    flexShrink: 0,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  dirBtnTxt: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.md,
    marginBottom: SPACING.xs,
    paddingVertical: 3,
  },
  detailLabel: {
    minWidth: 108,
    maxWidth: '42%',
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    fontWeight: '600',
    flexShrink: 0,
  },
  detailValue: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.bodyText,
    textAlign: 'right',
    lineHeight: 18,
  },
  detailValueTouch: {
    flex: 1,
    alignItems: 'flex-end',
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
    marginHorizontal: 16,
  },
  actionsWrap: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 8,
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
  navigateBtn: {
    marginTop: SPACING.md,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.primary,
    ...SHADOWS.small,
  },
  navigateBtnTxt: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
    color: COLORS.primary,
  },
  incidentBtn: {
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: COLORS.danger,
    marginBottom: SPACING.sm,
    ...SHADOWS.small,
  },
  incidentBtnTxt: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
    color: COLORS.white,
  },
});

