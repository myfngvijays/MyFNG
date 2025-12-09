'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, Suspense } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search, Loader2, ArrowRight, Building, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

function LeadManagerLeadsContent() {
  const supabase = createClientComponentClient();
  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter') || 'all';

  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState(filterParam);
  const [sortBy, setSortBy] = useState<'priority' | 'sla' | 'created'>('priority');
  
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading leads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-5 md:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Lead Management</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">{leads.length} leads found</p>
        </div>
        <Link href="/dashboard/lead_manager">
          <button className="bg-gray-200 hover:bg-gray-300 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap w-full sm:w-auto">
            ← Back to Dashboard
          </button>
        </Link>
      </div>

      {/* Search Bar */}
      <div className="mb-4 sm:mb-5 md:mb-6">
        <input
          type="text"
          placeholder="Search by name, phone, lead number, or vehicle..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Filter Tabs */}
      <div className="mb-4 sm:mb-5 md:mb-6 flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {filters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setActiveFilter(filter.value)}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap transition flex-shrink-0 ${
              activeFilter === filter.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Sort Options */}
      <div className="mb-4 sm:mb-5 md:mb-6 flex flex-wrap items-center gap-2 sm:gap-3 md:gap-4">
        <span className="text-xs sm:text-sm text-gray-700 font-medium">Sort by:</span>
        <button
          onClick={() => setSortBy('priority')}
          className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-lg ${sortBy === 'priority' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}
        >
          Priority
        </button>
        <button
          onClick={() => setSortBy('sla')}
          className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-lg ${sortBy === 'sla' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}
        >
          SLA
        </button>
        <button
          onClick={() => setSortBy('created')}
          className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-lg ${sortBy === 'created' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}
        >
          Latest
        </button>
      </div>

      {/* Leads Table - Desktop */}
      {leads.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 sm:p-10 md:p-12 text-center">
          <div className="text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4">📋</div>
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1 sm:mb-2">No Leads Found</h3>
          <p className="text-sm sm:text-base text-gray-600">
            {searchTerm ? `No leads match "${searchTerm}"` : `No leads in ${activeFilter} filter`}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden hidden lg:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead Details</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Workshop</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {leads.map((lead) => (
                    <tr 
                      key={lead.id}
                      className={`hover:bg-gray-50 ${lead.sla_state === 'BREACHED' ? 'border-l-4 border-red-500' : ''}`}
                    >
                      {/* Lead Details */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="flex flex-col">
                          <span className="text-xs sm:text-sm font-medium text-gray-900">#{lead.lead_number}</span>
                          <div className="flex flex-wrap gap-1 sm:gap-2 mt-1">
                            <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-medium ${getPriorityColor(lead.lead_priority || 'NORMAL')}`}>
                              {lead.lead_priority || 'NORMAL'}
                            </span>
                            {lead.is_incomplete && (
                              <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-medium text-orange-600 bg-orange-100">
                                INCOMPLETE
                              </span>
                            )}
                            {lead.reopen_count > 0 && (
                              <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-medium text-red-600 bg-red-100">
                                Reopened ({lead.reopen_count})
                              </span>
                            )}
                          </div>
                          {lead.sla_state && (
                            <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-medium mt-1 inline-block ${getSLAColor(lead.sla_state)}`}>
                              SLA: {lead.sla_state}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div>
                          <div className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[150px]">{lead.customer_name}</div>
                          <div className="text-xs sm:text-sm text-gray-500 truncate">{lead.customer_phone}</div>
                          <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1 truncate">{lead.city || 'N/A'}</div>
                        </div>
                      </td>

                      {/* Vehicle */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div>
                          <div className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[120px]">{lead.vehicle_model || 'N/A'}</div>
                          <div className="text-[10px] sm:text-xs text-gray-500 truncate">{lead.vehicle_number || 'Not provided'}</div>
                        </div>
                      </td>

                      {/* Workshop */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        {lead.workshop ? (
                          <div>
                            <div className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[150px]">{lead.workshop.name}</div>
                            <div className="text-[10px] sm:text-xs text-gray-500 truncate">{lead.workshop.city}</div>
                          </div>
                        ) : (
                          <span className="text-xs sm:text-sm text-orange-600 font-medium">Not Assigned</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <span className={`text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1 rounded-full font-medium ${getStatusColor(lead.status)}`}>
                          {lead.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                          <Link href={`/dashboard/lead_manager/leads/${lead.id}`}>
                            <button className="text-blue-600 hover:text-blue-800 font-medium text-xs sm:text-sm whitespace-nowrap">
                              View
                            </button>
                          </Link>
                          {(lead.status === 'VALIDATED' || lead.status === 'ASSIGNED_TO_WORKSHOP') && (
                            <button 
                              onClick={() => handleAssignClick(lead)}
                              className="text-green-600 hover:text-green-800 font-medium text-xs sm:text-sm whitespace-nowrap"
                            >
                              {lead.workshop_id ? 'Reassign' : 'Assign'}
                            </button>
                          )}
                          {lead.is_incomplete && (
                            <Link href={`/dashboard/lead_manager/leads/${lead.id}?mode=edit`}>
                              <button className="text-orange-600 hover:text-orange-800 font-medium text-xs sm:text-sm whitespace-nowrap">
                                Complete
                              </button>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile/Tablet Cards */}
          <div className="lg:hidden space-y-3 sm:space-y-4">
            {leads.map((lead) => (
              <div 
                key={lead.id}
                className={`bg-white rounded-lg shadow p-3 sm:p-4 border ${lead.sla_state === 'BREACHED' ? 'border-l-4 border-red-500' : 'border-gray-100'}`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm sm:text-base font-medium text-gray-900">#{lead.lead_number}</span>
                      <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-medium ${getPriorityColor(lead.lead_priority || 'NORMAL')}`}>
                        {lead.lead_priority || 'NORMAL'}
                      </span>
                      {lead.is_incomplete && (
                        <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-medium text-orange-600 bg-orange-100">
                          INCOMPLETE
                        </span>
                      )}
                    </div>
                    {lead.sla_state && (
                      <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-medium inline-block ${getSLAColor(lead.sla_state)}`}>
                        SLA: {lead.sla_state}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1 rounded-full font-medium flex-shrink-0 ${getStatusColor(lead.status)}`}>
                    {lead.status}
                  </span>
                </div>

                <div className="space-y-2 mb-3 pb-3 border-b border-gray-100">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-gray-500">Customer:</span>
                    <div className="text-right min-w-0 flex-1 ml-2">
                      <div className="text-gray-900 font-medium truncate">{lead.customer_name}</div>
                      <div className="text-gray-500 text-xs truncate">{lead.customer_phone}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-gray-500">Vehicle:</span>
                    <div className="text-right min-w-0 flex-1 ml-2">
                      <div className="text-gray-900 font-medium truncate">{lead.vehicle_model || 'N/A'}</div>
                      <div className="text-gray-500 text-[10px] sm:text-xs truncate">{lead.vehicle_number || 'Not provided'}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-gray-500">Workshop:</span>
                    <span className="text-gray-900 font-medium text-right truncate max-w-[60%]">
                      {lead.workshop ? `${lead.workshop.name}, ${lead.workshop.city}` : <span className="text-orange-600">Not Assigned</span>}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link href={`/dashboard/lead_manager/leads/${lead.id}`} className="flex-1 min-w-[80px]">
                    <button className="w-full px-3 py-1.5 text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium border border-blue-200 rounded-lg hover:bg-blue-50">
                      View
                    </button>
                  </Link>
                  {(lead.status === 'VALIDATED' || lead.status === 'ASSIGNED_TO_WORKSHOP') && (
                    <button 
                      onClick={() => handleAssignClick(lead)}
                      className="flex-1 min-w-[80px] px-3 py-1.5 text-xs sm:text-sm text-green-600 hover:text-green-800 font-medium border border-green-200 rounded-lg hover:bg-green-50"
                    >
                      {lead.workshop_id ? 'Reassign' : 'Assign'}
                    </button>
                  )}
                  {lead.is_incomplete && (
                    <Link href={`/dashboard/lead_manager/leads/${lead.id}?mode=edit`} className="flex-1 min-w-[80px]">
                      <button className="w-full px-3 py-1.5 text-xs sm:text-sm text-orange-600 hover:text-orange-800 font-medium border border-orange-200 rounded-lg hover:bg-orange-50">
                        Complete
                      </button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Assignment Modal */}
      {showAssignModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-4 sm:p-5 md:p-6 my-4 sm:my-6 md:my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                Assign Workshop - Lead #{selectedLead.lead_number}
              </h3>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedLead(null);
                  setSelectedWorkshop('');
                  setAssignmentNotes('');
                }}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
            
            {/* Priority Selection */}
            <div className="mb-3 sm:mb-4">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Priority Level</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            {/* Workshop Search */}
            <div className="mb-3 sm:mb-4">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Search Workshops</label>
              <div className="relative">
                <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                <input
                  type="text"
                  value={workshopSearch}
                  onChange={(e) => {
                    setWorkshopSearch(e.target.value);
                    if (selectedLead) {
                      fetchWorkshops(selectedLead);
                    }
                  }}
                  placeholder="Search by name or city..."
                  className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Workshop List */}
            <div className="mb-3 sm:mb-4 max-h-64 sm:max-h-72 md:max-h-80 overflow-y-auto border border-gray-200 rounded-lg">
              {filteredWorkshops.length === 0 ? (
                <p className="p-3 sm:p-4 text-center text-xs sm:text-sm text-gray-500">No workshops found</p>
              ) : (
                filteredWorkshops.map((workshop) => (
                  <div
                    key={workshop.id}
                    onClick={() => setSelectedWorkshop(workshop.id)}
                    className={`p-3 sm:p-4 cursor-pointer hover:bg-gray-50 transition border-b border-gray-100 ${
                      selectedWorkshop === workshop.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm sm:text-base text-gray-900 truncate">{workshop.name}</h4>
                        <p className="text-xs sm:text-sm text-gray-600 truncate">{workshop.city}, {workshop.state}</p>
                        <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 truncate">{workshop.contact_person} • {workshop.phone}</p>
                      </div>
                      <div className="text-left sm:text-right flex-shrink-0">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <span className="text-[10px] sm:text-xs font-medium">Rating: {workshop.rating || 'N/A'}</span>
                        </div>
                        <div className={`text-[10px] sm:text-xs mt-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded ${
                          workshop.capacity_status === 'AVAILABLE' ? 'bg-green-100 text-green-800' :
                          workshop.capacity_status === 'BUSY' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {workshop.capacity_status} ({workshop.active_leads_count} active)
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Assignment Notes */}
            <div className="mb-3 sm:mb-4">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Assignment Notes (Optional)</label>
              <textarea
                value={assignmentNotes}
                onChange={(e) => setAssignmentNotes(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg p-2 sm:p-3 text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Any special instructions or notes for the workshop..."
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedLead(null);
                  setSelectedWorkshop('');
                  setAssignmentNotes('');
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg font-medium"
                disabled={assigning}
              >
                Cancel
              </button>
              <button
                onClick={handleAssignWorkshop}
                disabled={assigning || !selectedWorkshop}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg font-medium flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assigning ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    <span>Assigning...</span>
                  </>
                ) : (
                  <>
                    <span>Assign Workshop</span>
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LeadManagerLeadsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading leads...</p>
        </div>
      </div>
    }>
      <LeadManagerLeadsContent />
    </Suspense>
  );
}

