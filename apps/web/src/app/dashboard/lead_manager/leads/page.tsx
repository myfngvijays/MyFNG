'use client';

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function LeadManagerLeadsPage() {
  const supabase = createClientComponentClient();
  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter') || 'all';

  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState(filterParam);
  const [sortBy, setSortBy] = useState<'priority' | 'sla' | 'created'>('priority');

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
          query = query.eq('status', 'NEW').is('assigned_workshop_id', null);
          break;
        case 'INCOMPLETE':
          query = query.eq('is_incomplete', true);
          break;
        case 'NEED_ASSIGNMENT':
          query = query.in('status', ['NEW', 'VALIDATED']).is('assigned_workshop_id', null).eq('is_incomplete', false);
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
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Lead Management</h1>
          <p className="text-gray-600 mt-1">{leads.length} leads found</p>
        </div>
        <Link href="/dashboard/lead_manager">
          <button className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg font-medium">
            ← Back to Dashboard
          </button>
        </Link>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name, phone, lead number, or vehicle..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {filters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setActiveFilter(filter.value)}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition ${
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
      <div className="mb-6 flex items-center gap-4">
        <span className="text-gray-700 font-medium">Sort by:</span>
        <button
          onClick={() => setSortBy('priority')}
          className={`px-3 py-1 rounded-lg ${sortBy === 'priority' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}
        >
          Priority
        </button>
        <button
          onClick={() => setSortBy('sla')}
          className={`px-3 py-1 rounded-lg ${sortBy === 'sla' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}
        >
          SLA
        </button>
        <button
          onClick={() => setSortBy('created')}
          className={`px-3 py-1 rounded-lg ${sortBy === 'created' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}
        >
          Latest
        </button>
      </div>

      {/* Leads Table */}
      {leads.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Leads Found</h3>
          <p className="text-gray-600">
            {searchTerm ? `No leads match "${searchTerm}"` : `No leads in ${activeFilter} filter`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead Details</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Workshop</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leads.map((lead) => (
                <tr 
                  key={lead.id}
                  className={`hover:bg-gray-50 ${lead.sla_state === 'BREACHED' ? 'border-l-4 border-red-500' : ''}`}
                >
                  {/* Lead Details */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">#{lead.lead_number}</span>
                      <div className="flex gap-2 mt-1">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPriorityColor(lead.lead_priority || 'NORMAL')}`}>
                          {lead.lead_priority || 'NORMAL'}
                        </span>
                        {lead.is_incomplete && (
                          <span className="text-xs px-2 py-1 rounded-full font-medium text-orange-600 bg-orange-100">
                            INCOMPLETE
                          </span>
                        )}
                        {lead.reopen_count > 0 && (
                          <span className="text-xs px-2 py-1 rounded-full font-medium text-red-600 bg-red-100">
                            Reopened ({lead.reopen_count})
                          </span>
                        )}
                      </div>
                      {lead.sla_state && (
                        <span className={`text-xs px-2 py-1 rounded-full font-medium mt-1 inline-block ${getSLAColor(lead.sla_state)}`}>
                          SLA: {lead.sla_state}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Customer */}
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{lead.customer_name}</div>
                      <div className="text-sm text-gray-500">{lead.customer_phone}</div>
                      <div className="text-xs text-gray-400 mt-1">{lead.city || 'N/A'}</div>
                    </div>
                  </td>

                  {/* Vehicle */}
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{lead.vehicle_model || 'N/A'}</div>
                      <div className="text-xs text-gray-500">{lead.vehicle_number || 'Not provided'}</div>
                    </div>
                  </td>

                  {/* Workshop */}
                  <td className="px-6 py-4">
                    {lead.workshop ? (
                      <div>
                        <div className="text-sm font-medium text-gray-900">{lead.workshop.name}</div>
                        <div className="text-xs text-gray-500">{lead.workshop.city}</div>
                      </div>
                    ) : (
                      <span className="text-sm text-orange-600 font-medium">Not Assigned</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4">
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${getStatusColor(lead.status)}`}>
                      {lead.status}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <Link href={`/dashboard/lead_manager/leads/${lead.id}`}>
                        <button className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                          View
                        </button>
                      </Link>
                      {!lead.assigned_workshop_id && (
                        <button className="text-green-600 hover:text-green-800 font-medium text-sm">
                          Assign
                        </button>
                      )}
                      {lead.is_incomplete && (
                        <Link href={`/dashboard/lead_manager/leads/${lead.id}?mode=edit`}>
                          <button className="text-orange-600 hover:text-orange-800 font-medium text-sm">
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
      )}
    </div>
  );
}

