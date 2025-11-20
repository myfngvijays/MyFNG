'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { CheckCircle, XCircle, Clock, Users, Wrench } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function WorkshopAdminDashboard() {
  const [pendingLeads, setPendingLeads] = useState<any[]>([]);
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    accepted: 0,
    inProgress: 0,
    staff: 0,
    loading: true
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    const supabase = createClient();

    try {
      // Get current user's workshop_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('email', user.email)
        .single();

      const workshopId = userProfile?.workshop_id;

      if (!workshopId) {
        setStats(prev => ({ ...prev, loading: false }));
        return;
      }

      // Fetch pending leads for this workshop
      const { data: pending } = await supabase
        .from('service_leads')
        .select('*')
        .eq('workshop_id', workshopId)
        .eq('status', 'ASSIGNED')
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch active/in-progress jobs
      const { data: active } = await supabase
        .from('service_leads')
        .select('*, assigned_to_id(full_name)')
        .eq('workshop_id', workshopId)
        .in('status', ['ACCEPTED', 'IN_PROGRESS'])
        .order('updated_at', { ascending: false })
        .limit(5);

      // Get stats counts
      const { count: pendingCount } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', workshopId)
        .eq('status', 'ASSIGNED');

      const { count: acceptedCount } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', workshopId)
        .eq('status', 'ACCEPTED');

      const { count: inProgressCount } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', workshopId)
        .eq('status', 'IN_PROGRESS');

      const { count: staffCount } = await supabase
        .from('users_login')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', workshopId)
        .eq('is_active', true);

      setPendingLeads(pending || []);
      setActiveJobs(active || []);
      setStats({
        pending: pendingCount || 0,
        accepted: acceptedCount || 0,
        inProgress: inProgressCount || 0,
        staff: staffCount || 0,
        loading: false
      });
    } catch (error) {
      console.error('Error fetching workshop data:', error);
      setStats(prev => ({ ...prev, loading: false }));
    }
  }

  if (stats.loading) {
    return (
      <DashboardLayout role="workshop_admin">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-4 text-text-body">Loading dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_admin">
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-6 rounded-lg shadow-lg -mx-6 -mt-6 mb-6">
          <h1 className="text-3xl font-bold text-yellow-300 drop-shadow-lg">🏪 Workshop Admin Dashboard</h1>
          <p className="text-white font-medium mt-1">Manage your workshop operations and leads</p>
        </div>

        {/* Pending Leads - Most Important */}
        <div className="card bg-yellow-50 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-text-heading flex items-center gap-2">
              <Clock className="w-6 h-6 text-yellow-600" />
              Pending Lead Approvals
            </h2>
            <span className="bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
              {stats.pending} New
            </span>
          </div>
          
          <div className="space-y-3">
            {pendingLeads.length > 0 ? (
              pendingLeads.map((lead) => (
                <LeadApprovalCard
                  key={lead.id}
                  leadNumber={lead.lead_number}
                  customerName={lead.customer_name}
                  vehicleNumber={lead.vehicle_number}
                  serviceType={lead.service_type}
                  estimatedAmount={lead.estimated_amount}
                />
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No pending leads</p>
            )}
          </div>

          {pendingLeads.length > 0 && (
            <button className="btn btn-primary w-full mt-4">
              View All Pending Leads
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Pending" value={stats.pending.toString()} icon={<Clock className="w-6 h-6 text-yellow-500" />} color="yellow" />
          <StatCard title="Accepted" value={stats.accepted.toString()} icon={<CheckCircle className="w-6 h-6 text-green-500" />} color="green" />
          <StatCard title="In Progress" value={stats.inProgress.toString()} icon={<Wrench className="w-6 h-6 text-brand-primary" />} color="blue" />
          <StatCard title="Staff" value={stats.staff.toString()} icon={<Users className="w-6 h-6 text-brand-secondary" />} color="purple" />
        </div>

        {/* Active Jobs */}
        <div className="card">
          <h2 className="text-xl font-semibold text-text-heading mb-4">Active Jobs</h2>
          <div className="space-y-3">
            {activeJobs.length > 0 ? (
              activeJobs.map((job) => (
                <JobCard
                  key={job.id}
                  jobNumber={job.lead_number}
                  customer={job.customer_name}
                  vehicle={`${job.vehicle_make || ''} ${job.vehicle_model || ''}`.trim() || job.vehicle_number}
                  mechanic={job.assigned_to_id?.full_name || 'Not assigned'}
                  status={job.status}
                />
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No active jobs</p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function LeadApprovalCard({ leadNumber, customerName, vehicleNumber, serviceType, estimatedAmount }: any) {
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="font-semibold text-lg">{leadNumber}</p>
          <p className="text-sm text-gray-600">{customerName}</p>
          <p className="text-sm text-gray-600">{vehicleNumber}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">{serviceType}</p>
          <p className="font-bold text-brand-primary">₹{estimatedAmount}</p>
        </div>
      </div>
      
      <div className="flex gap-2">
        <button className="flex-1 btn bg-green-500 hover:bg-green-600 text-white text-sm py-2">
          <CheckCircle className="w-4 h-4" />
          Accept
        </button>
        <button className="flex-1 btn bg-red-500 hover:bg-red-600 text-white text-sm py-2">
          <XCircle className="w-4 h-4" />
          Reject
        </button>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: any) {
  return (
    <div className="card">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-sm text-text-body">{title}</p>
          <p className="text-2xl font-bold text-text-heading">{value}</p>
        </div>
      </div>
    </div>
  );
}

function JobCard({ jobNumber, customer, vehicle, mechanic, status }: any) {
  return (
    <div className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-semibold text-text-heading">{jobNumber}</p>
          <p className="text-sm text-text-body">{customer} - {vehicle}</p>
          <p className="text-sm text-gray-500">Assigned to: {mechanic}</p>
        </div>
        <span className="bg-blue-100 text-brand-primary px-3 py-1 rounded-full text-xs font-semibold">
          {status}
        </span>
      </div>
    </div>
  );
}

