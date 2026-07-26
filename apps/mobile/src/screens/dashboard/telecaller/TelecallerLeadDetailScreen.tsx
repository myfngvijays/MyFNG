import React, { useState, useEffect } from 'react';
import { formatDateTime } from "@/lib/dateFormat";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  BackHandler
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
// import { MaterialCommunityIcons } from '@expo/vector-icons'; // Removed - using emojis
import { Icon } from '../../../components/Icon';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { apiFetch } from '../../../lib/api';
import { parseIds } from '../../../lib/parseIds';
import { openPhoneCall, openWhatsApp } from '../../../lib/phone';
import { COLORS, SPACING } from '../../../constants/theme';

const CALL_STATUSES = ['ANSWERED', 'NO_ANSWER', 'BUSY', 'SWITCHED_OFF', 'WRONG_NUMBER'];
const CALL_OUTCOMES = ['INFO_COLLECTED', 'FOLLOW_UP_SCHEDULED', 'NOT_INTERESTED', 'LEAD_CREATED', 'OTHER'];
const NO_OUTCOME_STATUSES = new Set(['SWITCHED_OFF', 'WRONG_NUMBER']);
const FOLLOW_UP_TYPES = ['CALLBACK', 'REMINDER', 'FOLLOW_UP'];
const FOLLOW_UP_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

