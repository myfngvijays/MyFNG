'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { CheckCircle, XCircle, Clock, User, MapPin, Car, Phone, Mail, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { formatDateTime } from "@/lib/utils";

interface PendingLead {
  id: string;
  lead_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  vehicle_number: string;
  vehicle_make: string;
  vehicle_model: string;
  pickup_address: string;
  city: string;
  service_type: string;
  estimated_amount: string;
  created_at: string;
  pickup_required: boolean;
}

export default function PendingLeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<PendingLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<PendingLead | null>(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPendingLeads();
  }, []);

  async function fetchPendingLeads() {
    const supabase = createClient();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('email', user.email)
        .single();

      if (!userProfile?.workshop_id) {
        toast.error('Workshop not found');
        return;
      }

      // Fetch leads with ASSIGNED_TO_WORKSHOP status
      const { data: pendingLeads, error } = await supabase
        .from('service_leads')
        .select('*')
        .eq('workshop_id', userProfile.workshop_id)
        .in('status', ['ASSIGNED_TO_WORKSHOP', 'PENDING'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching pending leads:', error);
        toast.error('Failed to fetch pending leads');
        return;
      }

      setLeads(pendingLeads || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(lead: PendingLead) {
    setProcessing(true);
    const supabase = createClient();

    try {
      const response = await fetch(`/api/workshop/leads/${lead.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to accept lead');
        return;
      }

      toast.success('Lead accepted successfully!');
      setShowAcceptModal(false);
      setSelectedLead(null);
      
      // Redirect to team assignment
      router.push(`/dashboard/workshop_admin/leads/${lead.id}/assign-team`);
    } catch (error) {
      console.error('Error accepting lead:', error);
      toast.error('Failed to accept lead');
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject() {
    if (!selectedLead || !rejectionReason) {
      toast.error('Please select a rejection reason');
      return;
    }

    setProcessing(true);

    try {
      const response = await fetch(`/api/workshop/leads/${selectedLead.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: rejectionReason,
          notes: rejectionNotes
        })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to reject lead');
        return;
      }

      toast.success('Lead rejected successfully');
      setShowRejectModal(false);
      setSelectedLead(null);
      setRejectionReason('');
      setRejectionNotes('');
      
      // Refresh leads
      fetchPendingLeads();
    } catch (error) {
      console.error('Error rejecting lead:', error);
      toast.error('Failed to reject lead');
    } finally {
      setProcessing(false);
    }
  }

  const rejectionReasons = [
    'Workshop at full capacity',
    'Vehicle model not supported',
    'Location too far',
    'Inadequate service pricing',
    'Technical limitation',
    'Staff unavailable',
    'Other'
  ];

  if (loading) {
    return (
      <DashboardLayout role="workshop_admin">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-6 rounded-lg shadow-lg">
          <h1 className="text-3xl font-bold text-yellow-300 drop-shadow-lg">📬 Pending Lead Acceptance</h1>
          <p className="text-white font-medium mt-1">Review and accept/reject assigned leads</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card bg-gradient-to-br from-yellow-50 to-yellow-100">
            <div className="flex items-center gap-3">
              <Clock className="w-10 h-10 text-yellow-600" />
              <div>
                <p className="text-sm text-gray-600">Awaiting Decision</p>
                <p className="text-3xl font-bold text-gray-800">{leads.length}</p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-green-50 to-green-100">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-10 h-10 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Requires Pickup</p>
                <p className="text-3xl font-bold text-gray-800">
                  {leads.filter(l => l.pickup_required).length}
                </p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
            <div className="flex items-center gap-3">
              <Car className="w-10 h-10 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Direct Drop-off</p>
                <p className="text-3xl font-bold text-gray-800">
                  {leads.filter(l => !l.pickup_required).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Leads List */}
        {leads.length === 0 ? (
          <div className="card text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">All Caught Up!</h3>
            <p className="text-gray-500">No pending leads awaiting your decision.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {leads.map((lead) => (
              <div key={lead.id} className="card hover:shadow-xl transition-shadow border-l-4 border-yellow-500">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  {/* Lead Info */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="badge-blue text-lg">{lead.lead_number}</span>
                      {lead.pickup_required && (
                        <span className="badge-yellow">🚚 Pickup Required</span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="font-semibold">{lead.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-500" />
                        <span>{lead.customer_phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4 text-gray-500" />
                        <span>{lead.vehicle_make} {lead.vehicle_model} - {lead.vehicle_number}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <span>{lead.city}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>Received: {formatDateTime(lead.created_at)}</span>
                    </div>

                    {lead.estimated_amount && (
                      <div className="text-lg font-semibold text-brand-primary">
                        Estimated Amount: ₹{lead.estimated_amount}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2 md:w-48">
                    <button
                      onClick={() => {
                        setSelectedLead(lead);
                        setShowAcceptModal(true);
                      }}
                      className="btn-primary flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Accept Lead
                    </button>
                    <button
                      onClick={() => {
                        setSelectedLead(lead);
                        setShowRejectModal(true);
                      }}
                      className="btn-secondary bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-5 h-5" />
                      Reject Lead
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Accept Confirmation Modal */}
        {showAcceptModal && selectedLead && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-xl font-bold mb-4 text-green-600">Accept Lead</h3>
              <p className="text-gray-700 mb-4">
                You are about to accept lead <strong>{selectedLead.lead_number}</strong> for{' '}
                <strong>{selectedLead.customer_name}</strong>.
              </p>
              <p className="text-sm text-gray-600 mb-6">
                After accepting, you'll be redirected to assign team members (Mechanic, Adviser, Pickupboy/Driver).
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleAccept(selectedLead)}
                  disabled={processing}
                  className="btn-primary flex-1"
                >
                  {processing ? 'Processing...' : 'Confirm Accept'}
                </button>
                <button
                  onClick={() => {
                    setShowAcceptModal(false);
                    setSelectedLead(null);
                  }}
                  disabled={processing}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Modal */}
        {showRejectModal && selectedLead && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-xl font-bold mb-4 text-red-600">Reject Lead</h3>
              <p className="text-gray-700 mb-4">
                Lead: <strong>{selectedLead.lead_number}</strong>
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="input w-full"
                    required
                  >
                    <option value="">Select a reason...</option>
                    {rejectionReasons.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    value={rejectionNotes}
                    onChange={(e) => setRejectionNotes(e.target.value)}
                    className="input w-full"
                    rows={3}
                    placeholder="Provide additional details..."
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleReject}
                  disabled={processing || !rejectionReason}
                  className="btn-secondary bg-red-600 hover:bg-red-700 text-white flex-1"
                >
                  {processing ? 'Processing...' : 'Confirm Reject'}
                </button>
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setSelectedLead(null);
                    setRejectionReason('');
                    setRejectionNotes('');
                  }}
                  disabled={processing}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

