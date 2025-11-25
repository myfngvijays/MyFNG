'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Wrench, User, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function WorkshopJobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active'); // active, completed, all

  useEffect(() => {
    fetchJobs();
  }, [filter]);

  async function fetchJobs() {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('email', user.email)
        .single();

      const workshopId = userProfile?.workshop_id;
      if (!workshopId) {
        setLoading(false);
        return;
      }

      let query = supabase
        .from('service_leads')
        .select(`
          *,
          assigned_to:users_login!service_leads_assigned_to_id_fkey(full_name, phone),
          assigned_mechanic:users_login!service_leads_assigned_mechanic_id_fkey(full_name, phone),
          assigned_pickup_boy:users_login!service_leads_assigned_pickup_boy_id_fkey(full_name, phone)
        `)
        .eq('workshop_id', workshopId)
        .order('updated_at', { ascending: false });

      if (filter === 'active') {
        query = query.in('status', ['ACCEPTED', 'IN_PROGRESS']);
      } else if (filter === 'completed') {
        query = query.eq('status', 'COMPLETED');
      }

      const { data } = await query;

      // Fetch service type names for each job
      const jobsWithServiceNames = await Promise.all((data || []).map(async (job) => {
        let serviceTypeIds = job.service_type_ids;
        if (typeof serviceTypeIds === 'string') {
          try {
            serviceTypeIds = JSON.parse(serviceTypeIds);
          } catch (e) {
            console.error('Failed to parse service_type_ids:', e);
            serviceTypeIds = [];
          }
        }

        if (serviceTypeIds && Array.isArray(serviceTypeIds) && serviceTypeIds.length > 0) {
          const { data: serviceTypes } = await supabase
            .from('service_types')
            .select('id, name')
            .in('id', serviceTypeIds);

          if (serviceTypes && serviceTypes.length > 0) {
            job.service_type_names = serviceTypes.map((st: any) => st.name).join(', ');
          }
        }

        return job;
      }));

      setJobs(jobsWithServiceNames || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setLoading(false);
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'ACCEPTED': 'bg-green-100 text-green-700',
      'IN_PROGRESS': 'bg-blue-100 text-blue-700',
      'COMPLETED': 'bg-gray-100 text-gray-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'COMPLETED') return <CheckCircle className="w-5 h-5" />;
    if (status === 'IN_PROGRESS') return <Wrench className="w-5 h-5" />;
    return <Clock className="w-5 h-5" />;
  };

  if (loading) {
    return (
      <DashboardLayout role="workshop_admin">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-text-heading">Active Jobs</h1>
          <p className="text-text-body mt-2">Monitor and manage ongoing work</p>
        </div>

        {/* Filter Tabs */}
        <div className="card">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('active')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'active'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Wrench className="w-4 h-4 inline mr-2" />
              Active Jobs
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <CheckCircle className="w-4 h-4 inline mr-2" />
              Completed
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'all'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Jobs
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-sm text-gray-600">Total Jobs</p>
            <p className="text-2xl font-bold">{jobs.length}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Accepted</p>
            <p className="text-2xl font-bold text-green-600">
              {jobs.filter(j => j.status === 'ACCEPTED').length}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">In Progress</p>
            <p className="text-2xl font-bold text-blue-600">
              {jobs.filter(j => j.status === 'IN_PROGRESS').length}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Completed</p>
            <p className="text-2xl font-bold text-gray-600">
              {jobs.filter(j => j.status === 'COMPLETED').length}
            </p>
          </div>
        </div>

        {/* Jobs List */}
        <div className="space-y-4">
          {jobs.map((job) => (
            <div key={job.id} className="card hover:shadow-lg transition">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{job.lead_number}</h3>
                  <p className="text-lg text-gray-700">
                    {job.service_type_names || job.service_type}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 ${getStatusColor(job.status)}`}>
                    {getStatusIcon(job.status)}
                    {job.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Customer</p>
                  <p className="font-semibold">{job.customer_name}</p>
                  <p className="text-sm text-gray-600">{job.customer_phone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Vehicle</p>
                  <p className="font-semibold">{job.vehicle_number}</p>
                  {(job.vehicle_make || job.vehicle_model) && (
                    <p className="text-sm text-gray-600">{job.vehicle_make} {job.vehicle_model}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Mechanic</p>
                  {job.assigned_mechanic ? (
                    <>
                      <p className="font-semibold flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {job.assigned_mechanic.full_name}
                      </p>
                      <p className="text-sm text-gray-600">{job.assigned_mechanic.phone}</p>
                    </>
                  ) : (
                    <p className="text-sm text-yellow-600 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      Not assigned
                    </p>
                  )}
                </div>
              </div>

              {/* Pickup Boy Row */}
              {job.pickup_required && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm text-gray-600 mb-1">Pickup Boy</p>
                  {job.assigned_pickup_boy ? (
                    <>
                      <p className="font-semibold flex items-center gap-2">
                        <User className="w-4 h-4 text-purple-600" />
                        {job.assigned_pickup_boy.full_name}
                      </p>
                      <p className="text-sm text-gray-600">{job.assigned_pickup_boy.phone}</p>
                    </>
                  ) : (
                    <p className="text-sm text-yellow-600 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      Pickup required - Not assigned
                    </p>
                  )}
                </div>
              )}

              {job.estimated_amount && (
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Estimated Amount</p>
                    <p className="text-xl font-bold text-green-600">₹{job.estimated_amount.toLocaleString()}</p>
                  </div>
                  {job.actual_amount && (
                    <div>
                      <p className="text-sm text-gray-600">Actual Amount</p>
                      <p className="text-xl font-bold text-green-600">₹{job.actual_amount.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 pt-4 border-t flex justify-between items-center">
                <div className="text-xs text-gray-500 space-x-4">
                  <span>Accepted: {new Date(job.accepted_at || job.created_at).toLocaleDateString()}</span>
                  {job.completed_at && (
                    <span>Completed: {new Date(job.completed_at).toLocaleDateString()}</span>
                  )}
                </div>
                <button className="btn btn-outline text-sm">
                  View Details
                </button>
              </div>
            </div>
          ))}

          {jobs.length === 0 && (
            <div className="card text-center py-12">
              <Wrench className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No jobs found in this category</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

