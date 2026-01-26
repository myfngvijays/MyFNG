'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';

export default function CompanyVanDriverTaskDetailPage() {
  const params = useParams();
  const taskId = String(params?.id || '');
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (taskId) fetchTask();
  }, [taskId]);

  async function fetchTask() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('service_leads')
        .select('*')
        .eq('id', taskId)
        .single();
      if (error) throw error;
      setTask(data);
    } catch (e) {
      console.error('Failed to load task', e);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(newStatus: string) {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('service_leads')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', taskId);
      if (error) throw error;
      await fetchTask();
    } catch (e) {
      console.error('Failed to update status', e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout role="company_van_driver">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-text-heading">Trip Detail</h1>
          <p className="text-sm text-gray-600 mt-1">Trip ID: {taskId}</p>
        </div>
        {loading ? (
          <div className="card p-4 text-center text-gray-500">Loading...</div>
        ) : !task ? (
          <div className="card p-4 text-center text-gray-500">Trip not found</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-4">
              <div className="text-xs text-gray-500">Lead Number</div>
              <div className="text-lg font-semibold">{task.lead_number || '—'}</div>
              <div className="text-xs text-gray-500 mt-3">Status</div>
              <div className="text-sm">{task.status || '—'}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-gray-500">Customer</div>
              <div className="text-sm">{task.customer_name || '—'}</div>
              <div className="text-xs text-gray-500 mt-2">Phone</div>
              <div className="text-sm">{task.customer_phone || '—'}</div>
              <div className="text-xs text-gray-500 mt-2">Address</div>
              <div className="text-sm">{task.service_address || '—'}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-gray-500">Actions</div>
              {task.status === 'ASSIGNED' && (
                <button
                  className="btn btn-primary mt-2"
                  disabled={saving}
                  onClick={() => updateStatus('IN_PROGRESS')}
                >
                  Start Trip
                </button>
              )}
              {task.status === 'IN_PROGRESS' && (
                <button
                  className="btn btn-primary mt-2"
                  disabled={saving}
                  onClick={() => updateStatus('COMPLETED')}
                >
                  Mark Completed
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
