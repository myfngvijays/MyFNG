'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';

export default function HomeServiceManagerDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalLeads: 0,
    pendingLeads: 0,
    activeLeads: 0,
    completedLeads: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('service_leads')
        .select('id, status')
        .eq('service_type', 'HOME_SERVICE');

      const totalLeads = data?.length || 0;
      const pendingLeads = data?.filter((l: any) => String(l.status || '').toUpperCase() === 'PENDING').length || 0;
      const activeLeads = data?.filter((l: any) =>
        ['ASSIGNED', 'IN_PROGRESS'].includes(String(l.status || '').toUpperCase())
      ).length || 0;
      const completedLeads = data?.filter((l: any) => String(l.status || '').toUpperCase() === 'COMPLETED').length || 0;

      setStats({ totalLeads, pendingLeads, activeLeads, completedLeads });
    } catch (e) {
      console.error('Failed to load home service stats', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout role="home_service_manager">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-heading">Home Service Manager</h1>
          <p className="text-sm text-gray-600 mt-1">Monitor home service leads, vans, and technicians.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="text-xs text-gray-500">Total Leads</div>
            <div className="text-2xl font-bold">{loading ? '—' : stats.totalLeads}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-gray-500">Pending</div>
            <div className="text-2xl font-bold text-yellow-600">{loading ? '—' : stats.pendingLeads}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-gray-500">Active</div>
            <div className="text-2xl font-bold text-blue-600">{loading ? '—' : stats.activeLeads}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-gray-500">Completed</div>
            <div className="text-2xl font-bold text-green-600">{loading ? '—' : stats.completedLeads}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link className="card p-4 hover:shadow-md transition" href="/dashboard/home_service_manager/leads">
            <div className="text-base font-semibold">Leads</div>
            <div className="text-xs text-gray-600">View and manage leads</div>
          </Link>
          <Link className="card p-4 hover:shadow-md transition" href="/dashboard/home_service_manager/vans">
            <div className="text-base font-semibold">Service Vans</div>
            <div className="text-xs text-gray-600">Track van availability</div>
          </Link>
          <Link className="card p-4 hover:shadow-md transition" href="/dashboard/home_service_manager/technicians">
            <div className="text-base font-semibold">Technicians</div>
            <div className="text-xs text-gray-600">View field technicians</div>
          </Link>
          <Link className="card p-4 hover:shadow-md transition" href="/dashboard/home_service_manager/reports">
            <div className="text-base font-semibold">Reports</div>
            <div className="text-xs text-gray-600">Service performance</div>
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
