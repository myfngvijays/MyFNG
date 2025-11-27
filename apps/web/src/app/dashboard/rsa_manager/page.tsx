'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import DashboardLayout from '@/components/DashboardLayout';
import { RSAManagerService } from '@/lib/services/rsaManagerService';
import { 
  AlertCircle, Clock, CheckCircle, XCircle, Users, 
  Search, Filter, Eye, ChevronRight, Wrench, MapPin 
} from 'lucide-react';
import Link from 'next/link';

export default function RSAManagerDashboard() {
  const supabase = createClientComponentClient();
  
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
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-orange-500 text-white p-6 rounded-lg shadow-lg -mx-6 -mt-6 mb-8">
          <h1 className="text-3xl font-bold text-white drop-shadow-lg">🚨 RSA Manager Dashboard</h1>
          <p className="text-white/90 font-medium mt-1">Roadside Assistance Lead Management & Mechanic Assignment</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Link href="/dashboard/rsa_manager/leads?status=all">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Leads</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_leads}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-blue-500" />
              </div>
            </div>
          </Link>

          <Link href="/dashboard/rsa_manager/leads?status=pending">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending_leads}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500" />
              </div>
            </div>
          </Link>

          <Link href="/dashboard/rsa_manager/leads?status=assigned">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Assigned to Me</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.assigned_to_me}</p>
                </div>
                <Users className="w-8 h-8 text-purple-500" />
              </div>
            </div>
          </Link>

          <Link href="/dashboard/rsa_manager/leads?status=unassigned">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Unassigned</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.unassigned_leads}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-orange-500" />
              </div>
            </div>
          </Link>

          <Link href="/dashboard/rsa_manager/leads?status=completed">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Completed</p>
                  <p className="text-2xl font-bold text-green-600">{stats.completed_leads}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </div>
          </Link>

          <Link href="/dashboard/rsa_manager/leads?status=cancelled">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Cancelled</p>
                  <p className="text-2xl font-bold text-red-600">{stats.cancelled_leads}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
            </div>
          </Link>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by customer name, phone, or vehicle number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {(['all', 'assigned', 'unassigned', 'pending', 'completed'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
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
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">RSA Leads</h2>
            
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading leads...</p>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No leads found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredLeads.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/dashboard/rsa_manager/leads/${lead.id}`}
                    className="block border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {lead.customer_name}
                          </h3>
                          {getStatusBadge(lead.lead_status || lead.complaint_status)}
                          {getPriorityBadge(lead.priority)}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span className="font-medium">Phone:</span>
                            <span>{lead.contact_number}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span className="font-medium">Vehicle:</span>
                            <span>{lead.vehicle_number} {lead.vehicle_model ? `(${lead.vehicle_model})` : ''}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span className="font-medium">Service:</span>
                            <span>{lead.service_type || 'N/A'}</span>
                          </div>
                        </div>

                        {lead.assigned_manager_name && (
                          <div className="mt-2 text-sm text-gray-600">
                            <span className="font-medium">Manager:</span> {lead.assigned_manager_name}
                          </div>
                        )}

                        {lead.assigned_mechanic_name && (
                          <div className="mt-2 text-sm text-gray-600">
                            <span className="font-medium">Mechanic:</span> {lead.assigned_mechanic_name}
                          </div>
                        )}

                        {lead.address && (
                          <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                            <MapPin className="w-4 h-4" />
                            <span>{lead.address} {lead.pincode ? `- ${lead.pincode}` : ''}</span>
                          </div>
                        )}

                        <div className="mt-3 text-xs text-gray-500">
                          Registered: {new Date(lead.lead_registered_at || lead.requested_at).toLocaleString()}
                        </div>
                      </div>
                      
                      <ChevronRight className="w-6 h-6 text-gray-400 ml-4" />
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

