'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';

export default function HomeServiceLeadDetailPage() {
  const params = useParams();
  const leadId = String(params?.id || '');
  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState<any>(null);

  useEffect(() => {
    if (leadId) fetchLead();
  }, [leadId]);

  async function fetchLead() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('service_leads')
        .select('*, technician:users_login(full_name, phone), van:service_vans(van_number, driver_name)')
        .eq('id', leadId)
        .single();
      if (error) throw error;
      setLead(data);
    } catch (e) {
      console.error('Failed to load lead', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout role="home_service_manager">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-text-heading">Lead Detail</h1>
          <p className="text-sm text-gray-600 mt-1">Lead ID: {leadId}</p>
        </div>
        {loading ? (
          <div className="card p-4 text-center text-gray-500">Loading...</div>
        ) : !lead ? (
          <div className="card p-4 text-center text-gray-500">Lead not found</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-4">
              <div className="text-xs text-gray-500">Lead Number</div>
              <div className="text-lg font-semibold">{lead.lead_number || '—'}</div>
              <div className="text-xs text-gray-500 mt-3">Status</div>
              <div className="text-sm">{lead.status || '—'}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-gray-500">Customer</div>
              <div className="text-sm">{lead.customer_name || '—'}</div>
              <div className="text-xs text-gray-500 mt-2">Phone</div>
              <div className="text-sm">{lead.customer_phone || '—'}</div>
              <div className="text-xs text-gray-500 mt-2">Email</div>
              <div className="text-sm">{lead.customer_email || '—'}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-gray-500">Service Address</div>
              <div className="text-sm">{lead.service_address || '—'}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-gray-500">Assigned Technician</div>
              <div className="text-sm">{lead.technician?.full_name || '—'}</div>
              <div className="text-xs text-gray-500 mt-2">Technician Phone</div>
              <div className="text-sm">{lead.technician?.phone || '—'}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-gray-500">Assigned Van</div>
              <div className="text-sm">{lead.van?.van_number || '—'}</div>
              <div className="text-xs text-gray-500 mt-2">Driver</div>
              <div className="text-sm">{lead.van?.driver_name || '—'}</div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