export default function TelecallerLeadDetailScreen({ route, navigation, embedded = false }: any) {
  const { user } = useAuth();
  const { leadId } = route.params;

  const [lead, setLead] = useState<any>(null);
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCallLogForm, setShowCallLogForm] = useState(false);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [showFollowUpPicker, setShowFollowUpPicker] = useState(false);
  const [serviceTypeNames, setServiceTypeNames] = useState<string[]>([]);
  const [subserviceNames, setSubserviceNames] = useState<string[]>([]);
  const [pricingItems, setPricingItems] = useState<Array<{ name: string; price: number }>>([]);
  const [couponInput, setCouponInput] = useState('');

  const [callLogData, setCallLogData] = useState({
    call_status: 'ANSWERED',
    call_duration: '',
    outcome: 'INFO_COLLECTED',
    notes: ''
  });
  const needsOutcome = !NO_OUTCOME_STATUSES.has(callLogData.call_status);

  const [followUpData, setFollowUpData] = useState({
    follow_up_type: 'CALLBACK',
    scheduled_time: '',
    reason: '',
    priority: 'NORMAL'
  });

  useEffect(() => {
    fetchLeadDetails();
  }, []);

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

  const fetchLeadDetails = async () => {
    try {
      // Fetch lead
      const { data: leadData, error: leadError } = await supabase
        .from('service_leads')
        .select(`
          *,
          workshop:workshops(name, phone, city),
          created_by:created_by_id(full_name),
          assigned_telecaller:assigned_telecaller_id(full_name)
        `)
        .eq('id', leadId)
        .single();

      if (leadError) throw leadError;
      setLead(leadData);

      // Pricing snapshot (line items) for display
      try {
        const { data: priceRows } = await supabase
          .from('lead_pricing_items')
          .select('item_name, total_price, unit_price')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: true });
        setPricingItems(
          (priceRows || []).map((r: any) => ({
            name: String(r.item_name || '').trim(),
            price: Number(r.total_price ?? r.unit_price ?? 0) || 0,
          })).filter((r: any) => r.name),
        );
      } catch {
        setPricingItems([]);
      }

      // Fetch service type names if service_type_ids exists
      if (leadData.service_type_ids) {
        try {
          const serviceIds = parseIds(leadData.service_type_ids);
          if (serviceIds.length > 0) {
            const { data: serviceTypesData } = await supabase
              .from('service_types')
              .select('id, name')
              .in('id', serviceIds);
            
            if (serviceTypesData?.length) {
              const byId = new Map(serviceTypesData.map((st: any) => [String(st.id), String(st.name || '')]));
              setServiceTypeNames(serviceIds.map((id) => byId.get(id) || '').filter(Boolean));
            } else if (leadData.service_type) {
              setServiceTypeNames(
                String(leadData.service_type)
                  .split(',')
                  .map((s: string) => s.trim())
                  .filter(Boolean),
              );
            }
          } else if (leadData.service_type) {
            setServiceTypeNames(
              String(leadData.service_type)
                .split(',')
                .map((s: string) => s.trim())
                .filter(Boolean),
            );
          }
        } catch (e) {
          console.error('Error resolving service_type_ids:', e);
          if (leadData.service_type) {
            setServiceTypeNames(
              String(leadData.service_type)
                .split(',')
                .map((s: string) => s.trim())
                .filter(Boolean),
            );
          }
        }
      } else if (leadData.service_type) {
        setServiceTypeNames(
          String(leadData.service_type)
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean),
        );
      }

      // Fetch subservice names if subservice_ids exists
      if (leadData.subservice_ids) {
        try {
          const subserviceIds = parseIds(leadData.subservice_ids);
          if (subserviceIds.length > 0) {
            const { data: subservicesData } = await supabase
              .from('service_addons')
              .select('id, name')
              .in('id', subserviceIds);
            
            if (subservicesData) {
              setSubserviceNames(subservicesData.map(sa => sa.name));
            }
          }
        } catch (e) {
          console.error('Error resolving subservice_ids:', e);
        }
      }

      // Fetch call logs via API (matches web behavior)
      try {
        const callData = await apiFetch<{ call_logs: any[] }>(`/api/telecaller/calls/${leadId}`);
        setCallLogs(callData.call_logs || []);
      } catch (err) {
        console.error('Error fetching call logs:', err);
        setCallLogs([]);
      }

      // Fetch follow-ups
      const { data: followUpsData } = await supabase
        .from('telecaller_follow_ups')
        .select('*, telecaller:telecaller_id(full_name)')
        .eq('lead_id', leadId)
        .order('scheduled_time', { ascending: false });

      setFollowUps(followUpsData || []);

    } catch (error) {
      console.error('Error fetching lead details:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeadDetails();
  };

  const handleFollowUpDateChange = (_event: any, selectedDate?: Date) => {
    setShowFollowUpPicker(false);
    if (!selectedDate) return;
    setFollowUpData(prev => ({
      ...prev,
      scheduled_time: selectedDate.toISOString(),
    }));
  };

  const handleAddCallLog = async () => {
    try {
      const status = callLogData.call_status;
      const skipOutcome = NO_OUTCOME_STATUSES.has(status);
      await apiFetch('/api/telecaller/calls/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadId,
          call_type: 'OUTBOUND',
          call_status: status,
          call_duration: callLogData.call_duration ? parseInt(callLogData.call_duration) : null,
          outcome: skipOutcome ? null : callLogData.outcome,
          notes: callLogData.notes,
          phone_number: lead?.customer_phone,
        }),
      });

      // Keep booking pipeline status intact; show call attempt on header from call logs
      const nextMeta = {
        ...(lead?.coupon_meta && typeof lead.coupon_meta === 'object' ? lead.coupon_meta : {}),
        last_call_status: status,
        last_call_at: new Date().toISOString(),
      };
      await supabase
        .from('service_leads')
        .update({
          last_call_at: new Date().toISOString(),
          total_calls: (lead?.total_calls || 0) + 1,
          coupon_meta: nextMeta,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);

      setCallLogData({
        call_status: 'ANSWERED',
        call_duration: '',
        outcome: 'INFO_COLLECTED',
        notes: '',
      });
      setShowCallLogForm(false);
      fetchLeadDetails();
      Alert.alert('Saved', `Status updated to ${formatStatusLabel(status)}`);
    } catch (error) {
      console.error('Error adding call log:', error);
      Alert.alert('Error', 'Failed to add call log');
    }
  };

  const handleAddFollowUp = async () => {
    try {
      if (!followUpData.scheduled_time) {
        Alert.alert('Missing time', 'Please select a follow-up time.');
        return;
      }
      const { data: profile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user?.email)
        .single();

      const { error } = await supabase
        .from('telecaller_follow_ups')
        .insert([{
          lead_id: leadId,
          telecaller_id: profile?.id,
          follow_up_type: followUpData.follow_up_type,
          scheduled_time: followUpData.scheduled_time,
          reason: followUpData.reason,
          priority: followUpData.priority,
          status: 'PENDING'
        }]);

      if (!error) {
        await supabase
          .from('service_leads')
          .update({
            follow_up_required: true,
            next_follow_up_at: followUpData.scheduled_time
          })
          .eq('id', leadId);

        setFollowUpData({
          follow_up_type: 'CALLBACK',
          scheduled_time: '',
          reason: '',
          priority: 'NORMAL'
        });
        setShowFollowUpForm(false);
        fetchLeadDetails();
        Alert.alert('Success', 'Follow-up scheduled!');
      }
    } catch (error) {
      console.error('Error adding follow-up:', error);
      Alert.alert('Error', 'Failed to schedule follow-up');
    }
  };

  const handleOpenWhatsApp = async () => {
    const ok = await openWhatsApp(lead?.customer_phone);
    if (!ok) {
      Alert.alert('WhatsApp', 'Could not open WhatsApp. Check the phone number.');
    }
  };

  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      Alert.alert('Coupon', 'Enter a coupon code');
      return;
    }
    try {
      await apiFetch(`/api/telecaller/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: lead.customer_name,
          customer_phone: lead.customer_phone,
          customer_alternate_phone: lead.customer_alternate_phone,
          customer_email: lead.customer_email,
          customer_address: lead.customer_address,
          city_id: lead.city_id,
          city: lead.city,
          pincode: lead.pincode,
          vehicle_number: lead.vehicle_number,
          vehicle_make: lead.vehicle_make,
          model_id: lead.model_id,
          vehicle_model: lead.vehicle_model,
          vehicle_variant: lead.vehicle_variant,
          vehicle_year: lead.vehicle_year,
          vehicle_fuel_type: lead.vehicle_fuel_type,
          odometer_km: lead.odometer_km,
          service_types: parseIds(lead.service_type_ids),
          service_addons: parseIds(lead.subservice_ids),
          service_type: lead.service_type,
          problem_description: lead.problem_description,
          description: lead.description,
          pickup_required: lead.pickup_required,
          pickup_address: lead.pickup_address,
          notes: lead.notes,
          lead_priority: lead.lead_priority,
          coupon_codes: [code],
          applied_coupon: code,
        }),
      });
      setCouponInput('');
      await fetchLeadDetails();
      Alert.alert('Success', 'Coupon applied');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to apply coupon');
    }
  };

  const handleRemoveCoupon = async () => {
    try {
      await apiFetch(`/api/telecaller/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: lead.customer_name,
          customer_phone: lead.customer_phone,
          customer_alternate_phone: lead.customer_alternate_phone,
          customer_email: lead.customer_email,
          customer_address: lead.customer_address,
          city_id: lead.city_id,
          city: lead.city,
          pincode: lead.pincode,
          vehicle_number: lead.vehicle_number,
          vehicle_make: lead.vehicle_make,
          model_id: lead.model_id,
          vehicle_model: lead.vehicle_model,
          vehicle_variant: lead.vehicle_variant,
          vehicle_year: lead.vehicle_year,
          vehicle_fuel_type: lead.vehicle_fuel_type,
          odometer_km: lead.odometer_km,
          service_types: parseIds(lead.service_type_ids),
          service_addons: parseIds(lead.subservice_ids),
          service_type: lead.service_type,
          problem_description: lead.problem_description,
          description: lead.description,
          pickup_required: lead.pickup_required,
          pickup_address: lead.pickup_address,
          notes: lead.notes,
          lead_priority: lead.lead_priority,
          coupon_codes: [],
          applied_coupon: '',
        }),
      });
      await fetchLeadDetails();
      Alert.alert('Removed', 'Coupon removed');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to remove coupon');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading lead details...</Text>
      </View>
    );
  }

  if (!lead) {
    return (
      <View style={styles.loadingContainer}>
        <Icon name="alert-circle" size={64} color={COLORS.red} />
        <Text style={styles.errorText}>Lead not found</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      {/* Header with Back Button */}
      <View style={[styles.headerBar, embedded && styles.headerBarEmbedded]}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation?.goBack()}
        >
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerBarTitle}>Lead Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {(() => {
          const headerStatus =
            callLogs[0]?.call_status ||
            lead?.coupon_meta?.last_call_status ||
            lead.status;
          const badge = getCallStatusBadge(headerStatus);
          return (
            <View style={styles.header}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.headerTitle}>{lead.customer_name}</Text>
                <Text style={styles.headerSubtitle}>Lead #{lead.lead_number}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.statusText, { color: badge.fg }]}>
                  {formatStatusLabel(headerStatus)}
                </Text>
              </View>
            </View>
          );
        })()}

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonPrimary]}
          onPress={() => openPhoneCall(lead.customer_phone)}
        >
          <Icon name="phone" size={18} color="#fff" />
          <Text style={styles.actionButtonTextPrimary}>Call</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={handleOpenWhatsApp}
        >
          <Icon name="whatsapp" size={18} color={COLORS.green} />
          <Text style={styles.actionButtonTextSecondary}>WhatsApp</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonEdit]}
          onPress={() => navigation.navigate('TelecallerEditLead', { leadId })}
        >
          <Icon name="pencil" size={16} color={COLORS.primary} />
          <Text style={styles.actionButtonTextEdit}>Edit</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <View style={[styles.statIconWrap, { backgroundColor: COLORS.primary + '15' }]}>
            <Icon name="phone" size={18} color={COLORS.primary} />
          </View>
          <Text style={styles.statValue}>{lead.total_calls || 0}</Text>
          <Text style={styles.statLabel}>Total Calls</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <View style={[styles.statIconWrap, { backgroundColor: COLORS.orange + '15' }]}>
            <Icon name="priority-high" size={18} color={COLORS.orange} />
          </View>
          <Text style={styles.statValue} numberOfLines={1}>{lead.lead_priority || 'NORMAL'}</Text>
          <Text style={styles.statLabel}>Priority</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <View style={[styles.statIconWrap, { backgroundColor: COLORS.blue + '15' }]}>
            <Icon name="source-branch" size={18} color={COLORS.blue} />
          </View>
          <Text style={styles.statValue} numberOfLines={2}>
            {formatLeadSource(lead.lead_source || lead.created_from)}
          </Text>
          <Text style={styles.statLabel}>Source</Text>
        </View>
      </View>

      {/* Coupon CRM */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Coupon</Text>
        <View style={styles.sectionContent}>
          {(() => {
            const code = String(
              lead?.coupon_code ?? lead?.coupon ?? lead?.applied_coupon_code ?? ''
            ).trim();
            if (code) {
              return (
                <View style={styles.couponBanner}>
                  <View style={styles.couponHeader}>
                    <Text style={styles.couponTitle}>Applied</Text>
                    <Text style={styles.couponCode}>{code}</Text>
                  </View>
                  <TouchableOpacity onPress={handleRemoveCoupon}>
                    <Text style={{ color: COLORS.red, fontWeight: '600', fontSize: 12, marginTop: 6 }}>
                      Remove coupon
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }
            return (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Enter coupon code"
                  value={couponInput}
                  onChangeText={setCouponInput}
                  autoCapitalize="characters"
                  placeholderTextColor={COLORS.textSecondary}
                />
                <TouchableOpacity
                  style={[styles.formButton, styles.formButtonPrimary, { flex: 0, paddingHorizontal: 16 }]}
                  onPress={handleApplyCoupon}
                >
                  <Text style={styles.formButtonTextPrimary}>Apply</Text>
                </TouchableOpacity>
              </View>
            );
          })()}
        </View>
      </View>

      {/* Customer Information */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={[styles.sectionIconWrap, { backgroundColor: '#DBEAFE' }]}>
            <Icon name="account" size={16} color={COLORS.primary} />
          </View>
          <Text style={styles.sectionTitle}>Customer</Text>
        </View>
        <View style={styles.sectionContent}>
          <DetailRow icon="account" label="Name" value={lead.customer_name} />
          <View style={styles.detailGrid}>
            <DetailRow icon="phone" label="Phone" value={lead.customer_phone} compact />
            {lead.customer_alternate_phone ? (
              <DetailRow icon="phone-plus" label="Alternate" value={lead.customer_alternate_phone} compact />
            ) : (
              <View style={{ flex: 1 }} />
            )}
          </View>
          {lead.customer_email ? (
            <DetailRow icon="email" label="Email" value={lead.customer_email} />
          ) : null}
          {(lead.pickup_address || lead.customer_address) ? (
            <DetailRow
              icon="map-marker"
              label="Address"
              value={formatLeadAddress(lead.pickup_address || lead.customer_address, lead.city, lead.pincode)}
            />
          ) : null}
          <View style={styles.detailGrid}>
            <DetailRow icon="city" label="City" value={lead.city || '—'} compact />
            <DetailRow icon="map-marker-radius" label="Pincode" value={lead.pincode ? String(lead.pincode) : '—'} compact />
          </View>
        </View>
      </View>

      {/* Vehicle Information */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={[styles.sectionIconWrap, { backgroundColor: '#E0E7FF' }]}>
            <Icon name="car" size={16} color={COLORS.indigo} />
          </View>
          <Text style={styles.sectionTitle}>Vehicle</Text>
        </View>
        <View style={styles.sectionContent}>
          <DetailRow icon="car" label="Registration" value={lead.vehicle_number || 'Not provided'} />
          <View style={styles.detailGrid}>
            <DetailRow icon="car-side" label="Make" value={lead.vehicle_make || '—'} compact />
            <DetailRow icon="car-info" label="Model" value={lead.vehicle_model || '—'} compact />
          </View>
          <View style={styles.detailGrid}>
            <DetailRow icon="gas-station" label="Fuel" value={lead.vehicle_fuel_type || '—'} compact />
            <DetailRow
              icon="calendar"
              label="Year"
              value={lead.vehicle_year ? String(lead.vehicle_year) : '—'}
              compact
            />
          </View>
          {lead.vehicle_variant ? (
            <DetailRow icon="tag" label="Variant" value={lead.vehicle_variant} />
          ) : null}
        </View>
      </View>

      {/* Service Details */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={[styles.sectionIconWrap, { backgroundColor: '#D1FAE5' }]}>
            <Icon name="wrench" size={16} color={COLORS.green} />
          </View>
          <Text style={styles.sectionTitle}>Service & Price</Text>
        </View>
        <View style={styles.sectionContent}>
          {(() => {
            const estimated = Number(lead.estimated_amount || 0) || 0;
            const discount = Number(lead.discount_amount || 0) || 0;
            const payable = Math.max(0, estimated);
            const lineSum = pricingItems.reduce((s, i) => s + (Number(i.price) || 0), 0);
            const showAmount = estimated > 0 || lineSum > 0;
            if (!showAmount) {
              return (
                <View style={styles.priceEmpty}>
                  <Text style={styles.priceEmptyText}>Price not set yet — edit lead to refresh quote</Text>
                </View>
              );
            }
            return (
              <View style={styles.priceCard}>
                <View style={styles.priceCardTop}>
                  <Text style={styles.priceCardLabel}>Booking amount</Text>
                  <Text style={styles.priceCardValue}>
                    ₹{(estimated > 0 ? estimated : lineSum).toLocaleString('en-IN')}
                  </Text>
                </View>
                {discount > 0 ? (
                  <View style={styles.priceMetaRow}>
                    <Text style={styles.priceMetaLabel}>Discount</Text>
                    <Text style={[styles.priceMetaValue, { color: COLORS.green }]}>
                      −₹{discount.toLocaleString('en-IN')}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.priceMetaRow}>
                  <Text style={styles.priceMetaLabel}>Payable</Text>
                  <Text style={styles.pricePayable}>
                    ₹{(estimated > 0 ? payable : Math.max(0, lineSum - discount)).toLocaleString('en-IN')}
                  </Text>
                </View>
                {lead.payment_mode ? (
                  <Text style={styles.priceMode}>{formatPaymentMode(lead.payment_mode)}</Text>
                ) : null}
              </View>
            );
          })()}

          <Text style={styles.fieldCaption}>Packages</Text>
          {serviceTypeNames.length > 0 ? (
            <View style={styles.tagsContainer}>
              {serviceTypeNames.map((name, idx) => (
                <View key={`${name}-${idx}`} style={[styles.tag, styles.tagBlue]}>
                  <Text style={styles.tagText}>{name}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.mutedValue}>Not specified</Text>
          )}

          {pricingItems.length > 0 ? (
            <View style={styles.lineItemsBox}>
              {pricingItems.map((item, idx) => (
                <View key={`${item.name}-${idx}`} style={styles.lineItemRow}>
                  <Text style={styles.lineItemName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.lineItemPrice}>
                    {item.price > 0 ? `₹${item.price.toLocaleString('en-IN')}` : '—'}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {subserviceNames.length > 0 ? (
            <>
              <Text style={[styles.fieldCaption, { marginTop: 12 }]}>Add-ons</Text>
              <View style={styles.tagsContainer}>
                {subserviceNames.map((name, idx) => (
                  <View key={`${name}-${idx}`} style={[styles.tag, styles.tagGreen]}>
                    <Text style={styles.tagText}>{name}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {(() => {
            const schedule = formatLeadSchedule(lead);
            if (!schedule) return null;
            return <DetailRow icon="calendar-clock" label="Schedule" value={schedule} />;
          })()}

          <DetailRow
            icon="car-pickup"
            label="Service mode"
            value={lead.pickup_required ? 'Doorstep pickup' : 'Workshop visit'}
          />

          {(() => {
            const notes = String(lead.problem_description || '').trim();
            if (!notes) return null;
            if (/^(pickup|visit)\s*:/i.test(notes) && notes.length < 40) return null;
            return <DetailRow icon="message-text" label="Notes" value={notes} />;
          })()}

          {(() => {
            const code = String(
              lead?.coupon_code ?? lead?.coupon ?? lead?.applied_coupon_code ?? ''
            ).trim();
            const discountAmount =
              Number(lead?.discount_amount ?? lead?.coupon_discount_amount ?? lead?.coupon_discount ?? 0) || 0;
            if (!code) return null;
            return (
              <View style={styles.couponBanner}>
                <View style={styles.couponHeader}>
                  <Text style={styles.couponTitle}>Coupon Applied</Text>
                  <Text style={styles.couponCode}>{code}</Text>
                </View>
                <Text style={styles.couponText}>
                  {discountAmount > 0
                    ? `Discount: ₹${discountAmount.toLocaleString('en-IN')}`
                    : 'Note: Discount will reflect at billing time.'}
                </Text>
              </View>
            );
          })()}
        </View>
      </View>

      {/* Workshop Info */}
      {lead.workshop && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workshop Assigned</Text>
          <View style={styles.sectionContent}>
            <InfoRow icon="store" label="Name" value={lead.workshop.name} />
            <InfoRow icon="map-marker" label="City" value={lead.workshop.city} />
            <InfoRow icon="phone" label="Phone" value={lead.workshop.phone} />
          </View>
        </View>
      )}

      {/* Call History */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Call History ({callLogs.length})</Text>
          <TouchableOpacity
            style={styles.addIconBtn}
            onPress={() => setShowCallLogForm(!showCallLogForm)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="plus-circle" size={26} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {showCallLogForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Add Call Log</Text>
            <Text style={styles.formLabel}>Call Status</Text>
            <View style={styles.chipRow}>
              {CALL_STATUSES.map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.chip,
                    callLogData.call_status === status && styles.chipActive,
                  ]}
                  onPress={() =>
                    setCallLogData({
                      ...callLogData,
                      call_status: status,
                      outcome: NO_OUTCOME_STATUSES.has(status) ? '' : callLogData.outcome || 'INFO_COLLECTED',
                    })
                  }
                >
                  <Text
                    style={[
                      styles.chipText,
                      callLogData.call_status === status && styles.chipTextActive,
                    ]}
                  >
                    {formatStatusLabel(status)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {needsOutcome ? (
              <>
                <Text style={styles.formLabel}>Outcome</Text>
                <View style={styles.chipRow}>
                  {CALL_OUTCOMES.map((outcome) => (
                    <TouchableOpacity
                      key={outcome}
                      style={[
                        styles.chip,
                        callLogData.outcome === outcome && styles.chipActive,
                      ]}
                      onPress={() => setCallLogData({ ...callLogData, outcome })}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          callLogData.outcome === outcome && styles.chipTextActive,
                        ]}
                      >
                        {formatStatusLabel(outcome)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <Text style={styles.outcomeHint}>
                Outcome not needed for {formatStatusLabel(callLogData.call_status)}.
              </Text>
            )}
            <TextInput
              style={styles.input}
              placeholder="Call duration (seconds)"
              value={callLogData.call_duration}
              onChangeText={(value) => setCallLogData({ ...callLogData, call_duration: value })}
              keyboardType="number-pad"
              placeholderTextColor={COLORS.textSecondary}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Notes..."
              value={callLogData.notes}
              onChangeText={(value) => setCallLogData({ ...callLogData, notes: value })}
              multiline
              numberOfLines={3}
              placeholderTextColor={COLORS.textSecondary}
            />
            <View style={styles.formButtons}>
              <TouchableOpacity
                style={[styles.formButton, styles.formButtonPrimary]}
                onPress={handleAddCallLog}
              >
                <Text style={styles.formButtonTextPrimary}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formButton, styles.formButtonSecondary]}
                onPress={() => setShowCallLogForm(false)}
              >
                <Text style={styles.formButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.sectionContent}>
          {callLogs.length === 0 ? (
            <Text style={styles.emptyText}>No call logs yet</Text>
          ) : (
            callLogs.map((log) => (
              <View key={log.id} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <View style={[styles.logBadge, { backgroundColor: getCallStatusColor(log.call_status) }]}>
                    <Text style={styles.logBadgeText}>{formatStatusLabel(log.call_status)}</Text>
                  </View>
                  {log.call_duration && (
                    <Text style={styles.logDuration}>
                      {Math.floor(log.call_duration / 60)}m {log.call_duration % 60}s
                    </Text>
                  )}
                </View>
                {log.notes && <Text style={styles.logNotes}>{log.notes}</Text>}
                <Text style={styles.logTime}>
                  {formatDateTime(log.created_at)}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>

      {/* Follow-ups */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Follow-ups ({followUps.length})</Text>
          <TouchableOpacity
            style={styles.addIconBtn}
            onPress={() => setShowFollowUpForm(!showFollowUpForm)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="plus-circle" size={26} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {showFollowUpForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Schedule Follow-up</Text>
            <Text style={styles.formLabel}>Follow-up Type</Text>
            <View style={styles.chipRow}>
              {FOLLOW_UP_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.chip,
                    followUpData.follow_up_type === type && styles.chipActive,
                  ]}
                  onPress={() => setFollowUpData({ ...followUpData, follow_up_type: type })}
                >
                  <Text
                    style={[
                      styles.chipText,
                      followUpData.follow_up_type === type && styles.chipTextActive,
                    ]}
                  >
                    {type.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.formLabel}>Priority</Text>
            <View style={styles.chipRow}>
              {FOLLOW_UP_PRIORITIES.map((priority) => (
                <TouchableOpacity
                  key={priority}
                  style={[
                    styles.chip,
                    followUpData.priority === priority && styles.chipActive,
                  ]}
                  onPress={() => setFollowUpData({ ...followUpData, priority })}
                >
                  <Text
                    style={[
                      styles.chipText,
                      followUpData.priority === priority && styles.chipTextActive,
                    ]}
                  >
                    {priority}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.formLabel}>Scheduled Time</Text>
            <TouchableOpacity
              style={styles.datetimeButton}
              onPress={() => setShowFollowUpPicker(true)}
            >
              <Text style={styles.datetimeButtonText}>
                {followUpData.scheduled_time
                  ? formatDateTime(followUpData.scheduled_time)
                  : 'Select date & time'}
              </Text>
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Reason..."
              value={followUpData.reason}
              onChangeText={(value) => setFollowUpData({ ...followUpData, reason: value })}
              placeholderTextColor={COLORS.textSecondary}
            />
            <View style={styles.formButtons}>
              <TouchableOpacity
                style={[styles.formButton, styles.formButtonPrimary]}
                onPress={handleAddFollowUp}
              >
                <Text style={styles.formButtonTextPrimary}>Schedule</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formButton, styles.formButtonSecondary]}
                onPress={() => setShowFollowUpForm(false)}
              >
                <Text style={styles.formButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.sectionContent}>
          {followUps.length === 0 ? (
            <Text style={styles.emptyText}>No follow-ups scheduled</Text>
          ) : (
            followUps.map((fu) => (
              <View key={fu.id} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <Text style={styles.followUpType}>{fu.follow_up_type}</Text>
                  <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(fu.priority) }]}>
                    <Text style={styles.priorityText}>{fu.priority}</Text>
                  </View>
                </View>
                <Text style={styles.logNotes}>{fu.reason}</Text>
                <Text style={styles.logTime}>
                  {formatDateTime(fu.scheduled_time)}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>

    {showFollowUpPicker && (
      <DateTimePicker
        value={followUpData.scheduled_time ? new Date(followUpData.scheduled_time) : new Date()}
        mode="datetime"
        display="default"
        onChange={handleFollowUpDateChange}
      />
    )}
    </View>
  );
}

interface DetailRowProps {
  icon: string;
  label: string;
  value: string;
  compact?: boolean;
}

function DetailRow({ icon, label, value, compact }: DetailRowProps) {
  return (
    <View style={[styles.detailRow, compact && styles.detailRowCompact]}>
      <View style={styles.detailIcon}>
        <Icon name={icon as any} size={14} color={COLORS.primary} />
      </View>
      <View style={styles.detailBody}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value || '—'}</Text>
      </View>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return <DetailRow icon={icon} label={label} value={value} />;
}

function formatStatusLabel(raw: string | null | undefined): string {
  return String(raw || '—')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatLeadSource(raw: string | null | undefined): string {
  const v = String(raw || 'N/A').trim();
  if (/whatsapp_meta|instagram ads|facebook ads|meta ads/i.test(v)) return v.replace(/_/g, ' ');
  if (/whatsapp/i.test(v)) return 'WhatsApp';
  if (/telecaller_crm/i.test(v)) return 'CRM Book';
  if (/telecaller/i.test(v)) return 'Telecaller';
  if (/mobile_app|app booking/i.test(v)) return 'App';
  if (/^web$/i.test(v) || /website/i.test(v)) return 'Website';
  return v.replace(/_/g, ' ');
}

function formatPaymentMode(raw: string | null | undefined): string {
  const v = String(raw || '').toUpperCase();
  if (v === 'PAY_LATER') return 'Pay Later';
  if (v === 'PAY_NOW') return 'Pay Now';
  if (v === 'CASH') return 'Cash';
  if (v === 'UPI') return 'UPI';
  if (v === 'ONLINE') return 'Online';
  return String(raw || '').replace(/_/g, ' ');
}

function formatLeadAddress(
  address: string | null | undefined,
  city?: string | null,
  pincode?: string | null,
): string {
  let cleaned = String(address || '')
    .replace(/\s*\((home|work|other)\)/gi, '')
    .replace(/,?\s*Landmark:\s*/gi, ', Near ')
    .replace(/,?\s*PIN\s*(\d{6})/gi, ', $1')
    .replace(/,{2,}/g, ',')
    .replace(/,\s*,+/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/^,\s*|,\s*$/g, '')
    .trim();
  const c = String(city || '').trim();
  const p = String(pincode || '').trim();
  if (c && !cleaned.toLowerCase().includes(c.toLowerCase())) cleaned = cleaned ? `${cleaned}, ${c}` : c;
  if (p && !cleaned.includes(p)) cleaned = cleaned ? `${cleaned} ${p}` : p;
  return cleaned || '—';
}

function formatLeadSchedule(lead: any): string {
  if (lead?.preferred_slot_start) {
    const formatted = formatDateTime(lead.preferred_slot_start);
    if (formatted) return formatted;
  }
  const meta = lead?.coupon_meta || {};
  const date = String(meta.pickup_date || lead?.preferred_date || '').trim();
  const time = String(meta.pickup_time || lead?.preferred_time_slot || '').trim();
  if (date && time) {
    try {
      return formatDateTime(`${date}T${time}:00+05:30`) || `${date} ${time}`;
    } catch {
      return `${date} ${time}`;
    }
  }
  const problem = String(lead?.problem_description || '');
  const m = problem.match(/(pickup|visit)\s*:\s*(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})/i);
  if (m) {
    return formatDateTime(`${m[2]}T${m[3]}:00+05:30`) || `${m[2]} ${m[3]}`;
  }
  return '';
}

function getStatusBg(status: string): string {
  switch (status) {
    case 'NEW': return '#DBEAFE';
    case 'ASSIGNED': return '#E0E7FF';
    case 'ACCEPTED': return '#D1FAE5';
    case 'REJECTED': return '#FEE2E2';
    case 'COMPLETED': return '#D1FAE5';
    default: return 'rgba(255,255,255,0.25)';
  }
}

function getStatusFg(status: string): string {
  switch (status) {
    case 'NEW': return COLORS.primary;
    case 'ASSIGNED': return COLORS.indigo;
    case 'ACCEPTED': return COLORS.green;
    case 'REJECTED': return COLORS.red;
    case 'COMPLETED': return COLORS.green;
    default: return '#fff';
  }
}

function getCallStatusBadge(status: string): { bg: string; fg: string } {
  switch (String(status || '').toUpperCase()) {
    case 'ANSWERED':
      return { bg: '#D1FAE5', fg: '#047857' };
    case 'NO_ANSWER':
    case 'BUSY':
      return { bg: '#FEF3C7', fg: '#B45309' };
    case 'SWITCHED_OFF':
      return { bg: '#E5E7EB', fg: '#374151' };
    case 'WRONG_NUMBER':
    case 'REJECTED':
      return { bg: '#FEE2E2', fg: '#B91C1C' };
    case 'NEW':
      return { bg: '#DBEAFE', fg: COLORS.primary };
    default:
      return { bg: 'rgba(255,255,255,0.22)', fg: '#fff' };
  }
}

function getStatusColor(status: string): string {
  return getStatusBg(status);
}

function getCallStatusColor(status: string): string {
  switch (status) {
    case 'ANSWERED': return COLORS.green + '30';
    case 'NO_ANSWER': return COLORS.orange + '30';
    case 'BUSY': return COLORS.orange + '30';
    case 'SWITCHED_OFF': return COLORS.gray[500] + '30';
    case 'WRONG_NUMBER': return COLORS.red + '30';
    default: return COLORS.gray[500] + '30';
  }
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'URGENT': return COLORS.red + '30';
    case 'HIGH': return COLORS.orange + '30';
    default: return COLORS.gray[500] + '30';
  }
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: SPACING.md,
  },
  headerBarEmbedded: {
    paddingTop: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  headerBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
  },
  errorText: {
    marginTop: SPACING.md,
    fontSize: 16,
    color: COLORS.red,
  },
  button: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    paddingTop: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#fff',
    opacity: 0.9,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    gap: 6,
  },
  actionButtonPrimary: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  actionButtonSecondary: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#34D399',
  },
  actionButtonEdit: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#93C5FD',
  },
  actionButtonTextPrimary: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  actionButtonTextSecondary: {
    color: '#059669',
    fontWeight: '700',
    fontSize: 13,
  },
  actionButtonTextEdit: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E8EEF7',
    shadowColor: '#023D95',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statDivider: {
    width: 1,
    height: 48,
    alignSelf: 'center',
    backgroundColor: COLORS.gray[200],
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  section: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIconBtn: {
    padding: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textHeading,
  },
  sectionContent: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8EEF7',
    shadowColor: '#023D95',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    gap: 8,
  },
  detailGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
  },
  detailRowCompact: {
    flex: 1,
  },
  detailIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  detailBody: {
    flex: 1,
    minWidth: 0,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  fieldCaption: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 4,
    marginBottom: 2,
  },
  mutedValue: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  priceCard: {
    backgroundColor: '#F0F7FF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 6,
  },
  priceCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceCardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  priceCardValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  priceMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  priceMetaLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  priceMetaValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  pricePayable: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textHeading,
  },
  priceMode: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  priceEmpty: {
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
    marginBottom: 4,
  },
  priceEmptyText: {
    fontSize: 12,
    color: '#9A3412',
    fontWeight: '600',
  },
  lineItemsBox: {
    marginTop: 6,
    backgroundColor: '#FAFCFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EEF7',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    gap: 10,
  },
  lineItemName: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  lineItemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textHeading,
  },
  outcomeHint: {
    marginTop: 4,
    marginBottom: 10,
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoContent: {
    marginLeft: 10,
    flex: 1,
  },
  infoItem: {
    marginBottom: SPACING.sm,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
    marginTop: 2,
    lineHeight: 20,
  },
  couponBanner: {
    backgroundColor: COLORS.yellow + '20',
    borderRadius: 10,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  couponHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  couponTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.orange,
  },
  couponCode: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.orange,
    backgroundColor: COLORS.yellow + '40',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  couponText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  italic: {
    fontStyle: 'italic',
  },
  pickupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.blue + '20',
    padding: SPACING.sm,
    borderRadius: 8,
    marginTop: SPACING.xs,
  },
  pickupText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.blue,
    marginLeft: SPACING.xs,
  },
  formCard: {
    backgroundColor: '#F8FBFF',
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#DCE8F8',
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textHeading,
    marginBottom: SPACING.sm,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  chipTextActive: {
    color: COLORS.white,
  },
  datetimeButton: {
    borderWidth: 1,
    borderColor: COLORS.gray[500] + '40',
    borderRadius: 8,
    padding: SPACING.sm,
    backgroundColor: COLORS.white,
    marginBottom: SPACING.sm,
  },
  datetimeButtonText: {
    color: COLORS.textPrimary,
    fontSize: 13,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.gray[500] + '40',
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
    fontSize: 14,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  formButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  formButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  formButtonPrimary: {
    backgroundColor: COLORS.primary,
  },
  formButtonSecondary: {
    backgroundColor: COLORS.gray[500] + '30',
  },
  formButtonTextPrimary: {
    color: '#fff',
    fontWeight: 'bold',
  },
  formButtonTextSecondary: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
  },
  logCard: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[500] + '20',
    paddingBottom: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  logBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 12,
  },
  logBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  logDuration: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  logNotes: {
    fontSize: 13,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  logTime: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  followUpType: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  priorityBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    padding: SPACING.lg,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  tag: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  tagBlue: {
    backgroundColor: '#DBEAFE',
  },
  tagGreen: {
    backgroundColor: '#D1FAE5',
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
});

