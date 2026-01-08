'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { MapPin, Clock, User, Car, Phone, Navigation, CheckCircle, PlayCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { formatDateDMY, formatTime12h } from "@/lib/utils";

interface PickupTask {
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
  preferred_date?: string | null;
  preferred_time_slot?: string | null;
  preferred_slot_start?: string | null;
  preferred_slot_end?: string | null;
  pickup_otp: string;
  pickup_otp_verified_at: string;
}

export default function PickupTasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<PickupTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'in_transit' | 'delivery_ready' | 'completed'>('all');
  const [filterCounts, setFilterCounts] = useState({
    all: 0,
    scheduled: 0,
    in_transit: 0,
    delivery_ready: 0,
    completed: 0
  });

  useEffect(() => {
    fetchTasks();

    // Setup real-time subscription
    const supabase = createClient();
    const channel = supabase
      .channel('pickup-boy-tasks')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_leads'
        },
        (payload) => {
          console.log('Pickup tasks updated:', payload);
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [filter]);

  async function fetchTasks() {
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

      // Build query based on filter
      let query = supabase
        .from('service_leads')
        .select('*')
        .eq('assigned_pickup_boy_id', userProfile.id)
        .not('status', 'in', '(REJECTED,CANCELLED)')
        .order('created_at', { ascending: false });

      if (filter === 'scheduled') {
        query = query.in('status', ['ACCEPTED', 'ASSIGNED_TO_WORKSHOP']);
      } else if (filter === 'in_transit') {
        query = query.in('status', ['ON_THE_WAY', 'VEHICLE_IN_TRANSIT', 'VEHICLE_DROPPED_AT_WORKSHOP', 'IN_PROGRESS']);
      } else if (filter === 'delivery_ready') {
        // After billing/payment: ready to return vehicle to customer
        query = query.in('status', ['READY_FOR_DELIVERY', 'COD_PENDING']);
      } else if (filter === 'completed') {
        query = query.in('status', ['COMPLETED', 'DELIVERED_TO_CUSTOMER', 'DELIVERED', 'CLOSED']);
      } else {
        // All active tasks (assigned but not completed)
        query = query.in('status', [
          'ACCEPTED', 
          'ASSIGNED_TO_WORKSHOP', 
          'ON_THE_WAY',
          'VEHICLE_IN_TRANSIT',
          'VEHICLE_DROPPED_AT_WORKSHOP',
          'IN_PROGRESS',
          'READY_FOR_DELIVERY',
          'COD_PENDING'
        ]);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching tasks:', error);
        toast.error('Failed to fetch tasks');
        return;
      }

      setTasks(data || []);

      // Fetch counts for all filters
      const allTasksQuery = supabase
        .from('service_leads')
        .select('status', { count: 'exact', head: true })
        .eq('assigned_pickup_boy_id', userProfile.id)
        .not('status', 'in', '(REJECTED,CANCELLED)');

      // Get all tasks for counting
      const { data: allTasksData } = await supabase
        .from('service_leads')
        .select('status')
        .eq('assigned_pickup_boy_id', userProfile.id)
        .not('status', 'in', '(REJECTED,CANCELLED)');

      if (allTasksData) {
        const counts = {
          all: allTasksData.filter(t => 
            ['ACCEPTED', 'ASSIGNED_TO_WORKSHOP', 'ON_THE_WAY', 'VEHICLE_IN_TRANSIT', 'VEHICLE_DROPPED_AT_WORKSHOP', 'IN_PROGRESS', 'READY_FOR_DELIVERY', 'COD_PENDING'].includes(t.status)
          ).length,
          scheduled: allTasksData.filter(t => 
            ['ACCEPTED', 'ASSIGNED_TO_WORKSHOP'].includes(t.status)
          ).length,
          in_transit: allTasksData.filter(t => 
            ['ON_THE_WAY', 'VEHICLE_IN_TRANSIT', 'VEHICLE_DROPPED_AT_WORKSHOP', 'IN_PROGRESS'].includes(t.status)
          ).length,
          delivery_ready: allTasksData.filter(t =>
            ['READY_FOR_DELIVERY', 'COD_PENDING'].includes(t.status)
          ).length,
          completed: allTasksData.filter(t => 
            ['COMPLETED', 'DELIVERED', 'CLOSED'].includes(t.status)
          ).length
        };
        setFilterCounts(counts);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadge = (status: string, hasOtp: boolean, otpVerified: boolean) => {
    if (status === 'ACCEPTED' || status === 'ASSIGNED_TO_WORKSHOP') {
      if (!hasOtp) return { class: 'badge-yellow', text: 'Ready to Start' };
      if (!otpVerified) return { class: 'badge-orange', text: 'OTP Pending' };
      return { class: 'badge-blue', text: 'In Transit' };
    }
    if (status === 'ON_THE_WAY') return { class: 'badge-blue', text: 'On The Way' };
    if (status === 'VEHICLE_IN_TRANSIT') return { class: 'badge-purple', text: 'In Transit' };
    if (status === 'VEHICLE_DROPPED_AT_WORKSHOP') return { class: 'badge-green', text: 'At Workshop' };
    if (status === 'IN_PROGRESS') return { class: 'badge-blue', text: 'In Progress' };
    if (status === 'READY_FOR_DELIVERY') return { class: 'badge-green', text: 'Delivery Ready' };
    if (status === 'COD_PENDING') return { class: 'badge-orange', text: 'COD Delivery' };
    if (status === 'COMPLETED' || status === 'DELIVERED' || status === 'CLOSED') return { class: 'badge-green', text: 'Completed' };
    return { class: 'badge-gray', text: status.replace(/_/g, ' ') };
  };

  const openGoogleMaps = async (task: PickupTask) => {
    // Build address string from available fields
    const addressParts = [];
    if (task.address) addressParts.push(task.address);
    if (task.city) addressParts.push(task.city);
    if (task.pincode) addressParts.push(task.pincode);
    const fullAddress = addressParts.join(', ');
    
    if (!fullAddress) {
      toast.error('No address available for navigation');
      return;
    }
    
    const encodedAddress = encodeURIComponent(fullAddress);
    
    // Open Google Maps
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
    
    // For delivery-ready leads, "Navigate" should start delivery (drop) flow (generate DROP OTP),
    // not pickup flow.
    const isDeliveryReady = task.status === 'READY_FOR_DELIVERY' || task.status === 'COD_PENDING';

    // Update status / tracking via API
    try {
      const response = await fetch(isDeliveryReady ? `/api/pickup/tasks/${task.id}/drop/start` : `/api/pickup/${task.id}/navigate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: null, // Can be added if available
          longitude: null
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || (isDeliveryReady ? 'Delivery started' : 'Status updated to ON_THE_WAY'));
        fetchTasks(); // Refresh tasks
      } else {
        const data = await response.json();
        console.error('Failed to update status:', data);
        toast.error(data.error || 'Failed to update status');
      }
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status: ' + (error.message || 'Unknown error'));
    }
  };

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
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-300 drop-shadow-lg">🚚 My Pickup Tasks</h1>
          <p className="text-white font-medium text-xs sm:text-sm md:text-base mt-0.5 sm:mt-1">Vehicle pickup and delivery assignments</p>
        </div>

        {/* Filter Tabs */}
        <div className="card">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition text-xs sm:text-sm ${
                filter === 'all'
                  ? 'bg-brand-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Active ({filterCounts.all})
            </button>
            <button
              onClick={() => setFilter('scheduled')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition text-xs sm:text-sm ${
                filter === 'scheduled'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Scheduled ({filterCounts.scheduled})
            </button>
            <button
              onClick={() => setFilter('in_transit')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition text-xs sm:text-sm ${
                filter === 'in_transit'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              In Transit ({filterCounts.in_transit})
            </button>
            <button
              onClick={() => setFilter('delivery_ready')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition text-xs sm:text-sm ${
                filter === 'delivery_ready'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Delivery Ready ({filterCounts.delivery_ready})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition text-xs sm:text-sm ${
                filter === 'completed'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Completed ({filterCounts.completed})
            </button>
          </div>
        </div>

        {/* Tasks Table */}
        {tasks.length === 0 ? (
          <div className="card text-center py-8 sm:py-10 md:py-12">
            <CheckCircle className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-1.5 sm:mb-2">No Tasks</h3>
            <p className="text-gray-500 text-sm sm:text-base">
              {filter === 'all' 
                ? 'You have no active pickup tasks.' 
                : `No tasks with status: ${filter}`}
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
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preferred Date & Time</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tasks.map((task) => {
                    const statusBadge = getStatusBadge(task.status, !!task.pickup_otp, !!task.pickup_otp_verified_at);
                    return (
                      <tr key={task.id} className="hover:bg-gray-50">
                        {/* Lead Number */}
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="text-sm font-medium text-blue-600">#{task.lead_number}</div>
                        </td>

                        {/* Customer */}
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            <div>
                              <div className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                                {task.customer_name}
                              </div>
                              <a href={`tel:${task.customer_phone}`} className="text-xs text-brand-primary hover:underline">
                                {task.customer_phone}
                              </a>
                            </div>
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
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="text-sm text-gray-900 truncate max-w-[200px]">
                                {task.address || 'Address not provided'}
                              </div>
                              {task.city && (
                                <div className="text-xs text-gray-500 truncate max-w-[200px]">
                                  {task.city}{task.pincode ? `, ${task.pincode}` : ''}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <span className={statusBadge.class}>{statusBadge.text}</span>
                        </td>

                        {/* Preferred Date & Time */}
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          {(() => {
                            if (task.preferred_date) {
                              const date = new Date(task.preferred_date);
                              return (
                                <div className="text-xs sm:text-sm">
                                  <div className="font-semibold text-gray-900">{formatDateDMY(date)}</div>
                                  {task.preferred_time_slot && (
                                    <div className="text-gray-600">{task.preferred_time_slot}</div>
                                  )}
                                </div>
                              );
                            }
                            if (task.preferred_slot_start) {
                              const startDate = new Date(task.preferred_slot_start);
                              const endDate = task.preferred_slot_end ? new Date(task.preferred_slot_end) : null;
                              return (
                                <div className="text-xs sm:text-sm">
                                  <div className="font-semibold text-gray-900">{formatDateDMY(startDate)}</div>
                                  <div className="text-gray-600">
                                    {formatTime12h(startDate)}
                                    {endDate && ` - ${formatTime12h(endDate)}`}
                                  </div>
                                </div>
                              );
                            }
                            return <span className="text-xs text-gray-400">Not specified</span>;
                          })()}
                        </td>

                        {/* Actions */}
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => openGoogleMaps(task)}
                              disabled={!task.address && !task.city}
                              className="btn bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Navigation className="w-3.5 h-3.5" />
                              Navigate
                            </button>
                            <button
                              onClick={() => router.push(`/dashboard/workshop_pickup_boy/tasks/${task.id}`)}
                              className="btn btn-primary text-xs px-3 py-1.5"
                            >
                              View Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
