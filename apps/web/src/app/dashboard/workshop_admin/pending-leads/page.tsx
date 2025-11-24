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

      setLeads(pendingLeads || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred');
    } finally {
      setLoading(false);
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
              <div key={lead.id} className="card">
                <p>{lead.lead_number} - {lead.customer_name}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

