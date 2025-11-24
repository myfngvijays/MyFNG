'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { Search, Filter, User, Wrench, Clock, CheckCircle } from 'lucide-react';

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
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_supervisor">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-text-heading">Job Assignments</h1>
          <p className="text-text-body mt-2">Monitor and manage mechanic job assignments</p>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by lead number, customer, or vehicle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <Filter className="w-5 h-5 text-gray-400 mt-2" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card bg-blue-50">
            <p className="text-sm text-gray-600">Total Jobs</p>
            <p className="text-2xl font-bold text-blue-600">{jobs.length}</p>
          </div>
          <div className="card bg-yellow-50">
            <p className="text-sm text-gray-600">In Progress</p>
            <p className="text-2xl font-bold text-yellow-600">
              {jobs.filter(j => j.mechanic_status === 'IN_PROGRESS').length}
            </p>
          </div>
          <div className="card bg-green-50">
            <p className="text-sm text-gray-600">Completed</p>
            <p className="text-2xl font-bold text-green-600">
              {jobs.filter(j => j.mechanic_status === 'COMPLETED').length}
            </p>
          </div>
          <div className="card bg-red-50">
            <p className="text-sm text-gray-600">On Hold</p>
            <p className="text-2xl font-bold text-red-600">
              {jobs.filter(j => j.mechanic_status === 'HOLD').length}
            </p>
          </div>
        </div>

        {/* Jobs List */}
        <div className="space-y-4">
          {filteredJobs.map((job) => (
            <div 
              key={job.id} 
              className="card hover:shadow-lg transition cursor-pointer"
              onClick={() => router.push(`/dashboard/workshop_supervisor/jobs/${job.lead_id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold">{job.service_leads?.lead_number}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      job.mechanic_status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                      job.mechanic_status === 'ASSIGNED' ? 'bg-green-100 text-green-700' :
                      job.mechanic_status === 'COMPLETED' ? 'bg-purple-100 text-purple-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {job.mechanic_status}
                    </span>
                    {job.job_priority !== 'NORMAL' && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                        {job.job_priority}
                      </span>
                    )}
                  </div>
                </div>
                {job.sla_remaining_minutes !== null && (
                  <div className={`text-right ${job.sla_remaining_minutes < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    <p className="text-sm font-semibold">
                      SLA: {job.sla_remaining_minutes < 0 ? 'Overdue' : 
                      `${Math.floor(job.sla_remaining_minutes / 60)}h ${job.sla_remaining_minutes % 60}m`}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Customer
                  </p>
                  <p className="font-semibold">{job.service_leads?.customer_name}</p>
                  <p className="text-sm text-gray-600">{job.service_leads?.customer_phone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <Wrench className="w-4 h-4" />
                    Vehicle
                  </p>
                  <p className="font-semibold">{job.service_leads?.vehicle_number}</p>
                  <p className="text-sm text-gray-600">
                    {job.service_leads?.vehicle_make} {job.service_leads?.vehicle_model}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Assigned Mechanic
                  </p>
                  <p className="font-semibold">{job.mechanic?.full_name || 'Unassigned'}</p>
                  <p className="text-sm text-gray-600">{job.mechanic?.email}</p>
                </div>
              </div>

              {job.service_leads?.problem_description && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Problem Description</p>
                  <p className="text-sm">{job.service_leads.problem_description}</p>
                </div>
              )}

              <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm text-gray-500">
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Assigned: {new Date(job.assigned_at).toLocaleString()}
                </span>
                {job.started_at && (
                  <span className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Started: {new Date(job.started_at).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          ))}

          {filteredJobs.length === 0 && (
            <div className="card text-center py-12">
              <p className="text-gray-500">No jobs found matching your criteria</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

