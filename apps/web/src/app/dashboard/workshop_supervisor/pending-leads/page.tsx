'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { CheckCircle, XCircle, Clock, AlertTriangle, Phone, Car, MapPin, DollarSign, RefreshCw, Eye } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { formatDateTime } from "@/lib/utils";

interface PendingLead {
  id: string;
  lead_number: string;
  customer_name: string;
  customer_phone: string;
  vehicle_number: string;
  vehicle_make: string;
  vehicle_model: string;
  service_type: string;
  service_type_ids?: any;
  service_type_names?: string;
  estimated_amount: number;
  created_at: string;
  sla_accept_deadline: string;
  pickup_required: boolean;
  address: string;
  description: string;
  status: string;
}

export default function WorkshopSupervisorPendingLeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<PendingLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingLeads();
    
    // Setup real-time subscription
    const supabase = createClient();
    const channel = supabase
      .channel('pending-leads-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_leads'
        },
        (payload) => {
          console.log('Pending leads updated:', payload);
          fetchPendingLeads();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
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

      setWorkshopId(userProfile.workshop_id);

      // Fetch leads with ASSIGNED status (waiting for workshop acceptance)
      const { data: pendingLeads, error } = await supabase
        .from('service_leads')
        .select('*')
        .eq('workshop_id', userProfile.workshop_id)
        .in('status', ['ASSIGNED_TO_WORKSHOP', 'ASSIGNED'])
        .order('created_at', { ascending: false }); // Latest first

      if (error) {
        console.error('Error fetching pending leads:', error);
        toast.error('Failed to fetch pending leads');
        return;
      }

      // Fetch service type names for each lead
      const leadsWithServiceNames = await Promise.all((pendingLeads || []).map(async (lead) => {
        let serviceTypeIds = lead.service_type_ids;
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
            lead.service_type_names = serviceTypes.map((st: any) => st.name).join(', ');
          }
        }

        return lead;
      }));

      setLeads(leadsWithServiceNames || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleAcceptLead(leadId: string) {
    if (!confirm('Accept this lead? You will be automatically assigned as the supervisor.')) return;

    setProcessing(leadId);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!userProfile) {
        toast.error('User profile not found');
        return;
      }

      // Update lead status to ACCEPTED and auto-assign supervisor
      const { error } = await supabase
        .from('service_leads')
        .update({
          status: 'ACCEPTED',
          assigned_supervisor_id: userProfile.id, // Auto-assign supervisor
          supervisor_assigned_at: new Date().toISOString(),
          workshop_accepted_by: userProfile.id,
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);

      if (error) throw error;

      // Create lead event
      await supabase
        .from('lead_events')
        .insert({
          lead_id: leadId,
          event_type: 'LEAD_ACCEPTED',
          event_description: `Workshop Supervisor accepted the lead and was auto-assigned`,
          created_by: userProfile.id
        });

      toast.success('Lead accepted successfully! You have been assigned as supervisor.');
      fetchPendingLeads();
    } catch (error) {
      console.error('Error accepting lead:', error);
      toast.error('Failed to accept lead');
    } finally {
      setProcessing(null);
    }
  }

  async function handleRejectLead(leadId: string) {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    setProcessing(leadId);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      // Update lead status to REJECTED
      const { error } = await supabase
        .from('service_leads')
        .update({
          status: 'REJECTED',
          rejected_reason: reason,
          rejected_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);

      if (error) throw error;

      // Create lead event
      await supabase
        .from('lead_events')
        .insert({
          lead_id: leadId,
          event_type: 'LEAD_REJECTED',
          event_description: `Workshop Supervisor rejected the lead: ${reason}`,
          created_by: userProfile?.id
        });

      toast.success('Lead rejected');
      fetchPendingLeads();
    } catch (error) {
      console.error('Error rejecting lead:', error);
      toast.error('Failed to reject lead');
    } finally {
      setProcessing(null);
    }
  }

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
        <div className="bg-gradient-to-r from-yellow-500 to-orange-600 text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">⏰ Pending Lead Approvals</h1>
          <p className="font-medium text-sm sm:text-base mt-1">Review and accept/reject incoming leads. Accepting will auto-assign you as supervisor.</p>
        </div>

          {leads.length === 0 ? (
            <div className="card text-center py-8 sm:py-10 md:py-12">
              <CheckCircle className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-green-500 mx-auto mb-3 sm:mb-4" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-1.5 sm:mb-2">All Caught Up!</h3>
              <p className="text-gray-500 text-sm sm:text-base">No pending leads waiting for approval</p>
            </div>
          ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead #</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SLA Deadline</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      {/* Lead Number */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="flex flex-col">
                          <span className="text-xs sm:text-sm font-medium text-gray-900">#{lead.lead_number}</span>
                          <span className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                            {formatDateTime(lead.created_at)}
                          </span>
                          {lead.pickup_required && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-[10px] font-semibold w-fit">
                              🚗 Pickup
                            </span>
                          )}
                  </div>
                      </td>

                      {/* Customer */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div>
                          <div className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[150px]">{lead.customer_name}</div>
                          <div className="text-xs sm:text-sm text-gray-500 truncate">{lead.customer_phone}</div>
                          {lead.address && (
                            <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5 truncate max-w-[150px]">{lead.address}</div>
                  )}
                </div>
                      </td>

                      {/* Vehicle */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div>
                          <div className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[120px]">{lead.vehicle_number}</div>
                          <div className="text-[10px] sm:text-xs text-gray-500 truncate">{lead.vehicle_make} {lead.vehicle_model}</div>
                        </div>
                      </td>

                      {/* Service */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div>
                          <div className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[150px]">
                            {lead.service_type_names || lead.service_type}
                    </div>
                          {lead.description && (
                            <div className="text-[10px] sm:text-xs text-gray-500 truncate max-w-[150px] mt-0.5">
                              {lead.description}
                      </div>
                    )}
                  </div>
                      </td>

                      {/* SLA Deadline */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        {lead.sla_accept_deadline ? (
                          <div className="bg-orange-100 border border-orange-300 px-2 py-1 rounded">
                            <p className="text-[10px] text-orange-600 font-semibold">SLA Deadline</p>
                            <p className="text-xs font-bold text-orange-700">
                              {formatDateTime(lead.sla_accept_deadline)}
                            </p>
                    </div>
                        ) : (
                          <span className="text-xs text-gray-400">N/A</span>
                    )}
                      </td>

                      {/* Amount */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        {lead.estimated_amount ? (
                          <div>
                            <span className="text-sm font-bold text-green-600">
                        ₹{lead.estimated_amount.toLocaleString()}
                      </span>
                            <span className="text-[10px] text-gray-500 block">(Estimated)</span>
                    </div>
                        ) : (
                          <span className="text-xs text-gray-400">N/A</span>
                  )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => router.push(`/dashboard/workshop_supervisor/jobs/${lead.id}`)}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded font-medium transition-colors flex items-center justify-center gap-1"
                  >
                            <Eye className="w-3 h-3" />
                            View
                  </button>
                  <button
                    onClick={() => handleAcceptLead(lead.id)}
                    disabled={processing === lead.id}
                            className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded font-medium transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    {processing === lead.id ? (
                      <>
                                <RefreshCw className="w-3 h-3 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                                <CheckCircle className="w-3 h-3" />
                                Accept
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleRejectLead(lead.id)}
                    disabled={processing === lead.id}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded font-medium transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                            <XCircle className="w-3 h-3" />
                    Reject
                  </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                </div>
              </div>
          )}
      </div>
    </DashboardLayout>
  );
}

