'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import DashboardLayout from '@/components/DashboardLayout';
import { formatDateDMY } from '@/lib/utils';
import {
  CheckCircle, XCircle, Clock, AlertTriangle, TrendingUp,
  Users, Building, Search, Filter, Eye, ChevronRight 
} from 'lucide-react';
import Link from 'next/link';

export default function LeadManagerDashboard() {
  const supabase = createClientComponentClient();
  
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    total_pending: 0,
    new_leads: 0,
    incomplete_leads: 0,
    validated_leads: 0
  });
  
  const [filter, setFilter] = useState<'all' | 'new' | 'validated'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLeads();
  }, [filter]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/lead-manager/pending-leads?status=${filter}&limit=50`);
      const data = await response.json();
      
      if (data.success) {
        setLeads(data.leads);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      'NEW': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'New' },
      'INCOMPLETE': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Incomplete' },
      'VALIDATED': { bg: 'bg-green-100', text: 'text-green-800', label: 'Validated' },
    };
    
    const badge = badges[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const badges: Record<string, { bg: string; text: string }> = {
      'LOW': { bg: 'bg-gray-100', text: 'text-gray-600' },
      'MEDIUM': { bg: 'bg-blue-100', text: 'text-blue-600' },
      'HIGH': { bg: 'bg-orange-100', text: 'text-orange-600' },
      'URGENT': { bg: 'bg-red-100', text: 'text-red-600' },
      'CRITICAL': { bg: 'bg-red-600', text: 'text-white' },
    };
    
    const badge = badges[priority] || badges['MEDIUM'];
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded ${badge.bg} ${badge.text}`}>
        {priority}
      </span>
    );
  };

  const filteredLeads = leads.filter(lead =>
    lead.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.customer_phone?.includes(searchTerm) ||
    lead.vehicle_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.lead_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout role="lead_manager">
      <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6 mb-6 sm:mb-7 md:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-300 drop-shadow-lg">🎯 Lead Manager Control Panel</h1>
          <p className="text-white font-medium text-xs sm:text-sm md:text-base mt-0.5 sm:mt-1">Traffic Controller • Quality Gatekeeper • Assignment Brain</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-7 md:mb-8">
          <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Total Pending</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{summary.total_pending}</p>
              </div>
              <div className="bg-blue-100 p-2 sm:p-3 rounded-full flex-shrink-0">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">New Leads</p>
                <p className="text-2xl sm:text-3xl font-bold text-blue-600">{summary.new_leads}</p>
              </div>
              <div className="bg-blue-100 p-2 sm:p-3 rounded-full flex-shrink-0">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Incomplete</p>
                <p className="text-2xl sm:text-3xl font-bold text-yellow-600">{summary.incomplete_leads}</p>
              </div>
              <div className="bg-yellow-100 p-2 sm:p-3 rounded-full flex-shrink-0">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Validated</p>
                <p className="text-2xl sm:text-3xl font-bold text-green-600">{summary.validated_leads}</p>
              </div>
              <div className="bg-green-100 p-2 sm:p-3 rounded-full flex-shrink-0">
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6 mb-4 sm:mb-5 md:mb-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
              <input
                type="text"
                placeholder="Search by name, phone, vehicle number, lead number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-xs sm:text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition text-xs sm:text-sm ${
                  filter === 'all'
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All ({summary.total_pending})
              </button>
              <button
                onClick={() => setFilter('new')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition text-xs sm:text-sm ${
                  filter === 'new'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                New ({summary.new_leads})
              </button>
              <button
                onClick={() => setFilter('validated')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition text-xs sm:text-sm ${
                  filter === 'validated'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Validated ({summary.validated_leads})
              </button>
            </div>
          </div>
        </div>

        {/* Leads Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 sm:p-10 md:p-12 text-center">
              <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-brand-primary mx-auto"></div>
              <p className="mt-3 sm:mt-4 text-gray-600 text-sm sm:text-base">Loading leads...</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="p-8 sm:p-10 md:p-12 text-center">
              <Users className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <p className="text-lg sm:text-xl text-gray-600">No leads found</p>
              <p className="text-gray-500 text-sm sm:text-base mt-1 sm:mt-2">
                {searchTerm ? 'Try adjusting your search' : 'All leads are processed!'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table - Hidden on mobile */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead #</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-brand-primary">{lead.lead_number}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{lead.customer_name}</div>
                          <div className="text-sm text-gray-500">{lead.customer_phone}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{lead.vehicle_number}</div>
                          <div className="text-sm text-gray-500">
                            {lead.model?.make || lead.vehicle_make} {lead.model?.model_name || lead.vehicle_model}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{lead.city?.name || lead.city}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(lead.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getPriorityBadge(lead.priority)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDateDMY(lead.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <Link
                            href={`/dashboard/lead_manager/leads/${lead.id}`}
                            className="inline-flex items-center gap-1 text-brand-primary hover:text-brand-secondary font-medium"
                          >
                            Review
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards - Visible on mobile only */}
              <div className="lg:hidden divide-y divide-gray-200">
                {filteredLeads.map((lead) => (
                  <div key={lead.id} className="p-4 hover:bg-gray-50 transition">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-brand-primary mb-1">{lead.lead_number}</div>
                        <div className="text-base font-semibold text-gray-900 truncate">{lead.customer_name}</div>
                        <div className="text-sm text-gray-500">{lead.customer_phone}</div>
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        {getStatusBadge(lead.status)}
                        {getPriorityBadge(lead.priority)}
                      </div>
                    </div>
                    <div className="space-y-1 text-sm mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Vehicle:</span>
                        <span className="font-medium text-gray-900">{lead.vehicle_number}</span>
                      </div>
                      <div className="text-gray-600 text-xs">
                        {lead.model?.make || lead.vehicle_make} {lead.model?.model_name || lead.vehicle_model}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">City:</span>
                        <span className="text-gray-900">{lead.city?.name || lead.city}</span>
                      </div>
                      <div className="text-gray-500 text-xs">
                        Created: {formatDateDMY(lead.created_at)}
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/lead_manager/leads/${lead.id}`}
                      className="inline-flex items-center gap-1 text-brand-primary hover:text-brand-secondary font-medium text-sm"
                    >
                      Review Lead
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
