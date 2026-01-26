'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';

export default function HomeServiceReportsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalServices: 0,
    completedServices: 0,
    totalRevenue: 0,
  });

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('service_leads')
        .select('status, invoice_amount')
        .eq('service_type', 'HOME_SERVICE');
      if (error) throw error;
      const totalServices = data?.length || 0;
      const completedServices = data?.filter((l: any) => String(l.status || '').toUpperCase() === 'COMPLETED').length || 0;
      const totalRevenue = data?.reduce((sum: number, l: any) => sum + (l.invoice_amount || 0), 0) || 0;
      setStats({ totalServices, completedServices, totalRevenue });
    } catch (e) {
      console.error('Failed to load reports', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout role="home_service_manager">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-text-heading">Home Service Reports</h1>
          <p className="text-sm text-gray-600 mt-1">Performance overview</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-4">
            <div className="text-xs text-gray-500">Total Services</div>
            <div className="text-2xl font-bold">{loading ? '—' : stats.totalServices}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-gray-500">Completed</div>
            <div className="text-2xl font-bold text-green-600">{loading ? '—' : stats.completedServices}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-gray-500">Total Revenue</div>
            <div className="text-2xl font-bold text-blue-600">{loading ? '—' : `₹${Math.round(stats.totalRevenue)}`}</div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
