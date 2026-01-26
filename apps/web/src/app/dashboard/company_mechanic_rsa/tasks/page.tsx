'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';

export default function CompanyMechanicRSATasksPage() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('service_leads')
        .select('id, lead_number, status, customer_name, customer_phone, service_location, created_at')
        .eq('service_type', 'RSA')
        .eq('assigned_mechanic_id', user.id)
        .in('status', ['ASSIGNED', 'IN_PROGRESS', 'PENDING'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTasks(data || []);
    } catch (e) {
      console.error('Failed to load tasks', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout role="company_mechanic_rsa">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-text-heading">My RSA Tasks</h1>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">Loading...</td>
                </tr>
              )}
              {!loading && tasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">No tasks found</td>
                </tr>
              )}
              {tasks.map((task) => (
                <tr key={task.id} className="border-t">
                  <td className="px-4 py-3">{task.lead_number || '—'}</td>
                  <td className="px-4 py-3">
                    <div>{task.customer_name || 'Customer'}</div>
                    <div className="text-xs text-gray-500">{task.customer_phone || '—'}</div>
                  </td>
                  <td className="px-4 py-3">{task.status || '—'}</td>
                  <td className="px-4 py-3">{task.service_location || '—'}</td>
                  <td className="px-4 py-3">
                    <Link className="text-brand-primary hover:underline" href={`/dashboard/company_mechanic_rsa/tasks/${task.id}`}>
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
