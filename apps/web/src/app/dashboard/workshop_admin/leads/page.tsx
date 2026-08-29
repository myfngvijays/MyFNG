'use client';

/**
 * Workshop Admin - Enhanced Leads Dashboard
 * With SLA tracking, real-time updates, and filters
 * Task: WA-201
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import LeadCard from '@/components/workshop/LeadCard';
import { Filter, Search, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  WorkshopPageHeader,
  WorkshopPageShell,
  WorkshopStatTile,
  WorkshopEmpty,
} from '@/components/workshop/WorkshopUi';

type LeadStatus = 'ALL' | 'ASSIGNED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
type LeadType = 'ALL' | 'NORMAL' | 'RSA' | 'HOME_SERVICE';

export default function WorkshopLeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<any[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<LeadType>('ALL');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    initializeDashboard();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [leads, searchQuery, statusFilter, typeFilter]);

  // Set up real-time subscription
  useEffect(() => {
    if (!workshopId) return;

    const supabase = createClient();
    
    // Subscribe to lead changes for this workshop
    const channel = supabase
      .channel('workshop-leads')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_leads',
          filter: `workshop_id=eq.${workshopId}`,
        },
        (payload) => {
          console.log('Lead update:', payload);
          // Refresh leads when changes occur
          fetchLeads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workshopId]);

  async function initializeDashboard() {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('id', user.id)
        .single();

      if (userProfile?.workshop_id) {
        setWorkshopId(userProfile.workshop_id);
        await fetchLeads(userProfile.workshop_id);
      }
    } catch (error) {
      console.error('Error initializing dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLeads(wId?: string) {
    const supabase = createClient();
    const targetWorkshopId = wId || workshopId;

    if (!targetWorkshopId) return;

    try {
      // Only fetch ACCEPTED or later status leads (not ASSIGNED_TO_WORKSHOP)
      const { data, error } = await supabase
        .from('service_leads')
        .select('*')
        .eq('workshop_id', targetWorkshopId)
        .not('status', 'in', '(ASSIGNED_TO_WORKSHOP,ASSIGNED)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching leads:', error);
        return;
      }

      // Fetch service type names for each lead
      const leadsWithServiceNames = await Promise.all((data || []).map(async (lead) => {
        // Parse service_type_ids if it's a string
        let serviceTypeIds = lead.service_type_ids;
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
            lead.service_type_names = serviceTypes.map((st: any) => st.name).join(', ');
          }
        }

        return lead;
      }));

      setLeads(leadsWithServiceNames || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    }
  }

  function applyFilters() {
    let filtered = [...leads];

    // Status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(lead => lead.status === statusFilter);
    }

    // Type filter
    if (typeFilter !== 'ALL') {
      filtered = filtered.filter(lead => lead.lead_type === typeFilter);
    }

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(lead =>
        lead.lead_number?.toLowerCase().includes(query) ||
        lead.customer_name?.toLowerCase().includes(query) ||
        lead.customer_phone?.includes(query) ||
        lead.vehicle_number?.toLowerCase().includes(query) ||
        lead.service_type?.toLowerCase().includes(query)
      );
    }

    setFilteredLeads(filtered);
  }

  async function handleAcceptLead(leadId: string) {
    if (actionLoading) return;
    
    setActionLoading(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        alert('Lead accepted successfully!');
        await fetchLeads();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error accepting lead:', error);
      alert('Failed to accept lead. Please try again.');
    } finally {
      setActionLoading(false);
    }
  }

  function handleRejectLead(leadId: string) {
    setSelectedLeadId(leadId);
    setRejectReason('');
    setRejectNotes('');
    setShowRejectModal(true);
  }

  async function submitRejection() {
    if (!selectedLeadId || !rejectReason.trim() || rejectReason.length < 10) {
      alert('Please provide a rejection reason (minimum 10 characters)');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/leads/${selectedLeadId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: rejectReason,
          notes: rejectNotes,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert('Lead rejected successfully!');
        setShowRejectModal(false);
        setSelectedLeadId(null);
        await fetchLeads();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error rejecting lead:', error);
      alert('Failed to reject lead. Please try again.');
    } finally {
      setActionLoading(false);
    }
  }

  function handleViewLead(leadId: string) {
    router.push(`/dashboard/workshop_admin/leads/${leadId}`);
  }

  const stats = {
    total: leads.length,
    assigned: leads.filter(l => l.status === 'ASSIGNED').length,
    accepted: leads.filter(l => l.status === 'ACCEPTED').length,
    inProgress: leads.filter(l => l.status === 'IN_PROGRESS').length,
    completed: leads.filter(l => l.status === 'COMPLETED').length,
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
      <WorkshopPageShell>
        <WorkshopPageHeader
          eyebrow="Workshop Owner"
          title="Manage Leads"
          subtitle="View and manage all service leads assigned to your workshop"
          right={
            <button
              onClick={() => fetchLeads()}
              className="inline-flex w-full min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#023D95] px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-[#012f73] min-[900px]:w-auto"
              disabled={actionLoading}
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${actionLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          }
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <WorkshopStatTile label="Total Leads" value={stats.total} tone="from-blue-50 to-blue-100" />
          <WorkshopStatTile label="Assigned" value={stats.assigned} tone="from-yellow-50 to-yellow-100" />
          <WorkshopStatTile label="Accepted" value={stats.accepted} tone="from-green-50 to-green-100" />
          <WorkshopStatTile label="In Progress" value={stats.inProgress} tone="from-purple-50 to-purple-100" />
          <WorkshopStatTile label="Completed" value={stats.completed} tone="from-slate-50 to-slate-100" />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <div className="relative">
                <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                <input
                  type="text"
                  placeholder="Search by lead number, customer, phone, vehicle..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004AAD] focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as LeadStatus)}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004AAD] focus:border-transparent w-full sm:w-auto"
              >
                <option value="ALL">All Status</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div className="w-full sm:w-auto">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as LeadType)}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004AAD] focus:border-transparent w-full sm:w-auto"
              >
                <option value="ALL">All Types</option>
                <option value="NORMAL">Normal Service</option>
                <option value="RSA">RSA</option>
                <option value="HOME_SERVICE">Home Service</option>
              </select>
            </div>
          </div>
        </div>

        {filteredLeads.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <WorkshopEmpty>
              {searchQuery || statusFilter !== 'ALL' || typeFilter !== 'ALL'
                ? 'No leads match your filters'
                : 'No leads assigned yet'}
            </WorkshopEmpty>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            {filteredLeads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onAccept={handleAcceptLead}
                onReject={handleRejectLead}
                onView={handleViewLead}
              />
            ))}
          </div>
        )}
      </WorkshopPageShell>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Reject Lead</h3>
            
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Minimum 10 characters required..."
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  rows={3}
                />
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
                  {rejectReason.length}/10 characters minimum
                </p>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Any additional information..."
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4 sm:mt-5 md:mt-6 pt-4 border-t border-slate-200">
              <button
                onClick={() => setShowRejectModal(false)}
                disabled={actionLoading}
                className="flex-1 inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={submitRejection}
                disabled={actionLoading || rejectReason.length < 10}
                className="flex-1 inline-flex min-h-11 items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-xs sm:text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'Rejecting...' : 'Reject Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
