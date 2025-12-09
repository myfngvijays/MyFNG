'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Truck, MapPin, Camera, Navigation, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

export default function WorkshopPickupBoyDashboard() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [stats, setStats] = useState([
    { label: 'Pickup Tasks', value: '0', icon: <Truck className="w-8 h-8" />, color: 'text-brand-primary' },
    { label: 'Delivery Tasks', value: '0', icon: <Truck className="w-8 h-8" />, color: 'text-blue-500' },
    { label: 'In Transit', value: '0', icon: <Navigation className="w-8 h-8" />, color: 'text-green-500' },
    { label: 'Completed Today', value: '0', icon: <CheckCircle className="w-8 h-8" />, color: 'text-green-600' },
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPickupData();

    // Setup real-time subscription
    const supabase = createClient();
    const channel = supabase
      .channel('pickup-boy-dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_leads'
        },
        (payload) => {
          console.log('Dashboard updated:', payload);
          fetchPickupData();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  async function fetchPickupData() {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!userProfile) return;

      // Fetch tasks assigned to this pickup boy from service_leads
      const { data: assignedTasks } = await supabase
        .from('service_leads')
        .select('*')
        .eq('assigned_pickup_boy_id', userProfile.id)
        .in('status', [
          'ACCEPTED', 
          'ASSIGNED_TO_WORKSHOP', 
          'ON_THE_WAY',
          'VEHICLE_IN_TRANSIT',
          'VEHICLE_DROPPED_AT_WORKSHOP',
          'IN_PROGRESS'
        ])
        .order('created_at', { ascending: false })
        .limit(5);

      // Get all tasks for stats
      const { data: allTasks } = await supabase
        .from('service_leads')
        .select('*')
        .eq('assigned_pickup_boy_id', userProfile.id);

      const pickupCount = allTasks?.filter(t => 
        t.pickup_required && 
        (t.status === 'ACCEPTED' || t.status === 'ASSIGNED_TO_WORKSHOP')
      ).length || 0;

      const deliveryCount = allTasks?.filter(t => 
        t.status === 'COMPLETED' || t.status === 'READY_FOR_DELIVERY'
      ).length || 0;

      const inTransitCount = allTasks?.filter(t => 
        t.status === 'ON_THE_WAY' || 
        t.status === 'VEHICLE_IN_TRANSIT' || 
        t.status === 'VEHICLE_DROPPED_AT_WORKSHOP' ||
        t.status === 'IN_PROGRESS'
      ).length || 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const completedToday = allTasks?.filter(t => 
        (t.status === 'DELIVERED' || t.status === 'CLOSED') && 
        t.completed_at &&
        new Date(t.completed_at) >= today
      ).length || 0;

      setTasks(assignedTasks || []);
      setStats([
        { label: 'Pickup Tasks', value: pickupCount.toString(), icon: <Truck className="w-8 h-8" />, color: 'text-brand-primary' },
        { label: 'Delivery Tasks', value: deliveryCount.toString(), icon: <Truck className="w-8 h-8" />, color: 'text-blue-500' },
        { label: 'In Transit', value: inTransitCount.toString(), icon: <Navigation className="w-8 h-8" />, color: 'text-green-500' },
        { label: 'Completed Today', value: completedToday.toString(), icon: <CheckCircle className="w-8 h-8" />, color: 'text-green-600' },
      ]);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching pickup data:', error);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="workshop_pickup_boy">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-4 text-text-body">Loading dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_pickup_boy">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-text-heading">Pickup & Delivery Dashboard</h1>
          <p className="text-text-body text-sm sm:text-base mt-1 sm:mt-2">Manage your pickup and delivery tasks</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {stats.map((stat, index) => (
            <div key={index} className="card">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className={`${stat.color} flex-shrink-0`}>{stat.icon}</div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-text-body">{stat.label}</p>
                  <p className="text-xl sm:text-2xl font-bold text-text-heading">{stat.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Tasks */}
        <div className="card">
          <h2 className="text-lg sm:text-xl font-semibold text-text-heading mb-3 sm:mb-4">Active Tasks</h2>
          {tasks.length > 0 ? (
            <div className="space-y-2 sm:space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="p-3 sm:p-4 border border-gray-200 rounded-lg hover:shadow-md transition">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-text-heading text-base sm:text-lg truncate">{task.lead_number}</p>
                      <p className="text-xs sm:text-sm text-text-body truncate">{task.customer_name} - {task.vehicle_number}</p>
                      <div className="mt-1.5 sm:mt-2 space-y-1">
                        {task.pickup_address && (
                          <p className="text-[10px] sm:text-xs text-gray-500 flex items-start gap-1">
                            <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0 mt-0.5" />
                            <span className="truncate">Pickup: {task.pickup_address}</span>
                          </p>
                        )}
                        {task.address && (
                          <p className="text-[10px] sm:text-xs text-gray-500 flex items-start gap-1">
                            <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0 mt-0.5" />
                            <span className="truncate">Address: {task.address}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold flex-shrink-0 sm:ml-4 ${
                      task.status === 'IN_PROGRESS' ? 'bg-green-100 text-green-700' : 
                      task.status === 'ACCEPTED' ? 'bg-blue-100 text-blue-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button 
                      onClick={async () => {
                        console.log('Navigate button clicked for task:', task.id, task.lead_number);
                        
                        // Open Google Maps - use coordinates if available, otherwise use address
                        const address = task.pickup_address || task.customer_address || task.address || '';
                        const city = task.city || '';
                        const pincode = task.pincode || '';
                        const fullAddress = `${address}, ${city}, ${pincode}`.trim();
                        
                        console.log('Address info:', { address, city, pincode, fullAddress, lat: task.customer_lat, lng: task.customer_lng });
                        
                        if (task.customer_lat && task.customer_lng) {
                          window.open(`https://maps.google.com/?q=${task.customer_lat},${task.customer_lng}`, '_blank');
                        } else if (fullAddress) {
                          const encodedAddress = encodeURIComponent(fullAddress);
                          window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
                        } else {
                          toast.error('No address or coordinates available');
                          return;
                        }
                        
                        // Update lead status to ON_THE_WAY
                        try {
                          console.log('Calling navigate API for task:', task.id);
                          const response = await fetch(`/api/pickup/${task.id}/navigate`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              latitude: task.customer_lat || null,
                              longitude: task.customer_lng || null
                            })
                          });
                          
                          console.log('Navigate API response status:', response.status);
                          
                          if (response.ok) {
                            const data = await response.json();
                            console.log('Navigate API success:', data);
                            toast.success(data.message || 'Status updated to ON_THE_WAY');
                            fetchPickupData(); // Refresh tasks
                          } else {
                            const data = await response.json();
                            console.error('Navigate API failed:', data);
                            toast.error(data.error || 'Failed to update status');
                            if (data.details) {
                              console.error('Error details:', data.details);
                            }
                          }
                        } catch (error: any) {
                          console.error('Navigate API error:', error);
                          toast.error('Failed to update status: ' + (error.message || 'Unknown error'));
                        }
                      }}
                      className="btn btn-outline text-xs sm:text-sm flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5"
                    >
                      <Navigation className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      Navigate
                    </button>
                    <button 
                      onClick={() => window.location.href = `/dashboard/workshop_pickup_boy/tasks/${task.id}`}
                      className="btn btn-primary text-xs sm:text-sm flex-1 py-2 sm:py-2.5"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-6 sm:py-8 text-sm sm:text-base">No active tasks</p>
          )}
        </div>

        {/* Photo Upload Guide */}
        <div className="card bg-blue-50 border-l-4 border-brand-primary">
          <h3 className="font-semibold text-sm sm:text-base text-text-heading mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
            <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-brand-primary flex-shrink-0" />
            Photo Guidelines
          </h3>
          <ul className="text-xs sm:text-sm text-gray-700 space-y-1.5 sm:space-y-2">
            <li className="flex items-start gap-1.5 sm:gap-2">
              <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mt-0.5 text-green-600 flex-shrink-0" />
              <span>Take clear photos of vehicle before pickup</span>
            </li>
            <li className="flex items-start gap-1.5 sm:gap-2">
              <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mt-0.5 text-green-600 flex-shrink-0" />
              <span>Capture odometer reading</span>
            </li>
            <li className="flex items-start gap-1.5 sm:gap-2">
              <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mt-0.5 text-green-600 flex-shrink-0" />
              <span>Document any existing damage</span>
            </li>
            <li className="flex items-start gap-1.5 sm:gap-2">
              <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mt-0.5 text-green-600 flex-shrink-0" />
              <span>Photo of customer ID/signature</span>
            </li>
            <li className="flex items-start gap-1.5 sm:gap-2">
              <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mt-0.5 text-green-600 flex-shrink-0" />
              <span>Repeat process during delivery</span>
            </li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}
