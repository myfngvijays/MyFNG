'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { FileText, PhoneCall } from 'lucide-react';

type EnquiryLead = {
  id: string;
  lead_number: string | null;
  lead_type: string;
  lead_status: string;
  lead_priority: string | null;
  lead_source: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  assigned_at: string | null;
  next_follow_up_at: string | null;
  total_calls: number | null;
  meta?: any;
};

export default function TelecallerEnquiryLeadsPage() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<EnquiryLead[]>([]);

  useEffect(() => {
    fetchLeads();
  }, []);

  async function fetchLeads() {
    try {
      const res = await fetch('/api/telecaller/enquiry-leads');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load leads');
      setLeads(json.leads || []);
    } catch (e) {
      console.error('Failed to load enquiry leads:', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout role="telecaller">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-5 sm:py-6 md:py-8 space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-heading">Enquiry Leads</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Auto-assigned enquiry leads for follow-up and closure.
          </p>
        </div>

        <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Coupon</th>
                <th className="px-4 py-3">Calls</th>
                <th className="px-4 py-3">Next Follow-up</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && leads.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                    No enquiry leads assigned yet.
                  </td>
                </tr>
              )}
              {leads.map((lead) => (
                <tr key={lead.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{lead.lead_number || '—'}</div>
                    <div className="text-xs text-gray-500">{lead.lead_priority || 'NORMAL'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{lead.customer_name || 'Customer'}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <PhoneCall className="w-3 h-3" />
                      {lead.customer_phone || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3">{lead.lead_type}</td>
                  <td className="px-4 py-3">{lead.lead_status}</td>
                  <td className="px-4 py-3">{lead.lead_source || '—'}</td>
                  <td className="px-4 py-3">
                    {lead?.meta?.coupon?.code || '—'}
                  </td>
                  <td className="px-4 py-3">{lead.total_calls ?? 0}</td>
                  <td className="px-4 py-3">
                    {lead.next_follow_up_at ? new Date(lead.next_follow_up_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/telecaller/enquiry-leads/${lead.id}`}
                      className="inline-flex items-center gap-1 text-brand-primary hover:underline"
                    >
                      <FileText className="w-4 h-4" />
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

