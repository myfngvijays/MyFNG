'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Wrench, User, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatDateDMY } from "@/lib/utils";

export default function WorkshopJobsPage() {
  const router = useRouter();
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
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_admin">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-text-heading">Active Jobs</h1>
          <p className="text-text-body text-xs sm:text-sm mt-1 sm:mt-2">Monitor and manage ongoing work</p>
        </div>

        {/* Filter Tabs */}
        <div className="card">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('active')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition text-xs sm:text-sm ${
                filter === 'active'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1.5 sm:mr-2" />
              Active Jobs
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition text-xs sm:text-sm ${
                filter === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1.5 sm:mr-2" />
              Completed
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition text-xs sm:text-sm ${
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
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="card">
            <p className="text-xs sm:text-sm text-gray-600">Total Jobs</p>
            <p className="text-xl sm:text-2xl font-bold">{jobs.length}</p>
          </div>
          <div className="card">
            <p className="text-xs sm:text-sm text-gray-600">Accepted</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600">
              {jobs.filter(j => j.status === 'ACCEPTED').length}
            </p>
          </div>
          <div className="card">
            <p className="text-xs sm:text-sm text-gray-600">In Progress</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-600">
              {jobs.filter(j => j.status === 'IN_PROGRESS').length}
            </p>
          </div>
          <div className="card sm:col-span-2 lg:col-span-1">
            <p className="text-xs sm:text-sm text-gray-600">Completed</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-600">
              {jobs.filter(j => j.status === 'COMPLETED').length}
            </p>
          </div>
        </div>

        {/* Jobs List */}
        <div className="space-y-3 sm:space-y-4">
          {jobs.map((job) => (
            <div key={job.id} className="card hover:shadow-lg transition">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{job.lead_number}</h3>
                  <p className="text-sm sm:text-base md:text-lg text-gray-700 truncate">
                    {job.service_type_names || job.service_type}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 ${getStatusColor(job.status)}`}>
                    {getStatusIcon(job.status)}
                    {job.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-0.5 sm:mb-1">Customer</p>
                  <p className="font-semibold text-sm sm:text-base truncate">{job.customer_name}</p>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">{job.customer_phone}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-0.5 sm:mb-1">Vehicle</p>
                  <p className="font-semibold text-sm sm:text-base truncate">{job.vehicle_number}</p>
                  {(job.vehicle_make || job.vehicle_model) && (
                    <p className="text-xs sm:text-sm text-gray-600 truncate">{job.vehicle_make} {job.vehicle_model}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-0.5 sm:mb-1">Mechanic</p>
                  {job.assigned_mechanic ? (
                    <>
                      <p className="font-semibold text-sm sm:text-base flex items-center gap-1.5 sm:gap-2 truncate">
                        <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                        <span className="truncate">{job.assigned_mechanic.full_name}</span>
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600 truncate">{job.assigned_mechanic.phone}</p>
                    </>
                  ) : (
                    <p className="text-xs sm:text-sm text-yellow-600 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                      Not assigned
                    </p>
                  )}
                </div>
              </div>

              {/* Pickup Boy Row */}
              {job.pickup_required && (
                <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t">
                  <p className="text-xs sm:text-sm text-gray-600 mb-0.5 sm:mb-1">Pickupboy/Driver</p>
                  {job.assigned_pickup_boy ? (
                    <>
                      <p className="font-semibold text-sm sm:text-base flex items-center gap-1.5 sm:gap-2 truncate">
                        <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600 flex-shrink-0" />
                        <span className="truncate">{job.assigned_pickup_boy.full_name}</span>
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600 truncate">{job.assigned_pickup_boy.phone}</p>
                    </>
                  ) : (
                    <p className="text-xs sm:text-sm text-yellow-600 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                      Pickup required - Not assigned
                    </p>
                  )}
                </div>
              )}

              {job.estimated_amount && (
                <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600">Estimated Amount</p>
                    <p className="text-lg sm:text-xl font-bold text-green-600">₹{job.estimated_amount.toLocaleString()}</p>
                  </div>
                  {job.actual_amount && (
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600">Actual Amount</p>
                      <p className="text-lg sm:text-xl font-bold text-green-600">₹{job.actual_amount.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3">
                <div className="text-[10px] sm:text-xs text-gray-500 flex flex-wrap gap-2 sm:gap-4">
                  <span>Accepted: {formatDateDMY(job.accepted_at || job.created_at)}</span>
                  {job.completed_at && (
                    <span>Completed: {formatDateDMY(job.completed_at)}</span>
                  )}
                </div>
                <button 
                  onClick={() => router.push(`/dashboard/workshop_admin/leads/${job.id}`)}
                  className="btn btn-outline text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 hover:bg-blue-50 hover:border-blue-500 transition w-full sm:w-auto"
                >
                  View Details
                </button>
              </div>
            </div>
          ))}

          {jobs.length === 0 && (
            <div className="card text-center py-8 sm:py-10 md:py-12">
              <Wrench className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <p className="text-gray-500 text-sm sm:text-base">No jobs found in this category</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

