'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';

export default function CustomerBookingsPage() {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<any[]>([]);

  useEffect(() => {
    fetchBookings();
  }, []);

  async function fetchBookings() {
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
        .from('service_leads')
        .select('id, lead_number, status, vehicle_make, vehicle_model, vehicle_number, service_type, created_at')
        .or(`customer_email.eq.${profile.email},customer_phone.eq.${profile.phone}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBookings(data || []);
    } catch (e) {
      console.error('Failed to load bookings', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout role="customer">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-text-heading">My Bookings</h1>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">Loading...</td>
                </tr>
              )}
              {!loading && bookings.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">No bookings yet</td>
                </tr>
              )}
              {bookings.map((b) => (
                <tr key={b.id} className="border-t">
                  <td className="px-4 py-3">{b.lead_number || '—'}</td>
                  <td className="px-4 py-3">{`${b.vehicle_make || ''} ${b.vehicle_model || ''}`.trim() || '—'} {b.vehicle_number ? `(${b.vehicle_number})` : ''}</td>
                  <td className="px-4 py-3">{b.service_type || '—'}</td>
                  <td className="px-4 py-3">{b.status || '—'}</td>
                  <td className="px-4 py-3">{b.created_at ? new Date(b.created_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
