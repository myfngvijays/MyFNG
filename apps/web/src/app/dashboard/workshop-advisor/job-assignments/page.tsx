'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { Search, Filter, User, Wrench, Clock, CheckCircle } from 'lucide-react';
import { formatDateTime } from "@/lib/utils";
import { AdvisorPageHeader } from '@/components/advisor/AdvisorPageHeader';

export default function JobAssignmentsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();

    // Setup realtime subscription for job updates
    const supabase = createClient();
    const channel = supabase
      .channel('job-assignments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mechanic_jobs'
        },
        (payload) => {
          console.log('Job assignment update:', payload);
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_leads'
        },
        (payload) => {
          console.log('Service lead update:', payload);
          fetchData();
        }
      )
      .subscribe((status) => {
        console.log('Job assignments realtime subscription:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchData() {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id, workshop_id')
        .eq('email', user.email)
        .single();

      if (!userProfile || !userProfile.workshop_id) return;

      // Fetch all jobs in workshop
      const { data: jobsData } = await supabase
        .from('mechanic_jobs')
        .select(`
          *,
          service_leads:lead_id(
            lead_number, 
            customer_name, 
            customer_phone,
            vehicle_number,
            vehicle_make,
            vehicle_model,
            problem_description
          ),
          mechanic:mechanic_id(full_name, email)
        `)
        .order('assigned_at', { ascending: false });

      // Fetch mechanics
      const { data: mechanicsData } = await supabase
        .from('users_login')
        .select('id, name, email')
        .eq('workshop_id', userProfile.workshop_id)
        .eq('role.role_code', 'WORKSHOP_MECHANIC');

      setJobs(jobsData || []);
      setMechanics(mechanicsData || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  }

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = 
      job.service_leads?.lead_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.service_leads?.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.service_leads?.vehicle_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === 'ALL' || job.mechanic_status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <DashboardLayout role="workshop_supervisor">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_supervisor">
      <div className="w-full max-w-full min-w-0 space-y-4 sm:space-y-5">
        <AdvisorPageHeader
          title="Job Assignments"
          subtitle="Assign and monitor mechanic jobs"
          href="/dashboard/workshop-advisor/jobs"
        />

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1 min-w-0 relative">
            <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
            <input
              type="text"
              placeholder="Search by lead number, customer, or vehicle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-2 flex-shrink-0" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent w-full sm:w-auto"
            >
              <option value="ALL">All Status</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="HOLD">On Hold</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <p className="text-xs sm:text-sm text-gray-600">Total Jobs</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-600">{jobs.length}</p>
          </div>
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 shadow-sm">
            <p className="text-xs sm:text-sm text-gray-600">In Progress</p>
            <p className="text-xl sm:text-2xl font-bold text-yellow-600">
              {jobs.filter(j => j.mechanic_status === 'IN_PROGRESS').length}
            </p>
          </div>
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm">
            <p className="text-xs sm:text-sm text-gray-600">Completed</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600">
              {jobs.filter(j => j.mechanic_status === 'COMPLETED').length}
            </p>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm sm:col-span-2 lg:col-span-1">
            <p className="text-xs sm:text-sm text-gray-600">On Hold</p>
            <p className="text-xl sm:text-2xl font-bold text-red-600">
              {jobs.filter(j => j.mechanic_status === 'HOLD').length}
            </p>
          </div>
        </div>

        {/* Jobs List */}
        <div className="space-y-3 sm:space-y-4">
          {filteredJobs.map((job) => (
            <div 
              key={job.id} 
              className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
              onClick={() => router.push(`/dashboard/workshop-advisor/jobs/${job.lead_id}`)}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
                    <h3 className="text-lg sm:text-xl font-bold truncate">{job.service_leads?.lead_number}</h3>
                    <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold flex-shrink-0 ${
                      job.mechanic_status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                      job.mechanic_status === 'ASSIGNED' ? 'bg-green-100 text-green-700' :
                      job.mechanic_status === 'COMPLETED' ? 'bg-purple-100 text-purple-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {job.mechanic_status}
                    </span>
                    {job.job_priority !== 'NORMAL' && (
                      <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-red-100 text-red-700 flex-shrink-0">
                        {job.job_priority}
                      </span>
                    )}
                  </div>
                </div>
                {job.sla_remaining_minutes !== null && (
                  <div className={`text-left sm:text-right ${job.sla_remaining_minutes < 0 ? 'text-red-600' : 'text-green-600'} flex-shrink-0`}>
                    <p className="text-xs sm:text-sm font-semibold">
                      SLA: {job.sla_remaining_minutes < 0 ? 'Overdue' : 
                      `${Math.floor(job.sla_remaining_minutes / 60)}h ${job.sla_remaining_minutes % 60}m`}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 flex items-center gap-1.5 sm:gap-2 mb-1">
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    Customer
                  </p>
                  <p className="font-semibold text-sm sm:text-base">{job.service_leads?.customer_name}</p>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">{job.service_leads?.customer_phone}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 flex items-center gap-1.5 sm:gap-2 mb-1">
                    <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    Vehicle
                  </p>
                  <p className="font-semibold text-sm sm:text-base">{job.service_leads?.vehicle_number}</p>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">
                    {job.service_leads?.vehicle_make} {job.service_leads?.vehicle_model}
                  </p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 flex items-center gap-1.5 sm:gap-2 mb-1">
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    Assigned Mechanic
                  </p>
                  <p className="font-semibold text-sm sm:text-base truncate">{job.mechanic?.full_name || 'Unassigned'}</p>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">{job.mechanic?.email}</p>
                </div>
              </div>

              {job.service_leads?.problem_description && (
                <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Problem Description</p>
                  <p className="text-xs sm:text-sm">{job.service_leads.problem_description}</p>
                </div>
              )}

              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs sm:text-sm text-gray-500">
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  Assigned: {formatDateTime(job.assigned_at)}
                </span>
                {job.started_at && (
                  <span className="flex items-center gap-1.5 sm:gap-2">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    Started: {formatDateTime(job.started_at)}
                  </span>
                )}
              </div>
            </div>
          ))}

          {filteredJobs.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white py-10 text-center shadow-sm sm:py-12">
              <p className="text-gray-500 text-sm sm:text-base">No jobs found matching your criteria</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

