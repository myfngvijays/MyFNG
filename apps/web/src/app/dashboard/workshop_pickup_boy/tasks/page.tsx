'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { MapPin, Clock, User, Car, Phone, Navigation, CheckCircle, PlayCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

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
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'in_transit' | 'completed'>('all');

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
        query = query.eq('status', 'IN_PROGRESS');
      } else if (filter === 'completed') {
        query = query.eq('status', 'COMPLETED');
      } else {
        // All active tasks (assigned but not completed)
        query = query.in('status', ['ACCEPTED', 'ASSIGNED_TO_WORKSHOP', 'IN_PROGRESS']);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching tasks:', error);
        toast.error('Failed to fetch tasks');
        return;
      }

      setTasks(data || []);
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
    if (status === 'IN_PROGRESS') return { class: 'badge-blue', text: 'In Progress' };
    if (status === 'COMPLETED') return { class: 'badge-green', text: 'Completed' };
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
    
    // Update lead status to ON_THE_WAY
    try {
      const response = await fetch(`/api/pickup/${task.id}/navigate`, {
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
        toast.success(data.message || 'Status updated to ON_THE_WAY');
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
          <h1 className="text-3xl font-bold text-yellow-300 drop-shadow-lg">🚚 My Pickup Tasks</h1>
          <p className="text-white font-medium mt-1">Vehicle pickup and delivery assignments</p>
        </div>

        {/* Filter Tabs */}
        <div className="card">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'all'
                  ? 'bg-brand-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Active ({tasks.length})
            </button>
            <button
              onClick={() => setFilter('scheduled')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'scheduled'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Scheduled
            </button>
            <button
              onClick={() => setFilter('in_transit')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'in_transit'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              In Transit
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'completed'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Completed
            </button>
          </div>
        </div>

        {/* Tasks List */}
        {tasks.length === 0 ? (
          <div className="card text-center py-12">
            <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Tasks</h3>
            <p className="text-gray-500">
              {filter === 'all' 
                ? 'You have no active pickup tasks.' 
                : `No tasks with status: ${filter}`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => {
              const statusBadge = getStatusBadge(task.status, !!task.pickup_otp, !!task.pickup_otp_verified_at);
              return (
                <div 
                  key={task.id} 
                  className="card hover:shadow-xl transition-all border-l-4 border-blue-500"
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="badge-blue text-lg">{task.lead_number}</span>
                        <span className={statusBadge.class}>{statusBadge.text}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Preferred Date & Time</p>
                        {(() => {
                          // Check for preferred_date (DATE column)
                          if (task.preferred_date) {
                            const date = new Date(task.preferred_date);
                            return (
                              <>
                                <p className="font-semibold">
                                  {date.toLocaleDateString('en-IN', { 
                                    weekday: 'short',
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })}
                                </p>
                                {task.preferred_time_slot && (
                                  <p className="text-sm text-gray-600">{task.preferred_time_slot}</p>
                                )}
                              </>
                            );
                          }
                          // Check for preferred_slot_start (TIMESTAMP column)
                          if (task.preferred_slot_start) {
                            const startDate = new Date(task.preferred_slot_start);
                            const endDate = task.preferred_slot_end ? new Date(task.preferred_slot_end) : null;
                            return (
                              <>
                                <p className="font-semibold">
                                  {startDate.toLocaleDateString('en-IN', { 
                                    weekday: 'short',
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {startDate.toLocaleTimeString('en-IN', { 
                                    hour: '2-digit', 
                                    minute: '2-digit',
                                    hour12: true 
                                  })}
                                  {endDate && ` - ${endDate.toLocaleTimeString('en-IN', { 
                                    hour: '2-digit', 
                                    minute: '2-digit',
                                    hour12: true 
                                  })}`}
                                </p>
                              </>
                            );
                          }
                          // No preferred date/time found
                          return <p className="font-semibold text-gray-400">Not specified</p>;
                        })()}
                      </div>
                    </div>

                    {/* Customer & Vehicle Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-500" />
                          <span className="font-semibold">{task.customer_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-500" />
                          <a href={`tel:${task.customer_phone}`} className="text-brand-primary hover:underline">
                            {task.customer_phone}
                          </a>
                        </div>
                        <div className="flex items-center gap-2">
                          <Car className="w-4 h-4 text-gray-500" />
                          <span>{task.vehicle_make} {task.vehicle_model} - {task.vehicle_number}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{task.address || 'Address not provided'}</p>
                            {task.city && <p className="text-sm text-gray-600">{task.city}{task.pincode ? `, ${task.pincode}` : ''}</p>}
                          </div>
                        </div>
                        <button
                          onClick={() => openGoogleMaps(task)}
                          className="btn-secondary bg-green-600 hover:bg-green-700 text-white text-sm flex items-center gap-2"
                          disabled={!task.address && !task.city}
                        >
                          <Navigation className="w-4 h-4" />
                          Navigate
                        </button>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2 border-t">
                      <button
                        onClick={() => router.push(`/dashboard/workshop_pickup_boy/tasks/${task.id}`)}
                        className="btn-primary flex-1"
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
