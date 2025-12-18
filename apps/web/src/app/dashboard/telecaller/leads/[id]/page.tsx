'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { formatDateTime } from '@/lib/utils';
import {
  Phone, Mail, MapPin, Car, Calendar, Clock, FileText,
  User, Building2, PhoneCall, MessageSquare, Edit, ArrowLeft,
  CheckCircle, AlertCircle, TrendingUp
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

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
  const [serviceTypeNames, setServiceTypeNames] = useState<string[]>([]);
  const [subserviceNames, setSubserviceNames] = useState<string[]>([]);

  const [callLogData, setCallLogData] = useState({
    call_status: 'ANSWERED',
    call_duration: '',
    outcome: 'INFO_COLLECTED',
    notes: ''
  });

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
      setLead(leadData);

      // Fetch service type names if service_type_ids exists
      if (leadData.service_type_ids) {
        try {
          const serviceIds = JSON.parse(leadData.service_type_ids);
          if (Array.isArray(serviceIds) && serviceIds.length > 0) {
            const { data: serviceTypesData } = await supabase
              .from('service_types')
              .select('id, name')
              .in('id', serviceIds);
            
            if (serviceTypesData) {
              setServiceTypeNames(serviceTypesData.map(st => st.name));
            }
          }
        } catch (e) {
          console.error('Error parsing service_type_ids:', e);
        }
      }

      // Fetch subservice names if subservice_ids exists
      if (leadData.subservice_ids) {
        try {
          const subserviceIds = JSON.parse(leadData.subservice_ids);
          if (Array.isArray(subserviceIds) && subserviceIds.length > 0) {
            const { data: subservicesData } = await supabase
              .from('service_addons')
              .select('id, name')
              .in('id', subserviceIds);
            
            if (subservicesData) {
              setSubserviceNames(subservicesData.map(sa => sa.name));
            }
          }
        } catch (e) {
          console.error('Error parsing subservice_ids:', e);
        }
      }

      // Fetch call logs
      const { data: callsData } = await supabase
        .from('telecaller_call_logs')
        .select('*, telecaller:telecaller_id(full_name)')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      setCallLogs(callsData || []);

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
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      const { error } = await supabase
        .from('telecaller_call_logs')
        .insert([{
          lead_id: leadId,
          telecaller_id: userProfile?.id,
          call_type: 'OUTBOUND',
          call_status: callLogData.call_status,
          call_duration: callLogData.call_duration ? parseInt(callLogData.call_duration) : null,
          outcome: callLogData.outcome,
          notes: callLogData.notes,
          phone_number: lead?.customer_phone
        }]);

      if (!error) {
        // Update lead's last_call_at and total_calls
        await supabase
          .from('service_leads')
          .update({
            last_call_at: new Date().toISOString(),
            total_calls: (lead?.total_calls || 0) + 1
          })
          .eq('id', leadId);

        setCallLogData({
          call_status: 'ANSWERED',
          call_duration: '',
          outcome: 'INFO_COLLECTED',
          notes: ''
        });
        setShowCallLogForm(false);
        fetchLeadDetails();
        alert('Call log added successfully!');
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

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      const { error } = await supabase
        .from('telecaller_follow_ups')
        .insert([{
          lead_id: leadId,
          telecaller_id: userProfile?.id,
          follow_up_type: followUpData.follow_up_type,
          scheduled_time: followUpData.scheduled_time,
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
        <div className={`card ${
          lead.status === 'NEW' ? 'bg-blue-50 border-blue-200' :
          lead.status === 'ASSIGNED' ? 'bg-indigo-50 border-indigo-200' :
          lead.status === 'ACCEPTED' ? 'bg-green-50 border-green-200' :
          lead.status === 'REJECTED' ? 'bg-red-50 border-red-200' :
          'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-semibold">Status: {lead.status}</h3>
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
                {/* Service Types - Show names instead of UUIDs */}
                <div>
                  <div className="flex items-start gap-1.5 sm:gap-2">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Service Types:</p>
                      {serviceTypeNames.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          {serviceTypeNames.map((name, idx) => (
                            <span 
                              key={idx}
                              className="inline-block px-2 sm:px-3 py-0.5 sm:py-1 bg-blue-100 text-blue-800 rounded-full text-xs sm:text-sm font-medium"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm sm:text-base text-gray-700">Not specified</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Subservices / Add-ons */}
                {subserviceNames.length > 0 && (
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

                {lead.description && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Description:</p>
                    <p className="text-gray-700">{lead.description}</p>
                  </div>
                )}
                {lead.problem_description && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Problem Description:</p>
                    <p className="text-gray-700 italic">"{lead.problem_description}"</p>
                  </div>
                )}
                {lead.payment_mode && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Payment Mode:</p>
                    <p className="text-gray-700 font-semibold">{lead.payment_mode}</p>
                  </div>
                )}
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
                    value={callLogData.call_status}
                    onChange={(e) => setCallLogData({...callLogData, call_status: e.target.value})}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg"
                  >
                    <option value="ANSWERED">Answered</option>
                    <option value="NO_ANSWER">No Answer</option>
                    <option value="BUSY">Busy</option>
                    <option value="SWITCHED_OFF">Switched Off</option>
                    <option value="WRONG_NUMBER">Wrong Number</option>
                  </select>

                  <input
                    type="number"
                    placeholder="Call duration (seconds)"
                    value={callLogData.call_duration}
                    onChange={(e) => setCallLogData({...callLogData, call_duration: e.target.value})}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg"
                  />

                  <select
                    value={callLogData.outcome}
                    onChange={(e) => setCallLogData({...callLogData, outcome: e.target.value})}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg"
                  >
                    <option value="INFO_COLLECTED">Info Collected</option>
                    <option value="LEAD_CREATED">Lead Created</option>
                    <option value="FOLLOW_UP_SET">Follow-up Set</option>
                    <option value="CUSTOMER_REJECTED">Customer Rejected</option>
                    <option value="ESCALATED">Escalated</option>
                  </select>

                  <textarea
                    placeholder="Call notes..."
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
                              {log.call_status}
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
                <StatItem label="Total Calls" value={lead.total_calls || 0} icon={<PhoneCall />} />
                <StatItem label="Priority" value={lead.lead_priority || 'NORMAL'} icon={<TrendingUp />} />
                <StatItem label="Source" value={lead.created_from || 'Unknown'} icon={<FileText />} />
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
                        {formatDateTime(fu.scheduled_time)}
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
                <button className="btn btn-outline w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-center gap-1.5 sm:gap-2">
                  <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Send WhatsApp
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

