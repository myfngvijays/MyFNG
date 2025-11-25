'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { CheckCircle, XCircle, Clock, AlertTriangle, Phone, Car, MapPin, DollarSign, RefreshCw, Eye } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

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

export default function WorkshopAdminPendingLeadsPage() {
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
        .order('created_at', { ascending: true });

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
    if (!confirm('Accept this lead?')) return;

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

      // Update lead status to ACCEPTED
      const { error } = await supabase
        .from('service_leads')
        .update({
          status: 'ACCEPTED',
          workshop_accepted_by: userProfile?.id,
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
          event_description: 'Workshop Admin accepted the lead',
          created_by: userProfile?.id
        });

      toast.success('Lead accepted successfully!');
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
          event_description: `Workshop Admin rejected the lead: ${reason}`,
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
        <div className="bg-gradient-to-r from-yellow-500 to-orange-600 text-white p-6 rounded-lg shadow-lg">
          <h1 className="text-3xl font-bold">⏰ Pending Lead Approvals</h1>
          <p className="font-medium mt-1">Review and accept/reject incoming leads</p>
        </div>

        <div className="space-y-4">
          {leads.length === 0 ? (
            <div className="card text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">All Caught Up!</h3>
              <p className="text-gray-500">No pending leads waiting for approval</p>
            </div>
          ) : (
            leads.map((lead) => (
              <div key={lead.id} className="card hover:shadow-xl transition-shadow border-l-4 border-yellow-500">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-brand-primary">{lead.lead_number}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Created: {new Date(lead.created_at).toLocaleString()}
                    </p>
                  </div>
                  {lead.sla_accept_deadline && (
                    <div className="bg-orange-100 border border-orange-300 px-4 py-2 rounded-lg">
                      <p className="text-xs text-orange-600 font-semibold">SLA Deadline</p>
                      <p className="text-sm font-bold text-orange-700">
                        {new Date(lead.sla_accept_deadline).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Customer & Vehicle Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Phone className="w-5 h-5 text-blue-600" />
                      <h4 className="font-semibold text-blue-900">Customer Details</h4>
                    </div>
                    <p className="font-bold text-lg">{lead.customer_name}</p>
                    <p className="text-gray-700">{lead.customer_phone}</p>
                    {lead.address && (
                      <div className="flex items-start gap-2 mt-2">
                        <MapPin className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
                        <p className="text-sm text-gray-600">{lead.address}</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Car className="w-5 h-5 text-purple-600" />
                      <h4 className="font-semibold text-purple-900">Vehicle Details</h4>
                    </div>
                    <p className="font-bold text-lg">{lead.vehicle_number}</p>
                    <p className="text-gray-700">{lead.vehicle_make} {lead.vehicle_model}</p>
                    {lead.pickup_required && (
                      <span className="inline-block mt-2 px-3 py-1 bg-purple-200 text-purple-800 rounded-full text-xs font-semibold">
                        🚗 Pickup Required
                      </span>
                    )}
                  </div>
                </div>

                {/* Service Details */}
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Service Required</h4>
                  <p className="text-gray-800 font-medium">
                    {lead.service_type_names || lead.service_type}
                  </p>
                  {lead.description && (
                    <p className="text-sm text-gray-600 mt-2">{lead.description}</p>
                  )}
                  {lead.estimated_amount && (
                    <div className="flex items-center gap-2 mt-3">
                      <DollarSign className="w-5 h-5 text-green-600" />
                      <span className="text-xl font-bold text-green-600">
                        ₹{lead.estimated_amount.toLocaleString()}
                      </span>
                      <span className="text-sm text-gray-500">(Estimated)</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={() => router.push(`/dashboard/workshop_admin/leads/${lead.id}`)}
                    className="btn btn-outline flex-1 flex items-center justify-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    View Details
                  </button>
                  <button
                    onClick={() => handleAcceptLead(lead.id)}
                    disabled={processing === lead.id}
                    className="btn bg-green-600 hover:bg-green-700 text-white flex-1 flex items-center justify-center gap-2"
                  >
                    {processing === lead.id ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Accept Lead
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleRejectLead(lead.id)}
                    disabled={processing === lead.id}
                    className="btn bg-red-600 hover:bg-red-700 text-white flex-1 flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

