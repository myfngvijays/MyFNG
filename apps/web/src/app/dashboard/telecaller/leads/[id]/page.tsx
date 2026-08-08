'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { formatDateTime, formatDateTimeIST } from '@/lib/utils';
import {
  Phone, Mail, MapPin, Car, Calendar, Clock, FileText,
  User, Building2, PhoneCall, MessageSquare, Edit, ArrowLeft,
  CheckCircle, AlertCircle, TrendingUp
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import SendWhatsAppModal from '@/components/shared/SendWhatsAppModal';
import {
  leadDisplayStatus,
  leadStatusBannerClass,
} from '@/lib/telecaller/leadDisplayStatus';
import { redactLeadSourceForTelecaller } from '@/lib/telecaller/redactLeadSource';
import { parseCallDisposition } from '@/lib/telecaller/callDisposition';

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params?.id as string;

  const [lead, setLead] = useState<any>(null);
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCallLogForm, setShowCallLogForm] = useState(false);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [sendingPricing, setSendingPricing] = useState(false);
  const [serviceGroups, setServiceGroups] = useState<Array<{ category: string; names: string[] }>>([]);
  const [subserviceNames, setSubserviceNames] = useState<string[]>([]);
  const SHOW_SERVICE_ADDONS = false;

  function titleCaseCat(c: string) {
    return String(c || '')
      .replace(/^CAR\s+/i, '')
      .replace(/\s+SERVICE$/i, '')
      .replace(/\s+SERVICES$/i, '')
      .split(' ')
      .map((w) => (w ? w.charAt(0) + w.slice(1).toLowerCase() : ''))
      .join(' ')
      .trim() || 'Other';
  }

  function parseIds(raw: any): string[] {
    if (raw == null) return [];
    if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
    if (typeof raw !== 'string') return [];
    const s = raw.trim();
    if (!s) return [];
    // If it looks like JSON, try parsing; otherwise fallback to comma-separated.
    if (s.startsWith('[') || s.startsWith('{') || s.startsWith('"')) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.map(String).map((v) => v.trim()).filter(Boolean);
      } catch {
        // fall through
      }
    }
    return s.split(',').map((v) => v.trim()).filter(Boolean);
  }

  function parseCodes(raw: any): string[] {
    return parseIds(raw).map((c) => String(c || '').trim().toUpperCase()).filter(Boolean);
  }

  const [callLogData, setCallLogData] = useState({
    call_status: 'ANSWERED',
    call_duration: '',
    outcome: 'INFO_COLLECTED',
    activity: 'INTERESTED',
    lost_reason: '',
    notes: ''
  });

  const ACTIVITY_OPTIONS = [
    { id: 'INTERESTED', label: 'Interested', call_status: 'ANSWERED', outcome: 'INFO_COLLECTED', lead_status: null as string | null },
    { id: 'WILL_VISIT', label: 'He will visit', call_status: 'ANSWERED', outcome: 'INFO_COLLECTED', lead_status: null },
    { id: 'BOOKING_CONFIRMED', label: 'Booking confirmed', call_status: 'ANSWERED', outcome: 'LEAD_CREATED', lead_status: 'VALIDATED' },
    { id: 'IN_SERVICE', label: 'In Service', call_status: 'ANSWERED', outcome: 'INFO_COLLECTED', lead_status: 'IN_PROGRESS' },
    { id: 'SERVICE_DONE', label: 'Service Done', call_status: 'ANSWERED', outcome: 'INFO_COLLECTED', lead_status: 'COMPLETED' },
    { id: 'LOST', label: 'Lost', call_status: 'ANSWERED', outcome: 'NOT_INTERESTED', lead_status: 'REJECTED' },
    { id: 'RINGING', label: 'Ringing / No answer', call_status: 'NO_ANSWER', outcome: null, lead_status: null },
  ];

  const LOST_REASONS = [
    'Not Interested',
    'Unqualified Lead',
    'No-Response to Calls',
    'Already Service Done',
    'Under Warranty',
    'Looking For Authorised Service Center',
    'Other Reasons',
  ];

  const [followUpData, setFollowUpData] = useState({
    follow_up_type: 'CALLBACK',
    scheduled_time: '',
    reason: '',
    priority: 'NORMAL'
  });

  useEffect(() => {
    if (leadId) {
      fetchLeadDetails();
    }
  }, [leadId]);

  async function fetchLeadDetails() {
    const supabase = createClient();
    setLoading(true);

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
      setLead(redactLeadSourceForTelecaller(leadData as Record<string, any>));

      // Fetch service types grouped by category (Periodic / AC / Brake / Engine …)
      if (leadData.service_type_ids) {
        const serviceIds = parseIds(leadData.service_type_ids);
        if (serviceIds.length > 0) {
          const [{ data: cats }, { data: serviceTypesData }] = await Promise.all([
            supabase.from('categories').select('uuid, category'),
            supabase
              .from('service_types')
              .select('id, name, category_uuid')
              .in('id', serviceIds),
          ]);
          const categoryMap: Record<string, string> = {};
          (cats || []).forEach((c: any) => {
            if (c.uuid && c.category) categoryMap[String(c.uuid)] = String(c.category);
          });
          const order = [
            'PERIODIC', 'ENGINE', 'AC', 'BATTERY', 'BRAKE', 'CLUTCH', 'TYRE', 'WHEEL',
            'DETAILING', 'DENTING', 'PAINTING', 'ELECTRICAL', 'SUSPENSION', 'STEERING',
          ];
          const grouped = new Map<string, string[]>();
          (serviceTypesData || []).forEach((st: any) => {
            const cat = st.category_uuid
              ? categoryMap[String(st.category_uuid)] || 'Other Services'
              : 'Other Services';
            const arr = grouped.get(cat) || [];
            arr.push(String(st.name || ''));
            grouped.set(cat, arr);
          });
          const groups = Array.from(grouped.entries())
            .map(([category, names]) => ({ category, names: names.filter(Boolean) }))
            .sort((a, b) => {
              const ia = order.findIndex((o) => a.category.toUpperCase().includes(o));
              const ib = order.findIndex((o) => b.category.toUpperCase().includes(o));
              return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
            });
          setServiceGroups(groups);
        } else {
          setServiceGroups([]);
        }
      } else {
        setServiceGroups([]);
      }

      // Fetch subservice names if subservice_ids exists
      if (leadData.subservice_ids) {
        const subserviceIds = parseIds(leadData.subservice_ids);
        if (subserviceIds.length > 0) {
          const { data: subservicesData } = await supabase
            .from('service_addons')
            .select('id, name')
            .in('id', subserviceIds);

          if (subservicesData) {
            setSubserviceNames(subservicesData.map((sa) => sa.name));
          }
        }
      }

      // Fetch call logs + heal status if telecaller already logged Lost/etc. but lead stayed NEW
      let logs: any[] = [];
      try {
        const res = await fetch(`/api/telecaller/calls/${leadId}`, { method: 'GET' });
        const json = await res.json().catch(() => ({}));
        logs = res.ok && Array.isArray(json?.call_logs) ? json.call_logs : [];
        setCallLogs(logs);
      } catch {
        setCallLogs([]);
      }

      const safeLead = redactLeadSourceForTelecaller(leadData as Record<string, any>);
      const meta =
        safeLead?.coupon_meta && typeof safeLead.coupon_meta === 'object'
          ? safeLead.coupon_meta
          : {};
      const hasDisposition = Boolean(meta.last_call_result || meta.last_call_label);
      if (!hasDisposition && logs.length > 0) {
        for (const log of logs) {
          const disp = parseCallDisposition({
            notes: log?.notes,
            outcome: log?.outcome,
            call_status: log?.call_status,
          });
          if (!disp || disp.result === 'RINGING') continue;
          try {
            const healRes = await fetch(`/api/telecaller/leads/${leadId}/heal-disposition`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                last_call_result: disp.result,
                last_call_label: disp.label,
                last_lost_reason: disp.lostReason,
                last_call_status: log?.call_status || 'ANSWERED',
                status: disp.leadStatus,
                telecaller_remarks: String(log?.notes || '')
                  .replace(/^\[[^\]]+\]\s*/, '')
                  .trim() || null,
                total_calls: Math.max(Number(leadData?.total_calls || 0), logs.length),
              }),
            });
            if (healRes.ok) {
              const healed = await healRes.json().catch(() => ({}));
              if (healed?.lead) {
                setLead(redactLeadSourceForTelecaller(healed.lead as Record<string, any>));
              } else {
                setLead({
                  ...safeLead,
                  status: disp.leadStatus || safeLead.status,
                  total_calls: Math.max(Number(leadData?.total_calls || 0), logs.length),
                  coupon_meta: {
                    ...meta,
                    last_call_result: disp.result,
                    last_call_label: disp.label,
                    last_lost_reason: disp.lostReason,
                    last_call_status: log?.call_status || 'ANSWERED',
                  },
                });
              }
            }
          } catch (e) {
            console.warn('heal disposition from call logs failed', e);
          }
          break;
        }
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
    }
  }

  async function handleAddCallLog() {
    try {
      const selected =
        ACTIVITY_OPTIONS.find((o) => o.id === callLogData.activity) || ACTIVITY_OPTIONS[0];
      if (selected.id === 'LOST' && !callLogData.lost_reason.trim()) {
        alert('Please select a lost reason');
        return;
      }
      const statusLabel =
        selected.id === 'LOST' && callLogData.lost_reason
          ? `Lost · ${callLogData.lost_reason}`
          : selected.label;
      const notesParts = [`[${statusLabel}]`, callLogData.notes.trim() || null].filter(Boolean);

      const res = await fetch('/api/telecaller/calls/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadId,
          call_type: 'OUTBOUND',
          call_status: selected.call_status,
          call_duration: callLogData.call_duration ? parseInt(callLogData.call_duration) : null,
          outcome: selected.outcome,
          activity: selected.id,
          notes: notesParts.join(' '),
          phone_number: lead?.customer_phone,
        }),
      });

      if (res.ok) {
        setCallLogData({
          call_status: 'ANSWERED',
          call_duration: '',
          outcome: 'INFO_COLLECTED',
          activity: 'INTERESTED',
          lost_reason: '',
          notes: ''
        });
        setShowCallLogForm(false);
        fetchLeadDetails();
        alert('Call log added successfully!');
      } else {
        const errJson = await res.json().catch(() => ({}));
        console.error('Call log API error:', errJson);
        alert(errJson?.error || 'Failed to add call log');
      }
    } catch (error) {
      console.error('Error adding call log:', error);
      alert('Failed to add call log');
    }
  }

  async function handleAddFollowUp() {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Resolve users_login profile robustly (email -> phone -> id)
      const email = (user.email || '').trim();
      const phone = (user.phone || '').trim();
      const selectCols = 'id';

      const { data: byEmail } = email
        ? await supabase.from('users_login').select(selectCols).ilike('email', email).maybeSingle()
        : { data: null as any };
      const { data: byPhone } = !byEmail && phone
        ? await supabase.from('users_login').select(selectCols).eq('phone', phone).maybeSingle()
        : { data: null as any };
      const { data: byId } = !byEmail && !byPhone
        ? await supabase.from('users_login').select(selectCols).eq('id', user.id).maybeSingle()
        : { data: null as any };
      const userProfile = byEmail || byPhone || byId;

      // Convert datetime-local -> ISO UTC for consistent storage
      // datetime-local gives "YYYY-MM-DDTHH:mm" (no timezone, treated as browser's local time)
      // new Date() interprets it as local time, toISOString() converts to UTC automatically
      const scheduledLocal = followUpData.scheduled_time;
      const scheduledIso = scheduledLocal 
        ? new Date(scheduledLocal).toISOString()
        : null;

      const { error } = await supabase
        .from('telecaller_follow_ups')
        .insert([{
          lead_id: leadId,
          telecaller_id: userProfile?.id,
          follow_up_type: followUpData.follow_up_type,
          scheduled_time: scheduledIso,
          reason: followUpData.reason,
          priority: followUpData.priority,
          status: 'PENDING'
        }]);

      if (!error) {
        // Update lead's follow_up flags
        await supabase
          .from('service_leads')
          .update({
            follow_up_required: true,
            next_follow_up_at: scheduledIso
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
        alert('Follow-up scheduled successfully!');
      }
    } catch (error) {
      console.error('Error adding follow-up:', error);
      alert('Failed to schedule follow-up');
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="telecaller">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-3 sm:mt-4 text-gray-600 text-sm sm:text-base">Loading lead details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!lead) {
    return (
      <DashboardLayout role="telecaller">
        <div className="card text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-500">Lead not found</p>
          <Link href="/dashboard/telecaller/leads" className="btn btn-primary mt-4">
            Back to Leads
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="telecaller">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-1">
            <button onClick={() => router.back()} className="btn btn-outline flex-shrink-0 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2">
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-text-heading truncate">Lead Details</h1>
              <p className="text-text-body text-xs sm:text-sm mt-0.5 sm:mt-1 truncate">Lead #{lead.lead_number}</p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <a href={`tel:${lead.customer_phone}`} className="btn btn-primary flex-1 sm:flex-initial text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
              <PhoneCall className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />
              <span className="hidden sm:inline">Call Customer</span>
              <span className="sm:hidden">Call</span>
            </a>
            <Link href={`/dashboard/telecaller/leads/${leadId}/edit`} className="btn btn-outline flex-1 sm:flex-initial text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
              <Edit className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />
              Edit
            </Link>
          </div>
        </div>

        {/* Status Banner */}
        <div className={`card ${leadStatusBannerClass(lead)}`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-semibold">
                Status: {leadDisplayStatus(lead)}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">
                Created {formatDateTime(lead.created_at)}
              </p>
            </div>
            {lead.is_incomplete && (
              <span className="px-3 sm:px-4 py-1.5 sm:py-2 bg-yellow-100 text-yellow-700 rounded-lg font-semibold flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm flex-shrink-0">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                Incomplete Lead
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-5 md:space-y-6">
            {/* Customer Information */}
            <div className="card">
              <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                <User className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                Customer Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <InfoItem icon={<User />} label="Name" value={lead.customer_name} />
                <InfoItem icon={<Phone />} label="Phone" value={lead.customer_phone} />
                {lead.customer_alternate_phone && (
                  <InfoItem icon={<Phone />} label="Alternate Phone" value={lead.customer_alternate_phone} />
                )}
                {lead.customer_email && (
                  <InfoItem icon={<Mail />} label="Email" value={lead.customer_email} />
                )}
                {lead.customer_address && (
                  <InfoItem icon={<MapPin />} label="Address" value={lead.customer_address} className="md:col-span-2" />
                )}
                <InfoItem icon={<MapPin />} label="City" value={lead.city || 'N/A'} />
                {lead.pincode && (
                  <InfoItem icon={<MapPin />} label="Pincode" value={lead.pincode} />
                )}
              </div>
            </div>

            {/* Vehicle Information */}
            <div className="card">
              <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                <Car className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                Vehicle Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <InfoItem icon={<Car />} label="Registration" value={lead.vehicle_number || 'Not provided'} />
                <InfoItem icon={<Car />} label="Make" value={lead.vehicle_make || 'N/A'} />
                <InfoItem icon={<Car />} label="Model" value={lead.vehicle_model || 'N/A'} />
                {lead.vehicle_variant && (
                  <InfoItem icon={<Car />} label="Variant" value={lead.vehicle_variant} />
                )}
                {lead.vehicle_year && (
                  <InfoItem icon={<Calendar />} label="Year" value={lead.vehicle_year.toString()} />
                )}
                {lead.vehicle_fuel_type && (
                  <InfoItem icon={<Car />} label="Fuel Type" value={lead.vehicle_fuel_type} />
                )}
              </div>
            </div>

            {/* Service Details */}
            <div className="card">
              <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                Service Details
              </h2>
              <div className="space-y-2 sm:space-y-3">
                {/* Service Types — grouped by category (Periodic / AC / Brake / Engine …) */}
                <div>
                  <div className="flex items-start gap-1.5 sm:gap-2">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0 space-y-2.5">
                      <p className="text-xs sm:text-sm font-medium text-gray-500">Service Types:</p>
                      {serviceGroups.length > 0 ? (
                        serviceGroups.map((group) => (
                          <div key={group.category}>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-800/80 mb-1">
                              {titleCaseCat(group.category)}
                            </p>
                            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                              {group.names.map((name, idx) => (
                                <span
                                  key={`${group.category}-${idx}`}
                                  className="inline-block px-2 sm:px-3 py-0.5 sm:py-1 bg-blue-100 text-blue-800 rounded-full text-xs sm:text-sm font-medium"
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm sm:text-base text-gray-700">Not specified</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Subservices / Add-ons */}
                {SHOW_SERVICE_ADDONS && subserviceNames.length > 0 && (
                  <div>
                    <div className="flex items-start gap-1.5 sm:gap-2">
                      <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Add-ons / Sub-services:</p>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          {subserviceNames.map((name, idx) => (
                            <span 
                              key={idx}
                              className="inline-block px-2 sm:px-3 py-0.5 sm:py-1 bg-green-100 text-green-800 rounded-full text-xs sm:text-sm font-medium"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {(lead.problem_description || lead.description) && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Customer Message:</p>
                    <p className="text-gray-700 italic">
                      &ldquo;{lead.problem_description || lead.description}&rdquo;
                    </p>
                  </div>
                )}
                {lead.payment_mode && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Payment Mode:</p>
                    <p className="text-gray-700 font-semibold">{lead.payment_mode}</p>
                  </div>
                )}

                {/* Coupon (if applied during lead creation) */}
                {(() => {
                  const code = String(
                    lead?.coupon_code ??
                      (lead as any)?.coupon_meta?.applied_code ??
                      (lead as any)?.coupon_meta?.code ??
                      lead?.coupon ??
                      lead?.applied_coupon_code ??
                      ''
                  ).trim();
                  const selectedCodes = parseCodes((lead as any)?.coupon_meta?.selected_codes);
                  const discountAmount =
                    Number(lead?.discount_amount ?? lead?.coupon_discount_amount ?? lead?.coupon_discount ?? 0) || 0;
                  if (!code && selectedCodes.length === 0) return null;
                  return (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-amber-800">
                          {selectedCodes.length > 1 ? 'Coupons Applied' : 'Coupon Applied'}
                        </p>
                        {code ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            {code}
                          </span>
                        ) : null}
                      </div>
                      {selectedCodes.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {selectedCodes.map((c) => {
                            const isPrimary = code && c === code.toUpperCase();
                            return (
                              <span
                                key={c}
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  isPrimary ? 'bg-amber-200 text-amber-900' : 'bg-amber-100 text-amber-900'
                                }`}
                                title={isPrimary ? 'Applied coupon' : 'Selected coupon'}
                              >
                                {c}
                                {isPrimary ? ' (Applied)' : ''}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {discountAmount > 0 ? (
                        <p className="mt-1 text-xs text-gray-700">
                          Discount: <span className="font-semibold">₹{discountAmount.toFixed(2)}</span>
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-gray-600">
                          Note: Discount will reflect in invoice at billing time.
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* Coupon editing is available only on the Edit Lead page */}
                {lead.pickup_required && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm font-semibold text-blue-700">Pickup Required</p>
                    {lead.pickup_address && (
                      <p className="text-sm text-gray-600 mt-1">Address: {lead.pickup_address}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Call Logs */}
            <div className="card p-3 sm:p-4 md:p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-3 sm:mb-4">
                <h2 className="text-lg sm:text-xl font-bold flex items-center gap-1.5 sm:gap-2">
                  <PhoneCall className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                  Call History ({callLogs.length})
                </h2>
                <button 
                  onClick={() => setShowCallLogForm(!showCallLogForm)}
                  className="btn btn-outline text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 w-full sm:w-auto"
                >
                  Add Call Log
                </button>
              </div>

              {showCallLogForm && (
                <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-gray-50 rounded-lg space-y-2 sm:space-y-3">
                  <select
                    value={callLogData.activity}
                    onChange={(e) =>
                      setCallLogData({
                        ...callLogData,
                        activity: e.target.value,
                        lost_reason: e.target.value === 'LOST' ? callLogData.lost_reason : '',
                      })
                    }
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg"
                  >
                    {ACTIVITY_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>

                  {callLogData.activity === 'LOST' && (
                    <select
                      value={callLogData.lost_reason}
                      onChange={(e) =>
                        setCallLogData({ ...callLogData, lost_reason: e.target.value })
                      }
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg"
                    >
                      <option value="">Select lost reason</option>
                      {LOST_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  )}

                  <input
                    type="number"
                    placeholder="Call duration (seconds)"
                    value={callLogData.call_duration}
                    onChange={(e) => setCallLogData({...callLogData, call_duration: e.target.value})}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg"
                  />

                  <textarea
                    placeholder="Call notes / remarks..."
                    value={callLogData.notes}
                    onChange={(e) => setCallLogData({...callLogData, notes: e.target.value})}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg"
                    rows={3}
                  />

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={handleAddCallLog} className="btn btn-primary flex-1 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
                      Save Call Log
                    </button>
                    <button onClick={() => setShowCallLogForm(false)} className="btn btn-outline text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2 sm:space-y-3">
                {callLogs.length === 0 ? (
                  <p className="text-gray-500 text-center py-4 text-xs sm:text-sm">No call logs yet</p>
                ) : (
                  callLogs.map((log) => (
                    <div key={log.id} className="p-3 sm:p-4 border border-gray-200 rounded-lg">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                            <span className={`px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs rounded ${
                              log.call_status === 'ANSWERED' ? 'bg-green-100 text-green-700' :
                              log.call_status === 'NO_ANSWER' ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {String(log.notes || '').match(/^\[([^\]]+)\]/)?.[1] || log.call_status}
                            </span>
                            {log.call_duration && (
                              <span className="text-xs sm:text-sm text-gray-500">
                                {Math.floor(log.call_duration / 60)}m {log.call_duration % 60}s
                              </span>
                            )}
                            {log.outcome && (
                              <span className="text-[10px] sm:text-xs px-2 py-0.5 sm:py-1 bg-blue-100 text-blue-700 rounded">
                                {log.outcome}
                              </span>
                            )}
                          </div>
                          {log.notes && (
                            <p className="text-xs sm:text-sm text-gray-700 mt-1 sm:mt-2">{log.notes}</p>
                          )}
                          <p className="text-[10px] sm:text-xs text-gray-500 mt-1.5 sm:mt-2">
                            {formatDateTime(log.created_at)} • {log.telecaller?.full_name}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Additional Info */}
          <div className="space-y-4 sm:space-y-5 md:space-y-6">
            {/* Quick Stats */}
            <div className="card p-3 sm:p-4 md:p-5">
              <h3 className="font-bold mb-2 sm:mb-3 text-base sm:text-lg">Quick Stats</h3>
              <div className="space-y-2 sm:space-y-3">
                <StatItem
                  label="Total Calls"
                  value={Math.max(Number(lead.total_calls || 0), callLogs.length)}
                  icon={<PhoneCall />}
                />
                <StatItem label="Priority" value={lead.lead_priority || 'NORMAL'} icon={<TrendingUp />} />
                {lead.last_call_at && (
                  <div>
                    <p className="text-xs sm:text-sm text-gray-500">Last Call:</p>
                    <p className="text-xs sm:text-sm font-semibold">{formatDateTime(lead.last_call_at)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Workshop Info */}
            {lead.workshop && (
              <div className="card p-3 sm:p-4 md:p-5">
                <h3 className="font-bold mb-2 sm:mb-3 text-base sm:text-lg flex items-center gap-1.5 sm:gap-2">
                  <Building2 className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  Workshop Assigned
                </h3>
                <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                  <p className="font-semibold">{lead.workshop.name}</p>
                  <p className="text-gray-600">{lead.workshop.city}</p>
                  <p className="text-gray-600">{lead.workshop.phone}</p>
                </div>
              </div>
            )}

            {/* Follow-ups */}
            <div className="card p-3 sm:p-4 md:p-5">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <h3 className="font-bold text-base sm:text-lg">Follow-ups</h3>
                <button 
                  onClick={() => setShowFollowUpForm(!showFollowUpForm)}
                  className="text-brand-primary text-xs sm:text-sm hover:underline"
                >
                  + Add
                </button>
              </div>

              {showFollowUpForm && (
                <div className="mb-3 sm:mb-4 space-y-2 sm:space-y-3 p-3 bg-gray-50 rounded-lg">
                  <select
                    value={followUpData.follow_up_type}
                    onChange={(e) => setFollowUpData({...followUpData, follow_up_type: e.target.value})}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm"
                  >
                    <option value="CALLBACK">Callback</option>
                    <option value="PRICE_CONFIRMATION">Price Confirmation</option>
                    <option value="INFO_PENDING">Info Pending</option>
                    <option value="SLOT_CONFIRMATION">Slot Confirmation</option>
                  </select>

                  <input
                    type="datetime-local"
                    value={followUpData.scheduled_time}
                    onChange={(e) => setFollowUpData({...followUpData, scheduled_time: e.target.value})}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm"
                  />

                  <textarea
                    placeholder="Reason..."
                    value={followUpData.reason}
                    onChange={(e) => setFollowUpData({...followUpData, reason: e.target.value})}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm"
                    rows={2}
                  />

                  <select
                    value={followUpData.priority}
                    onChange={(e) => setFollowUpData({...followUpData, priority: e.target.value})}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm"
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={handleAddFollowUp} className="btn btn-primary text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 flex-1">
                      Schedule
                    </button>
                    <button onClick={() => setShowFollowUpForm(false)} className="btn btn-outline text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {followUps.length === 0 ? (
                  <p className="text-gray-500 text-xs sm:text-sm text-center py-3 sm:py-4">No follow-ups</p>
                ) : (
                  followUps.map((fu) => (
                    <div key={fu.id} className={`p-2.5 sm:p-3 border rounded-lg text-xs sm:text-sm ${
                      fu.status === 'PENDING' ? 'border-purple-200 bg-purple-50' : 'border-gray-200'
                    }`}>
                      <div className="flex items-start justify-between mb-1">
                        <span className="font-semibold text-[10px] sm:text-xs">{fu.follow_up_type}</span>
                        <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded ${
                          fu.priority === 'URGENT' ? 'bg-red-100 text-red-700' :
                          fu.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {fu.priority}
                        </span>
                      </div>
                      <p className="text-[10px] sm:text-xs text-gray-600 mb-0.5 sm:mb-1">{fu.reason}</p>
                      <p className="text-[10px] sm:text-xs text-gray-500">
                        {formatDateTimeIST(fu.scheduled_time)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card p-3 sm:p-4 md:p-5">
              <h3 className="font-bold mb-2 sm:mb-3 text-base sm:text-lg">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setShowWhatsAppModal(true)}
                  className="btn btn-outline w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-center gap-1.5 sm:gap-2"
                >
                  <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Send WhatsApp
                </button>
                <button
                  type="button"
                  disabled={sendingPricing}
                  onClick={async () => {
                    const pincode = String(lead?.pincode || '').replace(/\D/g, '').slice(0, 6);
                    const carModel = [lead?.vehicle_make, lead?.vehicle_model]
                      .filter(Boolean)
                      .join(' ')
                      .trim();
                    const serviceTypeIds = parseIds(lead?.service_type_ids);
                    const meta =
                      lead?.coupon_meta && typeof lead.coupon_meta === 'object'
                        ? lead.coupon_meta
                        : {};
                    const savedCategories = Array.isArray((meta as any).pricing_categories)
                      ? (meta as any).pricing_categories
                          .map((c: any) => String(c || '').trim())
                          .filter(Boolean)
                      : [];
                    // No plan → all plans in category (default Periodic)
                    const pricingCategories = savedCategories.length
                      ? savedCategories
                      : ['Car Periodic Service'];
                    if (!/^\d{6}$/.test(pincode)) {
                      alert('Fill 6-digit pincode on the lead first.');
                      return;
                    }
                    if (!carModel) {
                      alert('Fill car model on the lead first.');
                      return;
                    }
                    const modeHint = serviceTypeIds.length
                      ? 'selected plan(s) only'
                      : `all ${pricingCategories.join(', ')} plans`;
                    if (
                      !confirm(
                        `Send pricing (${modeHint}) · ${carModel} · PIN ${pincode}?\nCreates myfng.in/p/… link (valid 3h) + WhatsApp`,
                      )
                    ) {
                      return;
                    }
                    setSendingPricing(true);
                    try {
                      const res = await fetch(`/api/telecaller/leads/${leadId}/send-pricing`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          pincode,
                          carModel,
                          serviceTypeIds: serviceTypeIds.length ? serviceTypeIds : undefined,
                          categories: serviceTypeIds.length
                            ? pricingCategories.length
                              ? pricingCategories
                              : undefined
                            : pricingCategories,
                        }),
                      });
                      const json = await res.json().catch(() => ({}));
                      if (!res.ok || !json?.success) {
                        throw new Error(json?.message || json?.error || 'Failed to send pricing');
                      }
                      alert(json.message || 'Pricing sent on WhatsApp.');
                    } catch (e: any) {
                      alert(
                        e?.message ||
                          'Could not send pricing link. Check WhatsApp session or approve pricing_share_link template.',
                      );
                    } finally {
                      setSendingPricing(false);
                    }
                  }}
                  className="btn btn-primary w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-60"
                  style={{ backgroundColor: '#004AAD', color: '#fff' }}
                >
                  <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {sendingPricing ? 'Sending…' : 'Send Pricing on WhatsApp'}
                </button>
                <button className="btn btn-outline w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-center gap-1.5 sm:gap-2">
                  <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Send Email
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <SendWhatsAppModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        leadId={leadId}
        leadNumber={lead?.lead_number}
        defaultPhone={lead?.customer_phone}
        defaultCustomerName={lead?.customer_name}
      />
    </DashboardLayout>
  );
}

interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  className?: string;
}

function InfoItem({ icon, label, value, className = '' }: InfoItemProps) {
  return (
    <div className={`flex items-start gap-2 sm:gap-3 ${className}`}>
      <div className="text-gray-400 mt-0.5 sm:mt-1 flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm text-gray-500">{label}</p>
        <p className="font-semibold text-gray-900 break-words text-xs sm:text-sm">{value}</p>
      </div>
    </div>
  );
}

interface StatItemProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}

function StatItem({ label, value, icon }: StatItemProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="text-gray-400 flex-shrink-0">{icon}</div>
        <span className="text-xs sm:text-sm text-gray-600">{label}</span>
      </div>
      <span className="font-semibold text-xs sm:text-sm">{value}</span>
    </div>
  );
}

