'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
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
  preferred_date: string;
  created_at: string;
  completed_at: string;
  cancelled_at: string;
  notes_internal: string;
  pickup_required: boolean;
  pickup_otp_verified_at: string;
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
      const { data, error } = await supabase
        .from('service_leads')
        .select('*')
        .eq('assigned_pickup_boy_id', userProfile.id)
        .in('status', ['COMPLETED', 'CANCELLED'])
        .order('completed_at', { ascending: false, nullsFirst: false });

      if (error) {
        console.error('Error fetching history:', error);
        toast.error('Failed to fetch history');
        return;
      }

      setHistory(data || []);

      // Calculate stats
      const completed = data?.filter(t => t.status === 'COMPLETED').length || 0;
      const cancelled = data?.filter(t => t.status === 'CANCELLED').length || 0;
      const withPickup = data?.filter(t => t.pickup_required && t.status === 'COMPLETED').length || 0;
      const delivered = data?.filter(t => t.pickup_otp_verified_at && t.status === 'COMPLETED').length || 0;

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
        const taskDate = new Date(task.completed_at || task.cancelled_at);
        return taskDate >= today;
      });
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(task => {
        const taskDate = new Date(task.completed_at || task.cancelled_at);
        return taskDate >= weekAgo;
      });
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(task => {
        const taskDate = new Date(task.completed_at || task.cancelled_at);
        return taskDate >= monthAgo;
      });
    }

    // Status filter
    if (statusFilter === 'completed') {
      filtered = filtered.filter(task => task.status === 'COMPLETED');
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
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_pickup_boy">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-6 rounded-lg shadow-lg">
          <h1 className="text-3xl font-bold text-yellow-300 drop-shadow-lg">📜 Task History</h1>
          <p className="text-white font-medium mt-1">View your completed and cancelled tasks</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card bg-green-50 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Completed</p>
                <p className="text-3xl font-bold text-green-600">{stats.totalCompleted}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
          </div>

          <div className="card bg-blue-50 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pickups Done</p>
                <p className="text-3xl font-bold text-blue-600">{stats.totalPickups}</p>
              </div>
              <Truck className="w-10 h-10 text-blue-500" />
            </div>
          </div>

          <div className="card bg-purple-50 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Deliveries Done</p>
                <p className="text-3xl font-bold text-purple-600">{stats.totalDeliveries}</p>
              </div>
              <Navigation className="w-10 h-10 text-purple-500" />
            </div>
          </div>

          <div className="card bg-red-50 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Cancelled</p>
                <p className="text-3xl font-bold text-red-600">{stats.totalCancelled}</p>
              </div>
              <XCircle className="w-10 h-10 text-red-500" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <span className="font-semibold text-gray-700">Filters:</span>
            </div>

            {/* Date Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => setDateFilter('today')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  dateFilter === 'today'
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setDateFilter('week')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  dateFilter === 'week'
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                This Week
              </button>
              <button
                onClick={() => setDateFilter('month')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  dateFilter === 'month'
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                This Month
              </button>
              <button
                onClick={() => setDateFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  dateFilter === 'all'
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Time
              </button>
            </div>

            <div className="w-px h-8 bg-gray-300"></div>

            {/* Status Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  statusFilter === 'all'
                    ? 'bg-brand-secondary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({history.length})
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  statusFilter === 'completed'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Completed
              </button>
              <button
                onClick={() => setStatusFilter('cancelled')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
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

        {/* History List */}
        <div className="space-y-4">
          {filteredHistory.length === 0 ? (
            <div className="card text-center py-12">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No History Found</h3>
              <p className="text-gray-500">
                {statusFilter !== 'all' 
                  ? `No ${statusFilter} tasks found for the selected period.`
                  : 'No tasks found for the selected period.'
                }
              </p>
            </div>
          ) : (
            filteredHistory.map((task) => (
              <div key={task.id} className="card hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">{getTaskTypeIcon(task)}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-text-heading">
                          {task.lead_number}
                        </h3>
                        {getStatusBadge(task.status)}
                      </div>
                      <p className="text-sm text-gray-600">
                        {task.pickup_required ? 'Pickup & Delivery Task' : 'Service Task'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/dashboard/workshop_pickup_boy/tasks/${task.id}`)}
                    className="btn bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm"
                  >
                    <Eye className="w-4 h-4" />
                    View Details
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Customer Info */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Car className="w-4 h-4 text-gray-500" />
                      <span className="font-semibold">{task.vehicle_number}</span>
                      <span className="text-gray-600">
                        {task.vehicle_make} {task.vehicle_model}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-gray-700">{task.customer_name}</span>
                    </div>
                  </div>

                  {/* Timing */}
                  <div className="space-y-2 text-sm">
                    {task.preferred_date && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-600">Preferred:</span>
                        <span className="font-medium">
                          {new Date(task.preferred_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {task.completed_at && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-gray-600">Completed:</span>
                        <span className="font-medium text-green-600">
                          {new Date(task.completed_at).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {task.cancelled_at && (
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-500" />
                        <span className="text-gray-600">Cancelled:</span>
                        <span className="font-medium text-red-600">
                          {new Date(task.cancelled_at).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-2 text-sm">
                  {task.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-blue-500 mt-0.5" />
                      <div>
                        <span className="text-gray-600 font-medium">Address:</span>{' '}
                        <span className="text-gray-700">{task.address}</span>
                        {task.city && <span className="text-gray-600">, {task.city}</span>}
                        {task.pincode && <span className="text-gray-600"> - {task.pincode}</span>}
                      </div>
                    </div>
                  )}
                  {task.pickup_otp_verified_at && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-green-600">OTP Verified</span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {task.notes_internal && (
                  <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Notes:</span> {task.notes_internal}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Summary Footer */}
        {filteredHistory.length > 0 && (
          <div className="card bg-gray-50">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing <span className="font-bold">{filteredHistory.length}</span> of{' '}
                <span className="font-bold">{history.length}</span> total tasks
              </p>
              <button
                onClick={() => window.print()}
                className="btn bg-brand-primary hover:bg-brand-secondary text-white text-sm"
              >
                <Download className="w-4 h-4" />
                Export History
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

