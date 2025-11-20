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
  pickup_address: string;
  pickup_city: string;
  pickup_pincode: string;
  pickup_status: string;
  preferred_date: string;
  preferred_time_slot: string;
  status: string;
  pickup_otp: string;
}

export default function PickupTasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<PickupTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'in_transit' | 'completed'>('all');

  useEffect(() => {
    fetchTasks();
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
        .order('preferred_date', { ascending: true });

      if (filter === 'scheduled') {
        query = query.eq('pickup_status', 'PICKUP_SCHEDULED');
      } else if (filter === 'in_transit') {
        query = query.eq('pickup_status', 'IN_TRANSIT');
      } else if (filter === 'completed') {
        query = query.in('pickup_status', ['DELIVERED', 'VERIFIED']);
      } else {
        // All active tasks (not completed or cancelled)
        query = query.in('pickup_status', ['PICKUP_SCHEDULED', 'IN_TRANSIT']);
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

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { class: string; text: string }> = {
      'PICKUP_SCHEDULED': { class: 'badge-yellow', text: 'Scheduled' },
      'IN_TRANSIT': { class: 'badge-blue', text: 'In Transit' },
      'DELIVERED': { class: 'badge-green', text: 'Delivered' },
      'VERIFIED': { class: 'badge-green', text: 'Verified' }
    };
    return badges[status] || { class: 'badge-gray', text: status };
  };

  const openGoogleMaps = (address: string, city: string, pincode: string) => {
    const fullAddress = `${address}, ${city}, ${pincode}`;
    const encodedAddress = encodeURIComponent(fullAddress);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
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
              const statusBadge = getStatusBadge(task.pickup_status);
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
                        <p className="text-sm text-gray-600">Preferred Date</p>
                        <p className="font-semibold">
                          {new Date(task.preferred_date).toLocaleDateString()}
                        </p>
                        {task.preferred_time_slot && (
                          <p className="text-sm text-gray-600">{task.preferred_time_slot}</p>
                        )}
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
                            <p className="text-sm font-medium">{task.pickup_address}</p>
                            <p className="text-sm text-gray-600">{task.pickup_city}, {task.pickup_pincode}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => openGoogleMaps(task.pickup_address, task.pickup_city, task.pickup_pincode)}
                          className="btn-secondary bg-green-600 hover:bg-green-700 text-white text-sm flex items-center gap-2"
                        >
                          <Navigation className="w-4 h-4" />
                          Open in Maps
                        </button>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2 border-t">
                      {task.pickup_status === 'PICKUP_SCHEDULED' && (
                        <button
                          onClick={() => router.push(`/dashboard/workshop_pickup_boy/tasks/${task.id}`)}
                          className="btn-primary flex-1 flex items-center justify-center gap-2"
                        >
                          <PlayCircle className="w-4 h-4" />
                          Start Pickup
                        </button>
                      )}
                      {task.pickup_status === 'IN_TRANSIT' && (
                        <button
                          onClick={() => router.push(`/dashboard/workshop_pickup_boy/tasks/${task.id}`)}
                          className="btn-primary bg-blue-600 hover:bg-blue-700 flex-1 flex items-center justify-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Complete Delivery
                        </button>
                      )}
                      <button
                        onClick={() => router.push(`/dashboard/workshop_pickup_boy/tasks/${task.id}`)}
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
