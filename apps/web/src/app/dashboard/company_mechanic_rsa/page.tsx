'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';

export default function CompanyMechanicRSADashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeTasks: 0,
    completedToday: 0,
    pendingTasks: 0,
    totalCompleted: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('service_leads')
        .select('id, status, completed_at')
        .eq('service_type', 'RSA')
        .eq('assigned_mechanic_id', user.id);

      const activeTasks = data?.filter((t: any) => ['ASSIGNED', 'IN_PROGRESS'].includes(t.status)).length || 0;
      const completedToday = data?.filter((t: any) => t.status === 'COMPLETED' && t.completed_at && new Date(t.completed_at).toDateString() === new Date().toDateString()).length || 0;
      const pendingTasks = data?.filter((t: any) => t.status === 'PENDING').length || 0;
      const totalCompleted = data?.filter((t: any) => t.status === 'COMPLETED').length || 0;

      setStats({ activeTasks, completedToday, pendingTasks, totalCompleted });
    } catch (e) {
      console.error('Failed to load RSA stats', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout role="company_mechanic_rsa">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-heading">RSA Mechanic</h1>
          <p className="text-sm text-gray-600 mt-1">My RSA tasks and history</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="text-xs text-gray-500">Active</div>
            <div className="text-2xl font-bold">{loading ? '—' : stats.activeTasks}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-gray-500">Completed Today</div>
            <div className="text-2xl font-bold text-green-600">{loading ? '—' : stats.completedToday}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-gray-500">Pending</div>
            <div className="text-2xl font-bold text-yellow-600">{loading ? '—' : stats.pendingTasks}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-gray-500">Total Completed</div>
            <div className="text-2xl font-bold">{loading ? '—' : stats.totalCompleted}</div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link className="card p-4 hover:shadow-md transition" href="/dashboard/company_mechanic_rsa/tasks">
            <div className="text-base font-semibold">My Tasks</div>
            <div className="text-xs text-gray-600">Assigned RSA tasks</div>
          </Link>
          <Link className="card p-4 hover:shadow-md transition" href="/dashboard/company_mechanic_rsa/history">
            <div className="text-base font-semibold">History</div>
            <div className="text-xs text-gray-600">Completed tasks</div>
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
