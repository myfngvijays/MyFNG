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
        .in('status', ['ACCEPTED', 'ASSIGNED_TO_WORKSHOP', 'IN_PROGRESS'])
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

      const inTransitCount = allTasks?.filter(t => t.status === 'IN_PROGRESS').length || 0;

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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-text-heading">Pickup & Delivery Dashboard</h1>
          <p className="text-text-body mt-2">Manage your pickup and delivery tasks</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <div key={index} className="card">
              <div className="flex items-center gap-3">
                <div className={stat.color}>{stat.icon}</div>
                <div>
                  <p className="text-sm text-text-body">{stat.label}</p>
                  <p className="text-2xl font-bold text-text-heading">{stat.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Tasks */}
        <div className="card">
          <h2 className="text-xl font-semibold text-text-heading mb-4">Active Tasks</h2>
          {tasks.length > 0 ? (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <p className="font-semibold text-text-heading text-lg">{task.lead_number}</p>
                      <p className="text-sm text-text-body">{task.customer_name} - {task.vehicle_number}</p>
                      <div className="mt-2 space-y-1">
                        {task.pickup_address && (
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            Pickup: {task.pickup_address}
                          </p>
                        )}
                        {task.address && (
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            Address: {task.address}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ml-4 ${
                      task.status === 'IN_PROGRESS' ? 'bg-green-100 text-green-700' : 
                      task.status === 'ACCEPTED' ? 'bg-blue-100 text-blue-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={async () => {
                        // Open Google Maps
                        if (task.customer_lat && task.customer_lng) {
                          window.open(`https://maps.google.com/?q=${task.customer_lat},${task.customer_lng}`, '_blank');
                        }
                        
                        // Update lead status to ON_THE_WAY
                        try {
                          const response = await fetch(`/api/pickup/${task.id}/navigate`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              latitude: task.customer_lat,
                              longitude: task.customer_lng
                            })
                          });
                          
                          if (response.ok) {
                            toast.success('Status updated to ON_THE_WAY');
                            fetchPickupData(); // Refresh tasks
                          } else {
                            const data = await response.json();
                            console.error('Failed to update status:', data.error);
                          }
                        } catch (error) {
                          console.error('Error updating status:', error);
                        }
                      }}
                      className="btn btn-outline text-sm flex-1"
                      disabled={!task.customer_lat || !task.customer_lng}
                    >
                      <MapPin className="w-4 h-4" />
                      Navigate
                    </button>
                    <button 
                      onClick={() => window.location.href = `/dashboard/workshop_pickup_boy/tasks/${task.id}`}
                      className="btn btn-primary text-sm flex-1"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No active tasks</p>
          )}
        </div>

        {/* Photo Upload Guide */}
        <div className="card bg-blue-50 border-l-4 border-brand-primary">
          <h3 className="font-semibold text-text-heading mb-3 flex items-center gap-2">
            <Camera className="w-5 h-5 text-brand-primary" />
            Photo Guidelines
          </h3>
          <ul className="text-sm text-gray-700 space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 text-green-600" />
              <span>Take clear photos of vehicle before pickup</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 text-green-600" />
              <span>Capture odometer reading</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 text-green-600" />
              <span>Document any existing damage</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 text-green-600" />
              <span>Photo of customer ID/signature</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 text-green-600" />
              <span>Repeat process during delivery</span>
            </li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}
