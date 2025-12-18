'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { formatDateDMY } from '@/lib/utils';
import {
  Clock, CheckCircle, XCircle, Calendar, 
  Filter, Search, Download, Eye
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface JobHistoryItem {
  job_id: string;
  lead_id: string;
  lead_number: string;
  customer_name: string;
  vehicle_number: string;
  vehicle_make: string;
  vehicle_model: string;
  mechanic_status: string;
  job_priority: string;
  assigned_at: string;
  started_at: string | null;
  completed_at: string | null;
  actual_work_duration: number | null;
  efficiency_score: number | null;
}

export default function JobHistoryPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobHistoryItem[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<JobHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  
  const [stats, setStats] = useState({
    total_completed: 0,
    total_duration: 0,
    avg_efficiency: 0,
    on_time_completion: 0
  });

  useEffect(() => {
    fetchJobHistory();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, statusFilter, dateFilter, jobs]);

  async function fetchJobHistory() {
    const supabase = createClient();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!userProfile) return;

      // Fetch all completed jobs
      const { data: jobsData } = await supabase
        .from('mechanic_jobs')
        .select(`
          id,
          lead_id,
          mechanic_status,
          job_priority,
          assigned_at,
          started_at,
          completed_at,
          actual_work_duration,
          efficiency_score,
          service_leads:lead_id (
            lead_number,
            customer_name,
            vehicle_number,
            vehicle_make,
            vehicle_model
          )
        `)
        .eq('mechanic_id', userProfile.id)
        .in('mechanic_status', ['COMPLETED', 'READY_FOR_DELIVERY'])
        .order('completed_at', { ascending: false })
        .limit(100);

      const formattedJobs = (jobsData || []).map((job: any) => ({
        job_id: job.id,
        lead_id: job.lead_id,
        lead_number: job.service_leads?.lead_number || 'N/A',
        customer_name: job.service_leads?.customer_name || 'N/A',
        vehicle_number: job.service_leads?.vehicle_number || 'N/A',
        vehicle_make: job.service_leads?.vehicle_make || '',
        vehicle_model: job.service_leads?.vehicle_model || '',
        mechanic_status: job.mechanic_status,
        job_priority: job.job_priority,
        assigned_at: job.assigned_at,
        started_at: job.started_at,
        completed_at: job.completed_at,
        actual_work_duration: job.actual_work_duration,
        efficiency_score: job.efficiency_score
      }));

      setJobs(formattedJobs);
      setFilteredJobs(formattedJobs);

      // Calculate stats
      const totalCompleted = formattedJobs.length;
      const totalDuration = formattedJobs.reduce((sum, job) => sum + (job.actual_work_duration || 0), 0);
      const avgEfficiency = formattedJobs.reduce((sum, job) => sum + (job.efficiency_score || 0), 0) / totalCompleted || 0;
      
      setStats({
        total_completed: totalCompleted,
        total_duration: totalDuration,
        avg_efficiency: avgEfficiency,
        on_time_completion: Math.round((formattedJobs.filter(j => (j.efficiency_score || 0) >= 80).length / totalCompleted) * 100) || 0
      });

    } catch (error) {
      console.error('Error fetching job history:', error);
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    let filtered = [...jobs];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(job => 
        job.lead_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.vehicle_number.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(job => job.mechanic_status === statusFilter);
    }

    // Date filter
    if (dateFilter !== 'ALL') {
      const now = new Date();
      filtered = filtered.filter(job => {
        if (!job.completed_at) return false;
        const completedDate = new Date(job.completed_at);
        
        switch (dateFilter) {
          case 'TODAY':
            return completedDate.toDateString() === now.toDateString();
          case 'WEEK':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return completedDate >= weekAgo;
          case 'MONTH':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return completedDate >= monthAgo;
          default:
            return true;
        }
      });
    }

    setFilteredJobs(filtered);
  }

  function formatDuration(minutes: number | null) {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }

  function getStatusBadgeClass(status: string) {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'READY_FOR_DELIVERY':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function getPriorityBadgeClass(priority: string) {
    switch (priority) {
      case 'URGENT':
      case 'CRITICAL':
        return 'bg-red-100 text-red-800';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="workshop_mechanic">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_mechanic">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-brand-heading">Job History</h1>
            <p className="text-brand-textSecondary text-xs sm:text-sm mt-0.5 sm:mt-1">Your completed jobs and performance</p>
          </div>
          <button className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-xs sm:text-sm w-full sm:w-auto">
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Export
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 sm:p-5 md:p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-brand-textSecondary">Total Completed</p>
                <p className="text-xl sm:text-2xl font-bold text-brand-heading mt-0.5 sm:mt-1">{stats.total_completed}</p>
              </div>
              <CheckCircle className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-green-500 flex-shrink-0" />
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 md:p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-brand-textSecondary">Total Time</p>
                <p className="text-xl sm:text-2xl font-bold text-brand-heading mt-0.5 sm:mt-1">{formatDuration(stats.total_duration)}</p>
              </div>
              <Clock className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-blue-500 flex-shrink-0" />
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 md:p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-brand-textSecondary">Avg Efficiency</p>
                <p className="text-xl sm:text-2xl font-bold text-brand-heading mt-0.5 sm:mt-1">{Math.round(stats.avg_efficiency)}%</p>
              </div>
              <CheckCircle className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-purple-500 flex-shrink-0" />
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 md:p-6 rounded-lg border border-gray-200 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-brand-textSecondary">On-Time</p>
                <p className="text-xl sm:text-2xl font-bold text-brand-heading mt-0.5 sm:mt-1">{stats.on_time_completion}%</p>
              </div>
              <Calendar className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-green-500 flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Search */}
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent w-full"
            >
              <option value="ALL">All Status</option>
              <option value="COMPLETED">Completed</option>
              <option value="READY_FOR_DELIVERY">Ready for Delivery</option>
            </select>

            {/* Date Filter */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent w-full"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today</option>
              <option value="WEEK">Last 7 Days</option>
              <option value="MONTH">Last 30 Days</option>
            </select>

            {/* Clear Filters */}
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
                setDateFilter('ALL');
              }}
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg hover:bg-gray-50 w-full sm:w-auto"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Job History Table - Desktop */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hidden lg:block">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Job Details
                  </th>
                  <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vehicle
                  </th>
                  <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Efficiency
                  </th>
                  <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Completed
                  </th>
                  <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 md:px-6 py-8 sm:py-10 md:py-12 text-center text-gray-500">
                      <XCircle className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 mx-auto mb-2 sm:mb-3 text-gray-300" />
                      <p className="text-sm sm:text-base">No completed jobs found</p>
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((job) => (
                    <tr key={job.job_id} className="hover:bg-gray-50">
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                        <div>
                          <div className="text-xs sm:text-sm font-medium text-brand-heading">{job.lead_number}</div>
                          <div className="text-xs sm:text-sm text-gray-500">{job.customer_name}</div>
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                        <div>
                          <div className="text-xs sm:text-sm font-medium text-gray-900">{job.vehicle_number}</div>
                          <div className="text-xs sm:text-sm text-gray-500">{job.vehicle_make} {job.vehicle_model}</div>
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 sm:py-1 inline-flex text-[10px] sm:text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(job.mechanic_status)}`}>
                          {job.mechanic_status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 sm:py-1 inline-flex text-[10px] sm:text-xs leading-5 font-semibold rounded-full ${getPriorityBadgeClass(job.job_priority)}`}>
                          {job.job_priority}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        {formatDuration(job.actual_work_duration)}
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-xs sm:text-sm font-medium text-gray-900">
                            {job.efficiency_score ? `${Math.round(job.efficiency_score)}%` : 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                        {job.completed_at ? formatDateDMY(job.completed_at) : 'N/A'}
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                        <button
                          onClick={() => router.push(`/dashboard/workshop_mechanic/jobs/${job.lead_id}`)}
                          className="text-brand-primary hover:text-brand-primaryHover flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Job History Cards - Mobile */}
        <div className="lg:hidden space-y-3">
          {filteredJobs.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 sm:p-10 md:p-12 text-center">
              <XCircle className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 mx-auto mb-2 sm:mb-3 text-gray-300" />
              <p className="text-sm sm:text-base text-gray-500">No completed jobs found</p>
            </div>
          ) : (
            filteredJobs.map((job) => (
              <div key={job.job_id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-brand-heading mb-1">{job.lead_number}</div>
                    <div className="text-sm text-gray-900 font-semibold truncate">{job.customer_name}</div>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <span className={`px-2 py-0.5 inline-flex text-[10px] font-semibold rounded-full ${getStatusBadgeClass(job.mechanic_status)}`}>
                      {job.mechanic_status.replace(/_/g, ' ')}
                    </span>
                    <span className={`px-2 py-0.5 inline-flex text-[10px] font-semibold rounded-full ${getPriorityBadgeClass(job.job_priority)}`}>
                      {job.job_priority}
                    </span>
                  </div>
                </div>
                <div className="space-y-2 text-xs sm:text-sm mb-3">
                  <div>
                    <span className="text-gray-500">Vehicle: </span>
                    <span className="font-medium text-gray-900">{job.vehicle_number}</span>
                  </div>
                  <div className="text-gray-600">{job.vehicle_make} {job.vehicle_model}</div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-gray-500">Duration: </span>
                      <span className="font-medium">{formatDuration(job.actual_work_duration)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Efficiency: </span>
                      <span className="font-medium">{job.efficiency_score ? `${Math.round(job.efficiency_score)}%` : 'N/A'}</span>
                    </div>
                  </div>
                  <div className="text-gray-500">
                    Completed: {job.completed_at ? formatDateDMY(job.completed_at) : 'N/A'}
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/dashboard/workshop_mechanic/jobs/${job.lead_id}`)}
                  className="text-brand-primary hover:text-brand-primaryHover flex items-center gap-1 text-xs sm:text-sm font-medium"
                >
                  <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  View Details
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

