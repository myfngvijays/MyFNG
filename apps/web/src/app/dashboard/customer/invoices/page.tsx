'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';

export default function CustomerInvoicesPage() {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    fetchInvoices();
  }, []);

  async function fetchInvoices() {
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

      const { data: leads } = await supabase
        .from('service_leads')
        .select('id')
        .or(`customer_email.eq.${profile.email},customer_phone.eq.${profile.phone}`);
      const leadIds = (leads || []).map((l: any) => l.id);
      if (leadIds.length === 0) {
        setInvoices([]);
        return;
      }

      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, invoice_date, final_amount, payment_status, lead_id')
        .in('lead_id', leadIds)
        .order('invoice_date', { ascending: false });
      if (error) throw error;
      setInvoices(data || []);
    } catch (e) {
      console.error('Failed to load invoices', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout role="customer">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-text-heading">My Invoices</h1>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">View</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">Loading...</td>
                </tr>
              )}
              {!loading && invoices.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">No invoices found</td>
                </tr>
              )}
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t">
                  <td className="px-4 py-3">{inv.invoice_number || '—'}</td>
                  <td className="px-4 py-3">{inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">₹{inv.final_amount ?? 0}</td>
                  <td className="px-4 py-3">{inv.payment_status || '—'}</td>
                  <td className="px-4 py-3">
                    {inv.invoice_number ? (
                      <Link className="text-brand-primary hover:underline" href={`/invoice/${inv.invoice_number}`}>
                        View
                      </Link>
                    ) : '—'}
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
