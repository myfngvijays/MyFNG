'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';

export default function CustomerVehiclesPage() {
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<any[]>([]);

  useEffect(() => {
    fetchVehicles();
  }, []);

  async function fetchVehicles() {
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
        .select('vehicle_number, vehicle_make, vehicle_model, vehicle_year')
        .or(`customer_email.eq.${profile.email},customer_phone.eq.${profile.phone}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const seen = new Set<string>();
      const unique = (data || []).filter((v: any) => {
        const key = `${v.vehicle_number || ''}-${v.vehicle_make || ''}-${v.vehicle_model || ''}-${v.vehicle_year || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setVehicles(unique);
    } catch (e) {
      console.error('Failed to load vehicles', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout role="customer">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-text-heading">My Vehicles</h1>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Year</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-gray-500">Loading...</td>
                </tr>
              )}
              {!loading && vehicles.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-gray-500">No vehicles found</td>
                </tr>
              )}
              {vehicles.map((v, idx) => (
                <tr key={idx} className="border-t">
                  <td className="px-4 py-3">{`${v.vehicle_make || ''} ${v.vehicle_model || ''}`.trim() || '—'}</td>
                  <td className="px-4 py-3">{v.vehicle_number || '—'}</td>
                  <td className="px-4 py-3">{v.vehicle_year || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
