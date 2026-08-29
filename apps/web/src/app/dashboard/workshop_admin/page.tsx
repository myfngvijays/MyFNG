'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { CheckCircle, XCircle, Clock, Users, Wrench, User, Phone, Car, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAdvisorSession } from '@/lib/dashboard/useAdvisorSession';
import {
  WorkshopPageHeader,
  WorkshopPageShell,
  WorkshopStatTile,
  WorkshopEmpty,
} from '@/components/workshop/WorkshopUi';

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
  const { workshopId, ready } = useAdvisorSession();
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
    if (!workshopId) {
      if (ready) setStats((prev) => ({ ...prev, loading: false }));
      return;
    }
    fetchDashboardData();
  }, [workshopId, ready]);

  async function fetchDashboardData() {
    const supabase = createClient();

    try {
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

  const loading = stats.loading;

  return (
    <DashboardLayout role="workshop_admin">
      <WorkshopPageShell>
        <WorkshopPageHeader
          eyebrow="Workshop Owner"
          title="Dashboard"
          subtitle="Leads, jobs, and staff — all in one place"
        />

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <WorkshopStatTile label="Pending" value={stats.pending} icon={<Clock className="w-6 h-6 text-amber-600" />} tone="from-yellow-50 to-yellow-100" loading={loading} />
          <WorkshopStatTile label="Accepted" value={stats.accepted} icon={<CheckCircle className="w-6 h-6 text-green-600" />} tone="from-green-50 to-green-100" loading={loading} />
          <WorkshopStatTile label="In Progress" value={stats.inProgress} icon={<Wrench className="w-6 h-6 text-blue-600" />} tone="from-blue-50 to-blue-100" loading={loading} />
          <WorkshopStatTile label="Staff" value={stats.staff} icon={<Users className="w-6 h-6 text-purple-600" />} tone="from-purple-50 to-purple-100" loading={loading} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <button type="button" onClick={() => router.push('/dashboard/workshop_admin/pending-leads')} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:shadow-md">
            <Clock className="w-5 h-5 text-blue-700 shrink-0" />
            <span>
              <span className="block font-semibold text-sm text-slate-900">Pending Approvals</span>
              <span className="block text-xs text-slate-500">Accept or reject new leads</span>
            </span>
          </button>
          <button type="button" onClick={() => router.push('/dashboard/workshop_admin/staff')} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:shadow-md">
            <Users className="w-5 h-5 text-blue-700 shrink-0" />
            <span>
              <span className="block font-semibold text-sm text-slate-900">Staff</span>
              <span className="block text-xs text-slate-500">Manage workshop team</span>
            </span>
          </button>
          <button type="button" onClick={() => router.push('/dashboard/workshop_admin/jobs')} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:shadow-md">
            <Wrench className="w-5 h-5 text-blue-700 shrink-0" />
            <span>
              <span className="block font-semibold text-sm text-slate-900">Active Jobs</span>
              <span className="block text-xs text-slate-500">Track work in progress</span>
            </span>
          </button>
        </div>

        <div className="rounded-2xl bg-[#004AAD] p-3.5 shadow-sm sm:p-4">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h2 className="text-[14px] font-bold text-white">Pending Lead Approvals</h2>
            <button
              type="button"
              onClick={() => router.push('/dashboard/workshop_admin/pending-leads')}
              className="text-xs font-bold text-white/85"
            >
              View all →
            </button>
          </div>
          <div className="space-y-2">
            {loading && pendingLeads.length === 0 ? (
              <p className="py-6 text-center text-sm text-white/70">Loading leads…</p>
            ) : null}
            {pendingLeads.map((lead) => (
              <LeadApprovalCard key={lead.id} lead={lead} />
            ))}
            {!loading && pendingLeads.length === 0 ? (
              <p className="py-6 text-center text-sm text-white/70">No pending leads</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">Active Jobs</h2>
            <button type="button" onClick={() => router.push('/dashboard/workshop_admin/jobs')} className="text-xs font-semibold text-blue-700 hover:underline">
              View all
            </button>
          </div>
          <div className="space-y-2">
            {loading && activeJobs.length === 0 ? <WorkshopEmpty>Loading jobs…</WorkshopEmpty> : null}
            {activeJobs.map((job) => (
              <JobCard
                key={job.id}
                jobNumber={job.lead_number}
                customer={job.customer_name}
                vehicle={`${job.vehicle_make || ''} ${job.vehicle_model || ''}`.trim() || job.vehicle_number}
                mechanic={job.assigned_to_id?.full_name || 'Not assigned'}
                status={job.status}
              />
            ))}
            {!loading && activeJobs.length === 0 ? <WorkshopEmpty>No active jobs</WorkshopEmpty> : null}
          </div>
        </div>
      </WorkshopPageShell>
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
    <div className="rounded-xl bg-white p-3 sm:p-4 hover:bg-slate-50 transition-shadow cursor-pointer overflow-hidden"
         onClick={() => router.push(`/dashboard/workshop_admin/leads/${lead.id}`)}>
      {/* Header with Lead Number and Time */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-3">
        <div className="flex-1 min-w-0 w-full sm:w-auto">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2">
            <p className="font-semibold text-base sm:text-lg text-slate-900 truncate">{lead.lead_number || 'N/A'}</p>
            <span className="text-[10px] sm:text-xs text-gray-500 whitespace-nowrap">{formatDate(lead.created_at)}</span>
          </div>
          
          {/* Customer Info */}
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
            <p className="text-xs sm:text-sm font-medium text-slate-900 truncate">{lead.customer_name || 'N/A'}</p>
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
            <p className="text-xs sm:text-sm font-semibold text-[#004AAD] truncate">
              {lead.service_type_name || lead.service_type || 'General Service'}
            </p>
          </div>
          {lead.estimated_amount && (
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Estimated</p>
              <p className="text-base sm:text-lg font-bold text-[#004AAD]">₹{lead.estimated_amount.toLocaleString('en-IN')}</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-2 mt-3 pt-3 border-t border-slate-200">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/dashboard/workshop_admin/leads/${lead.id}`);
          }}
          className="flex-1 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-xs sm:text-sm font-bold text-white hover:bg-emerald-700"
        >
          <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          Accept
        </button>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/dashboard/workshop_admin/leads/${lead.id}`);
          }}
          className="flex-1 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-red-600 text-xs sm:text-sm font-bold text-white hover:bg-red-700"
        >
          <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          Reject
        </button>
      </div>
    </div>
  );
}

function JobCard({ jobNumber, customer, vehicle, mechanic, status }: any) {
  return (
    <div className="w-full max-w-full min-w-0 flex items-center gap-2 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 overflow-hidden">
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="font-semibold text-sm truncate text-slate-900">{jobNumber}</p>
        <p className="text-xs text-slate-500 truncate">{customer} · {vehicle}</p>
        <p className="text-xs text-slate-400 truncate">Assigned to: {mechanic}</p>
      </div>
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 whitespace-nowrap bg-blue-100 text-blue-700">
        {status}
      </span>
    </div>
  );
}

