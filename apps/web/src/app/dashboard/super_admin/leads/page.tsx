'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { FileText, Search, Filter, Download, MapPin, Phone, Calendar, TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LeadsOverviewPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [stats, setStats] = useState({
    total: 0,
    normal: 0,
    rsa: 0,
    homeService: 0,
    active: 0,
    completed: 0
  });

  useEffect(() => {
    fetchLeads();
  }, []);

  async function fetchLeads() {
    const supabase = createClient();

    try {
      // Fetch all leads with related data
      const { data: leadsData } = await supabase
        .from('service_leads')
        .select(`
          *,
          workshop_id(name, city),
          assigned_to_id(full_name),
          created_by_id(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      // Get stats
      const { count: total } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true });

      const { count: normal } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('lead_type', 'NORMAL');

      const { count: rsa } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('lead_type', 'RSA');

      const { count: homeService } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('lead_type', 'HOME_SERVICE');

      const { count: active } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .in('status', ['NEW', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS']);

      const { count: completed } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'COMPLETED');

      setLeads(leadsData || []);
      setStats({
        total: total || 0,
        normal: normal || 0,
        rsa: rsa || 0,
        homeService: homeService || 0,
        active: active || 0,
        completed: completed || 0
      });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching leads:', error);
      setLoading(false);
    }
  }

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.lead_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.vehicle_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.customer_phone?.includes(searchTerm);
    
    const matchesType = filterType === 'all' || lead.lead_type === filterType;
    const matchesStatus = filterStatus === 'all' || lead.status === filterStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'NEW': 'bg-blue-100 text-blue-700',
      'ASSIGNED': 'bg-purple-100 text-purple-700',
      'ACCEPTED': 'bg-green-100 text-green-700',
      'REJECTED': 'bg-red-100 text-red-700',
      'IN_PROGRESS': 'bg-yellow-100 text-yellow-700',
      'COMPLETED': 'bg-green-100 text-green-700',
      'CANCELLED': 'bg-gray-100 text-gray-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'NORMAL': 'bg-blue-100 text-blue-700',
      'RSA': 'bg-orange-100 text-orange-700',
      'HOME_SERVICE': 'bg-purple-100 text-purple-700'
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <DashboardLayout role="super_admin">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-3 sm:mt-4 text-gray-600 text-xs sm:text-sm md:text-base">Loading leads...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-text-heading">Leads Overview</h1>
          <p className="text-text-body text-xs sm:text-sm md:text-base mt-1 sm:mt-2">Monitor all service leads across the platform</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <div className="card p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-600">Total Leads</p>
            <p className="text-xl sm:text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="card p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-600">Normal</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-600">{stats.normal}</p>
          </div>
          <div className="card p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-600">RSA</p>
            <p className="text-xl sm:text-2xl font-bold text-orange-600">{stats.rsa}</p>
          </div>
          <div className="card p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-600">Home Service</p>
            <p className="text-xl sm:text-2xl font-bold text-purple-600">{stats.homeService}</p>
          </div>
          <div className="card p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-600">Active</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.active}</p>
          </div>
          <div className="card p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-600">Completed</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-600">{stats.completed}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-3 sm:p-4 md:p-5">
          <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
              <input
                type="text"
                placeholder="Search by lead number, customer, vehicle..."
                className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="NORMAL">Normal</option>
                <option value="RSA">RSA</option>
                <option value="HOME_SERVICE">Home Service</option>
              </select>
              <select
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="NEW">New</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <button className="btn btn-outline px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2">
                <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Export</span>
                <span className="sm:hidden">Export</span>
              </button>
            </div>
          </div>
        </div>

        {/* Leads List */}
        <div className="space-y-3 sm:space-y-4">
          {filteredLeads.map((lead) => (
            <div key={lead.id} className="card hover:shadow-lg transition p-4 sm:p-5">
              <div className="flex flex-col lg:flex-row gap-3 sm:gap-4">
                {/* Lead Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-2 sm:mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{lead.lead_number}</h3>
                      <p className="text-xs sm:text-sm text-gray-600 truncate">{lead.service_type}</p>
                    </div>
                    <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
                      <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold ${getTypeColor(lead.lead_type)}`}>
                        {lead.lead_type.replace('_', ' ')}
                      </span>
                      <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold ${getStatusColor(lead.status)}`}>
                        {lead.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                    <div className="space-y-1">
                      <p className="text-gray-600">
                        <span className="font-semibold">Customer:</span> {lead.customer_name}
                      </p>
                      <p className="text-gray-600 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                        <span className="truncate">{lead.customer_phone}</span>
                      </p>
                      {lead.customer_email && (
                        <p className="text-gray-600 truncate">{lead.customer_email}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-gray-600">
                        <span className="font-semibold">Vehicle:</span> {lead.vehicle_number}
                      </p>
                      {(lead.vehicle_make || lead.vehicle_model) && (
                        <p className="text-gray-600">
                          {lead.vehicle_make} {lead.vehicle_model}
                        </p>
                      )}
                      {lead.vehicle_year && (
                        <p className="text-gray-600">Year: {lead.vehicle_year}</p>
                      )}
                    </div>
                  </div>

                  {(lead.city || lead.address) && (
                    <div className="mt-2 flex items-start gap-1 text-xs sm:text-sm text-gray-600">
                      <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 mt-0.5 flex-shrink-0" />
                      <span className="truncate">{lead.address}, {lead.city}, {lead.state}</span>
                    </div>
                  )}
                </div>

                {/* Workshop & Assignment Info */}
                <div className="lg:w-64 border-t lg:border-t-0 lg:border-l pt-3 sm:pt-4 lg:pt-0 lg:pl-3 sm:lg:pl-4">
                  <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
                    {lead.workshop_id && (
                      <div>
                        <p className="text-gray-500 text-[10px] sm:text-xs">Workshop</p>
                        <p className="font-semibold truncate">{lead.workshop_id.name}</p>
                        <p className="text-gray-600 truncate">{lead.workshop_id.city}</p>
                      </div>
                    )}
                    {lead.assigned_to_id && (
                      <div>
                        <p className="text-gray-500 text-[10px] sm:text-xs">Assigned To</p>
                        <p className="font-semibold truncate">{lead.assigned_to_id.full_name}</p>
                      </div>
                    )}
                    {lead.estimated_amount && (
                      <div>
                        <p className="text-gray-500 text-[10px] sm:text-xs">Estimated Amount</p>
                        <p className="font-semibold text-green-600">₹{lead.estimated_amount.toLocaleString()}</p>
                      </div>
                    )}
                    {lead.actual_amount && (
                      <div>
                        <p className="text-gray-500 text-[10px] sm:text-xs">Actual Amount</p>
                        <p className="font-semibold text-green-600">₹{lead.actual_amount.toLocaleString()}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-gray-500 text-[10px] sm:text-xs">Created</p>
                      <p className="text-gray-600">{new Date(lead.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredLeads.length === 0 && (
          <div className="card text-center py-8 sm:py-10 md:py-12">
            <FileText className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
            <p className="text-gray-500 text-sm sm:text-base">No leads found</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

