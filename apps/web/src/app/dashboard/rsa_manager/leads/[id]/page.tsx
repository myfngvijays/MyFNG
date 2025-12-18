'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import DashboardLayout from '@/components/DashboardLayout';
import { RSAManagerService } from '@/lib/services/rsaManagerService';
import { formatDateTime } from '@/lib/utils';
import {
  ArrowLeft, MapPin, Phone, Mail, Car, Wrench,
  Clock, User, AlertCircle, CheckCircle, XCircle,
  MessageSquare, Calendar, DollarSign, Image as ImageIcon
} from 'lucide-react';
import Link from 'next/link';

export default function RSALeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClientComponentClient();
  
  const [lead, setLead] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [managers, setManagers] = useState<any[]>([]);
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [showAssignManager, setShowAssignManager] = useState(false);
  const [showAssignMechanic, setShowAssignMechanic] = useState(false);
  const [showUpdateStatus, setShowUpdateStatus] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [selectedMechanicId, setSelectedMechanicId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [remark, setRemark] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (params.id) {
      fetchLeadDetail();
      fetchTimeline();
      fetchManagers();
    }
  }, [params.id]);

  const fetchUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id, full_name, email')
        .eq('id', authUser.id)
        .single();
      setUser(userProfile);
    }
  };

  const fetchLeadDetail = async () => {
    setLoading(true);
    try {
      const leadData = await RSAManagerService.getLeadById(params.id as string);
      setLead(leadData);
    } catch (error) {
      console.error('Error fetching lead:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeline = async () => {
    try {
      const timelineData = await RSAManagerService.getLeadTimeline(params.id as string);
      setTimeline(timelineData);
    } catch (error) {
      console.error('Error fetching timeline:', error);
    }
  };

  const fetchManagers = async () => {
    try {
      const managersData = await RSAManagerService.getAllManagers();
      setManagers(managersData);
    } catch (error) {
      console.error('Error fetching managers:', error);
    }
  };

  const handleClaimLead = async () => {
    if (!user) return;
    
    try {
      const result = await RSAManagerService.claimLead(
        params.id as string,
        user.id,
        user.full_name || user.email
      );
      
      if (result.success) {
        alert('Lead claimed successfully!');
        fetchLeadDetail();
        fetchTimeline();
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Error claiming lead:', error);
      alert('Failed to claim lead');
    }
  };

  const handleAssignToManager = async () => {
    if (!selectedManagerId || !user) return;
    
    try {
      const result = await RSAManagerService.assignLead(
        params.id as string,
        user.id,
        selectedManagerId,
        user.full_name || user.email
      );
      
      if (result.success) {
        alert('Lead assigned successfully!');
        setShowAssignManager(false);
        fetchLeadDetail();
        fetchTimeline();
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Error assigning lead:', error);
      alert('Failed to assign lead');
    }
  };

  const handleSearchMechanics = async () => {
    if (!lead) return;
    
    try {
      const mechanicsData = await RSAManagerService.searchMechanics({
        pincode: lead.pincode,
        serviceTag: lead.service_type
      });
      setMechanics(mechanicsData);
      setShowAssignMechanic(true);
    } catch (error) {
      console.error('Error searching mechanics:', error);
      alert('Failed to search mechanics');
    }
  };

  const handleAssignMechanic = async () => {
    if (!selectedMechanicId) return;
    
    try {
      const result = await RSAManagerService.assignMechanic(
        params.id as string,
        selectedMechanicId,
        {
          payment: paymentAmount ? parseFloat(paymentAmount) : undefined,
          remark: remark || undefined
        }
      );
      
      if (result.success) {
        alert('Mechanic assigned successfully!');
        setShowAssignMechanic(false);
        setSelectedMechanicId('');
        setPaymentAmount('');
        setRemark('');
        fetchLeadDetail();
        fetchTimeline();
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Error assigning mechanic:', error);
      alert('Failed to assign mechanic');
    }
  };

  const handleUpdateStatus = async () => {
    if (!newStatus) return;
    
    try {
      const result = await RSAManagerService.updateLeadStatus(
        params.id as string,
        newStatus,
        statusNotes
      );
      
      if (result.success) {
        alert('Status updated successfully!');
        setShowUpdateStatus(false);
        setNewStatus('');
        setStatusNotes('');
        fetchLeadDetail();
        fetchTimeline();
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      'pending': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
      'assigned': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Assigned' },
      'assigned_to_manager': { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Assigned to Manager' },
      'assigned_to_mechanic': { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Assigned to Mechanic' },
      'in_progress': { bg: 'bg-orange-100', text: 'text-orange-800', label: 'In Progress' },
      'completed': { bg: 'bg-green-100', text: 'text-green-800', label: 'Completed' },
      'cancelled': { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled' },
    };
    
    const badge = badges[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
    return (
      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <DashboardLayout role="rsa_manager">
        <div className="p-3 sm:p-4 md:p-5 lg:p-6">
          <div className="text-center py-8 sm:py-10 md:py-12">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-red-600 mx-auto"></div>
            <p className="mt-3 sm:mt-4 text-gray-600 text-xs sm:text-sm md:text-base">Loading lead details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!lead) {
    return (
      <DashboardLayout role="rsa_manager">
        <div className="p-3 sm:p-4 md:p-5 lg:p-6">
          <div className="text-center py-8 sm:py-10 md:py-12">
            <AlertCircle className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-gray-400 mx-auto mb-2 sm:mb-3 md:mb-4" />
            <p className="text-gray-600 text-xs sm:text-sm md:text-base">Lead not found</p>
            <Link href="/dashboard/rsa_manager" className="text-red-600 hover:underline mt-2 sm:mt-3 md:mt-4 inline-block text-xs sm:text-sm md:text-base">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="rsa_manager">
      <div className="p-3 sm:p-4 md:p-5 lg:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-5 md:mb-6">
          <Link
            href="/dashboard/rsa_manager"
            className="flex items-center gap-1.5 sm:gap-2 text-gray-600 hover:text-gray-900 text-xs sm:text-sm md:text-base"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Back to Dashboard</span>
          </Link>
          <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
            {!lead.assigned_manager_id && (
              <button
                onClick={handleClaimLead}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs sm:text-sm flex-1 sm:flex-initial"
              >
                Claim Lead
              </button>
            )}
            {lead.assigned_manager_id === user?.id && (
              <>
                <button
                  onClick={() => setShowUpdateStatus(true)}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs sm:text-sm flex-1 sm:flex-initial"
                >
                  Update Status
                </button>
                <button
                  onClick={() => setShowAssignManager(true)}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm flex-1 sm:flex-initial"
                >
                  Assign to Manager
                </button>
                {!lead.assigned_mechanic_id && (
                  <button
                    onClick={handleSearchMechanics}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs sm:text-sm flex-1 sm:flex-initial"
                  >
                    Assign Mechanic
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Lead Info Card */}
        <div className="bg-white rounded-lg shadow-lg p-3 sm:p-4 md:p-5 lg:p-6 mb-4 sm:mb-5 md:mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1.5 sm:mb-2">{lead.customer_name}</h1>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {getStatusBadge(lead.lead_status || lead.complaint_status)}
                <span className={`px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm font-semibold rounded ${
                  lead.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                  lead.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                  lead.priority === 'medium' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {lead.priority?.toUpperCase() || 'MEDIUM'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 md:gap-6 mt-4 sm:mt-5 md:mt-6">
            {/* Customer Info */}
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
                <User className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                Customer Information
              </h3>
              <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                <div className="flex items-center gap-1.5 sm:gap-2 text-gray-600">
                  <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span>{lead.contact_number}</span>
                </div>
                {lead.alternate_number && (
                  <div className="flex items-center gap-1.5 sm:gap-2 text-gray-600">
                    <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span>Alt: {lead.alternate_number}</span>
                  </div>
                )}
                {lead.address && (
                  <div className="flex items-start gap-1.5 sm:gap-2 text-gray-600">
                    <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 mt-0.5 flex-shrink-0" />
                    <span>{lead.address} {lead.pincode ? `- ${lead.pincode}` : ''}</span>
                  </div>
                )}
                {lead.location_link && (
                  <a
                    href={lead.location_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 sm:gap-2 text-red-600 hover:underline"
                  >
                    <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    View on Map
                  </a>
                )}
              </div>
            </div>

            {/* Vehicle Info */}
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
                <Car className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                Vehicle Information
              </h3>
              <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-gray-600">
                <div><span className="font-medium">Number:</span> {lead.vehicle_number}</div>
                {lead.vehicle_model && (
                  <div><span className="font-medium">Model:</span> {lead.vehicle_model}</div>
                )}
                <div><span className="font-medium">Service Type:</span> {lead.service_type || 'N/A'}</div>
                {lead.problem && (
                  <div className="mt-1.5 sm:mt-2">
                    <span className="font-medium">Problem:</span>
                    <p className="text-gray-700 mt-0.5 sm:mt-1">{lead.problem}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Assignment Info */}
          <div className="mt-4 sm:mt-5 md:mt-6 pt-4 sm:pt-5 md:pt-6 border-t border-gray-200">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3">Assignment Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
              {lead.registered_by_name && (
                <div>
                  <span className="font-medium text-gray-600">Registered By:</span>
                  <p className="text-gray-900">{lead.registered_by_name}</p>
                  <p className="text-gray-500 text-[10px] sm:text-xs">
                    {formatDateTime(lead.lead_registered_at)}
                  </p>
                </div>
              )}
              {lead.assigned_manager_name && (
                <div>
                  <span className="font-medium text-gray-600">Assigned Manager:</span>
                  <p className="text-gray-900">{lead.assigned_manager_name}</p>
                  {lead.assigned_to_manager_at && (
                    <p className="text-gray-500 text-[10px] sm:text-xs">
                      {formatDateTime(lead.assigned_to_manager_at)}
                    </p>
                  )}
                </div>
              )}
              {lead.assigned_mechanic_name && (
                <div>
                  <span className="font-medium text-gray-600">Assigned Mechanic:</span>
                  <p className="text-gray-900">{lead.assigned_mechanic_name}</p>
                  {lead.assigned_mechanic_contact && (
                    <p className="text-gray-600 text-xs sm:text-sm">{lead.assigned_mechanic_contact}</p>
                  )}
                  {lead.mechanic_assigned_datetime && (
                    <p className="text-gray-500 text-[10px] sm:text-xs">
                      Assigned: {formatDateTime(lead.mechanic_assigned_datetime)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Payment Info */}
          {lead.customer_quoted_amount && (
            <div className="mt-4 sm:mt-5 md:mt-6 pt-4 sm:pt-5 md:pt-6 border-t border-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                Payment Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm">
                <div>
                  <span className="font-medium text-gray-600">Quoted Amount:</span>
                  <p className="text-gray-900 text-base sm:text-lg font-semibold">₹{lead.customer_quoted_amount}</p>
                </div>
                {lead.payment_to_mechanic && (
                  <div>
                    <span className="font-medium text-gray-600">Payment to Mechanic:</span>
                    <p className="text-gray-900">₹{lead.payment_to_mechanic}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Remarks */}
          {(lead.remark || lead.assigned_remark || lead.dispatch_remark) && (
            <div className="mt-4 sm:mt-5 md:mt-6 pt-4 sm:pt-5 md:pt-6 border-t border-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
                <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                Remarks
              </h3>
              <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                {lead.remark && (
                  <div>
                    <span className="font-medium text-gray-600">General:</span>
                    <p className="text-gray-700">{lead.remark}</p>
                  </div>
                )}
                {lead.assigned_remark && (
                  <div>
                    <span className="font-medium text-gray-600">Assignment:</span>
                    <p className="text-gray-700">{lead.assigned_remark}</p>
                  </div>
                )}
                {lead.dispatch_remark && (
                  <div>
                    <span className="font-medium text-gray-600">Dispatch:</span>
                    <p className="text-gray-700">{lead.dispatch_remark}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Media */}
          {lead.media_upload && lead.media_upload.length > 0 && (
            <div className="mt-4 sm:mt-5 md:mt-6 pt-4 sm:pt-5 md:pt-6 border-t border-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
                <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                Media
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                {lead.media_upload.map((url: string, index: number) => (
                  <a
                    key={index}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={url}
                      alt={`Media ${index + 1}`}
                      className="w-full h-24 sm:h-28 md:h-32 object-cover rounded-lg hover:opacity-80 transition-opacity"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-lg shadow-lg p-3 sm:p-4 md:p-5 lg:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Timeline</h2>
          <div className="space-y-3 sm:space-y-4">
            {timeline.map((entry) => (
              <div key={entry.id} className="flex gap-2 sm:gap-3 md:gap-4 pb-3 sm:pb-4 border-b border-gray-200 last:border-0">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-2">
                    <h4 className="font-semibold text-gray-900 text-sm sm:text-base">{entry.status}</h4>
                    <span className="text-[10px] sm:text-xs text-gray-500">
                      {formatDateTime(entry.updated_at)}
                    </span>
                  </div>
                  {entry.status_description && (
                    <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">{entry.status_description}</p>
                  )}
                  {entry.updated_by_name && (
                    <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">By: {entry.updated_by_name}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Assign Manager Modal */}
        {showAssignManager && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white rounded-lg p-4 sm:p-5 md:p-6 max-w-md w-full mx-4">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Assign to Manager</h3>
              <select
                value={selectedManagerId}
                onChange={(e) => setSelectedManagerId(e.target.value)}
                className="w-full px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg mb-3 sm:mb-4 text-xs sm:text-sm"
              >
                <option value="">Select Manager</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name} ({manager.email})
                  </option>
                ))}
              </select>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    setShowAssignManager(false);
                    setSelectedManagerId('');
                  }}
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-xs sm:text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignToManager}
                  disabled={!selectedManagerId}
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-xs sm:text-sm"
                >
                  Assign
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assign Mechanic Modal */}
        {showAssignMechanic && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white rounded-lg p-4 sm:p-5 md:p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Assign Mechanic</h3>
              
              <div className="mb-3 sm:mb-4">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  Select Mechanic
                </label>
                <select
                  value={selectedMechanicId}
                  onChange={(e) => setSelectedMechanicId(e.target.value)}
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm"
                >
                  <option value="">Select Mechanic</option>
                  {mechanics.map((mechanic) => (
                    <option key={mechanic.id} value={mechanic.id}>
                      {mechanic.mechanic_name} ({mechanic.mechanic_code}) - 
                      {mechanic.is_available ? ' Available' : ' Busy'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-3 sm:mb-4">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  Payment Amount (Optional)
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter payment amount"
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm"
                />
              </div>

              <div className="mb-3 sm:mb-4">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  Remark (Optional)
                </label>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="Enter any remarks"
                  rows={3}
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    setShowAssignMechanic(false);
                    setSelectedMechanicId('');
                    setPaymentAmount('');
                    setRemark('');
                  }}
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-xs sm:text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignMechanic}
                  disabled={!selectedMechanicId}
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-xs sm:text-sm"
                >
                  Assign Mechanic
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Update Status Modal */}
        {showUpdateStatus && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white rounded-lg p-4 sm:p-5 md:p-6 max-w-md w-full mx-4">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Update Status</h3>
              
              <div className="mb-3 sm:mb-4">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  New Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm"
                >
                  <option value="">Select Status</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="mb-3 sm:mb-4">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="Enter notes about status change"
                  rows={3}
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    setShowUpdateStatus(false);
                    setNewStatus('');
                    setStatusNotes('');
                  }}
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-xs sm:text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateStatus}
                  disabled={!newStatus}
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 text-xs sm:text-sm"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

