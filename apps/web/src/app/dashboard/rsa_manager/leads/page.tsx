'use client';

import { useState, useEffect, Suspense } from 'react';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import { useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { RSAManagerService } from '@/lib/services/rsaManagerService';
import { formatDateTime } from '@/lib/utils';
import {
  AlertCircle, Clock, CheckCircle, XCircle, Users,
  Search, Filter, Eye, ChevronRight, Wrench, MapPin 
} from 'lucide-react';
import Link from 'next/link';

function RSALeadsListContent() {
  const supabase = getBrowserClient();
  const searchParams = useSearchParams();
  
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_leads: 0,
    pending_leads: 0,
    completed_leads: 0,
    cancelled_leads: 0,
    assigned_to_me: 0,
    unassigned_leads: 0
  });
  
  const [filter, setFilter] = useState<'all' | 'assigned' | 'unassigned' | 'pending' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam) {
      setFilter(statusParam as any);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, filter]);

  const fetchUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id, full_name, email')
        .eq('id', authUser.id)
        .single();
      setUser(userProfile);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const managerId = user?.id;
      const status = filter === 'all' ? '' : filter === 'assigned' ? 'assigned' : filter;
      const showAll = filter === 'all' || filter === 'unassigned';
      
      const [leadsData, statsData] = await Promise.all([
        RSAManagerService.getAllLeads(managerId, status, showAll),
        managerId ? RSAManagerService.getManagerStatistics(managerId) : Promise.resolve(stats)
      ]);
      
      setLeads(leadsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimLead = async (e: React.MouseEvent, leadId: string) => {
    e.preventDefault(); // Prevent navigation
    if (!user) return;
    
    try {
      const result = await RSAManagerService.claimLead(
        leadId,
        user.id,
        user.full_name || user.email
      );
      
      if (result.success) {
        alert('Lead claimed successfully!');
        fetchData();
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Error claiming lead:', error);
      alert('Failed to claim lead');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      'pending': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
      'assigned': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Assigned' },
      'assigned_to_manager': { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Assigned to Manager' },
      'assigned_to_mechanic': { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Assigned to Mechanic' },
      'in_progress': { bg: 'bg-orange-100', text: 'text-orange-800', label: 'In Progress' },
      'completed': { bg: 'bg-green-100', text: 'text-green-800', label: 'Completed' },
      'cancelled': { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled' },
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
      'low': { bg: 'bg-gray-100', text: 'text-gray-600' },
      'medium': { bg: 'bg-blue-100', text: 'text-blue-600' },
      'high': { bg: 'bg-orange-100', text: 'text-orange-600' },
      'urgent': { bg: 'bg-red-100', text: 'text-red-600' },
    };
    
    const badge = badges[priority?.toLowerCase()] || badges['medium'];
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded ${badge.bg} ${badge.text}`}>
        {priority?.toUpperCase() || 'MEDIUM'}
      </span>
    );
  };

  const filteredLeads = leads.filter(lead =>
    lead.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.contact_number?.includes(searchTerm) ||
    lead.vehicle_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout role="rsa_manager">
      <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-orange-500 text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6 mb-6 sm:mb-7 md:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white drop-shadow-lg">📋 RSA Leads</h1>
          <p className="text-white/90 font-medium text-xs sm:text-sm md:text-base mt-0.5 sm:mt-1">Manage all RSA leads and assignments</p>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-5 md:mb-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <div className="relative">
                <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                <input
                  type="text"
                  placeholder="Search by customer name, phone, or vehicle number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['all', 'assigned', 'unassigned', 'pending', 'completed'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm ${
                    filter === f
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Leads List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 sm:p-5 md:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">RSA Leads ({filteredLeads.length})</h2>
            
            {loading ? (
              <div className="text-center py-8 sm:py-10 md:py-12">
                <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-red-600 mx-auto"></div>
                <p className="mt-3 sm:mt-4 text-gray-600 text-sm sm:text-base">Loading leads...</p>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-8 sm:py-10 md:py-12">
                <AlertCircle className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
                <p className="text-gray-600 text-sm sm:text-base">No leads found</p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {filteredLeads.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/dashboard/rsa_manager/leads/${lead.id}`}
                    className="block border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                            {lead.customer_name}
                          </h3>
                          {getStatusBadge(lead.lead_status || lead.complaint_status)}
                          {getPriorityBadge(lead.priority)}
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4 mt-2 sm:mt-3">
                          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                            <span className="font-medium">Phone:</span>
                            <span className="truncate">{lead.contact_number}</span>
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                            <span className="font-medium">Vehicle:</span>
                            <span className="truncate">{lead.vehicle_number} {lead.vehicle_model ? `(${lead.vehicle_model})` : ''}</span>
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600 sm:col-span-2 lg:col-span-1">
                            <span className="font-medium">Service:</span>
                            <span className="truncate">{lead.service_type || 'N/A'}</span>
                          </div>
                        </div>

                        {lead.assigned_manager_name && (
                          <div className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-gray-600">
                            <span className="font-medium">Manager:</span> <span className="truncate">{lead.assigned_manager_name}</span>
                          </div>
                        )}

                        {lead.assigned_mechanic_name && (
                          <div className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-gray-600">
                            <span className="font-medium">Mechanic:</span> <span className="truncate">{lead.assigned_mechanic_name}</span>
                          </div>
                        )}

                        {lead.address && (
                          <div className="mt-1.5 sm:mt-2 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                            <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                            <span className="truncate">{lead.address} {lead.pincode ? `- ${lead.pincode}` : ''}</span>
                          </div>
                        )}

                        <div className="mt-2 sm:mt-3 text-[10px] sm:text-xs text-gray-500">
                          Registered: {formatDateTime(lead.lead_registered_at || lead.requested_at)}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                        {!lead.assigned_manager_id && (
                          <button
                            onClick={(e) => handleClaimLead(e, lead.id)}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-purple-600 text-white text-xs sm:text-sm rounded-lg hover:bg-purple-700 transition-colors z-10 relative"
                          >
                            Claim
                          </button>
                        )}
                        <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function RSALeadsListPage() {
  return (
    <Suspense fallback={
      <DashboardLayout role="rsa_manager">
        <div className="p-3 sm:p-4 md:p-5 lg:p-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[300px] sm:min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-brand-primary mx-auto mb-3 sm:mb-4"></div>
              <p className="text-gray-600 text-xs sm:text-sm md:text-base">Loading...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    }>
      <RSALeadsListContent />
    </Suspense>
  );
}

