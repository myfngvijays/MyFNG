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
          'IN_PROGRESS',
          // Delivery-ready states (after billing/payment)
          'READY_FOR_DELIVERY',
          'COD_PENDING',
          'DELIVERED_TO_CUSTOMER'
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
        t.status === 'COMPLETED' || t.status === 'READY_FOR_DELIVERY' || t.status === 'DELIVERED_TO_CUSTOMER'
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
        (t.status === 'DELIVERED_TO_CUSTOMER' || t.status === 'DELIVERED' || t.status === 'CLOSED') && 
        (t.delivered_at || t.completed_at) &&
        new Date(t.delivered_at || t.completed_at) >= today
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

        {/* Active Tasks Table */}
        <div className="card">
          <h2 className="text-lg sm:text-xl font-semibold text-text-heading mb-3 sm:mb-4">Active Tasks</h2>
          {tasks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead #</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tasks.map((task) => {
                    const getStatusColor = () => {
                      if (task.status === 'IN_PROGRESS') return 'bg-green-100 text-green-700';
                      if (task.status === 'ACCEPTED') return 'bg-blue-100 text-blue-700';
                      return 'bg-yellow-100 text-yellow-700';
                    };

                    const handleNavigate = async () => {
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
                          const isDeliveryReady = task.status === 'READY_FOR_DELIVERY' || task.status === 'COD_PENDING';
                          const response = await fetch(isDeliveryReady ? `/api/pickup/tasks/${task.id}/drop/start` : `/api/pickup/${task.id}/navigate`, {
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
                            toast.success(data.message || (isDeliveryReady ? 'Delivery started' : 'Status updated to ON_THE_WAY'));
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
                    };

                    return (
                      <tr key={task.id} className="hover:bg-gray-50">
                        {/* Lead # */}
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <span className="text-xs sm:text-sm font-medium text-gray-900">#{task.lead_number}</span>
                        </td>

                        {/* Customer */}
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[150px]">
                            {task.customer_name || 'N/A'}
                          </div>
                        </td>

                        {/* Vehicle */}
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="text-xs sm:text-sm text-gray-900 truncate max-w-[120px]">
                            {task.vehicle_number || 'N/A'}
                          </div>
                        </td>

                        {/* Address */}
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="flex items-start gap-1">
                            <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                              {task.pickup_address && (
                                <div className="text-[10px] sm:text-xs text-gray-600 truncate max-w-[150px]">
                                  Pickup: {task.pickup_address}
                                </div>
                              )}
                              {task.address && (
                                <div className="text-[10px] sm:text-xs text-gray-600 truncate max-w-[150px]">
                                  {task.pickup_address ? task.address : `Address: ${task.address}`}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold ${getStatusColor()}`}>
                            {task.status.replace(/_/g, ' ')}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="flex flex-col gap-1">
                            <button 
                              onClick={handleNavigate}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded font-medium transition-colors flex items-center justify-center gap-1"
                            >
                              <Navigation className="w-3 h-3" />
                      Navigate
                    </button>
                    <button 
                      onClick={() => window.location.href = `/dashboard/workshop_pickup_boy/tasks/${task.id}`}
                              className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded font-medium transition-colors"
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
