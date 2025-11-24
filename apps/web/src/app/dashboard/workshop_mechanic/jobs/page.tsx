'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Wrench, Clock, Camera, CheckCircle, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function MechanicJobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobs();
  }, []);

  async function fetchJobs() {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!userProfile) return;

      console.log('Fetching jobs for mechanic:', userProfile.id);

      // Fetch from mechanic_dashboard view
      const { data: jobsData, error } = await supabase
        .from('mechanic_dashboard')
        .select('*')
        .eq('mechanic_id', userProfile.id)
        .order('assigned_at', { ascending: false });

      if (error) {
        console.error('Error fetching jobs:', error);
      } else {
        console.log('Jobs fetched:', jobsData);
      }

      setJobs(jobsData || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setLoading(false);
    }
  }

  async function updateJobStatus(leadId: string, newStatus: string) {
    const supabase = createClient();
    
    const updates: any = {
      mechanic_status: newStatus,
      updated_at: new Date().toISOString()
    };

    if (newStatus === 'IN_PROGRESS') {
      updates.started_at = new Date().toISOString();
    }

    if (newStatus === 'COMPLETED') {
      updates.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('mechanic_jobs')
      .update(updates)
      .eq('lead_id', leadId);

    if (error) {
      console.error('Error updating job status:', error);
    } else {
      fetchJobs();
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="workshop_mechanic">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_mechanic">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-text-heading">My Jobs</h1>
          <p className="text-text-body mt-2">Manage your assigned service jobs</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="card">
            <p className="text-sm text-gray-600">Total Assigned</p>
            <p className="text-2xl font-bold">{jobs.length}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">In Progress</p>
            <p className="text-2xl font-bold text-blue-600">
              {jobs.filter(j => j.mechanic_status === 'IN_PROGRESS').length}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Ready to Start</p>
            <p className="text-2xl font-bold text-green-600">
              {jobs.filter(j => j.mechanic_status === 'ASSIGNED').length}
            </p>
          </div>
        </div>

        {/* Jobs List */}
        <div className="space-y-4">
          {jobs.map((job) => (
            <div key={job.job_id} className="card hover:shadow-lg transition">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold">{job.lead_number}</h3>
                  <p className="text-lg text-gray-700">{job.problem_description}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  job.mechanic_status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                }`}>
                  {job.mechanic_status === 'IN_PROGRESS' ? 'In Progress' : 'Assigned'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Customer</p>
                  <p className="font-semibold">{job.customer_name}</p>
                  <p className="text-sm text-gray-600">{job.customer_phone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Vehicle</p>
                  <p className="font-semibold">{job.vehicle_number}</p>
                  {(job.vehicle_make || job.vehicle_model) && (
                    <p className="text-sm text-gray-600">{job.vehicle_make} {job.vehicle_model}</p>
                  )}
                </div>
              </div>

              {job.problem_description && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Work Description</p>
                  <p className="text-sm">{job.problem_description}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {job.mechanic_status === 'ASSIGNED' && (
                  <button
                    onClick={() => updateJobStatus(job.lead_id, 'IN_PROGRESS')}
                    className="btn bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    <Wrench className="w-5 h-5" />
                    Start Job
                  </button>
                )}
                {job.mechanic_status === 'IN_PROGRESS' && (
                  <>
                    <button className="btn btn-outline">
                      <Camera className="w-5 h-5" />
                      Upload Photos
                    </button>
                    <button
                      onClick={() => updateJobStatus(job.lead_id, 'COMPLETED')}
                      className="btn bg-green-500 hover:bg-green-600 text-white"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Mark Complete
                    </button>
                  </>
                )}
              </div>

              <div className="mt-4 pt-4 border-t text-xs text-gray-500">
                Assigned: {new Date(job.assigned_at).toLocaleString()}
              </div>
            </div>
          ))}

          {jobs.length === 0 && (
            <div className="card text-center py-12">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No jobs assigned to you</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

