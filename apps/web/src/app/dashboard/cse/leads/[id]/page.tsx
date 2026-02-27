'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { formatDateDMY, formatDateTime, formatTime12h } from "@/lib/utils";
import {
  Phone, 
  Mail,
  MapPin,
  Car,
  Building2,
  Wrench,
  User,
  Clock,
  DollarSign,
  FileText,
  Truck,
  Edit2,
  Save,
  X,
  AlertTriangle,
  MessageSquare,
  Loader2,
  CheckCircle,
  XCircle,
  Calendar,
  Star,
  Plus
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import SendWhatsAppModal from '@/components/shared/SendWhatsAppModal';

export default function CSELeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const leadId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lead, setLead] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'customer' | 'vehicle' | 'service' | 'pickup' | 'progress' | 'invoice' | 'tickets'>('overview');

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

  // Form states
  const [customerForm, setCustomerForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    customer_address: '',
    communication_preference: 'PHONE',
  });

  useEffect(() => {
    if (leadId) {
      fetchLeadDetail();
      if (activeTab === 'tickets') {
        fetchTickets();
      }
    }
  }, [leadId, activeTab]);

  const fetchLeadDetail = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const response = await fetch(`/api/cse/leads/${leadId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch lead');
      }

      const data = await response.json();
      if (data.success && data.lead) {
        setLead(data.lead);
        setCustomerForm({
          customer_name: data.lead.customer_name || '',
          customer_phone: data.lead.customer_phone || '',
          customer_email: data.lead.customer_email || '',
          customer_address: data.lead.customer_address || '',
          communication_preference: data.lead.communication_preference || 'PHONE',
        });
      }
    } catch (error: any) {
      console.error('Error fetching lead:', error);
      toast.error('Failed to load lead details');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCustomer = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/cse/leads/${leadId}/customer/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerForm),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Customer details updated successfully!');
        setIsEditingCustomer(false);
        fetchLeadDetail();
      } else {
        toast.error(data.error || 'Failed to update');
      }
    } catch (error: any) {
      console.error('Error updating customer:', error);
      toast.error('Failed to update customer details');
    } finally {
      setSaving(false);
    }
  };

  const handleReschedulePickup = async () => {
    const newDate = prompt('Enter new pickup date (YYYY-MM-DD):');
    const newTime = prompt('Enter new pickup time (HH:MM):');
    const reason = prompt('Reason for reschedule:');

    if (!newDate) {
      toast.error('Date is required');
      return;
    }

    try {
      const response = await fetch(`/api/cse/leads/${leadId}/pickup/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduled_pickup_date: newDate,
          scheduled_pickup_time: newTime || null,
          reason: reason || 'Rescheduled by CSE',
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Pickup rescheduled successfully!');
        fetchLeadDetail();
      } else {
        toast.error(data.error || 'Failed to reschedule');
      }
    } catch (error) {
      console.error('Error rescheduling:', error);
      toast.error('Failed to reschedule pickup');
    }
  };

  const handleRescheduleDrop = async () => {
    const newDate = prompt('Enter new delivery date (YYYY-MM-DD):');
    const newTime = prompt('Enter new delivery time (HH:MM):');
    const reason = prompt('Reason for reschedule:');

    if (!newDate) {
      toast.error('Date is required');
      return;
    }

    try {
      const response = await fetch(`/api/cse/leads/${leadId}/drop/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduled_delivery_date: newDate,
          scheduled_delivery_time: newTime || null,
          reason: reason || 'Rescheduled by CSE',
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Drop rescheduled successfully!');
        fetchLeadDetail();
      } else {
        toast.error(data.error || 'Failed to reschedule');
      }
    } catch (error) {
      console.error('Error rescheduling drop:', error);
      toast.error('Failed to reschedule drop');
    }
  };

  const handleCancelLead = async () => {
    const reason = prompt('Enter cancellation reason (required):');
    if (!reason) {
      toast.error('Cancellation reason is required');
      return;
    }

    if (!confirm('Are you sure you want to cancel this lead?')) {
      return;
    }

    try {
      const response = await fetch(`/api/cse/leads/${leadId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancellation_reason: reason }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Lead cancelled successfully!');
        router.push('/dashboard/cse');
      } else {
        toast.error(data.error || 'Failed to cancel');
      }
    } catch (error) {
      console.error('Error cancelling:', error);
      toast.error('Failed to cancel lead');
    }
  };

  const fetchTickets = async () => {
    try {
      const response = await fetch(`/api/cse/tickets?lead_id=${leadId}`);
      if (response.ok) {
        const data = await response.json();
        setTickets(data.tickets || []);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    }
  };

  const handleAddNote = async () => {
    const note = prompt('Enter internal note:');
    if (!note) return;

    try {
      const response = await fetch(`/api/cse/leads/${leadId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Note added successfully!');
        fetchLeadDetail();
      } else {
        toast.error(data.error || 'Failed to add note');
      }
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Failed to add note');
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="customer_service_executive">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 animate-spin text-indigo-600" />
        </div>
      </DashboardLayout>
    );
  }

  if (!lead) {
    return (
      <DashboardLayout role="customer_service_executive">
        <div className="text-center py-8 sm:py-10 md:py-12">
          <p className="text-gray-600 text-sm sm:text-base">Lead not found</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="customer_service_executive">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3">
              <FileText className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-indigo-600 flex-shrink-0" />
              <span className="truncate">Lead: {lead.lead_number}</span>
            </h1>
            <p className="text-gray-600 text-xs sm:text-sm mt-0.5 sm:mt-1">Customer Service Executive - Lead Details</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button
              onClick={handleAddNote}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-600 text-white text-xs sm:text-sm rounded-lg hover:bg-gray-700 flex-1 sm:flex-none"
            >
              <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Add Note
            </button>
            {lead.status !== 'CANCELLED' && lead.status !== 'CLOSED' && (
              <>
                <button
                  onClick={handleReschedulePickup}
                  className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white text-xs sm:text-sm rounded-lg hover:bg-blue-700 flex-1 sm:flex-none"
                >
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Reschedule Pickup</span>
                  <span className="sm:hidden">Reschedule</span>
                </button>
                <button
                  onClick={handleCancelLead}
                  className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 text-white text-xs sm:text-sm rounded-lg hover:bg-red-700 flex-1 sm:flex-none"
                >
                  <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Cancel Lead
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className={`inline-flex px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm font-semibold rounded-full ${
                lead.status === 'CLOSED' ? 'bg-green-100 text-green-800' :
                lead.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                lead.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {lead.status}
              </span>
            </div>
            <div className="text-xs sm:text-sm text-gray-600">
              Created: {formatDateTime(lead.created_at)}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200 overflow-x-auto">
            <nav className="flex -mb-px min-w-max sm:min-w-0">
              {[
                { id: 'overview', label: 'Overview', icon: FileText },
                { id: 'customer', label: 'Customer Info', icon: User },
                { id: 'vehicle', label: 'Vehicle Info', icon: Car },
                { id: 'service', label: 'Service Info', icon: Wrench },
                { id: 'pickup', label: 'Pickup/Drop', icon: Truck },
                { id: 'progress', label: 'Job Progress', icon: Clock },
                { id: 'invoice', label: 'Invoice & Billing', icon: DollarSign },
                { id: 'tickets', label: 'Tickets', icon: AlertTriangle },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-4 sm:p-5 md:p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                    <div className="text-xs sm:text-sm text-gray-600">Customer</div>
                    <div className="text-base sm:text-lg font-semibold">{lead.customer_name}</div>
                    <div className="text-xs sm:text-sm text-gray-500">{lead.customer_phone}</div>
                  </div>
                  <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                    <div className="text-xs sm:text-sm text-gray-600">Vehicle</div>
                    <div className="text-base sm:text-lg font-semibold">{lead.vehicle_number || 'N/A'}</div>
                    <div className="text-xs sm:text-sm text-gray-500">{lead.vehicle_model || 'N/A'}</div>
                  </div>
                  <div className="bg-gray-50 p-3 sm:p-4 rounded-lg sm:col-span-2 lg:col-span-1">
                    <div className="text-xs sm:text-sm text-gray-600">Workshop</div>
                    <div className="text-base sm:text-lg font-semibold">{lead.workshop?.name || 'N/A'}</div>
                    <div className="text-xs sm:text-sm text-gray-500">{lead.workshop?.city || 'N/A'}</div>
                  </div>
                </div>
                {lead.internal_notes && (
                  <div className="bg-yellow-50 p-3 sm:p-4 rounded-lg border-l-4 border-yellow-500">
                    <div className="text-xs sm:text-sm font-semibold text-yellow-800 mb-1.5 sm:mb-2">Internal Notes</div>
                    <div className="text-xs sm:text-sm text-yellow-700 whitespace-pre-wrap">{lead.internal_notes}</div>
                  </div>
                )}
              </div>
            )}

            {/* Customer Info Tab */}
            {activeTab === 'customer' && (
              <div className="space-y-3 sm:space-y-4">
                {isEditingCustomer ? (
                  <>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
                      <input
                        type="text"
                        value={customerForm.customer_name}
                        onChange={(e) => setCustomerForm({ ...customerForm, customer_name: e.target.value })}
                        className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Phone *</label>
                      <input
                        type="tel"
                        value={customerForm.customer_phone}
                        onChange={(e) => setCustomerForm({ ...customerForm, customer_phone: e.target.value })}
                        className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={customerForm.customer_email}
                        onChange={(e) => setCustomerForm({ ...customerForm, customer_email: e.target.value })}
                        className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Address</label>
                      <textarea
                        value={customerForm.customer_address}
                        onChange={(e) => setCustomerForm({ ...customerForm, customer_address: e.target.value })}
                        rows={3}
                        className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Communication Preference</label>
                      <select
                        value={customerForm.communication_preference}
                        onChange={(e) => setCustomerForm({ ...customerForm, communication_preference: e.target.value })}
                        className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="PHONE">Phone</option>
                        <option value="EMAIL">Email</option>
                        <option value="WHATSAPP">WhatsApp</option>
                        <option value="SMS">SMS</option>
                      </select>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <button
                        onClick={handleUpdateCustomer}
                        disabled={saving}
                        className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white text-xs sm:text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingCustomer(false);
                          fetchLeadDetail();
                        }}
                        className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-200 text-gray-700 text-xs sm:text-sm rounded-lg hover:bg-gray-300"
                      >
                        <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                        <div className="text-sm sm:text-base md:text-lg font-semibold">{lead.customer_name}</div>
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5 sm:gap-2">
                          <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                          Phone
                        </label>
                        <div className="text-sm sm:text-base md:text-lg font-semibold">{lead.customer_phone}</div>
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5 sm:gap-2">
                          <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                          Email
                        </label>
                        <div className="text-sm sm:text-base md:text-lg">{lead.customer_email || 'Not provided'}</div>
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5 sm:gap-2">
                          <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                          Address
                        </label>
                        <div className="text-sm sm:text-base md:text-lg">{lead.customer_address || 'Not provided'}</div>
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Communication Preference</label>
                        <div className="text-sm sm:text-base md:text-lg">{lead.communication_preference || 'PHONE'}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsEditingCustomer(true)}
                      className="mt-3 sm:mt-4 flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white text-xs sm:text-sm rounded-lg hover:bg-indigo-700 w-full sm:w-auto"
                    >
                      <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      Edit Customer Details
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Vehicle Info Tab */}
            {activeTab === 'vehicle' && (
              <div className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Vehicle Number</label>
                    <div className="text-sm sm:text-base md:text-lg font-semibold">{lead.vehicle_number || 'N/A'}</div>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Vehicle Model</label>
                    <div className="text-sm sm:text-base md:text-lg">{lead.vehicle_model || 'N/A'}</div>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Vehicle Make</label>
                    <div className="text-sm sm:text-base md:text-lg">{lead.vehicle_make || 'N/A'}</div>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Variant</label>
                    <div className="text-sm sm:text-base md:text-lg">{lead.vehicle_variant || 'N/A'}</div>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Fuel Type</label>
                    <div className="text-sm sm:text-base md:text-lg">{lead.fuel_type || 'N/A'}</div>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Odometer</label>
                    <div className="text-sm sm:text-base md:text-lg">{lead.odometer_reading ? `${lead.odometer_reading} km` : 'N/A'}</div>
                  </div>
                </div>
                <div className="bg-blue-50 p-3 sm:p-4 rounded-lg border-l-4 border-blue-500">
                  <p className="text-xs sm:text-sm text-blue-800">
                    <strong>Note:</strong> Vehicle information is view-only. CSE cannot modify vehicle details.
                  </p>
                </div>
              </div>
            )}

            {/* Service Info Tab */}
            {activeTab === 'service' && (
              <div className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Service Types</label>
                    <div className="text-sm sm:text-base md:text-lg">
                      {lead.service_type_names?.join(', ') || lead.service_type || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Add-ons</label>
                    <div className="text-sm sm:text-base md:text-lg">
                      {lead.service_addon_details?.map((a: any) => `${a.name} (₹${a.price})`).join(', ') || 'None'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Estimated Cost</label>
                    <div className="text-sm sm:text-base md:text-lg font-semibold">₹{lead.estimated_cost?.toLocaleString() || lead.estimated_amount?.toLocaleString() || 'N/A'}</div>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Workshop</label>
                    <div className="text-sm sm:text-base md:text-lg">{lead.workshop?.name || 'N/A'}</div>
                    {lead.workshop?.phone && (
                      <div className="text-xs sm:text-sm text-gray-500">{lead.workshop.phone}</div>
                    )}
                  </div>
                </div>
                {lead.problem_description && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Problem Description</label>
                    <div className="bg-gray-50 p-3 sm:p-4 rounded-lg text-xs sm:text-sm">{lead.problem_description}</div>
                  </div>
                )}
                <div className="bg-blue-50 p-3 sm:p-4 rounded-lg border-l-4 border-blue-500">
                  <p className="text-xs sm:text-sm text-blue-800">
                    <strong>Note:</strong> Service information is view-only. CSE can explain service breakdown and send service summary via SMS/WhatsApp.
                  </p>
                </div>
              </div>
            )}

            {/* Pickup/Drop Tab */}
            {activeTab === 'pickup' && (
              <div className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Pickup Date</label>
                    <div className="text-sm sm:text-base md:text-lg font-semibold">
                      {getPickupDateText(lead)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Pickup Time</label>
                    <div className="text-sm sm:text-base md:text-lg">{getPickupTimeText(lead)}</div>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Pickup Address</label>
                    <div className="text-sm sm:text-base md:text-lg">
                      {lead?.pickup_tracking?.pickup_address || lead.pickup_address || lead.customer_address || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Pickup Status</label>
                    <div className="text-sm sm:text-base md:text-lg">
                      {lead?.pickup_tracking?.pickup_status || lead.pickup_status || 'Pending'}
                    </div>
                  </div>
                  {lead.pickup_otp && (
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Pickup OTP</label>
                      <div className="text-sm sm:text-base md:text-lg font-mono font-semibold">{lead.pickup_otp}</div>
                    </div>
                  )}
                  {lead.assigned_pickup_boy && (
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Pickup Boy</label>
                      <div className="text-sm sm:text-base md:text-lg">{lead.assigned_pickup_boy.full_name || 'N/A'}</div>
                      {lead.assigned_pickup_boy.phone && (
                        <div className="text-xs sm:text-sm text-gray-500">{lead.assigned_pickup_boy.phone}</div>
                      )}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Delivery Date</label>
                    <div className="text-sm sm:text-base md:text-lg font-semibold">
                      {getDropDateText(lead)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Delivery Time</label>
                    <div className="text-sm sm:text-base md:text-lg">{getDropTimeText(lead)}</div>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Delivery Address</label>
                    <div className="text-sm sm:text-base md:text-lg">
                      {lead?.pickup_tracking?.drop_address || lead.delivery_address || lead.customer_address || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Delivery Status</label>
                    <div className="text-sm sm:text-base md:text-lg">
                      {lead?.pickup_tracking?.drop_status || lead.delivery_status || 'Pending'}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    onClick={handleReschedulePickup}
                    className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white text-xs sm:text-sm rounded-lg hover:bg-blue-700"
                  >
                    <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Reschedule Pickup
                  </button>
                  <button
                    onClick={handleRescheduleDrop}
                    className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white text-xs sm:text-sm rounded-lg hover:bg-green-700"
                  >
                    <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Reschedule Drop
                  </button>
                </div>
              </div>
            )}

            {/* Job Progress Tab */}
            {activeTab === 'progress' && (
              <div className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Current Status</label>
                    <div className="text-sm sm:text-base md:text-lg font-semibold">{lead.status}</div>
                  </div>
                  {lead.assigned_mechanic && (
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Assigned Mechanic</label>
                      <div className="text-sm sm:text-base md:text-lg">{lead.assigned_mechanic.full_name || 'N/A'}</div>
                    </div>
                  )}
                  {lead.assigned_supervisor && (
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Supervisor</label>
                      <div className="text-sm sm:text-base md:text-lg">{lead.assigned_supervisor.full_name || 'N/A'}</div>
                    </div>
                  )}
                  {lead.expected_delivery_time && (
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Expected Delivery</label>
                      <div className="text-sm sm:text-base md:text-lg">{formatDateTime(lead.expected_delivery_time)}</div>
                    </div>
                  )}
                </div>
                {lead.extra_charges && lead.extra_charges.length > 0 && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Extra Charges Requested</label>
                    <div className="space-y-2">
                      {lead.extra_charges.map((charge: any, idx: number) => (
                        <div key={idx} className="bg-yellow-50 p-2.5 sm:p-3 rounded-lg border-l-4 border-yellow-500">
                          <div className="font-semibold text-xs sm:text-sm">{charge.description}</div>
                          <div className="text-xs sm:text-sm text-gray-600">Amount: ₹{charge.amount}</div>
                          {charge.reason && <div className="text-xs sm:text-sm text-gray-600">Reason: {charge.reason}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Invoice & Billing Tab */}
            {activeTab === 'invoice' && (
              <div className="space-y-3 sm:space-y-4">
                {lead.invoice ? (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
                        <div className="text-sm sm:text-base md:text-lg font-semibold">{lead.invoice.invoice_number || 'N/A'}</div>
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Final Amount</label>
                        <div className="text-sm sm:text-base md:text-lg font-semibold">₹{lead.invoice.final_amount?.toLocaleString() || 'N/A'}</div>
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Base Amount</label>
                        <div className="text-sm sm:text-base md:text-lg">₹{lead.invoice.base_amount?.toLocaleString() || 'N/A'}</div>
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Parts Cost</label>
                        <div className="text-sm sm:text-base md:text-lg">₹{lead.invoice.parts_cost?.toLocaleString() || '0'}</div>
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Extra Charges</label>
                        <div className="text-sm sm:text-base md:text-lg">₹{lead.invoice.extra_charges_amount?.toLocaleString() || '0'}</div>
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Tax</label>
                        <div className="text-sm sm:text-base md:text-lg">₹{lead.invoice.total_tax?.toLocaleString() || '0'}</div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <button className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white text-xs sm:text-sm rounded-lg hover:bg-green-700">
                        <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        Email Invoice
                      </button>
                      <button
                        onClick={() => setShowWhatsAppModal(true)}
                        className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white text-xs sm:text-sm rounded-lg hover:bg-blue-700"
                      >
                        <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        Send via WhatsApp
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 sm:py-10 md:py-12 bg-gray-50 rounded-lg">
                    <FileText className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
                    <p className="text-gray-600 text-sm sm:text-base">No invoice generated yet</p>
                  </div>
                )}
              </div>
            )}

            {/* Tickets Tab */}
            {activeTab === 'tickets' && (
              <div className="space-y-3 sm:space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <h3 className="text-base sm:text-lg font-semibold">Support Tickets</h3>
                  <Link
                    href={`/dashboard/cse/tickets/create?lead_id=${leadId}`}
                    className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white text-xs sm:text-sm rounded-lg hover:bg-indigo-700 w-full sm:w-auto"
                  >
                    <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Create Ticket
                  </Link>
                </div>
                {tickets.length === 0 ? (
                  <div className="text-center py-8 sm:py-10 md:py-12 bg-gray-50 rounded-lg">
                    <AlertTriangle className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
                    <p className="text-gray-600 text-sm sm:text-base">No tickets found</p>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1.5 sm:mt-2">Create a ticket to track customer issues</p>
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {tickets.map((ticket) => (
                      <Link
                        key={ticket.id}
                        href={`/dashboard/cse/tickets/${ticket.id}`}
                        className="block bg-white p-3 sm:p-4 rounded-lg border border-gray-200 hover:border-indigo-500 hover:shadow-md transition-all"
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-sm sm:text-base text-gray-900">{ticket.ticket_number}</div>
                            <div className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">{ticket.title}</div>
                            <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
                              {ticket.issue_category?.replace(/_/g, ' ')} • {formatDateTime(ticket.created_at)}
                            </div>
                          </div>
                          <span className={`px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full flex-shrink-0 ${
                            ticket.status === 'OPEN' ? 'bg-red-100 text-red-800' :
                            ticket.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                            ticket.status === 'RESOLVED' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {ticket.status}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
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
        invoiceId={lead?.invoice?.id}
      />
    </DashboardLayout>
  );
}

