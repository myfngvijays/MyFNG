'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  Phone, PhoneCall, PhoneMissed, Clock, CheckCircle, XCircle, 
  AlertCircle, TrendingUp, Calendar, Users 
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function TelecallerDashboard() {
  const [stats, setStats] = useState({
    newLeads: 0,
    pendingCallbacks: 0,
    followUpToday: 0,
    incompleteLeads: 0,
    bookedLeads: 0,
    rejectedLeads: 0,
    todayCalls: 0,
    answeredCalls: 0,
    loading: true
  });

  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [upcomingFollowUps, setUpcomingFollowUps] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    const supabase = createClient();

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

      // Fetch stats
      const today = new Date().toISOString().split('T')[0];

      // New leads (not contacted yet)
      const { count: newCount } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .or(`assigned_telecaller_id.is.null,assigned_telecaller_id.eq.${teleCallerId}`)
        .eq('status', 'NEW')
        .is('last_call_at', null);

      // Pending callbacks
      const { count: callbackCount } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_telecaller_id', teleCallerId)
        .eq('follow_up_required', true)
        .lte('next_follow_up_at', new Date().toISOString());

      // Follow-ups today
      const { count: followUpCount } = await supabase
        .from('telecaller_follow_ups')
        .select('*', { count: 'exact', head: true })
        .eq('telecaller_id', teleCallerId)
        .eq('status', 'PENDING')
        .gte('scheduled_time', `${today}T00:00:00`)
        .lte('scheduled_time', `${today}T23:59:59`);

      // Incomplete leads
      const { count: incompleteCount } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .or(`assigned_telecaller_id.is.null,assigned_telecaller_id.eq.${teleCallerId}`)
        .eq('is_incomplete', true);

      // Booked leads
      const { count: bookedCount } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('created_by_id', teleCallerId)
        .in('status', ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS']);

      // Rejected leads
      const { count: rejectedCount } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_telecaller_id', teleCallerId)
        .eq('status', 'REJECTED');

      // Today's call stats
      const { data: callStats } = await supabase
        .from('telecaller_call_logs')
        .select('call_status')
        .eq('telecaller_id', teleCallerId)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`);

      const todayCalls = callStats?.length || 0;
      const answeredCalls = callStats?.filter(c => c.call_status === 'ANSWERED').length || 0;

      setStats({
        newLeads: newCount || 0,
        pendingCallbacks: callbackCount || 0,
        followUpToday: followUpCount || 0,
        incompleteLeads: incompleteCount || 0,
        bookedLeads: bookedCount || 0,
        rejectedLeads: rejectedCount || 0,
        todayCalls,
        answeredCalls,
        loading: false
      });

      // Fetch recent leads
      const { data: leads } = await supabase
        .from('service_leads')
        .select('*')
        .or(`assigned_telecaller_id.is.null,assigned_telecaller_id.eq.${teleCallerId}`)
        .in('status', ['NEW', 'ASSIGNED'])
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentLeads(leads || []);

      // Fetch upcoming follow-ups
      const { data: followUps } = await supabase
        .from('telecaller_follow_ups')
        .select('*, lead:service_leads(lead_number, customer_name, customer_phone)')
        .eq('telecaller_id', teleCallerId)
        .eq('status', 'PENDING')
        .order('scheduled_time', { ascending: true })
        .limit(5);

      setUpcomingFollowUps(followUps || []);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setStats(prev => ({ ...prev, loading: false }));
    }
  }

  if (stats.loading) {
    return (
      <DashboardLayout role="telecaller">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="telecaller">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-text-heading">Telecaller Dashboard</h1>
          <p className="text-text-body mt-2">Manage customer calls and lead bookings</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link href="/dashboard/telecaller/leads?filter=new">
            <StatCard
              title="New Leads"
              value={stats.newLeads.toString()}
              icon={<Phone className="w-8 h-8 text-blue-600" />}
              bgColor="bg-blue-50"
              textColor="text-blue-600"
            />
          </Link>
          
          <Link href="/dashboard/telecaller/leads?filter=callback">
            <StatCard
              title="Pending Callbacks"
              value={stats.pendingCallbacks.toString()}
              icon={<PhoneMissed className="w-8 h-8 text-orange-600" />}
              bgColor="bg-orange-50"
              textColor="text-orange-600"
              urgent={stats.pendingCallbacks > 0}
            />
          </Link>

          <Link href="/dashboard/telecaller/followups">
            <StatCard
              title="Follow-ups Today"
              value={stats.followUpToday.toString()}
              icon={<Calendar className="w-8 h-8 text-purple-600" />}
              bgColor="bg-purple-50"
              textColor="text-purple-600"
            />
          </Link>

          <Link href="/dashboard/telecaller/leads?filter=incomplete">
            <StatCard
              title="Incomplete Leads"
              value={stats.incompleteLeads.toString()}
              icon={<AlertCircle className="w-8 h-8 text-yellow-600" />}
              bgColor="bg-yellow-50"
              textColor="text-yellow-600"
            />
          </Link>

          <StatCard
            title="Booked Leads"
            value={stats.bookedLeads.toString()}
            icon={<CheckCircle className="w-8 h-8 text-green-600" />}
            bgColor="bg-green-50"
            textColor="text-green-600"
          />

          <StatCard
            title="Rejected Leads"
            value={stats.rejectedLeads.toString()}
            icon={<XCircle className="w-8 h-8 text-red-600" />}
            bgColor="bg-red-50"
            textColor="text-red-600"
          />

          <StatCard
            title="Today's Calls"
            value={stats.todayCalls.toString()}
            icon={<PhoneCall className="w-8 h-8 text-indigo-600" />}
            bgColor="bg-indigo-50"
            textColor="text-indigo-600"
            subtitle={`${stats.answeredCalls} answered`}
          />

          <StatCard
            title="Call Answer Rate"
            value={stats.todayCalls > 0 ? `${Math.round((stats.answeredCalls / stats.todayCalls) * 100)}%` : '0%'}
            icon={<TrendingUp className="w-8 h-8 text-teal-600" />}
            bgColor="bg-teal-50"
            textColor="text-teal-600"
          />
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/dashboard/telecaller/leads/create">
              <button className="btn btn-primary w-full">
                <Phone className="w-5 h-5 mr-2" />
                Create Lead
              </button>
            </Link>
            <Link href="/dashboard/telecaller/leads?filter=new">
              <button className="btn btn-outline w-full">
                <Users className="w-5 h-5 mr-2" />
                View Queue
              </button>
            </Link>
            <Link href="/dashboard/telecaller/followups">
              <button className="btn btn-outline w-full">
                <Calendar className="w-5 h-5 mr-2" />
                Follow-ups
              </button>
            </Link>
            <Link href="/dashboard/telecaller/scripts">
              <button className="btn btn-outline w-full">
                <Clock className="w-5 h-5 mr-2" />
                Call Scripts
              </button>
            </Link>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Leads */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Recent Leads</h2>
              <Link href="/dashboard/telecaller/leads" className="text-brand-primary hover:underline text-sm">
                View All →
              </Link>
            </div>
            
            {recentLeads.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No recent leads</p>
            ) : (
              <div className="space-y-3">
                {recentLeads.map((lead) => (
                  <Link 
                    key={lead.id} 
                    href={`/dashboard/telecaller/leads/${lead.id}`}
                    className="block p-4 border border-gray-200 rounded-lg hover:border-brand-primary hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{lead.customer_name}</span>
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                            {lead.lead_number}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {lead.vehicle_make} {lead.vehicle_model} • {lead.customer_phone}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(lead.created_at).toLocaleString()}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        lead.status === 'NEW' ? 'bg-blue-100 text-blue-700' :
                        lead.status === 'ASSIGNED' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {lead.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Follow-ups */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Upcoming Follow-ups</h2>
              <Link href="/dashboard/telecaller/followups" className="text-brand-primary hover:underline text-sm">
                View All →
              </Link>
            </div>
            
            {upcomingFollowUps.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No follow-ups scheduled</p>
            ) : (
              <div className="space-y-3">
                {upcomingFollowUps.map((followUp) => (
                  <div 
                    key={followUp.id}
                    className="p-4 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{followUp.lead?.customer_name}</span>
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                            {followUp.lead?.lead_number}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{followUp.reason}</p>
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(followUp.scheduled_time).toLocaleString()}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        followUp.priority === 'URGENT' ? 'bg-red-100 text-red-700' :
                        followUp.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {followUp.priority}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button className="btn btn-primary btn-sm flex-1">
                        <Phone className="w-4 h-4 mr-1" />
                        Call Now
                      </button>
                      <button className="btn btn-outline btn-sm">
                        Reschedule
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  bgColor?: string;
  textColor?: string;
  subtitle?: string;
  urgent?: boolean;
}

function StatCard({ title, value, icon, bgColor = 'bg-gray-50', textColor = 'text-gray-600', subtitle, urgent }: StatCardProps) {
  return (
    <div className={`card hover:shadow-lg transition ${urgent ? 'ring-2 ring-orange-500 animate-pulse' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className={`text-3xl font-bold ${textColor}`}>{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${bgColor}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

