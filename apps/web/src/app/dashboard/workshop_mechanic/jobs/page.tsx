'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Wrench, Clock, Camera, CheckCircle, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function MechanicJobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobs();
  }, []);

  async function fetchJobs() {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!userProfile) {
        setLoading(false);
        return;
      }

      console.log('Fetching jobs for mechanic:', userProfile.id);

      // Fetch from mechanic_jobs table directly with proper joins
      const { data: mechanicJobs, error: jobsError } = await supabase
        .from('mechanic_jobs')
        .select(`
          *,
          lead:service_leads(
            id,
            lead_number,
            customer_name,
            customer_phone,
            vehicle_number,
            vehicle_make,
            vehicle_model,
            service_types,
            problem_description,
            status,
            pickup_required
          )
        `)
        .eq('mechanic_id', userProfile.id)
        .order('assigned_at', { ascending: false });

      if (jobsError) {
        console.error('Error fetching mechanic jobs:', jobsError);
        setJobs([]);
        setLoading(false);
        return;
      }

      // Transform data to match expected format
      const jobsData = (mechanicJobs || []).map((mj: any) => {
        // Parse service_types if it's a string
        let serviceTypes = [];
        if (mj.lead?.service_types) {
          if (typeof mj.lead.service_types === 'string') {
            try {
              serviceTypes = JSON.parse(mj.lead.service_types);
            } catch (e) {
              console.error('Error parsing service_types:', e);
              serviceTypes = [];
            }
          } else {
            serviceTypes = mj.lead.service_types;
          }
        }

        return {
          job_id: mj.id,
          lead_id: mj.lead_id,
          lead_number: mj.lead?.lead_number || 'N/A',
          customer_name: mj.lead?.customer_name || 'N/A',
          customer_phone: mj.lead?.customer_phone || '',
          vehicle_number: mj.lead?.vehicle_number || 'N/A',
          vehicle_make: mj.lead?.vehicle_make || '',
          vehicle_model: mj.lead?.vehicle_model || '',
          service_types: serviceTypes,
          problem_description: mj.lead?.problem_description || '',
          mechanic_status: mj.mechanic_status,
          job_priority: mj.job_priority,
          assigned_at: mj.assigned_at,
          started_at: mj.started_at,
          completed_at: mj.completed_at,
          before_images_count: mj.before_images_count || 0,
          progress_images_count: mj.progress_images_count || 0,
          after_images_count: mj.after_images_count || 0,
        };
      });

      console.log('Mechanic jobs raw:', mechanicJobs);
      console.log('Jobs transformed:', jobsData);
      console.log('Total jobs:', jobsData.length);
      
      setJobs(jobsData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setJobs([]);
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
            <div key={job.job_id || job.lead_id} className="card hover:shadow-lg transition">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold">{job.lead_number || 'N/A'}</h3>
                  {job.problem_description && (
                    <p className="text-lg text-gray-700 mt-1">{job.problem_description}</p>
                  )}
                  {job.service_types && Array.isArray(job.service_types) && job.service_types.length > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      Services: {job.service_types.join(', ')}
                    </p>
                  )}
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  job.mechanic_status === 'IN_PROGRESS' 
                    ? 'bg-blue-100 text-blue-700' 
                    : job.mechanic_status === 'COMPLETED'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {job.mechanic_status === 'IN_PROGRESS' 
                    ? 'In Progress' 
                    : job.mechanic_status === 'COMPLETED'
                    ? 'Completed'
                    : 'Assigned'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Customer</p>
                  <p className="font-semibold">{job.customer_name || 'N/A'}</p>
                  {job.customer_phone && (
                    <p className="text-sm text-gray-600">{job.customer_phone}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-600">Vehicle</p>
                  <p className="font-semibold">{job.vehicle_number || 'N/A'}</p>
                  {(job.vehicle_make || job.vehicle_model) && (
                    <p className="text-sm text-gray-600">
                      {job.vehicle_make || ''} {job.vehicle_model || ''}
                    </p>
                  )}
                </div>
              </div>

              {/* Image counts */}
              {(job.before_images_count > 0 || job.after_images_count > 0) && (
                <div className="mb-4 flex gap-4 text-sm">
                  <div className={`flex items-center gap-1 ${
                    job.before_images_count > 0 ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    <Camera className="w-4 h-4" />
                    Before: {job.before_images_count}
                  </div>
                  <div className={`flex items-center gap-1 ${
                    job.after_images_count > 0 ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    <Camera className="w-4 h-4" />
                    After: {job.after_images_count}
                  </div>
                </div>
              )}

              {job.problem_description && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Work Description</p>
                  <p className="text-sm">{job.problem_description}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {job.mechanic_status === 'ASSIGNED' && (
                  <button
                    onClick={() => {
                      if (job.lead_id) {
                        updateJobStatus(job.lead_id, 'IN_PROGRESS');
                      }
                    }}
                    className="btn bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-2"
                  >
                    <Wrench className="w-5 h-5" />
                    Start Job
                  </button>
                )}
                {job.mechanic_status === 'IN_PROGRESS' && (
                  <>
                    <button 
                      onClick={() => {
                        if (job.lead_id) {
                          router.push(`/dashboard/workshop_mechanic/jobs/${job.lead_id}?action=upload`);
                        }
                      }}
                      className="btn btn-outline flex items-center gap-2"
                    >
                      <Camera className="w-5 h-5" />
                      Upload Photos
                    </button>
                    <button
                      onClick={() => {
                        if (job.lead_id) {
                          updateJobStatus(job.lead_id, 'COMPLETED');
                        }
                      }}
                      className="btn bg-green-500 hover:bg-green-600 text-white flex items-center gap-2"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Mark Complete
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    if (job.lead_id) {
                      router.push(`/dashboard/workshop_mechanic/jobs/${job.lead_id}`);
                    }
                  }}
                  className="btn btn-outline flex items-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  View Details
                </button>
              </div>

              {job.assigned_at && (
                <div className="mt-4 pt-4 border-t text-xs text-gray-500">
                  Assigned: {new Date(job.assigned_at).toLocaleString()}
                </div>
              )}
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

