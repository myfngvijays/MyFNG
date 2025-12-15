'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { CheckCircle, XCircle, Clock, DollarSign, AlertTriangle, User, Car, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

interface ExtraWorkRequest {
  id: string;
  lead_id: string;
  lead_number: string;
  customer_name: string;
  vehicle_number: string;
  mechanic_name: string;
  description: string;
  reason: string;
  amount: number;
  category: string;
  is_urgent: boolean;
  created_at: string;
  status: string;
}

export default function ExtraWorkApprovalsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<ExtraWorkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ExtraWorkRequest | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchExtraWorkRequests();
    
    // Setup real-time subscription
    const supabase = createClient();
    const channel = supabase
      .channel('extra-work-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_extra_charges'
        },
        (payload) => {
          console.log('Extra work request updated:', payload);
          fetchExtraWorkRequests();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  async function fetchExtraWorkRequests() {
    const supabase = createClient();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const email = (user.email || '').trim();
      const phone = (user.phone || '').trim();

      const { data: userProfileByEmail } = email
        ? await supabase.from('users_login').select('workshop_id').ilike('email', email).maybeSingle()
        : { data: null };

      const { data: userProfileByPhone } = !userProfileByEmail && phone
        ? await supabase.from('users_login').select('workshop_id').eq('phone', phone).maybeSingle()
        : { data: null };

      const userProfile = userProfileByEmail || userProfileByPhone;

      if (!userProfile?.workshop_id) {
        toast.error('User profile not found');
        return;
      }

      // Fetch pending extra work requests
      const { data: extraWork, error } = await supabase
        .from('lead_extra_charges')
        .select(`
          id,
          lead_id,
          description,
          reason,
          amount,
          category,
          is_urgent,
          created_at,
          status,
          requested_by,
          service_leads!inner(
            lead_number,
            customer_name,
            vehicle_number,
            workshop_id
          )
        `)
        .eq('service_leads.workshop_id', userProfile.workshop_id)
        .eq('status', 'PENDING')
        .order('is_urgent', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching extra work:', error);
        toast.error('Failed to fetch extra work requests');
        return;
      }

      // Fetch mechanic names
      const requestsWithMechanics = await Promise.all((extraWork || []).map(async (req: any) => {
        const { data: mechanic } = await supabase
          .from('users_login')
          .select('full_name')
          .eq('id', req.requested_by)
          .single();

        return {
          id: req.id,
          lead_id: req.lead_id,
          lead_number: req.service_leads.lead_number,
          customer_name: req.service_leads.customer_name,
          vehicle_number: req.service_leads.vehicle_number,
          mechanic_name: mechanic?.full_name || 'Unknown',
          description: req.description,
          reason: req.reason,
          amount: parseFloat(req.amount),
          category: req.category,
          is_urgent: req.is_urgent,
          created_at: req.created_at,
          status: req.status
        };
      }));

      setRequests(requestsWithMechanics);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load extra work requests');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    if (!selectedRequest) return;

    const finalAmount = approvedAmount ? parseFloat(approvedAmount) : selectedRequest.amount;

    if (isNaN(finalAmount) || finalAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setProcessing(true);

    try {
      const response = await fetch(`/api/supervisor/extra-work/${selectedRequest.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: approvalNotes,
          approved_amount: finalAmount
        })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to approve extra work');
        return;
      }

      toast.success(`Extra work approved: ₹${finalAmount}`);
      setShowApproveModal(false);
      setSelectedRequest(null);
      setApprovalNotes('');
      setApprovedAmount('');
      fetchExtraWorkRequests();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to approve extra work');
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject() {
    if (!selectedRequest || !rejectionReason) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setProcessing(true);

    try {
      const response = await fetch(`/api/supervisor/extra-work/${selectedRequest.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: rejectionReason,
          notes: approvalNotes
        })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to reject extra work');
        return;
      }

      toast.success('Extra work request rejected');
      setShowRejectModal(false);
      setSelectedRequest(null);
      setRejectionReason('');
      setApprovalNotes('');
      fetchExtraWorkRequests();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to reject extra work');
    } finally {
      setProcessing(false);
    }
  }

  const getCategoryBadge = (category: string) => {
    const badges: Record<string, string> = {
      'PARTS_REPLACEMENT': 'badge-blue',
      'ADDITIONAL_SERVICE': 'badge-green',
      'URGENT_REPAIR': 'badge-red',
      'EXTENDED_WORK': 'badge-yellow',
      'OTHER': 'badge-gray'
    };
    return badges[category] || 'badge-gray';
  };

  if (loading) {
    return (
      <DashboardLayout role="workshop_supervisor">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_supervisor">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-300 drop-shadow-lg">💰 Extra Work Approvals</h1>
          <p className="text-white font-medium text-sm sm:text-base mt-0.5 sm:mt-1">Review and approve mechanic's extra work requests</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="card bg-gradient-to-br from-yellow-50 to-yellow-100">
            <div className="flex items-center gap-2 sm:gap-3">
              <Clock className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-yellow-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Pending Approval</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-800">{requests.length}</p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-red-50 to-red-100">
            <div className="flex items-center gap-2 sm:gap-3">
              <AlertTriangle className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-red-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Urgent Requests</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-800">
                  {requests.filter(r => r.is_urgent).length}
                </p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-green-50 to-green-100 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 sm:gap-3">
              <DollarSign className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-green-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Total Amount</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-800">
                  ₹{requests.reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Requests List */}
        {requests.length === 0 ? (
          <div className="card text-center py-8 sm:py-10 md:py-12">
            <CheckCircle className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-green-500 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-1.5 sm:mb-2">All Caught Up!</h3>
            <p className="text-gray-500 text-sm sm:text-base">No pending extra work requests.</p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {requests.map((request) => (
              <div 
                key={request.id} 
                className={`card hover:shadow-xl transition-shadow border-l-4 ${
                  request.is_urgent ? 'border-red-500 bg-red-50' : 'border-orange-500'
                }`}
              >
                <div className="space-y-3 sm:space-y-4">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="badge-blue text-sm sm:text-base md:text-lg">{request.lead_number}</span>
                      <span className={getCategoryBadge(request.category)}>
                        {request.category.replace(/_/g, ' ')}
                      </span>
                      {request.is_urgent && (
                        <span className="badge-red flex items-center gap-1 text-[10px] sm:text-xs">
                          <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
                          URGENT
                        </span>
                      )}
                    </div>
                    <div className="text-left sm:text-right flex-shrink-0">
                      <p className="text-lg sm:text-xl md:text-2xl font-bold text-orange-600">₹{request.amount.toFixed(2)}</p>
                      <p className="text-[10px] sm:text-xs text-gray-500">
                        {new Date(request.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1.5 sm:space-y-2">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500 flex-shrink-0" />
                        <span className="font-semibold text-sm sm:text-base truncate">{request.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <Car className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500 flex-shrink-0" />
                        <span className="text-xs sm:text-sm truncate">{request.vehicle_number}</span>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs sm:text-sm text-gray-600">Requested by:</p>
                      <p className="font-semibold text-sm sm:text-base truncate">{request.mechanic_name}</p>
                    </div>
                  </div>

                  {/* Description & Reason */}
                  <div className="space-y-2 sm:space-y-3">
                    <div className="bg-white p-2.5 sm:p-3 rounded border">
                      <p className="text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1 flex items-center gap-1.5 sm:gap-2">
                        <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                        Description:
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600">{request.description}</p>
                    </div>

                    <div className="bg-white p-2.5 sm:p-3 rounded border">
                      <p className="text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">Reason:</p>
                      <p className="text-xs sm:text-sm text-gray-600">{request.reason}</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
                    <button
                      onClick={() => {
                        setSelectedRequest(request);
                        setApprovedAmount(request.amount.toString());
                        setShowApproveModal(true);
                      }}
                      className="btn-primary flex-1 flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                    >
                      <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowRejectModal(true);
                      }}
                      className="btn-secondary bg-red-600 hover:bg-red-700 text-white flex-1 flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                    >
                      <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Approve Modal */}
        {showApproveModal && selectedRequest && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-5 md:p-6">
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-green-600">Approve Extra Work</h3>
              <p className="text-sm sm:text-base text-gray-700 mb-3 sm:mb-4">
                Lead: <strong>{selectedRequest.lead_number}</strong>
              </p>

              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    Requested Amount
                  </label>
                  <p className="text-xl sm:text-2xl font-bold text-orange-600">₹{selectedRequest.amount.toFixed(2)}</p>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    Approved Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(e.target.value)}
                    className="input w-full text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
                    You can modify the amount if needed
                  </p>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    Approval Notes (Optional)
                  </label>
                  <textarea
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    className="input w-full text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                    rows={3}
                    placeholder="Any notes or conditions..."
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4 sm:mt-5 md:mt-6 pt-4 border-t">
                <button
                  onClick={handleApprove}
                  disabled={processing}
                  className="btn-primary bg-green-600 hover:bg-green-700 flex-1 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  {processing ? 'Approving...' : 'Approve'}
                </button>
                <button
                  onClick={() => {
                    setShowApproveModal(false);
                    setSelectedRequest(null);
                    setApprovalNotes('');
                    setApprovedAmount('');
                  }}
                  disabled={processing}
                  className="btn-secondary flex-1 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Modal */}
        {showRejectModal && selectedRequest && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-5 md:p-6">
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-red-600">Reject Extra Work</h3>
              <p className="text-sm sm:text-base text-gray-700 mb-3 sm:mb-4">
                Lead: <strong>{selectedRequest.lead_number}</strong><br />
                Amount: <strong>₹{selectedRequest.amount.toFixed(2)}</strong>
              </p>

              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="input w-full text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                    rows={3}
                    placeholder="Explain why this request is being rejected..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    className="input w-full text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                    rows={2}
                    placeholder="Suggestions or alternative approaches..."
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4 sm:mt-5 md:mt-6 pt-4 border-t">
                <button
                  onClick={handleReject}
                  disabled={processing || !rejectionReason}
                  className="btn-secondary bg-red-600 hover:bg-red-700 text-white flex-1 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  {processing ? 'Rejecting...' : 'Reject Request'}
                </button>
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setSelectedRequest(null);
                    setRejectionReason('');
                    setApprovalNotes('');
                  }}
                  disabled={processing}
                  className="btn-secondary flex-1 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
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

