'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Calendar, Clock, Phone, CheckCircle, XCircle, AlertCircle, Filter, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // pending, today, overdue, completed
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchFollowUps();
  }, [filter]);

  async function fetchFollowUps() {
    const supabase = createClient();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      let query = supabase
        .from('telecaller_follow_ups')
        .select(`
          *,
          lead:service_leads(lead_number, customer_name, customer_phone, vehicle_make, vehicle_model)
        `)
        .eq('telecaller_id', userProfile?.id);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      switch (filter) {
        case 'pending':
          query = query.eq('status', 'PENDING');
          break;
        case 'today':
          query = query
            .eq('status', 'PENDING')
            .gte('scheduled_time', today.toISOString())
            .lt('scheduled_time', tomorrow.toISOString());
          break;
        case 'overdue':
          query = query
            .eq('status', 'PENDING')
            .lt('scheduled_time', new Date().toISOString());
          break;
        case 'completed':
          query = query.eq('status', 'COMPLETED');
          break;
      }

      const { data, error } = await query.order('scheduled_time', { ascending: true });

      if (error) throw error;
      setFollowUps(data || []);
    } catch (error) {
      console.error('Error fetching follow-ups:', error);
    } finally {
      setLoading(false);
    }
  }

  async function markAsCompleted(followUpId: string, notes: string = '') {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      const { error } = await supabase
        .from('telecaller_follow_ups')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          completed_by: userProfile?.id,
          completion_notes: notes
        })
        .eq('id', followUpId);

      if (!error) {
        fetchFollowUps();
        alert('Follow-up marked as completed!');
      }
    } catch (error) {
      console.error('Error marking follow-up:', error);
      alert('Failed to update follow-up');
    }
  }

  async function cancelFollowUp(followUpId: string) {
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from('telecaller_follow_ups')
        .update({
          status: 'CANCELLED'
        })
        .eq('id', followUpId);

      if (!error) {
        fetchFollowUps();
        alert('Follow-up cancelled');
      }
    } catch (error) {
      console.error('Error cancelling follow-up:', error);
      alert('Failed to cancel follow-up');
    }
  }

  const filteredFollowUps = followUps.filter(fu => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      fu.lead?.customer_name?.toLowerCase().includes(search) ||
      fu.lead?.customer_phone?.includes(search) ||
      fu.lead?.lead_number?.toLowerCase().includes(search) ||
      fu.reason?.toLowerCase().includes(search)
    );
  });

  const getTimeStatus = (scheduledTime: string) => {
    const now = new Date();
    const scheduled = new Date(scheduledTime);
    const diff = scheduled.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (diff < 0) return { label: 'Overdue', color: 'red', urgent: true };
    if (hours < 1) return { label: 'Due Soon', color: 'orange', urgent: true };
    if (hours < 24) return { label: 'Today', color: 'blue', urgent: false };
    return { label: 'Upcoming', color: 'gray', urgent: false };
  };

  if (loading) {
    return (
      <DashboardLayout role="telecaller">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading follow-ups...</p>
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
          <h1 className="text-3xl font-bold text-text-heading">Follow-up Management</h1>
          <p className="text-text-body mt-2">Manage and track customer follow-ups</p>
        </div>

        {/* Filters & Search */}
        <div className="card">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by customer name, phone, lead number..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('pending')}
                className={`px-4 py-2 rounded-lg font-semibold text-sm ${
                  filter === 'pending' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Pending
              </button>
              <button
                onClick={() => setFilter('today')}
                className={`px-4 py-2 rounded-lg font-semibold text-sm ${
                  filter === 'today' ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setFilter('overdue')}
                className={`px-4 py-2 rounded-lg font-semibold text-sm ${
                  filter === 'overdue' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                Overdue
              </button>
              <button
                onClick={() => setFilter('completed')}
                className={`px-4 py-2 rounded-lg font-semibold text-sm ${
                  filter === 'completed' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                Completed
              </button>
            </div>
          </div>
        </div>

        {/* Follow-ups List */}
        <div className="space-y-4">
          {filteredFollowUps.length === 0 ? (
            <div className="card text-center py-12">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No follow-ups found</p>
            </div>
          ) : (
            filteredFollowUps.map((followUp) => {
              const timeStatus = getTimeStatus(followUp.scheduled_time);
              
              return (
                <div 
                  key={followUp.id} 
                  className={`card hover:shadow-lg transition ${
                    timeStatus.urgent ? 'ring-2 ring-orange-500' : ''
                  }`}
                >
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Main Info */}
                    <div className="flex-1">
                      {/* Row 1: Customer & Lead Info */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-semibold">
                              {followUp.lead?.customer_name || 'Unknown'}
                            </h3>
                            <span className="text-xs px-2 py-1 bg-gray-100 rounded font-mono">
                              {followUp.lead?.lead_number}
                            </span>
                            <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                              followUp.priority === 'URGENT' ? 'bg-red-100 text-red-700' :
                              followUp.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                              followUp.priority === 'LOW' ? 'bg-gray-100 text-gray-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {followUp.priority}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {followUp.lead?.vehicle_make} {followUp.lead?.vehicle_model} • {followUp.lead?.customer_phone}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                          timeStatus.color === 'red' ? 'bg-red-100 text-red-700' :
                          timeStatus.color === 'orange' ? 'bg-orange-100 text-orange-700' :
                          timeStatus.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {timeStatus.label}
                        </span>
                      </div>

                      {/* Row 2: Follow-up Details */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="font-semibold">Type:</span>
                          <span className="text-gray-700">{followUp.follow_up_type}</span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="font-semibold">Scheduled:</span>
                          <span className="text-gray-700">
                            {new Date(followUp.scheduled_time).toLocaleString()}
                          </span>
                        </div>

                        {followUp.reason && (
                          <div className="text-sm">
                            <span className="font-semibold">Reason:</span>
                            <p className="text-gray-700 mt-1">{followUp.reason}</p>
                          </div>
                        )}

                        {followUp.context_notes && (
                          <div className="text-sm">
                            <span className="font-semibold">Context:</span>
                            <p className="text-gray-600 italic mt-1">{followUp.context_notes}</p>
                          </div>
                        )}

                        {followUp.status === 'COMPLETED' && followUp.completion_notes && (
                          <div className="bg-green-50 p-3 rounded-lg text-sm mt-2">
                            <p className="font-semibold text-green-700 mb-1">Completion Notes:</p>
                            <p className="text-gray-700">{followUp.completion_notes}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Completed on {new Date(followUp.completed_at).toLocaleString()}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {followUp.status === 'PENDING' && (
                      <div className="flex flex-col gap-2 md:w-48">
                        <a 
                          href={`tel:${followUp.lead?.customer_phone}`}
                          className="btn btn-primary w-full"
                        >
                          <Phone className="w-4 h-4 mr-2" />
                          Call Now
                        </a>
                        <Link 
                          href={`/dashboard/telecaller/leads/${followUp.lead_id}`}
                          className="btn btn-outline w-full"
                        >
                          View Lead
                        </Link>
                        <button
                          onClick={() => {
                            const notes = prompt('Add completion notes (optional):');
                            if (notes !== null) {
                              markAsCompleted(followUp.id, notes);
                            }
                          }}
                          className="btn btn-outline w-full text-green-600 hover:bg-green-50"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Mark Done
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Cancel this follow-up?')) {
                              cancelFollowUp(followUp.id);
                            }
                          }}
                          className="btn btn-outline w-full text-red-600 hover:bg-red-50"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Cancel
                        </button>
                      </div>
                    )}

                    {followUp.status === 'COMPLETED' && (
                      <div className="flex items-center justify-center md:w-48">
                        <div className="text-center">
                          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                          <p className="text-sm font-semibold text-green-700">Completed</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

