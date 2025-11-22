'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  Phone, Search, Filter, Clock, AlertCircle, CheckCircle, 
  XCircle, MessageSquare, Calendar, Eye, Edit, PhoneCall 
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

function TelecallerLeadsContent() {
  const searchParams = useSearchParams();
  const filterParam = searchParams?.get('filter') || 'all';

  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState(filterParam);
  const [showPhoneNumber, setShowPhoneNumber] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchLeads();
  }, [activeFilter]);

  async function fetchLeads() {
    const supabase = createClient();
    setLoading(true);

    try {
      // Get current telecaller
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      const teleCallerId = userProfile?.id;

      let query = supabase
        .from('service_leads')
        .select('*, workshop:workshops(name)');

      // Apply filters
      switch (activeFilter) {
        case 'new':
          query = query
            .or(`assigned_telecaller_id.is.null,assigned_telecaller_id.eq.${teleCallerId}`)
            .eq('status', 'NEW')
            .is('last_call_at', null);
          break;
        case 'callback':
          query = query
            .eq('assigned_telecaller_id', teleCallerId)
            .eq('follow_up_required', true)
            .lte('next_follow_up_at', new Date().toISOString());
          break;
        case 'incomplete':
          query = query
            .or(`assigned_telecaller_id.is.null,assigned_telecaller_id.eq.${teleCallerId}`)
            .eq('is_incomplete', true);
          break;
        case 'follow_up':
          query = query
            .eq('assigned_telecaller_id', teleCallerId)
            .eq('follow_up_required', true);
          break;
        case 'in_progress':
          query = query
            .eq('assigned_telecaller_id', teleCallerId)
            .in('status', ['NEW', 'ASSIGNED']);
          break;
        case 'completed':
          query = query
            .eq('created_by_id', teleCallerId)
            .in('status', ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED']);
          break;
        case 'rejected':
          query = query
            .eq('assigned_telecaller_id', teleCallerId)
            .eq('status', 'REJECTED');
          break;
        default:
          // All leads
          query = query.or(`assigned_telecaller_id.is.null,assigned_telecaller_id.eq.${teleCallerId},created_by_id.eq.${teleCallerId}`);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch service type names for all leads
      const leadsWithServiceNames = await Promise.all(
        (data || []).map(async (lead) => {
          let serviceTypeNames = [];
          
          if (lead.service_type_ids) {
            try {
              const serviceIds = typeof lead.service_type_ids === 'string' 
                ? JSON.parse(lead.service_type_ids) 
                : lead.service_type_ids;
              
              if (Array.isArray(serviceIds) && serviceIds.length > 0) {
                const { data: serviceTypesData } = await supabase
                  .from('service_types')
                  .select('id, name')
                  .in('id', serviceIds);
                
                if (serviceTypesData) {
                  serviceTypeNames = serviceTypesData.map(st => st.name);
                }
              }
            } catch (e) {
              console.error('Error parsing service_type_ids:', e);
            }
          }
          
          return {
            ...lead,
            service_type_names: serviceTypeNames.join(', ') || lead.service_type || 'Not specified'
          };
        })
      );

      setLeads(leadsWithServiceNames);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredLeads = leads.filter(lead => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      lead.customer_name?.toLowerCase().includes(search) ||
      lead.customer_phone?.includes(search) ||
      lead.lead_number?.toLowerCase().includes(search) ||
      lead.vehicle_number?.toLowerCase().includes(search) ||
      lead.city?.toLowerCase().includes(search)
    );
  });

  const togglePhoneVisibility = (leadId: string) => {
    setShowPhoneNumber(prev => ({
      ...prev,
      [leadId]: !prev[leadId]
    }));
  };

  const maskPhone = (phone: string) => {
    if (!phone) return 'N/A';
    if (phone.length <= 4) return phone;
    return phone.slice(0, 2) + '****' + phone.slice(-2);
  };

  if (loading) {
    return (
      <DashboardLayout role="telecaller">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading leads...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="telecaller">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-heading">Calling Queue</h1>
            <p className="text-text-body mt-2">Manage and call customer leads</p>
          </div>
          <Link href="/dashboard/telecaller/leads/create">
            <button className="btn btn-primary">
              <Phone className="w-5 h-5 mr-2" />
              Create Lead
            </button>
          </Link>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name, phone, lead number, vehicle..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2 overflow-x-auto">
              <FilterButton
                label="All"
                count={leads.length}
                active={activeFilter === 'all'}
                onClick={() => setActiveFilter('all')}
              />
              <FilterButton
                label="New"
                count={leads.filter(l => l.status === 'NEW' && !l.last_call_at).length}
                active={activeFilter === 'new'}
                onClick={() => setActiveFilter('new')}
                color="blue"
              />
              <FilterButton
                label="Callback"
                count={leads.filter(l => l.follow_up_required).length}
                active={activeFilter === 'callback'}
                onClick={() => setActiveFilter('callback')}
                color="orange"
              />
              <FilterButton
                label="Incomplete"
                count={leads.filter(l => l.is_incomplete).length}
                active={activeFilter === 'incomplete'}
                onClick={() => setActiveFilter('incomplete')}
                color="yellow"
              />
              <FilterButton
                label="Follow-up"
                count={leads.filter(l => l.follow_up_required).length}
                active={activeFilter === 'follow_up'}
                onClick={() => setActiveFilter('follow_up')}
                color="purple"
              />
              <FilterButton
                label="In Progress"
                count={leads.filter(l => ['NEW', 'ASSIGNED'].includes(l.status)).length}
                active={activeFilter === 'in_progress'}
                onClick={() => setActiveFilter('in_progress')}
                color="indigo"
              />
              <FilterButton
                label="Completed"
                count={leads.filter(l => ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(l.status)).length}
                active={activeFilter === 'completed'}
                onClick={() => setActiveFilter('completed')}
                color="green"
              />
              <FilterButton
                label="Rejected"
                count={leads.filter(l => l.status === 'REJECTED').length}
                active={activeFilter === 'rejected'}
                onClick={() => setActiveFilter('rejected')}
                color="red"
              />
            </div>
          </div>
        </div>

        {/* Leads List */}
        <div className="space-y-4">
          {filteredLeads.length === 0 ? (
            <div className="card text-center py-12">
              <Phone className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No leads found</p>
            </div>
          ) : (
            filteredLeads.map((lead) => (
              <div key={lead.id} className="card hover:shadow-lg transition">
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Lead Info */}
                  <div className="flex-1 space-y-3">
                    {/* Row 1: Name & Status */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-semibold">{lead.customer_name || 'Unknown'}</h3>
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded font-mono">
                            {lead.lead_number}
                          </span>
                          {lead.is_incomplete && (
                            <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Incomplete
                            </span>
                          )}
                          {lead.follow_up_required && (
                            <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Follow-up
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          Created {new Date(lead.created_at).toLocaleString()}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                        lead.status === 'NEW' ? 'bg-blue-100 text-blue-700' :
                        lead.status === 'ASSIGNED' ? 'bg-indigo-100 text-indigo-700' :
                        lead.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' :
                        lead.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {lead.status}
                      </span>
                    </div>

                    {/* Row 2: Contact Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">Phone:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {showPhoneNumber[lead.id] ? lead.customer_phone : maskPhone(lead.customer_phone)}
                          </span>
                          <button
                            onClick={() => togglePhoneVisibility(lead.id)}
                            className="text-brand-primary hover:underline text-xs"
                          >
                            {showPhoneNumber[lead.id] ? 'Hide' : 'Show'}
                          </button>
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Vehicle:</span>
                        <p className="font-semibold">
                          {lead.vehicle_make || 'N/A'} {lead.vehicle_model || ''} {lead.vehicle_number ? `(${lead.vehicle_number})` : ''}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">City:</span>
                        <p className="font-semibold">{lead.city || 'N/A'}</p>
                      </div>
                    </div>

                    {/* Row 3: Service Type & Workshop */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">Service Type:</span>
                        <p className="font-semibold">{lead.service_type_names}</p>
                      </div>
                      {lead.workshop && (
                        <div>
                          <span className="text-gray-500">Workshop:</span>
                          <p className="font-semibold">{lead.workshop.name}</p>
                        </div>
                      )}
                    </div>

                    {/* Row 4: Last Call & Follow-up Info */}
                    {(lead.last_call_at || lead.next_follow_up_at) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {lead.last_call_at && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <Clock className="w-4 h-4" />
                            <span>Last call: {new Date(lead.last_call_at).toLocaleString()}</span>
                          </div>
                        )}
                        {lead.next_follow_up_at && (
                          <div className="flex items-center gap-2 text-purple-600">
                            <Calendar className="w-4 h-4" />
                            <span>Next follow-up: {new Date(lead.next_follow_up_at).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes */}
                    {lead.notes && (
                      <div className="text-sm">
                        <span className="text-gray-500">Notes:</span>
                        <p className="text-gray-700 italic">{lead.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 md:w-48">
                    <a href={`tel:${lead.customer_phone}`} className="btn btn-primary w-full">
                      <PhoneCall className="w-4 h-4 mr-2" />
                      Call Now
                    </a>
                    <Link href={`/dashboard/telecaller/leads/${lead.id}`} className="btn btn-outline w-full">
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Link>
                    {lead.is_incomplete && (
                      <Link href={`/dashboard/telecaller/leads/${lead.id}/edit`} className="btn btn-outline w-full">
                        <Edit className="w-4 h-4 mr-2" />
                        Complete Info
                      </Link>
                    )}
                    <button className="btn btn-outline w-full text-sm">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      WhatsApp
                    </button>
                  </div>
                </div>

                {/* Call Stats Footer */}
                {lead.total_calls > 0 && (
                  <div className="mt-4 pt-4 border-t flex items-center gap-4 text-xs text-gray-500">
                    <span>Total Calls: {lead.total_calls}</span>
                    <span>Source: {lead.created_from || 'Unknown'}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function TelecallerLeadsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading leads...</p>
        </div>
      </div>
    }>
      <TelecallerLeadsContent />
    </Suspense>
  );
}

interface FilterButtonProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  color?: string;
}

function FilterButton({ label, count, active, onClick, color = 'gray' }: FilterButtonProps) {
  const colors = {
    gray: active ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    blue: active ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200',
    orange: active ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-700 hover:bg-orange-200',
    yellow: active ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200',
    purple: active ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700 hover:bg-purple-200',
    indigo: active ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200',
    green: active ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200',
    red: active ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200',
  };

  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-semibold text-sm transition whitespace-nowrap ${colors[color as keyof typeof colors]}`}
    >
      {label} ({count})
    </button>
  );
}

