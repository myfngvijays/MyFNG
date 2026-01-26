'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';

export default function CustomerSupportPage() {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<any[]>([]);

  useEffect(() => {
    fetchTickets();
  }, []);

  async function fetchTickets() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('users_login')
        .select('email, phone')
        .eq('id', user.id)
        .single();
      if (!profile) return;

      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .or(`customer_email.eq.${profile.email},customer_phone.eq.${profile.phone}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error && error.code === 'PGRST116') {
        const { data: leadsData } = await supabase
          .from('service_leads')
          .select('id, lead_number, customer_name, status, created_at, complaint_details')
          .or(`customer_email.eq.${profile.email},customer_phone.eq.${profile.phone}`)
          .eq('status', 'COMPLAINT')
          .order('created_at', { ascending: false });
        setTickets((leadsData || []).map((lead: any) => ({
          id: lead.id,
          ticket_number: lead.lead_number,
          subject: lead.complaint_details || 'Service Complaint',
          status: lead.status,
          created_at: lead.created_at,
        })));
      } else if (error) {
        throw error;
      } else {
        setTickets(data || []);
      }
    } catch (e) {
      console.error('Failed to load tickets', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout role="customer">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-text-heading">Support</h1>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-4 py-3">Ticket</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500">Loading...</td>
                </tr>
              )}
              {!loading && tickets.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500">No tickets found</td>
                </tr>
              )}
              {tickets.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-4 py-3">{t.ticket_number || '—'}</td>
                  <td className="px-4 py-3">{t.subject || '—'}</td>
                  <td className="px-4 py-3">{t.status || '—'}</td>
                  <td className="px-4 py-3">{t.created_at ? new Date(t.created_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
