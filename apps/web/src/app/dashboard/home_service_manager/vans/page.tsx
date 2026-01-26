'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';

export default function HomeServiceVansPage() {
  const [loading, setLoading] = useState(true);
  const [vans, setVans] = useState<any[]>([]);

  useEffect(() => {
    fetchVans();
  }, []);

  async function fetchVans() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('service_vans')
        .select('*')
        .order('van_number', { ascending: true });
      if (error && error.code !== 'PGRST116') throw error;
      setVans(data || []);
    } catch (e) {
      console.error('Failed to load vans', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout role="home_service_manager">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-text-heading">Service Vans</h1>
          <p className="text-sm text-gray-600 mt-1">Track availability and assignments</p>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-4 py-3">Van</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Location</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500">Loading...</td>
                </tr>
              )}
              {!loading && vans.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500">No vans found</td>
                </tr>
              )}
              {vans.map((van) => (
                <tr key={van.id} className="border-t">
                  <td className="px-4 py-3">{van.van_number || '—'}</td>
                  <td className="px-4 py-3">{van.status || 'AVAILABLE'}</td>
                  <td className="px-4 py-3">{van.driver_name || '—'}</td>
                  <td className="px-4 py-3">{van.location || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
