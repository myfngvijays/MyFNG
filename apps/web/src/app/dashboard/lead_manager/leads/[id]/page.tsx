'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { formatDateDMY, formatDateTime, formatTime12h } from '@/lib/utils';
import { getStatusColor, getStatusLabel } from '@/lib/services/leadStatusService';
import {
  CheckCircle, XCircle, Building, MapPin, Phone, Mail, Car,
  Calendar, DollarSign, FileText, AlertCircle, ArrowRight,
  Loader2, Search, Truck
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function LeadReviewPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  
  const [lead, setLead] = useState<any>(null);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [subserviceNames, setSubserviceNames] = useState<string[]>([]);
  
  // Validation state
  const [showValidation, setShowValidation] = useState(false);
  const [validationNotes, setValidationNotes] = useState('');
  
  // Workshop assignment state
  const [showWorkshopAssignment, setShowWorkshopAssignment] = useState(false);
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [selectedWorkshop, setSelectedWorkshop] = useState<string>('');
  const [workshopSearch, setWorkshopSearch] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [priority, setPriority] = useState('');

  const formatDate = (value: any) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : formatDateDMY(d);
  };

  const formatTime = (value: any) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? null
      : formatTime12h(d);
  };

  const getPickupDateText = (l: any) =>
    formatDate(l?.pickup_tracking?.pickup_time_window_start) ||
    formatDate(l?.scheduled_pickup_date) ||
    formatDate(l?.preferred_date) ||
    formatDate(l?.preferred_slot_start) ||
    'Not scheduled';

  const getPickupTimeText = (l: any) =>
    l?.pickup_tracking?.pickup_time_slot ||
    l?.scheduled_pickup_time ||
    l?.preferred_time_slot ||
    (formatTime(l?.preferred_slot_start) && formatTime(l?.preferred_slot_end)
      ? `${formatTime(l?.preferred_slot_start)} - ${formatTime(l?.preferred_slot_end)}`
      : null) ||
    'Not scheduled';

  const getDropDateText = (l: any) =>
    // pickup_tracking table (in your DB) doesn't have drop_time_window_start/end
    // so we use existing timestamps as best-effort.
    formatDate(l?.pickup_tracking?.drop_assigned_at) ||
    formatDate(l?.pickup_tracking?.drop_start_time) ||
    formatDate(l?.scheduled_delivery_date) ||
    'Not scheduled';

  const getDropTimeText = (l: any) =>
    l?.pickup_tracking?.drop_time_slot ||
    l?.scheduled_delivery_time ||
    'Not scheduled';

  useEffect(() => {
    if (params.id) {
      fetchLeadDetails();
      fetchLeadHistory();
    }
  }, [params.id]);

  const fetchLeadHistory = async () => {
    if (!params.id) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/audit/lead-history/${params.id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Non-blocking: lead details page should still render without history.
        setStatusHistory([]);
        return;
      }
      setStatusHistory(Array.isArray(data?.status_history) ? data.status_history : []);
    } catch (e) {
      setStatusHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const timelineItems = useMemo(() => {
    const items: Array<{
      key: string;
      status?: string;
      title: string;
      time?: string;
      meta?: string;
      iconBg: string;
      iconText: string;
    }> = [];

    if (lead?.created_at) {
      items.push({
        key: `created-${lead.created_at}`,
        status: 'CREATED',
        title: 'Created',
        time: formatDateTime(lead.created_at),
        meta: lead.created_by?.full_name ? `by ${lead.created_by.full_name}` : undefined,
        iconBg: 'bg-blue-100',
        iconText: 'text-blue-600',
      });
    }

    // API returns DESC; show oldest -> newest
    const histAsc = [...(statusHistory || [])].sort((a, b) => {
      const at = new Date(a?.changed_at || a?.created_at || 0).getTime();
      const bt = new Date(b?.changed_at || b?.created_at || 0).getTime();
      return at - bt;
    });

    for (const h of histAsc) {
      const newStatus = String(h?.new_status || '').trim();
      if (!newStatus) continue;
      const when = h?.changed_at || h?.created_at;
      const c = getStatusColor(newStatus);
      const metaParts = [
        h?.reason ? String(h.reason) : null,
        h?.notes ? String(h.notes) : null,
      ].filter(Boolean);
      items.push({
        key: `status-${h?.id || `${newStatus}-${when || ''}`}`,
        status: newStatus,
        title: getStatusLabel(newStatus),
        time: when ? formatDateTime(when) : undefined,
        meta: metaParts.length ? metaParts.join(' • ') : undefined,
        iconBg: c.bg,
        iconText: c.text,
      });
    }

    // Ensure current status shows even if history table is empty / missing latest
    const lastStatus = items
      .slice()
      .reverse()
      .find((x) => x.status && x.status !== 'CREATED')?.status;
    const currentStatus = lead?.status ? String(lead.status) : '';
    if (currentStatus && currentStatus !== lastStatus) {
      const c = getStatusColor(currentStatus);
      items.push({
        key: `current-${currentStatus}-${lead?.updated_at || ''}`,
        status: currentStatus,
        title: `${getStatusLabel(currentStatus)} (Current)`,
        time: lead?.updated_at ? formatDateTime(lead.updated_at) : undefined,
        iconBg: c.bg,
        iconText: c.text,
      });
    }

    // Dedupe consecutive duplicates (common on reassignment / repeated writes)
    const deduped: typeof items = [];
    for (const it of items) {
      const prev = deduped[deduped.length - 1];
      if (prev && prev.title === it.title && prev.time === it.time) continue;
      deduped.push(it);
    }
    return deduped;
  }, [lead, statusHistory]);

  // Fetch workshops when search changes (with debounce)
  useEffect(() => {
    if (showWorkshopAssignment) {
      const delayDebounceFn = setTimeout(() => {
        fetchWorkshops(workshopSearch);
      }, 300); // 300ms debounce

      return () => clearTimeout(delayDebounceFn);
    }
  }, [workshopSearch, showWorkshopAssignment]);

  const fetchLeadDetails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('service_leads')
        .select(`
          *,
          created_by:users_login!created_by_id(id, full_name, email, phone),
          validated_by:users_login!validated_by_id(id, full_name),
          assigned_pickup_boy:users_login!assigned_pickup_boy_id(id, full_name, phone),
          pickup_tracking:pickup_tracking!pickup_tracking_lead_id_fkey(
            pickup_status,
            pickup_time_slot,
            pickup_time_window_start,
            pickup_time_window_end,
            pickup_address,
            drop_status,
            drop_time_slot,
            drop_assigned_at,
            drop_start_time,
            drop_address
          ),
          city:cities(id, name, state),
          model:car_models(id, make, model_name, variant),
          workshop:workshops(id, name, city, contact_person, phone)
        `)
        .eq('id', params.id)
        .single();

      if (error) throw error;
      
      // Parse service_type_ids if it's a string (JSONB from database)
      let serviceTypeIds = data.service_type_ids;
      if (typeof serviceTypeIds === 'string') {
        try {
          serviceTypeIds = JSON.parse(serviceTypeIds);
        } catch (e) {
          console.error('Failed to parse service_type_ids:', e);
          serviceTypeIds = [];
        }
      }
      
      // Fetch service type names if service_type_ids exists
      if (serviceTypeIds && Array.isArray(serviceTypeIds) && serviceTypeIds.length > 0) {
        const { data: serviceTypes, error: stError } = await supabase
          .from('service_types')
          .select('id, name')
          .in('id', serviceTypeIds);
        
        if (!stError && serviceTypes && serviceTypes.length > 0) {
          data.service_type_names = serviceTypes.map(st => st.name).join(', ');
        }
      }
      
      // Fetch subservice/addon names if subservice_ids exists
      let subserviceIds = data.subservice_ids;
      if (typeof subserviceIds === 'string') {
        try {
          subserviceIds = JSON.parse(subserviceIds);
        } catch (e) {
          console.error('Failed to parse subservice_ids:', e);
          subserviceIds = [];
        }
      }
      
      if (subserviceIds && Array.isArray(subserviceIds) && subserviceIds.length > 0) {
        const { data: subservices, error: saError } = await supabase
          .from('service_addons')
          .select('id, name')
          .in('id', subserviceIds);
        
        if (!saError && subservices && subservices.length > 0) {
          setSubserviceNames(subservices.map(sa => sa.name));
        } else {
          setSubserviceNames([]);
        }
      } else {
        setSubserviceNames([]);
      }
      
      setLead(data);
      setPriority(data.priority || 'MEDIUM');
    } catch (error: any) {
      console.error('Error fetching lead:', error);
      toast.error('Failed to load lead details');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkshops = async (searchQuery = '') => {
    try {
      const city = lead?.city?.name || lead?.city;
      let url = `/api/lead-manager/available-workshops?`;
      
      if (searchQuery) {
        // If search query exists, prioritize search over city
        url += `search=${encodeURIComponent(searchQuery)}`;
      } else if (city) {
        // If no search, filter by city
        url += `city=${encodeURIComponent(city)}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setWorkshops(data.workshops);
      }
    } catch (error) {
      console.error('Error fetching workshops:', error);
      toast.error('Failed to load workshops');
    }
  };

  const handleValidate = async (isValid: boolean) => {
    if (!isValid && !validationNotes.trim()) {
      toast.error('Please provide validation notes when marking as incomplete');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch('/api/lead-manager/validate-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          is_valid: isValid,
          validation_notes: validationNotes
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        setShowValidation(false);
        setValidationNotes('');
        fetchLeadDetails();
      } else {
        toast.error(data.error || 'Validation failed');
      }
    } catch (error) {
      console.error('Validation error:', error);
      toast.error('Failed to validate lead');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignWorkshop = async () => {
    if (!selectedWorkshop) {
      toast.error('Please select a workshop');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch('/api/lead-manager/assign-workshop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          workshop_id: selectedWorkshop,
          assignment_notes: assignmentNotes,
          priority
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        setShowWorkshopAssignment(false);
        setSelectedWorkshop('');
        setAssignmentNotes('');
        fetchLeadDetails();
      } else {
        toast.error(data.error || 'Assignment failed');
      }
    } catch (error) {
      console.error('Assignment error:', error);
      toast.error('Failed to assign workshop');
    } finally {
      setActionLoading(false);
    }
  };

  // No need for client-side filtering anymore, API handles it
  const filteredWorkshops = workshops;

  if (loading) {
    return (
      <DashboardLayout role="lead_manager">
        <div className="flex items-center justify-center h-48 sm:h-64 md:h-screen">
          <Loader2 className="w-10 w-10 sm:w-11 sm:w-11 md:w-12 md:w-12 animate-spin text-brand-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!lead) {
    return (
      <DashboardLayout role="lead_manager">
        <div className="p-4 sm:p-5 md:p-6 text-center">
          <AlertCircle className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1.5 sm:mb-2">Lead Not Found</h2>
          <button
            onClick={() => router.push('/dashboard/lead_manager')}
            className="btn-primary mt-3 sm:mt-4 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
          >
            Back to Dashboard
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const canValidate = ['NEW', 'INCOMPLETE'].includes(lead.status);
  const canAssignWorkshop = lead.status === 'VALIDATED' || (lead.workshop_id && !['ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(lead.status));
  const isReassignment = lead.workshop_id && lead.status === 'ASSIGNED_TO_WORKSHOP';

  return (
    <DashboardLayout role="lead_manager">
      <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-5 md:mb-6">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Lead Review</h1>
            <p className="text-gray-600 text-xs sm:text-sm mt-0.5 sm:mt-1">Lead #{lead.lead_number}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {canValidate && (
              <>
                <button
                  onClick={() => setShowValidation(true)}
                  className="btn-secondary flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Mark Incomplete</span>
                  <span className="sm:hidden">Incomplete</span>
                </button>
                <button
                  onClick={() => handleValidate(true)}
                  disabled={actionLoading}
                  className="btn-primary flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  {actionLoading ? 'Validating...' : <><span className="hidden sm:inline">Validate Lead</span><span className="sm:hidden">Validate</span></>}
                </button>
              </>
            )}
            {canAssignWorkshop && (
              <button
                onClick={() => {
                  setShowWorkshopAssignment(true);
                  fetchWorkshops();
                }}
                className="btn-primary flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
              >
                <Building className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">{isReassignment ? 'Change Workshop' : 'Assign Workshop'}</span>
                <span className="sm:hidden">{isReassignment ? 'Change' : 'Assign'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Banner */}
        <div className={`p-3 sm:p-4 rounded-lg mb-4 sm:mb-5 md:mb-6 ${
          lead.status === 'NEW' ? 'bg-blue-50 border border-blue-200' :
          lead.status === 'INCOMPLETE' ? 'bg-yellow-50 border border-yellow-200' :
          lead.status === 'VALIDATED' ? 'bg-green-50 border border-green-200' :
          'bg-gray-50 border border-gray-200'
        }`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm sm:text-base">
                Status: <span className="text-base sm:text-lg">{lead.status}</span>
              </p>
              {lead.validated_at && (
                <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">
                  Validated by {lead.validated_by?.full_name} on {formatDateTime(lead.validated_at)}
                </p>
              )}
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1 flex items-center gap-1.5 sm:gap-2">
                <Building className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                <span className="font-medium text-gray-700">Assigned Workshop:</span>
                {lead.workshop_id ? (
                  <span className="font-semibold text-gray-900 truncate">
                    {lead.workshop?.name || '—'}
                    {lead.workshop?.city ? ` • ${lead.workshop.city}` : ''}
                    {lead.workshop?.phone ? ` • ${lead.workshop.phone}` : ''}
                  </span>
                ) : (
                  <span className="font-semibold text-gray-900">Not assigned</span>
                )}
              </p>
            </div>
            <span className={`px-3 sm:px-4 py-1 sm:py-2 rounded-full font-semibold text-xs sm:text-sm flex-shrink-0 ${
              lead.priority === 'CRITICAL' ? 'bg-red-600 text-white' :
              lead.priority === 'URGENT' ? 'bg-red-100 text-red-800' :
              lead.priority === 'HIGH' ? 'bg-orange-100 text-orange-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {lead.priority} Priority
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-5 md:space-y-6">
            {/* Customer Information */}
            <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Customer Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="text-xs sm:text-sm text-gray-600">Name</label>
                  <p className="font-medium text-sm sm:text-base">{lead.customer_name}</p>
                </div>
                <div>
                  <label className="text-xs sm:text-sm text-gray-600">Phone</label>
                  <p className="font-medium text-sm sm:text-base flex items-center gap-1.5 sm:gap-2">
                    <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{lead.customer_phone}</span>
                  </p>
                </div>
                {lead.customer_email && (
                  <div className="col-span-1 sm:col-span-2">
                    <label className="text-xs sm:text-sm text-gray-600">Email</label>
                    <p className="font-medium text-sm sm:text-base flex items-center gap-1.5 sm:gap-2">
                      <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{lead.customer_email}</span>
                    </p>
                  </div>
                )}
                <div className="col-span-1 sm:col-span-2">
                  <label className="text-xs sm:text-sm text-gray-600">Address</label>
                  <p className="font-medium text-sm sm:text-base flex items-start gap-1.5 sm:gap-2">
                    <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span>{lead.address || lead.customer_address}, {lead.city?.name || lead.city}, {lead.pincode}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Vehicle Information */}
            <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Vehicle Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="text-xs sm:text-sm text-gray-600">Vehicle Number</label>
                  <p className="font-medium text-base sm:text-lg">{lead.vehicle_number}</p>
                </div>
                <div>
                  <label className="text-xs sm:text-sm text-gray-600">Make & Model</label>
                  <p className="font-medium text-sm sm:text-base">
                    {lead.model?.make || lead.vehicle_make} {lead.model?.model_name || lead.vehicle_model}
                  </p>
                </div>
                {lead.vehicle_fuel_type && (
                  <div>
                    <label className="text-xs sm:text-sm text-gray-600">Fuel Type</label>
                    <p className="font-medium text-sm sm:text-base">{lead.vehicle_fuel_type}</p>
                  </div>
                )}
                {lead.vehicle_odometer && (
                  <div>
                    <label className="text-xs sm:text-sm text-gray-600">Odometer</label>
                    <p className="font-medium text-sm sm:text-base">{lead.vehicle_odometer} km</p>
                  </div>
                )}
              </div>
            </div>

            {/* Service Details */}
            <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Service Details</h2>
              <div className="space-y-2 sm:space-y-3">
                <div>
                  <label className="text-xs sm:text-sm text-gray-600">Service Type</label>
                  <p className="font-medium text-sm sm:text-base">{lead.service_type_names || lead.service_type || 'Not specified'}</p>
                </div>
                
                {/* Service Addons / Sub-services */}
                {subserviceNames.length > 0 && (
                  <div>
                    <label className="text-xs sm:text-sm text-gray-600 mb-1.5 sm:mb-2 block">Add-ons / Sub-services:</label>
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
                )}
                
                {lead.description && (
                  <div>
                    <label className="text-xs sm:text-sm text-gray-600">Description</label>
                    <p className="font-medium text-sm sm:text-base">{lead.description}</p>
                  </div>
                )}
                {lead.problem_description && (
                  <div>
                    <label className="text-xs sm:text-sm text-gray-600">Problem Description</label>
                    <p className="font-medium text-sm sm:text-base">{lead.problem_description}</p>
                  </div>
                )}
                {lead.estimated_amount && (
                  <div>
                    <label className="text-xs sm:text-sm text-gray-600">Estimated Amount</label>
                    <p className="font-medium text-base sm:text-lg text-green-600">₹{lead.estimated_amount}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Pickup & Delivery Details (show only when pickup selected) */}
            {lead.pickup_required && (
              <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-brand-primary" />
                  Pickup & Delivery
                </h2>

                <div className="space-y-4 sm:space-y-5">
                {/* Pickup */}
                <div>
                  <p className="text-sm sm:text-base font-semibold text-gray-800 mb-2">Pickup</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="text-xs sm:text-sm text-gray-600">Pickup Required</label>
                      <p className="font-medium text-sm sm:text-base">{lead.pickup_required ? 'Yes' : 'No'}</p>
                    </div>
                    <div>
                      <label className="text-xs sm:text-sm text-gray-600">Pickup Status</label>
                      <p className="font-medium text-sm sm:text-base">
                        {lead?.pickup_tracking?.pickup_status || lead.pickup_status || 'Pending'}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs sm:text-sm text-gray-600">Pickup Date</label>
                      <p className="font-medium text-sm sm:text-base">{getPickupDateText(lead)}</p>
                    </div>
                    <div>
                      <label className="text-xs sm:text-sm text-gray-600">Pickup Time</label>
                      <p className="font-medium text-sm sm:text-base">{getPickupTimeText(lead)}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs sm:text-sm text-gray-600">Pickup Address</label>
                      <p className="font-medium text-sm sm:text-base">
                        {lead?.pickup_tracking?.pickup_address || lead.pickup_address || lead.address || lead.customer_address || 'N/A'}
                      </p>
                    </div>
                    {lead.pickup_otp && (
                      <div>
                        <label className="text-xs sm:text-sm text-gray-600">Pickup OTP</label>
                        <p className="font-semibold font-mono text-sm sm:text-base">{lead.pickup_otp}</p>
                      </div>
                    )}
                    {(lead.assigned_pickup_boy?.full_name || lead.assigned_pickup_boy?.phone) && (
                      <div>
                        <label className="text-xs sm:text-sm text-gray-600">Pickup Boy</label>
                        <p className="font-medium text-sm sm:text-base">{lead.assigned_pickup_boy?.full_name || 'N/A'}</p>
                        {lead.assigned_pickup_boy?.phone && (
                          <p className="text-xs sm:text-sm text-gray-500">{lead.assigned_pickup_boy.phone}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Delivery */}
                <div className="pt-3 sm:pt-4 border-t">
                  <p className="text-sm sm:text-base font-semibold text-gray-800 mb-2">Delivery</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="text-xs sm:text-sm text-gray-600">Delivery Status</label>
                      <p className="font-medium text-sm sm:text-base">
                        {lead?.pickup_tracking?.drop_status || lead.delivery_status || 'Pending'}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs sm:text-sm text-gray-600">Delivery Address</label>
                      <p className="font-medium text-sm sm:text-base">
                        {lead?.pickup_tracking?.drop_address || lead.delivery_address || lead.address || lead.customer_address || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs sm:text-sm text-gray-600">Delivery Date</label>
                      <p className="font-medium text-sm sm:text-base">{getDropDateText(lead)}</p>
                    </div>
                    <div>
                      <label className="text-xs sm:text-sm text-gray-600">Delivery Time</label>
                      <p className="font-medium text-sm sm:text-base">{getDropTimeText(lead)}</p>
                    </div>
                  </div>
                </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4 sm:space-y-5 md:space-y-6">
            {/* Timeline */}
            <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
              <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">Timeline</h3>
                {historyLoading && (
                  <span className="text-[10px] sm:text-xs text-gray-500">Loading…</span>
                )}
              </div>
              <div className="space-y-3 sm:space-y-4 max-h-[420px] overflow-y-auto pr-1">
                {timelineItems.length === 0 ? (
                  <div className="text-xs sm:text-sm text-gray-600">No tracking updates yet.</div>
                ) : (
                  timelineItems.map((it) => (
                    <div key={it.key} className="flex items-start gap-2 sm:gap-3">
                      <div className={`${it.iconBg} p-1.5 sm:p-2 rounded-full flex-shrink-0`}>
                        <span className={`w-3.5 h-3.5 sm:w-4 sm:h-4 inline-flex items-center justify-center ${it.iconText} text-[10px] sm:text-xs font-bold`}>
                          •
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-gray-900">{it.title}</p>
                        {it.time && (
                          <p className="text-[10px] sm:text-xs text-gray-600">{it.time}</p>
                        )}
                        {it.meta && (
                          <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 line-clamp-2">
                            {it.meta}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Notes */}
            {(lead.validation_notes || lead.internal_notes) && (
              <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4">Notes</h3>
                {lead.validation_notes && (
                  <div className="mb-2 sm:mb-3">
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Validation Notes:</p>
                    <p className="text-xs sm:text-sm text-gray-800 mt-0.5 sm:mt-1">{lead.validation_notes}</p>
                  </div>
                )}
                {lead.internal_notes && (
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Internal Notes:</p>
                    <p className="text-xs sm:text-sm text-gray-800 mt-0.5 sm:mt-1">{lead.internal_notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Validation Modal */}
        {showValidation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 sm:p-5 md:p-6">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Mark Lead as Incomplete</h3>
              <p className="text-gray-600 text-xs sm:text-sm mb-3 sm:mb-4">
                Please provide details about what information is missing or incorrect:
              </p>
              <textarea
                value={validationNotes}
                onChange={(e) => setValidationNotes(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg p-2 sm:p-3 text-xs sm:text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                placeholder="e.g., Vehicle model incorrect, missing pickup address, etc."
              />
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4 sm:mt-5 md:mt-6">
                <button
                  onClick={() => {
                    setShowValidation(false);
                    setValidationNotes('');
                  }}
                  className="flex-1 btn-secondary text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleValidate(false)}
                  disabled={actionLoading || !validationNotes.trim()}
                  className="flex-1 btn-primary text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  {actionLoading ? 'Processing...' : 'Mark Incomplete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Workshop Assignment Modal */}
        {showWorkshopAssignment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-4 sm:p-5 md:p-6 my-4 sm:my-6 md:my-8">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">
                {isReassignment ? 'Change Workshop Assignment' : 'Assign Workshop'}
              </h3>
              
              {/* Reassignment Notice */}
              {isReassignment && lead.workshop && (
                <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-yellow-900">Currently Assigned To</p>
                      <p className="text-xs sm:text-sm text-yellow-800 mt-0.5 sm:mt-1">
                        {lead.workshop.name} - {lead.workshop.city}
                      </p>
                      <p className="text-[10px] sm:text-xs text-yellow-700 mt-1 sm:mt-2">
                        ⚠️ Workshop has not accepted yet. You can reassign to another workshop.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Priority Selection */}
              <div className="mb-3 sm:mb-4">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Priority Level</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-xs sm:text-sm focus:ring-2 focus:ring-brand-primary"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              {/* Workshop Search */}
              <div className="mb-3 sm:mb-4">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Search Workshops</label>
                <div className="relative">
                  <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                  <input
                    type="text"
                    value={workshopSearch}
                    onChange={(e) => setWorkshopSearch(e.target.value)}
                    placeholder="Search by name or city..."
                    className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                  />
                </div>
              </div>

              {/* Workshop List */}
              <div className="mb-3 sm:mb-4 max-h-60 sm:max-h-80 overflow-y-auto border border-gray-200 rounded-lg">
                {filteredWorkshops.length === 0 ? (
                  <p className="p-3 sm:p-4 text-center text-gray-500 text-xs sm:text-sm">No workshops found</p>
                ) : (
                  filteredWorkshops.map((workshop) => (
                    <div
                      key={workshop.id}
                      onClick={() => setSelectedWorkshop(workshop.id)}
                      className={`p-3 sm:p-4 cursor-pointer hover:bg-gray-50 transition border-b border-gray-100 ${
                        selectedWorkshop === workshop.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{workshop.name}</h4>
                          <p className="text-xs sm:text-sm text-gray-600 truncate">{workshop.city}, {workshop.state}</p>
                          <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 truncate">{workshop.contact_person} • {workshop.phone}</p>
                        </div>
                        <div className="text-left sm:text-right flex-shrink-0">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <span className="text-[10px] sm:text-xs font-medium">Rating: {workshop.rating || 'N/A'}</span>
                          </div>
                          <div className={`text-[10px] sm:text-xs mt-0.5 sm:mt-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded ${
                            workshop.capacity_status === 'AVAILABLE' ? 'bg-green-100 text-green-800' :
                            workshop.capacity_status === 'BUSY' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {workshop.capacity_status} ({workshop.active_leads_count} active)
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Assignment Notes */}
              <div className="mb-3 sm:mb-4">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Assignment Notes (Optional)</label>
                <textarea
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg p-2 sm:p-3 text-xs sm:text-sm focus:ring-2 focus:ring-brand-primary"
                  placeholder="Any special instructions or notes for the workshop..."
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    setShowWorkshopAssignment(false);
                    setSelectedWorkshop('');
                    setAssignmentNotes('');
                  }}
                  className="flex-1 btn-secondary text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignWorkshop}
                  disabled={actionLoading || !selectedWorkshop}
                  className="flex-1 btn-primary flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <span className="hidden sm:inline">Assign Workshop</span>
                      <span className="sm:hidden">Assign</span>
                      <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
