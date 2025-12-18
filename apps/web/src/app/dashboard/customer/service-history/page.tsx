'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, FileText, Loader2, Search } from 'lucide-react';
import { formatDateTime } from "@/lib/utils";

type ServiceHistoryItem = {
  id: string;
  lead_number: string;
  service_type?: string;
  vehicle_number?: string;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  completed_at?: string | null;
  status: string;
  actual_amount?: number | null;
  invoice_id?: string | null;
  workshop_id?: { name?: string } | null;
};

export default function CustomerServiceHistoryPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ServiceHistoryItem[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchHistory() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('email, phone')
        .eq('email', user.email)
        .single();

      if (!userProfile) {
        setItems([]);
        return;
      }

      const { data, error } = await supabase
        .from('service_leads')
        .select('id, lead_number, service_type, vehicle_number, vehicle_make, vehicle_model, completed_at, status, actual_amount, invoice_id, workshop_id(name)')
        .or(`customer_email.eq.${userProfile.email},customer_phone.eq.${userProfile.phone}`)
        .in('status', ['DELIVERED_TO_CUSTOMER', 'COMPLETED', 'CLOSED'])
        .order('completed_at', { ascending: false, nullsFirst: false })
        .limit(200);

      if (error) {
        console.error('Error fetching service history:', error);
        setItems([]);
        return;
      }

      setItems((data || []) as ServiceHistoryItem[]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      (i.lead_number || '').toLowerCase().includes(q) ||
      (i.vehicle_number || '').toLowerCase().includes(q) ||
      (i.service_type || '').toLowerCase().includes(q) ||
      `${i.vehicle_make || ''} ${i.vehicle_model || ''}`.toLowerCase().includes(q)
    );
  }, [items, query]);

  return (
    <DashboardLayout role="customer">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="btn-secondary flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-text-heading">Service History</h1>
        </div>

        <div className="card p-3 sm:p-4 flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by lead, vehicle, service…"
            className="w-full outline-none bg-transparent text-sm"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-10 h-10 animate-spin text-brand-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-10">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <div className="text-gray-600">No service history found</div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((i) => (
              <div key={i.id} className="card p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-text-heading">
                      {i.service_type || 'Service'} • {i.vehicle_number}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 mt-1">
                      Lead: <span className="font-medium">{i.lead_number}</span>
                      {i.workshop_id?.name ? ` • Workshop: ${i.workshop_id.name}` : ''}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600">
                      {i.vehicle_make || i.vehicle_model ? `Vehicle: ${i.vehicle_make || ''} ${i.vehicle_model || ''}`.trim() : ''}
                      {i.completed_at ? ` • Completed: ${formatDateTime(i.completed_at)}` : ''}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {typeof i.actual_amount === 'number' && (
                      <div className="text-sm font-bold text-green-600">
                        ₹{Number(i.actual_amount).toLocaleString('en-IN')}
                      </div>
                    )}
                    {i.invoice_id && (
                      <button
                        onClick={() => router.push(`/dashboard/billing/invoices/${i.invoice_id}`)}
                        className="btn-outline text-sm"
                      >
                        View Invoice
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}


