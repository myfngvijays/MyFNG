'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { formatDateDMY, formatDateTime } from '@/lib/utils';
import {
  Calendar, Clock, MapPin, Car, CheckCircle, XCircle, 
  Truck, Navigation, Eye, Filter, Download 
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

interface HistoryTask {
  id: string;
  lead_number: string;
  customer_name: string;
  customer_phone: string;
  vehicle_number: string;
  vehicle_make: string;
  vehicle_model: string;
  address: string;
  city: string;
  pincode: string;
  status: string;
  preferred_date: string | null;
  created_at: string;
  updated_at?: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  delivered_at?: string | null;
  drop_completed_time?: string | null;
  notes_internal: string | null;
  pickup_required: boolean;
  pickup_otp_verified_at: string | null;
  pickup_status?: string | null;
  drop_status?: string | null;
}

export default function PickupBoyHistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryTask[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<HistoryTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [stats, setStats] = useState({
    totalCompleted: 0,
    totalCancelled: 0,
    totalPickups: 0,
    totalDeliveries: 0
  });

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [history, dateFilter, statusFilter]);

  async function fetchHistory() {
    const supabase = createClient();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!userProfile) {
        toast.error('User profile not found');
        return;
      }

      // Fetch completed tasks from service_leads
      // Include all statuses that indicate completed work (pickup or delivery)
      // Also include tasks where pickup was completed even if main status is different
      const { data, error } = await supabase
        .from('service_leads')
        .select('*')
        .eq('assigned_pickup_boy_id', userProfile.id)
        .or(`status.in.(COMPLETED,CANCELLED,DELIVERED_TO_CUSTOMER,DELIVERED,CLOSED,VEHICLE_DROPPED_AT_WORKSHOP),pickup_status.in.(VEHICLE_DROPPED_AT_WORKSHOP,DROPPED,ARRIVED_AT_WORKSHOP)`)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching history:', error);
        toast.error('Failed to fetch history');
        return;
      }

      // Also fetch from pickup_tracking for completed pickups/deliveries
      let trackingData = null;
      try {
        const { data: trackingData1 } = await supabase
          .from('pickup_tracking')
          .select(`
            *,
            lead:service_leads!inner(*)
          `)
          .eq('pickup_assigned_to', userProfile.id)
          .in('pickup_status', ['ARRIVED_AT_WORKSHOP', 'DROPPED', 'VEHICLE_DROPPED_AT_WORKSHOP']);

        const { data: trackingData2 } = await supabase
          .from('pickup_tracking')
          .select(`
            *,
            lead:service_leads!inner(*)
          `)
          .eq('drop_assigned_to', userProfile.id)
          .eq('drop_status', 'DELIVERED');

        trackingData = [...(trackingData1 || []), ...(trackingData2 || [])];
      } catch (trackingError) {
        console.warn('Error fetching tracking data:', trackingError);
        // Continue without tracking data
      }

      // Combine and deduplicate
      const allTasks = [...(data || [])];
      const leadIds = new Set(allTasks.map(t => t.id));
      
      // Add tracking leads that might not be in main query
      if (trackingData) {
        trackingData.forEach(tracking => {
          const lead = (tracking as any)?.lead;
          if (lead && !leadIds.has(lead.id)) {
            // Merge tracking data into lead
            allTasks.push({
              ...lead,
              drop_completed_time: (tracking as any)?.drop_completed_time,
              pickup_arrival_time: (tracking as any)?.pickup_arrival_time,
            });
            leadIds.add(lead.id);
          }
        });
      }

      // Sort by most recent completion/delivery/cancellation
      allTasks.sort((a, b) => {
        const aDate = new Date(a.delivered_at || a.drop_completed_time || a.completed_at || a.cancelled_at || a.updated_at || 0).getTime();
        const bDate = new Date(b.delivered_at || b.drop_completed_time || b.completed_at || b.cancelled_at || b.updated_at || 0).getTime();
        return bDate - aDate; // Latest first
      });

      setHistory(allTasks);

      // Calculate stats - consider all completed statuses
      const completedStatuses = ['COMPLETED', 'DELIVERED_TO_CUSTOMER', 'DELIVERED', 'CLOSED', 'VEHICLE_DROPPED_AT_WORKSHOP'];
      const completed = allTasks?.filter(t => completedStatuses.includes(t.status) || t.pickup_status === 'VEHICLE_DROPPED_AT_WORKSHOP' || t.pickup_status === 'DROPPED').length || 0;
      const cancelled = allTasks?.filter(t => t.status === 'CANCELLED').length || 0;
      const withPickup = allTasks?.filter(t => 
        t.pickup_required && 
        (completedStatuses.includes(t.status) || t.pickup_status === 'VEHICLE_DROPPED_AT_WORKSHOP' || t.pickup_status === 'DROPPED')
      ).length || 0;
      const delivered = allTasks?.filter(t => 
        (t.status === 'DELIVERED_TO_CUSTOMER' || t.status === 'DELIVERED' || t.drop_status === 'DELIVERED') &&
        completedStatuses.includes(t.status)
      ).length || 0;

      setStats({
        totalCompleted: completed,
        totalCancelled: cancelled,
        totalPickups: withPickup,
        totalDeliveries: delivered
      });

    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    let filtered = [...history];

    // Date filter
    const now = new Date();
    if (dateFilter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filtered = filtered.filter(task => {
                            const taskDate = new Date(task.delivered_at || task.drop_completed_time || task.completed_at || task.cancelled_at || task.updated_at || task.created_at || 0);
                            return taskDate.getTime() > 0 && taskDate >= today;
      });
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(task => {
                            const taskDate = new Date(task.delivered_at || task.drop_completed_time || task.completed_at || task.cancelled_at || task.updated_at || task.created_at || 0);
                            return taskDate.getTime() > 0 && taskDate >= weekAgo;
      });
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(task => {
                            const taskDate = new Date(task.delivered_at || task.drop_completed_time || task.completed_at || task.cancelled_at || task.updated_at || task.created_at || 0);
                            return taskDate.getTime() > 0 && taskDate >= monthAgo;
      });
    }
    // 'all' filter doesn't need date filtering - show all tasks

    // Status filter
    const completedStatuses = ['COMPLETED', 'DELIVERED_TO_CUSTOMER', 'DELIVERED', 'CLOSED', 'VEHICLE_DROPPED_AT_WORKSHOP'];
    if (statusFilter === 'completed') {
      filtered = filtered.filter(task => completedStatuses.includes(task.status));
    } else if (statusFilter === 'cancelled') {
      filtered = filtered.filter(task => task.status === 'CANCELLED');
    }

    setFilteredHistory(filtered);
  }

  function getTaskTypeIcon(task: HistoryTask) {
    if (task.pickup_required) return '🚚';
    return '📋';
  }

  function getStatusBadge(status: string) {
    if (status === 'COMPLETED') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Completed
        </span>
      );
    }
    if (status === 'CANCELLED') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="w-3 h-3 mr-1" />
          Cancelled
        </span>
      );
    }
    return null;
  }

  if (loading) {
    return (
      <DashboardLayout role="workshop_pickup_boy">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_pickup_boy">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-300 drop-shadow-lg">📜 Task History</h1>
          <p className="text-white font-medium text-xs sm:text-sm md:text-base mt-0.5 sm:mt-1">View your completed and cancelled tasks</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="card bg-green-50 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Total Completed</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600">{stats.totalCompleted}</p>
              </div>
              <CheckCircle className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-green-500 flex-shrink-0" />
            </div>
          </div>

          <div className="card bg-blue-50 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Pickups Done</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-600">{stats.totalPickups}</p>
              </div>
              <Truck className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-blue-500 flex-shrink-0" />
            </div>
          </div>

          <div className="card bg-purple-50 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Deliveries Done</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-600">{stats.totalDeliveries}</p>
              </div>
              <Navigation className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-purple-500 flex-shrink-0" />
            </div>
          </div>

          <div className="card bg-red-50 border-l-4 border-red-500 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Cancelled</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-red-600">{stats.totalCancelled}</p>
              </div>
              <XCircle className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-red-500 flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
              <span className="font-semibold text-gray-700 text-xs sm:text-sm">Filters:</span>
            </div>

            {/* Date Filter */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setDateFilter('today')}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                  dateFilter === 'today'
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setDateFilter('week')}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                  dateFilter === 'week'
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                This Week
              </button>
              <button
                onClick={() => setDateFilter('month')}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                  dateFilter === 'month'
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                This Month
              </button>
              <button
                onClick={() => setDateFilter('all')}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                  dateFilter === 'all'
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Time
              </button>
            </div>

            <div className="hidden sm:block w-px h-6 sm:h-8 bg-gray-300"></div>

            {/* Status Filter */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                  statusFilter === 'all'
                    ? 'bg-brand-secondary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({history.length})
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                  statusFilter === 'completed'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Completed
              </button>
              <button
                onClick={() => setStatusFilter('cancelled')}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                  statusFilter === 'cancelled'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Cancelled
              </button>
            </div>
          </div>
        </div>

        {/* History Table */}
        {filteredHistory.length === 0 ? (
          <div className="card text-center py-8 sm:py-10 md:py-12">
            <Calendar className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-1.5 sm:mb-2">No History Found</h3>
            <p className="text-gray-500 text-sm sm:text-base">
              {statusFilter !== 'all' 
                ? `No ${statusFilter} tasks found for the selected period.`
                : 'No tasks found for the selected period.'
              }
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead #</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed/Cancelled</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredHistory.map((task) => (
                    <tr key={task.id} className="hover:bg-gray-50">
                      {/* Lead Number */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="flex items-center gap-2">
                          <div className="text-xl flex-shrink-0">{getTaskTypeIcon(task)}</div>
                          <div className="text-sm font-medium text-blue-600">#{task.lead_number}</div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {task.pickup_required ? 'Pickup & Delivery' : 'Service Task'}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                          {task.customer_name}
                        </div>
                      </td>

                      {/* Vehicle */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="flex items-center gap-2">
                          <Car className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          <div>
                            <div className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                              {task.vehicle_number}
                            </div>
                            <div className="text-xs text-gray-500 truncate max-w-[150px]">
                              {task.vehicle_make} {task.vehicle_model}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Address */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        {task.address ? (
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="text-sm text-gray-900 truncate max-w-[200px]">
                                {task.address}
                              </div>
                              {(task.city || task.pincode) && (
                                <div className="text-xs text-gray-500 truncate max-w-[200px]">
                                  {task.city}{task.pincode ? `, ${task.pincode}` : ''}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Not provided</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        {getStatusBadge(task.status)}
                        {task.pickup_otp_verified_at && (
                          <div className="flex items-center gap-1 mt-1">
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            <span className="text-xs text-green-600">OTP Verified</span>
                          </div>
                        )}
                      </td>

                      {/* Completed/Cancelled Date */}
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        {(task.completed_at || task.delivered_at || task.drop_completed_time) ? (
                          <div className="flex items-center gap-1.5">
                            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                            <div className="text-xs sm:text-sm">
                              <div className="font-medium text-green-600">
                                {formatDateTime(task.delivered_at || task.drop_completed_time || task.completed_at)}
                              </div>
                            </div>
                          </div>
                        ) : task.cancelled_at ? (
                          <div className="flex items-center gap-1.5">
                            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <div className="text-xs sm:text-sm">
                              <div className="font-medium text-red-600">
                                {formatDateTime(task.cancelled_at)}
                              </div>
                            </div>
                          </div>
                        ) : task.preferred_date ? (
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            <div className="text-xs sm:text-sm text-gray-600">
                              Preferred: {formatDateDMY(task.preferred_date)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => router.push(`/dashboard/workshop_pickup_boy/tasks/${task.id}`)}
                          className="btn btn-outline text-xs px-3 py-1.5 flex items-center justify-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary Footer */}
        {filteredHistory.length > 0 && (
          <div className="card bg-gray-50">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="text-xs sm:text-sm text-gray-600">
                Showing <span className="font-bold">{filteredHistory.length}</span> of{' '}
                <span className="font-bold">{history.length}</span> total tasks
              </p>
              <button
                onClick={() => window.print()}
                className="btn bg-brand-primary hover:bg-brand-secondary text-white text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-center gap-1.5 sm:gap-2 w-full sm:w-auto"
              >
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Export History
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

