'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Phone, CheckCircle, Clock, Star, AlertCircle, UserCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

interface CSELead {
  id: string;
  lead_number: string;
  customer_name: string;
  customer_phone: string;
  vehicle_number: string;
  status: string;
  follow_up_required: boolean;
  next_follow_up_at: string | null;
  customer_satisfaction_score: number | null;
  total_calls: number;
  last_call_at: string | null;
  invoice_sent_at: string | null;
}

export default function CSEDashboard() {
  const router = useRouter();
  const [leads, setLeads] = useState<CSELead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'follow_up' | 'invoiced' | 'all'>('follow_up');
  
  const [stats, setStats] = useState({
    pendingFollowUps: 0,
    todayFollowUps: 0,
    completedToday: 0,
    avgSatisfaction: 0
  });

  useEffect(() => {
    fetchCSEData();
  }, [filter]);

  async function fetchCSEData() {
    const supabase = createClient();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Build query based on filter
      let query = supabase
        .from('service_leads')
        .select('*')
        .in('status', ['INVOICE_SENT', 'PAYMENT_RECEIVED', 'CLOSED'])
        .order('next_follow_up_at', { ascending: true, nullsFirst: false });

      if (filter === 'follow_up') {
        query = query.eq('follow_up_required', true).neq('status', 'CLOSED');
      } else if (filter === 'invoiced') {
        query = query.eq('status', 'INVOICE_SENT');
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching CSE data:', error);
        toast.error('Failed to fetch leads');
        return;
      }

      setLeads(data || []);

      // Calculate stats
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      const pendingFollowUps = data?.filter(l => l.follow_up_required && l.status !== 'CLOSED').length || 0;
      
      const todayFollowUps = data?.filter(l => {
        if (!l.next_follow_up_at) return false;
        const followUpDate = new Date(l.next_follow_up_at);
        return followUpDate >= todayStart && followUpDate < todayEnd;
      }).length || 0;

      const completedToday = data?.filter(l => {
        if (!l.last_call_at) return false;
        const callDate = new Date(l.last_call_at);
        return callDate >= todayStart && callDate < todayEnd;
      }).length || 0;

      const satisfactionScores = data?.filter(l => l.customer_satisfaction_score !== null).map(l => l.customer_satisfaction_score || 0) || [];
      const avgSatisfaction = satisfactionScores.length > 0 
        ? satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length 
        : 0;

      setStats({
        pendingFollowUps,
        todayFollowUps,
        completedToday,
        avgSatisfaction
      });

    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load CSE data');
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      'INVOICE_SENT': 'badge-blue',
      'PAYMENT_RECEIVED': 'badge-green',
      'CLOSED': 'badge-gray'
    };
    return badges[status] || 'badge-gray';
  };

  const getFollowUpPriority = (lead: CSELead) => {
    if (!lead.next_follow_up_at) return 'low';
    const followUpDate = new Date(lead.next_follow_up_at);
    const now = new Date();
    const diffHours = (followUpDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (diffHours < 0) return 'overdue';
    if (diffHours < 4) return 'urgent';
    if (diffHours < 24) return 'today';
    return 'upcoming';
  };

  const getPriorityBadge = (priority: string) => {
    const badges: Record<string, { class: string; text: string }> = {
      'overdue': { class: 'badge-red', text: '🔴 Overdue' },
      'urgent': { class: 'badge-orange bg-orange-600', text: '🟠 Urgent' },
      'today': { class: 'badge-yellow', text: '🟡 Today' },
      'upcoming': { class: 'badge-blue', text: '🔵 Upcoming' },
      'low': { class: 'badge-gray', text: '⚪ Low' }
    };
    return badges[priority] || badges['low'];
  };

  if (loading) {
    return (
      <DashboardLayout role="cse">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="cse">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-6 rounded-lg shadow-lg">
          <h1 className="text-3xl font-bold text-yellow-300 drop-shadow-lg">📞 Customer Service Dashboard</h1>
          <p className="text-white font-medium mt-1">Follow-up management and customer satisfaction tracking</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card bg-gradient-to-br from-red-50 to-red-100">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-10 h-10 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">Pending Follow-ups</p>
                <p className="text-3xl font-bold text-gray-800">{stats.pendingFollowUps}</p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-orange-50 to-orange-100">
            <div className="flex items-center gap-3">
              <Clock className="w-10 h-10 text-orange-600" />
              <div>
                <p className="text-sm text-gray-600">Today's Follow-ups</p>
                <p className="text-3xl font-bold text-gray-800">{stats.todayFollowUps}</p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-green-50 to-green-100">
            <div className="flex items-center gap-3">
              <UserCheck className="w-10 h-10 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Completed Today</p>
                <p className="text-3xl font-bold text-gray-800">{stats.completedToday}</p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-yellow-50 to-yellow-100">
            <div className="flex items-center gap-3">
              <Star className="w-10 h-10 text-yellow-600" />
              <div>
                <p className="text-sm text-gray-600">Avg Satisfaction</p>
                <p className="text-3xl font-bold text-gray-800">{stats.avgSatisfaction.toFixed(1)}/5</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="card">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('follow_up')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'follow_up'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pending Follow-ups ({stats.pendingFollowUps})
            </button>
            <button
              onClick={() => setFilter('invoiced')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'invoiced'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Invoiced Leads
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'all'
                  ? 'bg-brand-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Leads
            </button>
          </div>
        </div>

        {/* Leads List */}
        {leads.length === 0 ? (
          <div className="card text-center py-12">
            <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Leads</h3>
            <p className="text-gray-500">
              {filter === 'follow_up' 
                ? 'No pending follow-ups at the moment.' 
                : 'No leads found with the selected filter.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {leads.map((lead) => {
              const priority = getFollowUpPriority(lead);
              const priorityBadge = getPriorityBadge(priority);
              const statusBadge = getStatusBadge(lead.status);

              return (
                <div 
                  key={lead.id} 
                  className={`card hover:shadow-xl transition-shadow border-l-4 ${
                    priority === 'overdue' ? 'border-red-500 bg-red-50' :
                    priority === 'urgent' ? 'border-orange-500 bg-orange-50' :
                    priority === 'today' ? 'border-yellow-500 bg-yellow-50' :
                    'border-blue-500'
                  }`}
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="badge-blue text-lg">{lead.lead_number}</span>
                        <span className={statusBadge}>{lead.status.replace(/_/g, ' ')}</span>
                        {lead.follow_up_required && (
                          <span className={priorityBadge.class}>{priorityBadge.text}</span>
                        )}
                      </div>
                      <div className="text-right">
                        {lead.customer_satisfaction_score !== null && (
                          <div className="flex items-center gap-1">
                            <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                            <span className="font-bold text-lg">{lead.customer_satisfaction_score}/5</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Customer</p>
                        <p className="font-semibold">{lead.customer_name}</p>
                        <a 
                          href={`tel:${lead.customer_phone}`} 
                          className="text-brand-primary hover:underline text-sm flex items-center gap-1 mt-1"
                        >
                          <Phone className="w-3 h-3" />
                          {lead.customer_phone}
                        </a>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Vehicle</p>
                        <p className="font-semibold">{lead.vehicle_number}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Follow-up Info</p>
                        {lead.next_follow_up_at ? (
                          <p className="font-semibold text-sm">
                            {new Date(lead.next_follow_up_at).toLocaleString()}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-500">Not scheduled</p>
                        )}
                        <p className="text-xs text-gray-600 mt-1">Total calls: {lead.total_calls || 0}</p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2 border-t">
                      <button
                        onClick={() => router.push(`/dashboard/cse/leads/${lead.id}/follow-up`)}
                        className="btn-primary flex-1 flex items-center justify-center gap-2"
                      >
                        <Phone className="w-4 h-4" />
                        Log Follow-up
                      </button>
                      {lead.status !== 'CLOSED' && (
                        <button
                          onClick={() => router.push(`/dashboard/cse/leads/${lead.id}/close`)}
                          className="btn-secondary bg-green-600 hover:bg-green-700 text-white flex-1 flex items-center justify-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Close Lead
                        </button>
                      )}
                      <button
                        onClick={() => router.push(`/dashboard/cse/leads/${lead.id}`)}
                        className="btn-secondary flex-1"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

