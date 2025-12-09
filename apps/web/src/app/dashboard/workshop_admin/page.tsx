'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { CheckCircle, XCircle, Clock, Users, Wrench, User, Phone, Car, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface PendingLead {
  id: string;
  lead_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  vehicle_number: string;
  vehicle_make?: string;
  vehicle_model?: string;
  pickup_address?: string;
  city?: string;
  service_type?: string;
  service_type_name?: string;
  estimated_amount?: number;
  created_at: string;
  pickup_required?: boolean;
}

export default function WorkshopAdminDashboard() {
  const router = useRouter();
  const [pendingLeads, setPendingLeads] = useState<PendingLead[]>([]);
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

      // Fetch pending leads for this workshop with service type details
      const { data: pending, error: pendingError } = await supabase
        .from('service_leads')
        .select(`
          id,
          lead_number,
          customer_name,
          customer_phone,
          customer_email,
          vehicle_number,
          vehicle_make,
          vehicle_model,
          pickup_address,
          city,
          service_type,
          estimated_amount,
          created_at,
          pickup_required
        `)
        .eq('workshop_id', workshopId)
        .in('status', ['ASSIGNED_TO_WORKSHOP', 'PENDING', 'ASSIGNED'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (pendingError) {
        console.error('Error fetching pending leads:', pendingError);
      }

      // Transform pending leads to include service type name
      const transformedPending = (pending || []).map((lead: any) => ({
        ...lead,
        service_type_name: lead.service_type || 'General Service'
      }));

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
        .in('status', ['ASSIGNED_TO_WORKSHOP', 'PENDING', 'ASSIGNED']);

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

      setPendingLeads(transformedPending);
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
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6 mb-4 sm:mb-5 md:mb-6">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-300 drop-shadow-lg">🏪 Workshop Owner Dashboard</h1>
          <p className="text-white font-medium mt-0.5 sm:mt-1 text-sm sm:text-base">Manage your workshop operations and leads</p>
        </div>

        {/* Pending Leads - Most Important */}
        <div className="card bg-yellow-50 border-l-4 border-yellow-500">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 mb-3 sm:mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-text-heading flex items-center gap-1.5 sm:gap-2">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600 flex-shrink-0" />
              <span>Pending Lead Approvals</span>
            </h2>
            <span className="bg-yellow-500 text-white px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap">
              {stats.pending} {stats.pending === 1 ? 'New' : 'New'}
            </span>
          </div>
          
          <div className="space-y-2 sm:space-y-3">
            {pendingLeads.length > 0 ? (
              pendingLeads.map((lead) => (
                <LeadApprovalCard
                  key={lead.id}
                  lead={lead}
                />
              ))
            ) : (
              <p className="text-gray-500 text-center py-3 sm:py-4 text-sm sm:text-base">No pending leads</p>
            )}
          </div>

          {pendingLeads.length > 0 && (
            <button 
              onClick={() => router.push('/dashboard/workshop_admin/leads/pending')}
              className="btn btn-primary w-full mt-3 sm:mt-4 text-sm sm:text-base py-2 sm:py-2.5"
            >
              View All Pending Leads ({stats.pending})
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard title="Pending" value={stats.pending.toString()} icon={<Clock className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" />} color="yellow" />
          <StatCard title="Accepted" value={stats.accepted.toString()} icon={<CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-500" />} color="green" />
          <StatCard title="In Progress" value={stats.inProgress.toString()} icon={<Wrench className="w-5 h-5 sm:w-6 sm:h-6 text-brand-primary" />} color="blue" />
          <StatCard title="Staff" value={stats.staff.toString()} icon={<Users className="w-5 h-5 sm:w-6 sm:h-6 text-brand-secondary" />} color="purple" />
        </div>

        {/* Active Jobs */}
        <div className="card">
          <h2 className="text-lg sm:text-xl font-semibold text-text-heading mb-3 sm:mb-4">Active Jobs</h2>
          <div className="space-y-2 sm:space-y-3">
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
              <p className="text-gray-500 text-center py-3 sm:py-4 text-sm sm:text-base">No active jobs</p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function LeadApprovalCard({ lead }: { lead: PendingLead }) {
  const router = useRouter();
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} min ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }
  };

  return (
    <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
         onClick={() => router.push(`/dashboard/workshop_admin/leads/${lead.id}`)}>
      {/* Header with Lead Number and Time */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-3">
        <div className="flex-1 min-w-0 w-full sm:w-auto">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2">
            <p className="font-semibold text-base sm:text-lg text-text-heading truncate">{lead.lead_number || 'N/A'}</p>
            <span className="text-[10px] sm:text-xs text-gray-500 whitespace-nowrap">{formatDate(lead.created_at)}</span>
          </div>
          
          {/* Customer Info */}
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
            <p className="text-xs sm:text-sm font-medium text-text-heading truncate">{lead.customer_name || 'N/A'}</p>
          </div>
          
          {/* Phone */}
          {lead.customer_phone && (
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
              <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-gray-600 truncate">{lead.customer_phone}</p>
            </div>
          )}
          
          {/* Vehicle Info */}
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
            <Car className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
            <p className="text-xs sm:text-sm text-gray-600 truncate">
              {lead.vehicle_make && lead.vehicle_model 
                ? `${lead.vehicle_make} ${lead.vehicle_model}` 
                : lead.vehicle_number || 'N/A'}
            </p>
            {lead.vehicle_number && lead.vehicle_make && (
              <span className="text-[10px] sm:text-xs text-gray-500">({lead.vehicle_number})</span>
            )}
          </div>
          
          {/* Location */}
          {lead.city && (
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-gray-600 truncate">{lead.city}</p>
              {lead.pickup_required && (
                <span className="text-[10px] sm:text-xs bg-blue-100 text-blue-600 px-1.5 sm:px-2 py-0.5 rounded whitespace-nowrap">Pickup Required</span>
              )}
            </div>
          )}
        </div>
        
        {/* Right Side - Service & Amount */}
        <div className="text-left sm:text-right ml-0 sm:ml-4 w-full sm:w-auto flex-shrink-0">
          <div className="mb-1.5 sm:mb-2">
            <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Service</p>
            <p className="text-xs sm:text-sm font-semibold text-brand-primary truncate">
              {lead.service_type_name || lead.service_type || 'General Service'}
            </p>
          </div>
          {lead.estimated_amount && (
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Estimated</p>
              <p className="text-base sm:text-lg font-bold text-brand-primary">₹{lead.estimated_amount.toLocaleString('en-IN')}</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-2 mt-3 pt-3 border-t border-gray-200">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/dashboard/workshop_admin/leads/${lead.id}`);
          }}
          className="flex-1 btn bg-green-500 hover:bg-green-600 text-white text-xs sm:text-sm py-2 flex items-center justify-center gap-1.5 sm:gap-2"
        >
          <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          Accept
        </button>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/dashboard/workshop_admin/leads/${lead.id}`);
          }}
          className="flex-1 btn bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm py-2 flex items-center justify-center gap-1.5 sm:gap-2"
        >
          <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          Reject
        </button>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: any) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex-shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-text-body">{title}</p>
          <p className="text-xl sm:text-2xl font-bold text-text-heading">{value}</p>
        </div>
      </div>
    </div>
  );
}

function JobCard({ jobNumber, customer, vehicle, mechanic, status }: any) {
  return (
    <div className="p-3 sm:p-4 border border-gray-200 rounded-lg hover:shadow-md transition">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm sm:text-base text-text-heading truncate">{jobNumber}</p>
          <p className="text-xs sm:text-sm text-text-body truncate">{customer} - {vehicle}</p>
          <p className="text-xs sm:text-sm text-gray-500 truncate">Assigned to: {mechanic}</p>
        </div>
        <span className="bg-blue-100 text-brand-primary px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold whitespace-nowrap flex-shrink-0">
          {status}
        </span>
      </div>
    </div>
  );
}

