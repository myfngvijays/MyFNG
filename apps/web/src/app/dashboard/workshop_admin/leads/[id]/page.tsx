'use client';

/**
 * Lead Detail Page - Complete 12 Sections
 * Task: WA-501 (Enhanced from WA-202)
 * 
 * Sections:
 * 1. Lead Header (Top Bar)
 * 2. Customer Details
 * 3. Vehicle Details
 * 4. Service Request
 * 5. Scheduling & Pickup
 * 6. Admin Actions
 * 7. Internal Assignment
 * 8. Job Card & Parts
 * 9. Media Section
 * 10. Extra Charges
 * 11. Audit & Quality
 * 12. Invoice
 * 13. Communication Logs
 * 14. Service History
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  ArrowLeft, Clock, AlertCircle, CheckCircle, Phone, Mail, MapPin,
  Car, Calendar, Package, User, FileText, XCircle
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  getSLAColor,
  getSLABackgroundColor,
  getTimeRemaining,
  formatTimeRemaining,
  getTimeSince,
  calculateLeadSLAStatus,
  type SLAStatus
} from '@/lib/services/slaService';
import InternalAssignment from '@/components/lead-detail/InternalAssignment';
import MediaSection from '@/components/lead-detail/MediaSection';
import ExtraChargesSection from '@/components/lead-detail/ExtraChargesSection';
import AuditSection from '@/components/lead-detail/AuditSection';
import InvoiceSection from '@/components/lead-detail/InvoiceSection';
import CommunicationLogs from '@/components/lead-detail/CommunicationLogs';
import ServiceHistory from '@/components/lead-detail/ServiceHistory';

export default function LeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const leadId = params.id as string;

  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [slaStatus, setSlaStatus] = useState<SLAStatus>('ON_TIME');
  const [timeRemaining, setTimeRemaining] = useState<any>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');

  useEffect(() => {
    if (leadId) {
      fetchLeadDetails();
    }
  }, [leadId]);

  // Update SLA status in real-time
  useEffect(() => {
    if (!lead) return;

    const updateSLA = () => {
      const status = calculateLeadSLAStatus({
        status: lead.status,
        assigned_at: lead.assigned_at,
        accepted_at: lead.accepted_at,
        sla_accept_deadline: lead.sla_accept_deadline,
        sla_assign_deadline: lead.sla_assign_deadline,
        sla_start_deadline: lead.sla_start_deadline,
        assigned_mechanic_id: lead.assigned_mechanic_id,
        lead_type: lead.lead_type,
      });
      setSlaStatus(status);

      // Get appropriate deadline
      let deadline = null;
      if (lead.status === 'ASSIGNED' && lead.sla_accept_deadline) {
        deadline = new Date(lead.sla_accept_deadline);
      } else if (lead.status === 'ACCEPTED' && lead.sla_assign_deadline) {
        deadline = new Date(lead.sla_assign_deadline);
      }

      if (deadline) {
        const remaining = getTimeRemaining(deadline, lead.lead_type);
        setTimeRemaining(remaining);
      }
    };

    updateSLA();
    const interval = setInterval(updateSLA, 1000);

    return () => clearInterval(interval);
  }, [lead]);


  async function fetchLeadDetails() {
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from('service_leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (error) {
        console.error('Error fetching lead:', error);
        alert('Lead not found');
        router.push('/dashboard/workshop_admin/leads');
        return;
      }

      if (data) {
        // Fetch service type names
        let serviceTypeIds = data.service_type_ids;
        if (typeof serviceTypeIds === 'string') {
          try {
            serviceTypeIds = JSON.parse(serviceTypeIds);
          } catch (e) {
            console.error('Failed to parse service_type_ids:', e);
            serviceTypeIds = [];
          }
        }

        if (serviceTypeIds && Array.isArray(serviceTypeIds) && serviceTypeIds.length > 0) {
          const { data: serviceTypes } = await supabase
            .from('service_types')
            .select('id, name')
            .in('id', serviceTypeIds);

          if (serviceTypes && serviceTypes.length > 0) {
            data.service_type_names = serviceTypes.map((st: any) => st.name);
          }
        }

        setLead(data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAcceptLead() {
    if (actionLoading) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (result.success) {
        alert('Lead accepted successfully!');
        await fetchLeadDetails();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error accepting lead:', error);
      alert('Failed to accept lead');
    } finally {
      setActionLoading(false);
    }
  }

  function handleRejectLead() {
    setRejectReason('');
    setRejectNotes('');
    setShowRejectModal(true);
  }

  async function submitRejection() {
    if (!rejectReason.trim() || rejectReason.length < 10) {
      alert('Please provide a rejection reason (minimum 10 characters)');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: rejectReason,
          notes: rejectNotes,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert('Lead rejected successfully!');
        setShowRejectModal(false);
        await fetchLeadDetails();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error rejecting lead:', error);
      alert('Failed to reject lead');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="workshop_admin">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!lead) {
    return (
      <DashboardLayout role="workshop_admin">
        <div className="text-center py-12">
          <p>Lead not found</p>
        </div>
      </DashboardLayout>
    );
  }

  const getStatusColor = (status: string) => {
    const colors: any = {
      NEW: 'bg-blue-100 text-blue-800',
      ASSIGNED: 'bg-yellow-100 text-yellow-800',
      ACCEPTED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      IN_PROGRESS: 'bg-purple-100 text-purple-800',
      COMPLETED: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <DashboardLayout role="workshop_admin">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Back Button */}
        <Link
          href="/dashboard/workshop_admin/leads"
          className="inline-flex items-center gap-2 text-brand-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Leads
        </Link>

        {/* === SECTION 1: LEAD HEADER === */}
        <div 
          className="card border-l-4"
          style={{ borderLeftColor: getSLAColor(slaStatus) }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-text-heading">{lead.lead_number}</h1>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(lead.status)}`}>
                  {lead.status.replace('_', ' ')}
                </span>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>Created {getTimeSince(lead.created_at)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-semibold">Priority:</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    lead.priority === 'URGENT' ? 'bg-red-100 text-red-800' :
                    lead.priority === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                    lead.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {lead.priority}
                  </span>
                </div>
              </div>
            </div>

            {/* SLA Indicator */}
            <div 
              className="px-4 py-3 rounded-lg text-center min-w-[150px]"
              style={{ backgroundColor: getSLABackgroundColor(slaStatus) }}
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                {slaStatus === 'ON_TIME' && <CheckCircle className="w-5 h-5" style={{ color: getSLAColor(slaStatus) }} />}
                {slaStatus === 'AT_RISK' && <AlertCircle className="w-5 h-5" style={{ color: getSLAColor(slaStatus) }} />}
                {slaStatus === 'BREACHED' && <XCircle className="w-5 h-5" style={{ color: getSLAColor(slaStatus) }} />}
                <span className="font-bold" style={{ color: getSLAColor(slaStatus) }}>
                  {slaStatus.replace('_', ' ')}
                </span>
              </div>
              {timeRemaining && (
                <div>
                  <div className="text-2xl font-mono font-bold" style={{ color: getSLAColor(slaStatus) }}>
                    {formatTimeRemaining(timeRemaining)}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">remaining</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* === SECTION 2: CUSTOMER DETAILS === */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-brand-primary" />
              Customer Details
            </h2>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600">Full Name</label>
                <p className="text-lg font-semibold">{lead.customer_name}</p>
              </div>

              <div>
                <label className="text-sm text-gray-600">Phone Number</label>
                <a 
                  href={`tel:${lead.customer_phone}`}
                  className="flex items-center gap-2 text-brand-primary hover:underline font-semibold"
                >
                  <Phone className="w-4 h-4" />
                  {lead.customer_phone}
                </a>
              </div>

              {lead.customer_email && (
                <div>
                  <label className="text-sm text-gray-600">Email</label>
                  <a 
                    href={`mailto:${lead.customer_email}`}
                    className="flex items-center gap-2 text-brand-primary hover:underline"
                  >
                    <Mail className="w-4 h-4" />
                    {lead.customer_email}
                  </a>
                </div>
              )}

              {lead.address && (
                <div>
                  <label className="text-sm text-gray-600">Address</label>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
                    <p className="text-gray-900">{lead.address}</p>
                  </div>
                  {(lead.city || lead.state || lead.pincode) && (
                    <p className="text-sm text-gray-600 ml-6">
                      {[lead.city, lead.state, lead.pincode].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              )}

              {lead.customer_special_notes && (
                <div>
                  <label className="text-sm text-gray-600">Special Notes</label>
                  <p className="text-gray-900 bg-yellow-50 p-3 rounded border border-yellow-200">
                    {lead.customer_special_notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* === SECTION 3: VEHICLE DETAILS === */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Car className="w-5 h-5 text-brand-primary" />
              Vehicle Details
            </h2>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600">Registration Number</label>
                <p className="text-lg font-bold text-gray-900">{lead.vehicle_number}</p>
              </div>

              {(lead.vehicle_make || lead.vehicle_model) && (
                <div>
                  <label className="text-sm text-gray-600">Make & Model</label>
                  <p className="text-lg font-semibold text-gray-900">
                    {[lead.vehicle_make, lead.vehicle_model, lead.vehicle_variant].filter(Boolean).join(' ')}
                  </p>
                </div>
              )}

              {lead.vehicle_year && (
                <div>
                  <label className="text-sm text-gray-600">Year</label>
                  <p className="font-semibold">{lead.vehicle_year}</p>
                </div>
              )}

              {lead.vehicle_fuel_type && (
                <div>
                  <label className="text-sm text-gray-600">Fuel Type</label>
                  <p className="font-semibold">{lead.vehicle_fuel_type}</p>
                </div>
              )}

              {lead.vehicle_odometer && (
                <div>
                  <label className="text-sm text-gray-600">Odometer Reading</label>
                  <p className="font-semibold">{lead.vehicle_odometer.toLocaleString()} km</p>
                </div>
              )}

              {lead.vehicle_vin && (
                <div>
                  <label className="text-sm text-gray-600">VIN</label>
                  <p className="font-mono text-sm">{lead.vehicle_vin}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* === SECTION 4: SERVICE REQUEST === */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-primary" />
            Service Request Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-gray-600">Service Type</label>
              <p className="text-lg font-semibold text-gray-900">
                {lead.service_type_names && lead.service_type_names.length > 0 
                  ? lead.service_type_names.join(', ') 
                  : lead.service_type}
              </p>
            </div>

            <div>
              <label className="text-sm text-gray-600">Lead Type</label>
              <p className="font-semibold">
                {lead.lead_type === 'NORMAL' ? 'Normal Service' :
                 lead.lead_type === 'RSA' ? 'RSA (Roadside Assistance)' :
                 'Home Service'}
              </p>
            </div>

            {lead.description && (
              <div className="md:col-span-2">
                <label className="text-sm text-gray-600">Problem Description</label>
                <p className="text-gray-900 bg-gray-50 p-4 rounded border border-gray-200">
                  {lead.description}
                </p>
              </div>
            )}

            {lead.estimated_amount && (
              <div>
                <label className="text-sm text-gray-600">Estimated Amount</label>
                <p className="text-2xl font-bold text-green-600">₹{lead.estimated_amount.toFixed(2)}</p>
              </div>
            )}

            {lead.payment_mode && (
              <div>
                <label className="text-sm text-gray-600">Payment Mode</label>
                <p className="font-semibold">{lead.payment_mode}</p>
              </div>
            )}

            {lead.coupon_code && (
              <div>
                <label className="text-sm text-gray-600">Coupon Applied</label>
                <p className="font-mono text-green-600">{lead.coupon_code}</p>
              </div>
            )}
          </div>
        </div>

        {/* === SECTION 5: SCHEDULING & PICKUP === */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-primary" />
            Scheduling & Pickup
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {lead.preferred_date && (
              <div>
                <label className="text-sm text-gray-600">Preferred Date</label>
                <p className="font-semibold">{new Date(lead.preferred_date).toLocaleDateString()}</p>
              </div>
            )}

            {lead.preferred_time_slot && (
              <div>
                <label className="text-sm text-gray-600">Preferred Time Slot</label>
                <p className="font-semibold">{lead.preferred_time_slot}</p>
              </div>
            )}

            <div className="md:col-span-2">
              <label className="text-sm text-gray-600">Pickup Required</label>
              <div className="flex items-center gap-2">
                {lead.pickup_required ? (
                  <>
                    <Package className="w-5 h-5 text-orange-500" />
                    <span className="font-semibold text-orange-600">Yes - Pickup Required</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-600">No pickup required</span>
                  </>
                )}
              </div>
            </div>

            {lead.pickup_required && lead.pickup_address && (
              <div className="md:col-span-2">
                <label className="text-sm text-gray-600">Pickup Address</label>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 mt-1" />
                  <p className="text-gray-900">{lead.pickup_address}</p>
                </div>
              </div>
            )}

            {lead.distance_from_workshop && (
              <div>
                <label className="text-sm text-gray-600">Distance from Workshop</label>
                <p className="font-semibold">{lead.distance_from_workshop.toFixed(1)} km</p>
              </div>
            )}
          </div>
        </div>

        {/* === SECTION 6: ADMIN ACTIONS === */}
        {lead.status === 'ASSIGNED' && (
          <div className="card bg-gray-50">
            <h2 className="text-xl font-bold mb-4">Admin Actions</h2>
            
            <div className="flex gap-4">
              <button
                onClick={handleAcceptLead}
                disabled={actionLoading}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white px-6 py-4 rounded-lg font-bold text-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle className="w-6 h-6" />
                {actionLoading ? 'Accepting...' : 'Accept Lead'}
              </button>
              
              <button
                onClick={handleRejectLead}
                disabled={actionLoading}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white px-6 py-4 rounded-lg font-bold text-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <XCircle className="w-6 h-6" />
                Reject Lead
              </button>
            </div>

            <p className="text-sm text-gray-600 mt-3 text-center">
              Review the lead details carefully before accepting or rejecting
            </p>
          </div>
        )}

        {lead.status === 'REJECTED' && lead.rejected_reason && (
          <div className="card bg-red-50 border-red-200">
            <h3 className="text-lg font-bold text-red-800 mb-2">Rejection Details</h3>
            <p className="text-red-700"><strong>Reason:</strong> {lead.rejected_reason}</p>
            {lead.rejection_notes && (
              <p className="text-red-700 mt-2"><strong>Notes:</strong> {lead.rejection_notes}</p>
            )}
            <p className="text-sm text-red-600 mt-2">Rejected at: {new Date(lead.rejected_at).toLocaleString()}</p>
          </div>
        )}

        {/* Section 7: Internal Assignment */}
        {lead.status !== 'NEW' && lead.status !== 'REJECTED' && (
          <InternalAssignment lead={lead} onUpdate={fetchLeadDetails} />
        )}

        {/* Section 9: Media Section */}
        {/* Owner view: media is view-only (upload removed as requested) */}
        <MediaSection lead={lead} onUpdate={fetchLeadDetails} canUpload={false} />

        {/* Section 10: Extra Charges */}
        {lead.status !== 'NEW' && lead.status !== 'REJECTED' && (
          <ExtraChargesSection lead={lead} onUpdate={fetchLeadDetails} />
        )}

        {/* Section 11: Audit & Quality */}
        {(lead.status === 'READY_FOR_DELIVERY' || lead.status === 'DELIVERED' || lead.status === 'CLOSED') && (
          <AuditSection lead={lead} onUpdate={fetchLeadDetails} />
        )}

        {/* Section 12: Invoice (keep visible after invoice generation too) */}
        {[
          'READY_FOR_BILLING',
          'INVOICE_GENERATED',
          'AWAITING_PAYMENT',
          'PARTIAL_PAYMENT',
          'PAID',
          'COD_PENDING',
          'READY_FOR_DELIVERY',
          'DELIVERED_TO_CUSTOMER',
          'DELIVERED',
          'CLOSED',
        ].includes(lead.status) && (
          <InvoiceSection lead={lead} onUpdate={fetchLeadDetails} />
        )}

        {/* Section 13: Communication Logs */}
        <CommunicationLogs lead={lead} />

        {/* Section 14: Service History */}
        <ServiceHistory lead={lead} />
      </div>


      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Reject Lead</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Minimum 10 characters required..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {rejectReason.length}/10 characters minimum
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Any additional information..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowRejectModal(false)}
                disabled={actionLoading}
                className="flex-1 btn btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={submitRejection}
                disabled={actionLoading || rejectReason.length < 10}
                className="flex-1 btn bg-red-500 hover:bg-red-600 text-white"
              >
                {actionLoading ? 'Rejecting...' : 'Reject Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

