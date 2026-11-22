'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search, Loader2, ArrowRight, Building, X, ClipboardList, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import DashboardLayout from '@/components/DashboardLayout';
import PageHelpIcon from '@/components/PageHelpIcon';

function LeadManagerLeadsContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter') || 'all';

  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState(filterParam);
  const [sortBy, setSortBy] = useState<'priority' | 'sla' | 'created'>('created');
  
  // Assignment modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [selectedWorkshop, setSelectedWorkshop] = useState<string>('');
  const [workshopSearch, setWorkshopSearch] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [assigning, setAssigning] = useState(false);

  const filters = [
    { value: 'all', label: 'All Leads' },
    { value: 'NEW', label: 'New' },
    { value: 'INCOMPLETE', label: 'Incomplete' },
    { value: 'NEED_ASSIGNMENT', label: 'Need Assignment' },
    { value: 'WORKSHOP_REJECTED', label: 'Rejected' },
    { value: 'TELECALLER_PENDING', label: 'Tel. Pending' },
    { value: 'SLA_AT_RISK', label: 'SLA Risk' },
    { value: 'SLA_BREACHED', label: 'SLA Breach' },
  ];

  useEffect(() => {
    fetchLeads();
  }, [activeFilter, sortBy]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm) {
        fetchLeads();
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const fetchLeads = async () => {
    setLoading(true);
    setLoadError('');
    try {
      let query = supabase
        .from('service_leads')
        .select(`
          *,
          workshop:workshops(name, city),
          assigned_telecaller:assigned_telecaller_id(full_name)
        `);

      // Apply filters
      switch (activeFilter) {
        case 'NEW':
          query = query.eq('status', 'NEW').is('workshop_id', null);
          break;
        case 'INCOMPLETE':
          query = query.eq('is_incomplete', true);
          break;
        case 'NEED_ASSIGNMENT':
          query = query.in('status', ['NEW', 'VALIDATED']).is('workshop_id', null).eq('is_incomplete', false);
          break;
        case 'WORKSHOP_REJECTED':
          query = query.eq('status', 'REJECTED');
          break;
        case 'TELECALLER_PENDING':
          query = query.eq('follow_up_required', true).not('assigned_telecaller_id', 'is', null);
          break;
        case 'SLA_AT_RISK':
          query = query.eq('sla_state', 'AT_RISK').not('status', 'in', '(COMPLETED,CANCELLED,CLOSED)');
          break;
        case 'SLA_BREACHED':
          query = query.eq('sla_state', 'BREACHED').not('status', 'in', '(COMPLETED,CANCELLED,CLOSED)');
          break;
        default:
          query = query.not('status', 'in', '(COMPLETED,CANCELLED,CLOSED)');
      }

      // Apply search
      if (searchTerm) {
        query = query.or(
          `customer_name.ilike.%${searchTerm}%,` +
          `customer_phone.ilike.%${searchTerm}%,` +
          `lead_number.ilike.%${searchTerm}%,` +
          `vehicle_number.ilike.%${searchTerm}%`
        );
      }

      // Apply sorting
      switch (sortBy) {
        case 'priority':
          query = query.order('lead_priority', { ascending: false });
          break;
        case 'sla':
          query = query.order('sla_expires_at', { ascending: true });
          break;
        case 'created':
          query = query.order('created_at', { ascending: false });
          break;
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
      const msg = (error as any)?.message || 'Failed to load leads';
      setLoadError(msg);
      toast.error(msg);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'text-red-600 bg-red-100';
      case 'HIGH': return 'text-orange-600 bg-orange-100';
      case 'NORMAL': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW': return 'text-blue-600 bg-blue-100';
      case 'ASSIGNED': return 'text-indigo-600 bg-indigo-100';
      case 'ACCEPTED': return 'text-green-600 bg-green-100';
      case 'REJECTED': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getSLAColor = (slaState: string) => {
    switch (slaState) {
      case 'BREACHED': return 'text-red-600 bg-red-100';
      case 'AT_RISK': return 'text-orange-600 bg-orange-100';
      default: return 'text-green-600 bg-green-100';
    }
  };

  const fetchWorkshops = async (lead: any) => {
    try {
      const city = lead.city || '';
      let url = `/api/lead-manager/available-workshops?`;
      
      if (workshopSearch) {
        url += `search=${encodeURIComponent(workshopSearch)}`;
      } else if (city) {
        url += `city=${encodeURIComponent(city)}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setWorkshops(data.workshops || []);
      }
    } catch (error) {
      console.error('Error fetching workshops:', error);
    }
  };

  const handleAssignClick = (lead: any) => {
    setSelectedLead(lead);
    setShowAssignModal(true);
    setWorkshopSearch('');
    setSelectedWorkshop('');
    setAssignmentNotes('');
    setPriority(lead.lead_priority || 'MEDIUM');
    fetchWorkshops(lead);
  };

  const handleAssignWorkshop = async () => {
    if (!selectedWorkshop || !selectedLead) {
      return;
    }

    setAssigning(true);
    try {
      const response = await fetch('/api/lead-manager/assign-workshop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: selectedLead.id,
          workshop_id: selectedWorkshop,
          assignment_notes: assignmentNotes,
          priority
        })
      });

      const data = await response.json();

      if (data.success) {
        // Close modal and refresh leads
        setShowAssignModal(false);
        setSelectedLead(null);
        setSelectedWorkshop('');
        setAssignmentNotes('');
        fetchLeads();
        
        toast.success(data.message || 'Workshop assigned successfully!');
      } else {
        toast.error(data.error || 'Assignment failed');
      }
    } catch (error) {
      console.error('Assignment error:', error);
      toast.error('Failed to assign workshop');
    } finally {
      setAssigning(false);
    }
  };

  const filteredWorkshops = workshops.filter((workshop) => {
    if (!workshopSearch) return true;
    const search = workshopSearch.toLowerCase();
    return (
      workshop.name?.toLowerCase().includes(search) ||
      workshop.city?.toLowerCase().includes(search) ||
      workshop.state?.toLowerCase().includes(search)
    );
  });

  const closeModal = () => {
    setShowAssignModal(false);
    setSelectedLead(null);
    setSelectedWorkshop('');
    setAssignmentNotes('');
  };

  const pill = 'rounded-full px-2 py-0.5 text-[10px] font-bold';

  return (
    <DashboardLayout role="lead_manager">
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black text-[#023D95]">
              <ClipboardList className="h-6 w-6" /> Assignment
              <PageHelpIcon href="/dashboard/lead_manager/assignment" label="Assignment" />
            </h1>
            <p className="text-sm text-slate-500">
              Leads ko workshop assign karo · {leads.length} lead{leads.length === 1 ? '' : 's'}
              {leads.length >= 100 ? ' (latest 100)' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void fetchLeads()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, phone, lead number, vehicle"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
              {filters.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setActiveFilter(f.value)}
                  className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    activeFilter === f.value
                      ? 'bg-[#023D95] text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-0.5">
              <span className="px-2 text-[11px] font-bold uppercase text-slate-400">Sort</span>
              {(
                [
                  { id: 'created', label: 'Latest' },
                  { id: 'priority', label: 'Priority' },
                  { id: 'sla', label: 'SLA' },
                ] as const
              ).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSortBy(o.id)}
                  className={`rounded-lg px-3 py-1 text-xs font-bold ${
                    sortBy === o.id ? 'bg-white text-[#023D95] shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loadError ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            {loadError}
          </p>
        ) : null}

        {loading && !leads.length ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading leads…
          </div>
        ) : leads.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-14 text-center">
            <p className="text-base font-black text-slate-800">No leads</p>
            <p className="text-sm text-slate-500">
              {searchTerm ? `"${searchTerm}" se koi lead nahi mili.` : 'Is filter mein koi lead nahi.'}
            </p>
          </div>
        ) : (
          <div
            className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-opacity ${
              loading ? 'opacity-60' : ''
            }`}
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Lead</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-4 py-3">Workshop</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map((lead) => {
                    const canAssign = lead.status === 'VALIDATED' || lead.status === 'ASSIGNED_TO_WORKSHOP';
                    return (
                      <tr
                        key={lead.id}
                        className={`align-top hover:bg-slate-50/70 ${
                          lead.sla_state === 'BREACHED' ? 'shadow-[inset_3px_0_0_#ef4444]' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">#{lead.lead_number}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span className={`${pill} ${getPriorityColor(lead.lead_priority || 'NORMAL')}`}>
                              {lead.lead_priority || 'NORMAL'}
                            </span>
                            {lead.is_incomplete ? (
                              <span className={`${pill} bg-orange-100 text-orange-700`}>Incomplete</span>
                            ) : null}
                            {lead.reopen_count > 0 ? (
                              <span className={`${pill} bg-red-100 text-red-700`}>Reopened ×{lead.reopen_count}</span>
                            ) : null}
                            {lead.sla_state ? (
                              <span className={`${pill} ${getSLAColor(lead.sla_state)}`}>
                                SLA {String(lead.sla_state).replace(/_/g, ' ').toLowerCase()}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="max-w-[180px] truncate font-semibold text-slate-900">{lead.customer_name || '—'}</p>
                          <p className="text-xs text-slate-500">{lead.customer_phone || '—'}</p>
                          <p className="text-[11px] text-slate-400">{lead.city || '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="max-w-[140px] truncate font-semibold text-slate-800">
                            {[lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(' ') || '—'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {lead.vehicle_number && lead.vehicle_number !== 'NA' ? lead.vehicle_number : '—'}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {lead.workshop ? (
                            <>
                              <p className="max-w-[180px] truncate font-semibold text-slate-800" title={lead.workshop.name}>
                                {lead.workshop.name}
                              </p>
                              <p className="text-xs text-slate-500">{lead.workshop.city || '—'}</p>
                            </>
                          ) : (
                            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-700">
                              Not assigned
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`${pill} ${getStatusColor(lead.status)}`}>
                            {String(lead.status || '').replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Link
                              href={`/dashboard/lead_manager/leads/${lead.id}`}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-[#023D95] hover:bg-blue-50"
                            >
                              View
                            </Link>
                            {canAssign ? (
                              <button
                                type="button"
                                onClick={() => handleAssignClick(lead)}
                                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                              >
                                {lead.workshop_id ? 'Reassign' : 'Assign'}
                              </button>
                            ) : null}
                            {lead.is_incomplete ? (
                              <Link
                                href={`/dashboard/lead_manager/leads/${lead.id}?mode=edit`}
                                className="rounded-lg border border-orange-200 px-2.5 py-1 text-xs font-bold text-orange-700 hover:bg-orange-50"
                              >
                                Complete
                              </Link>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showAssignModal && selectedLead ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-start justify-between gap-2">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-black text-[#023D95]">
                    <Building className="h-5 w-5" /> Assign workshop
                  </h3>
                  <p className="text-xs text-slate-500">
                    #{selectedLead.lead_number} · {selectedLead.customer_name || '—'} · {selectedLead.city || '—'}
                  </p>
                </div>
                <button type="button" onClick={closeModal} className="rounded-full p-1 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-3 grid gap-3 sm:grid-cols-[160px_1fr]">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-600">Priority</span>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-600">Search workshops</span>
                  <span className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={workshopSearch}
                      onChange={(e) => {
                        setWorkshopSearch(e.target.value);
                        if (selectedLead) fetchWorkshops(selectedLead);
                      }}
                      placeholder="Name or city"
                      className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm"
                    />
                  </span>
                </label>
              </div>

              <div className="mb-3 max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                {filteredWorkshops.length === 0 ? (
                  <p className="p-4 text-center text-sm text-slate-500">No workshops found</p>
                ) : (
                  filteredWorkshops.map((workshop) => {
                    const active = selectedWorkshop === workshop.id;
                    return (
                      <button
                        key={workshop.id}
                        type="button"
                        onClick={() => setSelectedWorkshop(workshop.id)}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition ${
                          active ? 'bg-blue-50 shadow-[inset_3px_0_0_#023D95]' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">{workshop.name}</p>
                          <p className="truncate text-xs text-slate-500">
                            {[workshop.city, workshop.state].filter(Boolean).join(', ') || '—'}
                            {workshop.contact_person || workshop.phone
                              ? ` · ${[workshop.contact_person, workshop.phone].filter(Boolean).join(' · ')}`
                              : ''}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span
                            className={`${pill} ${
                              workshop.capacity_status === 'AVAILABLE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : workshop.capacity_status === 'BUSY'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {workshop.capacity_status || '—'} · {workshop.active_leads_count ?? 0} active
                          </span>
                          {workshop.rating ? <p className="mt-0.5 text-[11px] text-slate-500">★ {workshop.rating}</p> : null}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <label className="mb-4 block">
                <span className="mb-1 block text-xs font-bold text-slate-600">Notes (optional)</span>
                <textarea
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm"
                  placeholder="Workshop ke liye koi instruction…"
                />
              </label>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={assigning}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssignWorkshop}
                  disabled={assigning || !selectedWorkshop}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#023D95] px-4 py-2 text-sm font-bold text-white hover:bg-[#012f73] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {assigning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Assigning…
                    </>
                  ) : (
                    <>
                      Assign workshop <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

export default function LeadManagerLeadsPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout role="lead_manager">
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading leads…
          </div>
        </DashboardLayout>
      }
    >
      <LeadManagerLeadsContent />
    </Suspense>
  );
}
