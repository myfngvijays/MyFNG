'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';

export default function HomeServiceLeadsPage() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLeads();
  }, []);

  async function fetchLeads() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('service_leads')
        .select('id, lead_number, customer_name, customer_phone, status, service_address, created_at')
        .eq('service_type', 'HOME_SERVICE')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLeads(data || []);
    } catch (e) {
      console.error('Failed to load leads', e);
    } finally {
      setLoading(false);
    }
  }

  const filtered = leads.filter((l) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      String(l.lead_number || '').toLowerCase().includes(q) ||
      String(l.customer_name || '').toLowerCase().includes(q) ||
      String(l.customer_phone || '').toLowerCase().includes(q)
    );
  });

  return (
    <DashboardLayout role="home_service_manager">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-text-heading">Home Service Leads</h1>
          <p className="text-sm text-gray-600 mt-1">All HOME_SERVICE leads</p>
        </div>

        <div className="card p-3">
          <input
            className="input w-full"
            placeholder="Search by lead, customer, phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">Loading...</td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">No leads found</td>
                </tr>
              )}
              {filtered.map((lead) => (
                <tr key={lead.id} className="border-t">
                  <td className="px-4 py-3">{lead.lead_number || '—'}</td>
                  <td className="px-4 py-3">
                    <div>{lead.customer_name || 'Customer'}</div>
                    <div className="text-xs text-gray-500">{lead.customer_phone || '—'}</div>
                  </td>
                  <td className="px-4 py-3">{lead.status || '—'}</td>
                  <td className="px-4 py-3">{lead.service_address || '—'}</td>
                  <td className="px-4 py-3">
                    <Link className="text-brand-primary hover:underline" href={`/dashboard/home_service_manager/leads/${lead.id}`}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
